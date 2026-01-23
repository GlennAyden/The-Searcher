"""
Alpha Hunter Stage 2 - Volume Price Analysis (VPA).

Analyzes watchlist tickers using the existing price-volume engine:
- Volume spike strength
- Sideways compression before spike
- Flow impact vs market cap
- Pullback health after spike
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import statistics

from db.alpha_hunter_repository import AlphaHunterRepository
from db.price_volume_repository import price_volume_repo


class AlphaHunterStage2VPA:
    def __init__(self):
        self.watchlist_repo = AlphaHunterRepository()

    def analyze_watchlist(
        self,
        ticker: str,
        lookback_days: int = 20,
        pre_spike_days: int = 15,
        post_spike_days: int = 10,
        min_ratio: float = 2.0,
        persist_tracking: bool = False
    ) -> Dict[str, Any]:
        ticker = ticker.upper()
        watchlist_item = self.watchlist_repo.get_watchlist_item(ticker)
        if not watchlist_item:
            return {"error": f"{ticker} not found in watchlist"}

        spike_candidate, spike_source = self._resolve_spike_candidate(
            ticker, watchlist_item, lookback_days, min_ratio
        )
        if not spike_candidate:
            return {"error": f"No price-volume data available for {ticker}"}

        spike_dt = datetime.strptime(spike_candidate, "%Y-%m-%d")
        start_date = (spike_dt - timedelta(days=lookback_days + pre_spike_days + 5)).strftime("%Y-%m-%d")
        end_date = (spike_dt + timedelta(days=post_spike_days + 2)).strftime("%Y-%m-%d")

        records = price_volume_repo.get_ohlcv_data(ticker, start_date=start_date, end_date=end_date)
        if not records:
            return {"error": f"No OHLCV data found for {ticker}"}

        spike_record, resolved_spike_date = self._resolve_spike_record(records, spike_candidate)
        if not spike_record:
            return {"error": f"Spike date not found for {ticker}"}

        spike_index = next(
            (i for i, row in enumerate(records) if row["time"] == resolved_spike_date),
            None
        )
        if spike_index is None:
            return {"error": f"Spike date not found in OHLCV data for {ticker}"}

        prev_day = records[spike_index - 1] if spike_index > 0 else None
        volume_ratio, volume_category, volume_score = self._calculate_volume_metrics(
            records[:spike_index], spike_record["volume"], lookback_days
        )
        volume_change_pct = self._pct_change(spike_record["volume"], prev_day["volume"] if prev_day else None)
        price_change_pct = self._pct_change(spike_record["close"], spike_record["open"])

        trend_status = self._classify_spike_trend(price_change_pct, volume_change_pct)

        compression = self._calculate_compression(records[:spike_index], pre_spike_days)
        flow_impact = price_volume_repo.calculate_flow_impact(ticker, resolved_spike_date)

        anomaly_score = volume_score + compression["compression_score"] + flow_impact.get("flow_score", 0)
        signal_level = self._signal_level(anomaly_score)

        pullback = self._calculate_pullback(records, spike_index, post_spike_days)
        health_score = pullback["health_score"]

        stage2_score = round(anomaly_score * 0.6 + health_score * 0.4)
        verdict = self._stage2_verdict(anomaly_score, health_score, pullback["distribution_days"])

        if persist_tracking and pullback["log"]:
            for entry in pullback["log"]:
                self.watchlist_repo.save_tracking_snapshot(
                    ticker,
                    entry["date"],
                    {
                        "price": entry["price"],
                        "price_change_pct": entry["price_chg"],
                        "volume": entry["volume"],
                        "volume_change_pct": entry["vol_chg"],
                        "health_status": entry["status"],
                        "health_score": health_score,
                        "meta_data": {
                            "stage2_score": stage2_score,
                            "spike_date": resolved_spike_date
                        }
                    }
                )

        return {
            "ticker": ticker,
            "watchlist": {
                "spike_date": watchlist_item.get("spike_date"),
                "initial_score": watchlist_item.get("initial_score"),
                "current_stage": watchlist_item.get("current_stage"),
                "detect_info": watchlist_item.get("detect_info", {})
            },
            "spike": {
                "requested_date": spike_candidate,
                "date": resolved_spike_date,
                "source": spike_source,
                "price_change_pct": price_change_pct,
                "volume_ratio": volume_ratio,
                "volume_category": volume_category,
                "volume_change_pct": volume_change_pct,
                "trend_status": trend_status
            },
            "compression": compression,
            "flow_impact": flow_impact,
            "scores": {
                "volume_score": volume_score,
                "compression_score": compression["compression_score"],
                "flow_score": flow_impact.get("flow_score", 0),
                "anomaly_score": anomaly_score,
                "signal_level": signal_level,
                "pullback_health_score": health_score,
                "stage2_score": stage2_score
            },
            "pullback": {
                "days_tracked": pullback["days_tracked"],
                "distribution_days": pullback["distribution_days"],
                "healthy_days": pullback["healthy_days"],
                "log": pullback["log"]
            },
            "verdict": verdict
        }

    def _resolve_spike_candidate(
        self,
        ticker: str,
        watchlist_item: Dict[str, Any],
        lookback_days: int,
        min_ratio: float
    ) -> Tuple[Optional[str], str]:
        detect_info = watchlist_item.get("detect_info") or {}
        candidate = detect_info.get("spike_date")
        if candidate:
            return candidate, "watchlist_detected"

        markers = price_volume_repo.get_volume_spike_markers(
            ticker,
            lookback_days=lookback_days,
            min_ratio=min_ratio
        )
        if markers:
            return markers[-1]["time"], "auto_detected"

        candidate = watchlist_item.get("spike_date")
        if candidate:
            return candidate, "watchlist"

        latest_date = price_volume_repo.get_latest_date(ticker)
        if latest_date:
            return latest_date, "latest_trade_date"

        return None, "no_data"

    def _resolve_spike_record(
        self,
        records: List[Dict[str, Any]],
        target_date: str
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        for record in records:
            if record["time"] == target_date:
                return record, target_date

        fallback = None
        for record in records:
            if record["time"] <= target_date:
                fallback = record

        if fallback:
            return fallback, fallback["time"]

        return None, None

    def _calculate_volume_metrics(
        self,
        prior_records: List[Dict[str, Any]],
        spike_volume: float,
        lookback_days: int
    ) -> Tuple[Optional[float], str, int]:
        if len(prior_records) < 10:
            return None, "insufficient_data", 0

        recent_prior = prior_records[-lookback_days:]
        volumes = [row["volume"] for row in recent_prior if row["volume"] is not None]
        if len(volumes) < 10:
            return None, "insufficient_data", 0

        median_volume = statistics.median(volumes)
        if median_volume <= 0:
            return None, "invalid_baseline", 0

        ratio = round(spike_volume / median_volume, 2)
        if ratio >= 5:
            category = "extreme"
        elif ratio >= 3:
            category = "high"
        elif ratio >= 2:
            category = "elevated"
        else:
            category = "normal"

        volume_score = self._volume_score(ratio)
        return ratio, category, volume_score

    def _calculate_compression(
        self,
        prior_records: List[Dict[str, Any]],
        days: int
    ) -> Dict[str, Any]:
        if len(prior_records) < max(days, 5):
            return {
                "is_sideways": False,
                "compression_score": 0,
                "sideways_days": 0,
                "volatility_pct": 999.0,
                "price_range_pct": 999.0,
                "avg_close": 0
            }

        window = prior_records[-days:]
        closes = [row["close"] for row in window]
        highs = [row["high"] for row in window]
        lows = [row["low"] for row in window]

        mean_close = statistics.mean(closes)
        std_close = statistics.stdev(closes) if len(closes) > 1 else 0
        cv = (std_close / mean_close * 100) if mean_close > 0 else 999.0

        overall_high = max(highs)
        overall_low = min(lows)
        price_range_pct = ((overall_high - overall_low) / mean_close * 100) if mean_close > 0 else 999.0

        if cv < 2.0:
            score = 30
            sideways_days = days
            is_sideways = True
        elif cv < 3.0:
            score = 25
            sideways_days = days
            is_sideways = True
        elif cv < 4.0:
            score = 20
            sideways_days = max(days - 3, 5)
            is_sideways = True
        elif cv < 5.0:
            score = 10
            sideways_days = max(days - 5, 3)
            is_sideways = True
        else:
            score = 0
            sideways_days = 0
            is_sideways = False

        return {
            "is_sideways": is_sideways,
            "compression_score": score,
            "sideways_days": sideways_days,
            "volatility_pct": round(cv, 2),
            "price_range_pct": round(price_range_pct, 2),
            "avg_close": round(mean_close, 2)
        }

    def _calculate_pullback(
        self,
        records: List[Dict[str, Any]],
        spike_index: int,
        post_spike_days: int
    ) -> Dict[str, Any]:
        log = []
        health_score = 100
        healthy_days = 0
        distribution_days = 0

        end_index = min(spike_index + 1 + post_spike_days, len(records))
        for i in range(spike_index + 1, end_index):
            prev = records[i - 1]
            curr = records[i]

            price_chg = self._pct_change(curr["close"], prev["close"])
            vol_chg = self._pct_change(curr["volume"], prev["volume"])

            status, penalty = self._classify_pullback_day(price_chg, vol_chg)
            if status == "HEALTHY":
                healthy_days += 1
            if status == "DANGER":
                distribution_days += 1

            health_score = max(0, health_score - penalty)
            log.append({
                "date": curr["time"],
                "price": curr["close"],
                "volume": curr["volume"],
                "price_chg": price_chg,
                "vol_chg": vol_chg,
                "status": status
            })

        return {
            "days_tracked": len(log),
            "health_score": health_score,
            "healthy_days": healthy_days,
            "distribution_days": distribution_days,
            "log": log
        }

    def _classify_pullback_day(self, price_chg: float, vol_chg: float) -> Tuple[str, int]:
        if price_chg < 0:
            if vol_chg < -20:
                return "HEALTHY", 0
            if vol_chg < 0:
                return "OK", 5
            return "DANGER", 25

        if price_chg > 0:
            if vol_chg > 0:
                return "STRONG", 0
            return "WEAK_BOUNCE", 5

        return "NEUTRAL", 0

    def _classify_spike_trend(self, price_chg: float, vol_chg: float) -> str:
        if price_chg > 0 and vol_chg > 0:
            return "VALID_UPTREND"
        if price_chg < 0 and vol_chg > 0:
            return "DISTRIBUTION_RISK"
        if price_chg < 0 and vol_chg <= 0:
            return "HEALTHY_PULLBACK"
        if price_chg >= 0 and vol_chg <= 0:
            return "WEAK_UP"
        return "NEUTRAL"

    def _stage2_verdict(self, anomaly_score: int, health_score: int, distribution_days: int) -> str:
        if anomaly_score >= 60 and health_score >= 70 and distribution_days == 0:
            return "PASS"
        if anomaly_score >= 40 and health_score >= 50:
            return "WATCH"
        return "FAIL"

    def _volume_score(self, ratio: float) -> int:
        if ratio >= 5.0:
            return 40
        if ratio >= 3.0:
            return 35
        if ratio >= 2.5:
            return 30
        if ratio >= 2.0:
            return 25
        if ratio >= 1.5:
            return 15
        return 0

    def _signal_level(self, total_score: int) -> str:
        if total_score >= 80:
            return "FIRE"
        if total_score >= 60:
            return "HOT"
        if total_score >= 40:
            return "WARM"
        return "COLD"

    def _pct_change(self, current: Optional[float], previous: Optional[float]) -> float:
        if previous in (None, 0):
            return 0.0
        return round((current - previous) / previous * 100, 2)
