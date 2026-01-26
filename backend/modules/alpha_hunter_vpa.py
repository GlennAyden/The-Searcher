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
import logging

from db.alpha_hunter_repository import AlphaHunterRepository
from db.price_volume_repository import price_volume_repo
from db.neobdm_repository import NeoBDMRepository
from modules.alpha_hunter_flow import AlphaHunterFlow

logger = logging.getLogger(__name__)


class AlphaHunterStage2VPA:
    def __init__(self):
        self.watchlist_repo = AlphaHunterRepository()
        self.neobdm_repo = NeoBDMRepository()
        self.flow_analyzer = AlphaHunterFlow()

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
            watchlist_item = {
                "ticker": ticker,
                "spike_date": None,
                "initial_score": 0,
                "current_stage": 0,
                "detect_info": {}
            }

        spike_candidate, spike_source = self._resolve_spike_candidate(
            ticker, watchlist_item, lookback_days, min_ratio
        )
        if not spike_candidate:
            return {"error": f"No price-volume data available for {ticker}"}

        spike_dt = datetime.strptime(spike_candidate, "%Y-%m-%d")
        start_date = (spike_dt - timedelta(days=lookback_days + pre_spike_days + 5)).strftime("%Y-%m-%d")
        end_date = (spike_dt + timedelta(days=post_spike_days + 2)).strftime("%Y-%m-%d")

        records = price_volume_repo.get_ohlcv_data(ticker, start_date=start_date, end_date=end_date)
        
        # Auto-fetch from yfinance if no data available
        if not records:
            logger.info(f"No OHLCV data for {ticker}, auto-fetching from yfinance...")
            try:
                import yfinance as yf
                yf_ticker = f"{ticker}.JK"
                stock = yf.Ticker(yf_ticker)
                
                # Fetch 9 months of data to cover analysis needs
                fetch_start = (datetime.now() - timedelta(days=270)).strftime('%Y-%m-%d')
                fetch_end = datetime.now().strftime('%Y-%m-%d')
                
                df = stock.history(start=fetch_start, end=fetch_end)
                
                if not df.empty:
                    new_records = []
                    for date_idx, row in df.iterrows():
                        new_records.append({
                            'time': date_idx.strftime('%Y-%m-%d'),
                            'open': float(row['Open']),
                            'high': float(row['High']),
                            'low': float(row['Low']),
                            'close': float(row['Close']),
                            'volume': int(row['Volume'])
                        })
                    
                    records_added = price_volume_repo.upsert_ohlcv_data(ticker, new_records)
                    logger.info(f"Fetched and stored {records_added} OHLCV records for {ticker}")
                    
                    # Re-fetch from database
                    records = price_volume_repo.get_ohlcv_data(ticker, start_date=start_date, end_date=end_date)
                else:
                    logger.warning(f"No data returned from yfinance for {yf_ticker}")
            except Exception as e:
                logger.error(f"Error fetching from yfinance for {ticker}: {e}")
        
        if not records:
            return {"error": f"No OHLCV data found for {ticker}. Unable to fetch from yfinance."}

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
        
        # NEW: HK Method - Volume Asymmetry (Bandar masih pegang?)
        volume_asymmetry = self._calculate_volume_asymmetry(pullback["log"])
        
        # NEW: HK Method - Dynamic Lookback & Pre-Spike Accumulation
        accumulation_start, detection_method = self._detect_accumulation_start(records, spike_index)
        accumulation = self._analyze_pre_spike_accumulation(records, accumulation_start, spike_index)
        accumulation["detection_method"] = detection_method
        
        # NEW: Breakout Setup Detection (Resistance & Entry Point)
        breakout_setup = self._detect_breakout_setup(records, spike_index, post_spike_days)
        
        # NEW: Big Player Analysis (broker accumulation, floor price, inventory)
        accumulation_start_date = accumulation.get("period_start")
        big_player_analysis = self.analyze_big_player(
            ticker,
            accumulation_start=accumulation_start_date,
            spike_date=resolved_spike_date,
            days=lookback_days + pre_spike_days
        )
        
        # Update health score with volume asymmetry bonus/penalty
        adjusted_health_score = max(0, min(100, health_score + volume_asymmetry["score_bonus"]))

        stage2_score = round(anomaly_score * 0.6 + adjusted_health_score * 0.4)
        verdict = self._stage2_verdict(anomaly_score, adjusted_health_score, pullback["distribution_days"])

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
            "accumulation": accumulation,
            "breakout_setup": breakout_setup,
            "big_player_analysis": big_player_analysis,
            "scores": {
                "volume_score": volume_score,
                "compression_score": compression["compression_score"],
                "flow_score": flow_impact.get("flow_score", 0),
                "anomaly_score": anomaly_score,
                "signal_level": signal_level,
                "pullback_health_score": health_score,
                "adjusted_health_score": adjusted_health_score,
                "asymmetry_bonus": volume_asymmetry["score_bonus"],
                "stage2_score": stage2_score
            },
            "pullback": {
                "days_tracked": pullback["days_tracked"],
                "distribution_days": pullback["distribution_days"],
                "healthy_days": pullback["healthy_days"],
                "volume_asymmetry": volume_asymmetry,
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

    def _calculate_volume_asymmetry(self, pullback_log: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        HK Method: Compare total volume on UP days vs DOWN days.
        
        Logic: If vol UP = 100M, vol DOWN = 10M, ratio 10:1 = Bandar still holding
        because it's impossible to distribute 100M with only 10M volume.
        """
        if not pullback_log:
            return {
                "volume_up_total": 0,
                "volume_down_total": 0,
                "asymmetry_ratio": 0,
                "verdict": "NO_DATA",
                "score_bonus": 0
            }
        
        volume_up = sum(day['volume'] for day in pullback_log if day.get('price_chg', 0) > 0)
        volume_down = sum(day['volume'] for day in pullback_log if day.get('price_chg', 0) < 0)
        
        if volume_down > 0:
            ratio = round(volume_up / volume_down, 2)
        else:
            ratio = 999.0 if volume_up > 0 else 0
        
        # Determine verdict and score bonus
        if ratio >= 5:
            verdict = "STRONG_HOLDING"
            score_bonus = 20
        elif ratio >= 3:
            verdict = "HOLDING"
            score_bonus = 10
        elif ratio >= 1:
            verdict = "NEUTRAL"
            score_bonus = 0
        else:
            verdict = "DISTRIBUTING"
            score_bonus = -30
        
        return {
            "volume_up_total": volume_up,
            "volume_down_total": volume_down,
            "asymmetry_ratio": ratio,
            "verdict": verdict,
            "score_bonus": score_bonus
        }

    def _detect_accumulation_start(
        self,
        records: List[Dict[str, Any]],
        spike_index: int,
        max_lookback: int = 60
    ) -> Tuple[int, str]:
        """
        Dynamic lookback: Auto-detect start of accumulation period.
        
        Logic:
        1. Search backward from spike date
        2. Find where: (a) previous volume spike occurs, OR (b) sideways compression starts
        3. Return start index and detection method
        """
        if spike_index < 5:
            return 0, "insufficient_data"
        
        # Calculate median volume for baseline
        lookback_end = max(0, spike_index - 5)
        lookback_start = max(0, spike_index - max_lookback)
        
        if lookback_end - lookback_start < 10:
            return lookback_start, "short_history"
        
        baseline_volumes = [r['volume'] for r in records[lookback_start:lookback_end]]
        median_volume = statistics.median(baseline_volumes) if baseline_volumes else 0
        
        # Search backward for accumulation start
        accumulation_start = lookback_start
        detection_method = "max_lookback"
        
        for i in range(spike_index - 5, lookback_start, -1):
            # Check for previous volume spike (potential start of move)
            if median_volume > 0 and records[i]['volume'] > median_volume * 2.5:
                accumulation_start = i
                detection_method = "previous_spike"
                break
            
            # Check for volatility change (entering sideways)
            if i > lookback_start + 10:
                window = [r['close'] for r in records[i-10:i]]
                if len(window) >= 10:
                    mean_close = statistics.mean(window)
                    std_close = statistics.stdev(window) if len(window) > 1 else 0
                    cv = (std_close / mean_close * 100) if mean_close > 0 else 999
                    
                    # If volatility suddenly increases (leaving sideways zone)
                    if cv > 6:
                        accumulation_start = i
                        detection_method = "volatility_change"
                        break
        
        return accumulation_start, detection_method

    def _analyze_pre_spike_accumulation(
        self,
        records: List[Dict[str, Any]],
        start_index: int,
        spike_index: int
    ) -> Dict[str, Any]:
        """
        Analyze accumulation BEFORE spike (HK Method: "Isi Perut" analysis).
        
        Returns:
        - Period start/end dates
        - Total volume accumulated
        - Average daily volume (compare with baseline)
        - Volume trend: increasing, stable, or decreasing
        """
        if start_index >= spike_index or spike_index >= len(records):
            return {
                "period_start": None,
                "period_end": None,
                "accumulation_days": 0,
                "total_volume": 0,
                "avg_daily_volume": 0,
                "volume_trend": "NO_DATA",
                "up_days": 0,
                "down_days": 0,
                "net_movement_pct": 0
            }
        
        accumulation_records = records[start_index:spike_index]
        accumulation_days = len(accumulation_records)
        
        if accumulation_days < 3:
            return {
                "period_start": records[start_index]['time'] if start_index < len(records) else None,
                "period_end": records[spike_index - 1]['time'] if spike_index > 0 else None,
                "accumulation_days": accumulation_days,
                "total_volume": 0,
                "avg_daily_volume": 0,
                "volume_trend": "INSUFFICIENT_DATA",
                "up_days": 0,
                "down_days": 0,
                "net_movement_pct": 0
            }
        
        total_volume = sum(r['volume'] for r in accumulation_records)
        avg_daily_volume = total_volume / accumulation_days if accumulation_days > 0 else 0
        
        # Count up/down days
        up_days = 0
        down_days = 0
        for i in range(1, len(accumulation_records)):
            if accumulation_records[i]['close'] > accumulation_records[i-1]['close']:
                up_days += 1
            elif accumulation_records[i]['close'] < accumulation_records[i-1]['close']:
                down_days += 1
        
        # Calculate net price movement
        start_price = accumulation_records[0]['close']
        end_price = accumulation_records[-1]['close']
        net_movement_pct = ((end_price - start_price) / start_price * 100) if start_price > 0 else 0
        
        # Determine volume trend (first half vs second half)
        half = accumulation_days // 2
        first_half_vol = sum(r['volume'] for r in accumulation_records[:half]) / half if half > 0 else 0
        second_half_vol = sum(r['volume'] for r in accumulation_records[half:]) / (accumulation_days - half) if (accumulation_days - half) > 0 else 0
        
        if second_half_vol > first_half_vol * 1.3:
            volume_trend = "INCREASING"
        elif second_half_vol < first_half_vol * 0.7:
            volume_trend = "DECREASING"
        else:
            volume_trend = "STABLE"
        
        return {
            "period_start": accumulation_records[0]['time'],
            "period_end": accumulation_records[-1]['time'],
            "accumulation_days": accumulation_days,
            "total_volume": total_volume,
            "avg_daily_volume": round(avg_daily_volume),
            "volume_trend": volume_trend,
            "up_days": up_days,
            "down_days": down_days,
            "net_movement_pct": round(net_movement_pct, 2)
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

    def _detect_breakout_setup(
        self, 
        records: List[Dict], 
        spike_index: int,
        post_spike_days: int = 10
    ) -> Dict[str, Any]:
        """
        Detect breakout setup after spike.
        
        Strategy: After spike, track pullback and identify resistance level.
        Entry when price breaks above post-spike resistance with volume confirmation.
        
        Args:
            records: List of OHLCV records
            spike_index: Index of the volume spike day
            post_spike_days: Days to look after spike for resistance
            
        Returns:
            Dictionary with resistance level, current price, distance, and status
        """
        if spike_index >= len(records) - 1:
            return {
                "resistance_price": None,
                "current_price": None,
                "distance_pct": None,
                "status": "NO_DATA",
                "is_breakout": False,
                "breakout_info": None
            }
        
        # Get post-spike records (from spike day to either end of data or post_spike_days)
        end_index = min(spike_index + post_spike_days + 1, len(records))
        post_spike_records = records[spike_index:end_index]
        
        if len(post_spike_records) < 2:
            return {
                "resistance_price": None,
                "current_price": None,
                "distance_pct": None,
                "status": "NO_DATA",
                "is_breakout": False,
                "breakout_info": None
            }
        
        # Find resistance: highest high after spike (including spike day)
        resistance_price = max(r['high'] for r in post_spike_records)
        resistance_date = next(r['time'] for r in post_spike_records if r['high'] == resistance_price)
        
        # Current price is the last record in our data
        current_record = records[-1]
        current_price = current_record['close']
        current_date = current_record['time']
        
        # Calculate distance to resistance
        if resistance_price > 0:
            distance_pct = round(((resistance_price - current_price) / current_price) * 100, 2)
        else:
            distance_pct = 0
        
        # Determine status
        is_breakout = current_price > resistance_price
        
        if is_breakout:
            # Check breakout quality (volume confirmation)
            breakout_volume = current_record['volume']
            # Get average volume from post-spike period (excluding spike day)
            avg_volume = sum(r['volume'] for r in post_spike_records[1:]) / max(1, len(post_spike_records) - 1)
            volume_ratio = breakout_volume / avg_volume if avg_volume > 0 else 0
            
            breakout_info = {
                "break_price": current_price,
                "break_date": current_date,
                "volume": breakout_volume,
                "volume_ratio": round(volume_ratio, 2),
                "quality": "STRONG" if volume_ratio >= 2 else "MODERATE" if volume_ratio >= 1.5 else "WEAK"
            }
            status = "ENTRY"
        else:
            breakout_info = None
            # How close to breakout?
            if distance_pct <= 3:
                status = "NEAR_BREAKOUT"
            elif distance_pct <= 10:
                status = "WAITING"
            else:
                status = "FAR"
        
        return {
            "resistance_price": round(resistance_price, 2),
            "resistance_date": resistance_date,
            "current_price": round(current_price, 2),
            "current_date": current_date,
            "distance_pct": distance_pct,
            "status": status,
            "is_breakout": is_breakout,
            "breakout_info": breakout_info
        }

    def _analyze_big_player_activity(
        self,
        ticker: str,
        accumulation_start: str,
        spike_date: str
    ) -> Dict[str, Any]:
        """
        Analyze broker activity during accumulation period using existing engines.
        
        Uses:
        - neobdm_repository.get_available_dates_for_ticker() to check data availability
        - neobdm_repository.get_top_holders_by_net_lot() for top accumulators
        - neobdm_repository.get_broker_journey() for detailed broker activity
        
        Returns:
            Dict with data_status, missing_dates, and top_accumulators
        """
        # Check available broker summary dates for this ticker
        available_dates = self.neobdm_repo.get_available_dates_for_ticker(ticker)
        
        if not available_dates:
            return {
                "data_status": "needs_broker_data",
                "missing_dates": [accumulation_start, spike_date],
                "message": f"No broker summary data available for {ticker}. Please scrape broker data first.",
                "top_accumulators": [],
                "accumulation_period": {
                    "start": accumulation_start,
                    "end": spike_date
                }
            }
        
        # Check which dates in our range are missing
        try:
            start_dt = datetime.strptime(accumulation_start, "%Y-%m-%d")
            end_dt = datetime.strptime(spike_date, "%Y-%m-%d")
        except ValueError:
            return {
                "data_status": "error",
                "message": "Invalid date format",
                "top_accumulators": []
            }
        
        available_set = set(available_dates)
        missing_dates = []
        
        # Check each trading day in range (approximate, skip weekends)
        current = start_dt
        while current <= end_dt:
            if current.weekday() < 5:  # Mon-Fri
                date_str = current.strftime("%Y-%m-%d")
                if date_str not in available_set:
                    missing_dates.append(date_str)
            current += timedelta(days=1)
        
        # Determine data status
        total_expected = sum(1 for d in range((end_dt - start_dt).days + 1) 
                            if (start_dt + timedelta(days=d)).weekday() < 5)
        coverage_pct = ((total_expected - len(missing_dates)) / total_expected * 100) if total_expected > 0 else 0
        
        if len(missing_dates) == 0:
            data_status = "ready"
        elif coverage_pct >= 70:
            data_status = "partial"
        else:
            data_status = "needs_broker_data"
        
        # Get top accumulators during this period
        top_holders = self.neobdm_repo.get_top_holders_by_net_lot(ticker, limit=5)
        
        # Format top accumulators
        top_accumulators = []
        for holder in top_holders:
            top_accumulators.append({
                "broker_code": holder.get("broker_code", ""),
                "total_net_lot": holder.get("total_net_lot", 0),
                "total_net_value": holder.get("total_net_value", 0),
                "trade_count": holder.get("trade_count", 0),
                "first_date": holder.get("first_date", ""),
                "last_date": holder.get("last_date", "")
            })
        
        return {
            "data_status": data_status,
            "missing_dates": missing_dates[:10],  # Limit to first 10 for display
            "total_missing": len(missing_dates),
            "coverage_pct": round(coverage_pct, 1),
            "top_accumulators": top_accumulators,
            "accumulation_period": {
                "start": accumulation_start,
                "end": spike_date
            }
        }

    def _get_big_player_floor_price(
        self,
        ticker: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get floor price estimate based on institutional broker buy prices.
        
        Uses: neobdm_repository.get_floor_price_analysis()
        
        Returns:
            Dict with floor_price, confidence, and gap analysis
        """
        floor_analysis = self.neobdm_repo.get_floor_price_analysis(ticker, days=days)
        
        if not floor_analysis or floor_analysis.get("confidence") == "NO_DATA":
            return {
                "data_status": "no_data",
                "price": 0,
                "confidence": "NO_DATA",
                "institutional_buy_value": 0,
                "gap_to_current_pct": 0,
                "message": "No floor price data available. Need broker summary data."
            }
        
        floor_price = floor_analysis.get("floor_price", 0)
        
        # Get current price from latest OHLCV
        latest_date = price_volume_repo.get_latest_date(ticker)
        current_price = 0
        if latest_date:
            records = price_volume_repo.get_ohlcv_data(ticker, start_date=latest_date, end_date=latest_date)
            if records:
                current_price = records[-1].get("close", 0)
        
        # Calculate gap
        gap_pct = 0
        if floor_price > 0 and current_price > 0:
            gap_pct = ((current_price - floor_price) / floor_price) * 100
        
        return {
            "data_status": "ready" if floor_price > 0 else "no_data",
            "price": round(floor_price, 0),
            "current_price": round(current_price, 0),
            "confidence": floor_analysis.get("confidence", "UNKNOWN"),
            "institutional_buy_value": floor_analysis.get("institutional_buy_value", 0),
            "institutional_buy_lot": floor_analysis.get("institutional_buy_lot", 0),
            "gap_to_current_pct": round(gap_pct, 2),
            "days_analyzed": floor_analysis.get("days_analyzed", 0),
            "top_institutional": floor_analysis.get("institutional_brokers", [])[:5]
        }

    def _calculate_inventory_balance(
        self,
        ticker: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Calculate big player inventory balance using smart money flow analysis.
        
        Uses: alpha_hunter_flow.analyze_smart_money_flow()
        
        Returns:
            Dict with accumulated vs distributed lot counts
        """
        flow_result = self.flow_analyzer.analyze_smart_money_flow(ticker, days=days)
        
        if not flow_result.get("data_available"):
            return {
                "data_status": "no_data",
                "accumulated_lot": 0,
                "distributed_lot": 0,
                "current_holding": 0,
                "distribution_pct": 0,
                "status": "NO_DATA",
                "message": "No broker data available for inventory analysis"
            }
        
        smart_net_lot = flow_result.get("smart_money_accumulation", {}).get("net_lot", 0)
        retail_net_lot = flow_result.get("retail_capitulation", {}).get("net_lot", 0)
        
        # Smart money net positive = accumulating
        # Smart money net negative = distributing
        if smart_net_lot > 0:
            accumulated_lot = smart_net_lot
            distributed_lot = 0
            status = "HOLDING"
        else:
            accumulated_lot = 0
            distributed_lot = abs(smart_net_lot)
            status = "DISTRIBUTING"
        
        # Check dominance
        dominance_pct = flow_result.get("smart_vs_retail", {}).get("dominance_pct", 0)
        if dominance_pct < 40:
            status = "NEUTRAL"
        
        # Calculate distribution percentage if we have historical accumulation
        total_potential = accumulated_lot + distributed_lot
        distribution_pct = (distributed_lot / total_potential * 100) if total_potential > 0 else 0
        
        return {
            "data_status": "ready",
            "accumulated_lot": accumulated_lot,
            "distributed_lot": distributed_lot,
            "current_holding": smart_net_lot,
            "distribution_pct": round(distribution_pct, 1),
            "status": status,
            "smart_vs_retail": {
                "smart_net_lot": smart_net_lot,
                "retail_net_lot": retail_net_lot,
                "dominance_pct": dominance_pct,
                "conviction": flow_result.get("overall_conviction", "LOW")
            },
            "top_brokers": flow_result.get("smart_money_accumulation", {}).get("top_brokers", [])[:5],
            "days_analyzed": flow_result.get("smart_money_accumulation", {}).get("total_days", 0)
        }

    def analyze_big_player(
        self,
        ticker: str,
        accumulation_start: Optional[str] = None,
        spike_date: Optional[str] = None,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Complete Big Player analysis combining all three components.
        
        This can be called standalone or integrated into analyze_watchlist.
        
        Args:
            ticker: Stock ticker symbol
            accumulation_start: Start of accumulation period (optional)
            spike_date: Spike date (optional)
            days: Lookback days for analysis (default 30)
        
        Returns:
            Dict with big_player_analysis containing all three components
        """
        ticker = ticker.upper()
        
        # Get broker activity if dates provided
        if accumulation_start and spike_date:
            broker_activity = self._analyze_big_player_activity(
                ticker, accumulation_start, spike_date
            )
        else:
            broker_activity = {
                "data_status": "no_dates",
                "message": "Accumulation period dates not provided",
                "top_accumulators": []
            }
        
        # Get floor price analysis
        floor_price = self._get_big_player_floor_price(ticker, days=days)
        
        # Get inventory balance
        inventory = self._calculate_inventory_balance(ticker, days=days)
        
        # Determine overall data status
        statuses = [
            broker_activity.get("data_status", "no_data"),
            floor_price.get("data_status", "no_data"),
            inventory.get("data_status", "no_data")
        ]
        
        if "needs_broker_data" in statuses:
            overall_status = "needs_broker_data"
        elif all(s == "ready" for s in statuses):
            overall_status = "ready"
        elif any(s == "ready" or s == "partial" for s in statuses):
            overall_status = "partial"
        else:
            overall_status = "no_data"
        
        return {
            "data_status": overall_status,
            "missing_dates": broker_activity.get("missing_dates", []),
            "top_accumulators": broker_activity.get("top_accumulators", []),
            "floor_price": floor_price,
            "inventory_balance": inventory
        }

    # ========================================================================
    # STAGE 2 VISUALIZATION SYSTEM
    # ========================================================================

    def get_stage2_visualization_data(
        self,
        ticker: str,
        selling_climax_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate visualization data for Stage 2 VPA.
        
        Args:
            ticker: Stock ticker symbol
            selling_climax_date: Optional override for selling climax date
        
        Returns:
            Dict with price_chart, volume_chart, money_flow_chart, 
            resistance_lines, and recommendation
        """
        ticker = ticker.upper()
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Step 1: Get OHLCV data (fetch if needed)
        records = self._fetch_ohlcv_for_visualization(ticker)
        if not records:
            return {"error": f"No OHLCV data available for {ticker}"}
        
        # Step 2: Detect selling climax
        if selling_climax_date:
            climax_date = selling_climax_date
            climax_info = self._find_climax_info(records, selling_climax_date)
        else:
            climax_date, climax_info = self._detect_selling_climax(records)
        
        if not climax_date:
            # No selling climax found, use earliest spike
            climax_date = records[min(20, len(records)-1)]["time"]
            climax_info = {"date": climax_date, "detected": False}
        
        # Step 3: Calculate date range (7 days before climax → today)
        try:
            climax_dt = datetime.strptime(climax_date, "%Y-%m-%d")
            start_dt = climax_dt - timedelta(days=7)
            start_date = start_dt.strftime("%Y-%m-%d")
        except ValueError:
            start_date = records[0]["time"]
        
        # Step 4: Calculate MAs from FULL records first (need 20+ data points)
        full_ma_data = self._calculate_all_moving_averages(records)
        
        # Step 5: Detect volume spikes from full records (needs MA20 values)
        volume_spikes = self._detect_volume_spikes_with_price(
            records, full_ma_data["volume_ma20"]
        )
        
        # Step 6: Filter records and data to display date range
        filtered_records = [
            r for r in records 
            if start_date <= r["time"] <= today
        ]
        
        if not filtered_records:
            filtered_records = records[-60:]  # Fallback: last 60 days
        
        # Filter spikes to date range
        volume_spikes = [s for s in volume_spikes if start_date <= s["date"] <= today]
        
        # Filter MA data to date range
        ma_data = {
            "price_ma5": [m for m in full_ma_data["price_ma5"] if start_date <= m["date"] <= today],
            "price_ma10": [m for m in full_ma_data["price_ma10"] if start_date <= m["date"] <= today],
            "price_ma20": [m for m in full_ma_data["price_ma20"] if start_date <= m["date"] <= today],
            "volume_ma20": [m for m in full_ma_data["volume_ma20"] if start_date <= m["date"] <= today]
        }
        
        # Step 7: Detect resistance levels
        resistance_lines = self._detect_resistance_levels(
            filtered_records, volume_spikes, today
        )
        
        # Step 8: Get money flow data
        money_flow = self._get_money_flow_chart_data(ticker, start_date, today)
        
        # Step 9: Generate recommendation
        recommendation = self._generate_trading_recommendation(
            filtered_records, volume_spikes, resistance_lines, ma_data
        )
        
        # Build response
        return {
            "ticker": ticker,
            "analysis_period": {
                "start_date": start_date,
                "end_date": today,
                "selling_climax_date": climax_date,
                "selling_climax_detected": climax_info.get("detected", True)
            },
            "price_chart": {
                "ohlcv": [
                    {
                        "date": r["time"],
                        "open": r["open"],
                        "high": r["high"],
                        "low": r["low"],
                        "close": r["close"],
                        "volume": r["volume"]
                    }
                    for r in filtered_records
                ],
                "ma5": ma_data["price_ma5"],
                "ma10": ma_data["price_ma10"],
                "ma20": ma_data["price_ma20"],
                "markers": {
                    "selling_climax": climax_info,
                    "volume_spikes": [
                        s for s in volume_spikes if s.get("price_direction") == "UP"
                    ]
                }
            },
            "volume_chart": {
                "volume": [
                    {"date": r["time"], "value": r["volume"]}
                    for r in filtered_records
                ],
                "ma20": ma_data["volume_ma20"],
                "spikes": volume_spikes
            },
            "money_flow_chart": money_flow,
            "resistance_lines": resistance_lines,
            "recommendation": recommendation
        }

    def _fetch_ohlcv_for_visualization(self, ticker: str) -> List[Dict]:
        """Fetch OHLCV data, auto-fetch from yfinance if not available."""
        # Try to get 6 months of data
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=180)).strftime("%Y-%m-%d")
        
        records = price_volume_repo.get_ohlcv_data(
            ticker, start_date=start_date, end_date=end_date
        )
        
        if not records or len(records) < 30:
            # Auto-fetch from yfinance
            logger.info(f"Fetching OHLCV from yfinance for {ticker}")
            try:
                import yfinance as yf
                stock = yf.Ticker(f"{ticker}.JK")
                df = stock.history(period="6mo")
                
                if not df.empty:
                    new_records = []
                    for date_idx, row in df.iterrows():
                        new_records.append({
                            'time': date_idx.strftime('%Y-%m-%d'),
                            'open': float(row['Open']),
                            'high': float(row['High']),
                            'low': float(row['Low']),
                            'close': float(row['Close']),
                            'volume': int(row['Volume'])
                        })
                    
                    price_volume_repo.upsert_ohlcv_data(ticker, new_records)
                    records = new_records
            except Exception as e:
                logger.error(f"Error fetching from yfinance: {e}")
        
        return records

    def _detect_selling_climax(
        self, records: List[Dict]
    ) -> Tuple[Optional[str], Dict]:
        """
        Detect selling climax: Volume spike (≥2x MA20) + Price DOWN.
        
        Returns:
            Tuple of (climax_date, climax_info)
        """
        if len(records) < 25:
            return None, {}
        
        # Calculate volume MA20
        volumes = [r["volume"] for r in records]
        
        for i in range(len(records) - 1, 19, -1):  # Search backward
            vol_ma20 = statistics.mean(volumes[i-20:i]) if i >= 20 else statistics.mean(volumes[:i])
            
            current_vol = volumes[i]
            current_close = records[i]["close"]
            prev_close = records[i-1]["close"]
            
            # Check: Volume ≥ 2x MA20 AND Price DOWN
            if vol_ma20 > 0:
                ratio = current_vol / vol_ma20
                price_change = (current_close - prev_close) / prev_close * 100 if prev_close > 0 else 0
                
                if ratio >= 2.0 and price_change < -1:  # At least 1% down
                    return records[i]["time"], {
                        "date": records[i]["time"],
                        "price": current_close,
                        "volume": current_vol,
                        "volume_ratio": round(ratio, 2),
                        "price_change_pct": round(price_change, 2),
                        "detected": True
                    }
        
        return None, {"detected": False}

    def _find_climax_info(self, records: List[Dict], date: str) -> Dict:
        """Get climax info for a specific date."""
        for i, r in enumerate(records):
            if r["time"] == date:
                prev_close = records[i-1]["close"] if i > 0 else r["open"]
                price_change = (r["close"] - prev_close) / prev_close * 100 if prev_close > 0 else 0
                return {
                    "date": date,
                    "price": r["close"],
                    "volume": r["volume"],
                    "price_change_pct": round(price_change, 2),
                    "detected": True
                }
        return {"date": date, "detected": False}

    def _calculate_all_moving_averages(
        self, records: List[Dict]
    ) -> Dict[str, List[Dict]]:
        """Calculate all required MAs for price and volume."""
        closes = [r["close"] for r in records]
        volumes = [r["volume"] for r in records]
        dates = [r["time"] for r in records]
        
        return {
            "price_ma5": self._calculate_sma(dates, closes, 5),
            "price_ma10": self._calculate_sma(dates, closes, 10),
            "price_ma20": self._calculate_sma(dates, closes, 20),
            "volume_ma20": self._calculate_sma(dates, volumes, 20)
        }

    def _calculate_sma(
        self, dates: List[str], values: List[float], period: int
    ) -> List[Dict]:
        """Calculate Simple Moving Average."""
        result = []
        for i in range(len(values)):
            if i < period - 1:
                result.append({"date": dates[i], "value": None})
            else:
                avg = statistics.mean(values[i-period+1:i+1])
                result.append({"date": dates[i], "value": round(avg, 2)})
        return result

    def _detect_volume_spikes_with_price(
        self,
        records: List[Dict],
        volume_ma20: List[Dict]
    ) -> List[Dict]:
        """Detect volume spikes with price direction."""
        spikes = []
        
        for i in range(1, len(records)):
            ma_val = volume_ma20[i]["value"] if i < len(volume_ma20) else None
            if ma_val is None or ma_val <= 0:
                continue
            
            current_vol = records[i]["volume"]
            ratio = current_vol / ma_val
            
            if ratio >= 2.0:
                prev_close = records[i-1]["close"]
                curr_close = records[i]["close"]
                price_change = (curr_close - prev_close) / prev_close * 100 if prev_close > 0 else 0
                
                # Determine category
                if ratio >= 5:
                    category = "extreme"
                elif ratio >= 3:
                    category = "high"
                else:
                    category = "elevated"
                
                spikes.append({
                    "date": records[i]["time"],
                    "ratio": round(ratio, 2),
                    "category": category,
                    "price_change_pct": round(price_change, 2),
                    "price_direction": "UP" if price_change > 0 else "DOWN",
                    "high": records[i]["high"],
                    "low": records[i]["low"],
                    "close": curr_close
                })
        
        return spikes

    def _detect_resistance_levels(
        self,
        records: List[Dict],
        volume_spikes: List[Dict],
        today: str
    ) -> List[Dict]:
        """
        Detect resistance lines from volume spike + price UP.
        Line extends until broken.
        """
        resistance_lines = []
        
        # Filter spikes with price UP in last 30 days
        recent_up_spikes = [
            s for s in volume_spikes 
            if s["price_direction"] == "UP"
        ]
        
        for spike in recent_up_spikes:
            spike_date = spike["date"]
            resistance_price = spike["high"]
            
            # Find if resistance is broken
            is_broken = False
            break_date = None
            
            for r in records:
                if r["time"] > spike_date:
                    if r["close"] > resistance_price:
                        is_broken = True
                        break_date = r["time"]
                        break
            
            resistance_lines.append({
                "start_date": spike_date,
                "end_date": break_date if is_broken else today,
                "price": resistance_price,
                "is_broken": is_broken,
                "break_date": break_date,
                "source": "volume_spike_up",
                "spike_info": {
                    "ratio": spike["ratio"],
                    "price_change_pct": spike["price_change_pct"]
                }
            })
        
        return resistance_lines

    def _get_money_flow_chart_data(
        self,
        ticker: str,
        start_date: str,
        end_date: str
    ) -> Dict[str, Any]:
        """Get money flow data from NeoBDM for visualization."""
        try:
            # Query flow history for this ticker using existing method
            # get_neobdm_history returns list of dicts with flow_d0, price, date
            history = self.neobdm_repo.get_neobdm_history(
                symbol=ticker,
                method='m',  # Market maker method
                period='c',  # Cumulative
                limit=90     # Get enough days
            )
            
            positive_flow = []
            negative_flow = []
            price_line = []
            
            if history:
                for record in history:
                    date = record.get('date', '')
                    if not date or date < start_date or date > end_date:
                        continue
                    
                    d_0 = float(record.get('flow_d0', 0) or 0)
                    price = float(record.get('price', 0) or 0)
                    
                    if d_0 >= 0:
                        positive_flow.append({"date": date, "value": d_0})
                    else:
                        negative_flow.append({"date": date, "value": d_0})
                    
                    if price > 0:
                        price_line.append({"date": date, "value": price})
            
            # Sort by date ascending for chart rendering
            positive_flow.sort(key=lambda x: x['date'])
            negative_flow.sort(key=lambda x: x['date'])
            price_line.sort(key=lambda x: x['date'])
            
            # If no flow data but have OHLCV, just show price line
            if not positive_flow and not negative_flow:
                ohlcv = price_volume_repo.get_ohlcv_data(ticker, start_date, end_date)
                if ohlcv:
                    for r in ohlcv:
                        price_line.append({"date": r["time"], "value": r["close"]})
            
            return {
                "positive_flow": positive_flow,
                "negative_flow": negative_flow,
                "price_line": price_line,
                "data_available": bool(positive_flow or negative_flow)
            }
            
        except Exception as e:
            logger.error(f"Error getting money flow data: {e}")
            return {
                "positive_flow": [],
                "negative_flow": [],
                "price_line": [],
                "data_available": False,
                "error": str(e)
            }

    def _generate_trading_recommendation(
        self,
        records: List[Dict],
        volume_spikes: List[Dict],
        resistance_lines: List[Dict],
        ma_data: Dict
    ) -> Dict[str, Any]:
        """Generate trading recommendation based on current state."""
        if not records:
            return {"status": "NO_DATA", "reason": "No data available"}
        
        today_date = records[-1]["time"]
        current_price = records[-1]["close"]
        
        # Check for recent volume spike + price UP (last 7 days)
        recent_up_spikes = [
            s for s in volume_spikes 
            if s["price_direction"] == "UP" 
            and self._days_between(s["date"], today_date) <= 7
        ]
        
        # Check for today's spike
        today_spike = next(
            (s for s in volume_spikes if s["date"] == today_date), None
        )
        
        # Check active (unbroken) resistance lines
        active_resistances = [
            r for r in resistance_lines if not r["is_broken"]
        ]
        
        # Check broken resistances (potential entry)
        broken_today = [
            r for r in resistance_lines 
            if r["is_broken"] and r.get("break_date") == today_date
        ]
        
        # Pullback validation: check if price stayed above spike LOW
        pullback_valid = True
        for spike in recent_up_spikes:
            spike_low = spike["low"]
            for r in records:
                if r["time"] > spike["date"] and r["low"] < spike_low:
                    pullback_valid = False
                    break
        
        # Generate recommendation
        if today_spike and today_spike["price_direction"] == "UP":
            return {
                "status": "WAIT_FOR_PULLBACK",
                "reason": f"Volume spike today (+{today_spike['price_change_pct']:.1f}% price, {today_spike['ratio']:.1f}x volume)",
                "action": "Wait for pullback with volume < MA20",
                "spike_info": today_spike,
                "pullback_valid": True
            }
        
        if broken_today:
            return {
                "status": "ENTRY_ZONE",
                "reason": f"Resistance broken at {broken_today[0]['price']:.0f}",
                "action": "Consider entry on breakout confirmation",
                "resistance_info": broken_today[0],
                "pullback_valid": pullback_valid
            }
        
        if recent_up_spikes and not pullback_valid:
            return {
                "status": "FAILED",
                "reason": "Price broke below spike low - pullback invalid",
                "action": "Wait for new setup",
                "pullback_valid": False
            }
        
        if recent_up_spikes and pullback_valid and active_resistances:
            # Waiting for breakout
            nearest_resistance = min(active_resistances, key=lambda x: x["price"])
            distance_pct = (nearest_resistance["price"] - current_price) / current_price * 100
            
            return {
                "status": "WATCH",
                "reason": f"Pullback valid, waiting for breakout at {nearest_resistance['price']:.0f}",
                "action": f"Monitor for break above {nearest_resistance['price']:.0f} ({distance_pct:+.1f}%)",
                "resistance_price": nearest_resistance["price"],
                "distance_pct": round(distance_pct, 2),
                "pullback_valid": True
            }
        
        # Default
        return {
            "status": "WATCH",
            "reason": "No clear setup detected",
            "action": "Wait for volume spike signal",
            "pullback_valid": True
        }

    def _days_between(self, date1: str, date2: str) -> int:
        """Calculate days between two date strings."""
        try:
            d1 = datetime.strptime(date1, "%Y-%m-%d")
            d2 = datetime.strptime(date2, "%Y-%m-%d")
            return abs((d2 - d1).days)
        except ValueError:
            return 999


# Backward-compatible alias for refactored class name.
class AlphaHunterVPA(AlphaHunterStage2VPA):
    pass
