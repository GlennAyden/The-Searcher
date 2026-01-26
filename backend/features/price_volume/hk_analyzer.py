"""
HK Methodology Analyzer for Price Volume.

Hengky's Smart Money Detection methodology:
- Volume Asymmetry: Compare volume on UP days vs DOWN days post-spike
- Pre-Spike Accumulation: Analyze accumulation BEFORE the spike
- Dynamic Lookback: Auto-detect start of accumulation period
"""
import statistics
from typing import Dict, List, Optional


class HKAnalyzer:
    """Analyzes price/volume data using HK methodology."""
    
    def analyze(
        self,
        records: List[Dict],
        spike_date: Optional[str] = None,
        post_spike_days: int = 10,
        spike_markers: List[Dict] = None
    ) -> Dict:
        """
        Perform HK methodology analysis.
        
        Args:
            records: List of OHLCV records (sorted by time ascending)
            spike_date: Specific spike date to analyze (defaults to latest spike)
            post_spike_days: Days after spike for pullback analysis
            spike_markers: Optional pre-computed spike markers
            
        Returns:
            Dict with volume_asymmetry and accumulation analysis
        """
        if not records or len(records) < 30:
            return self._empty_result()
        
        # Find spike date
        if spike_date:
            target_spike = spike_date
        elif spike_markers:
            target_spike = spike_markers[-1]['time']
        else:
            target_spike = records[-1]['time']
        
        # Find spike index
        spike_index = next(
            (i for i, r in enumerate(records) if r['time'] == target_spike),
            len(records) - 1
        )
        
        # Volume Asymmetry (Post-Spike Analysis)
        volume_asymmetry = self._analyze_volume_asymmetry(
            records, spike_index, post_spike_days
        )
        
        # Pre-Spike Accumulation
        accumulation = self._analyze_accumulation(records, spike_index)
        
        return {
            "spike_date": target_spike,
            "spike_source": "user_specified" if spike_date else "auto_detected",
            "volume_asymmetry": volume_asymmetry,
            "accumulation": accumulation
        }
    
    def _analyze_volume_asymmetry(
        self,
        records: List[Dict],
        spike_index: int,
        post_spike_days: int
    ) -> Dict:
        """Analyze volume asymmetry post-spike."""
        pullback_log = []
        end_index = min(spike_index + 1 + post_spike_days, len(records))
        
        for i in range(spike_index + 1, end_index):
            prev = records[i - 1]
            curr = records[i]
            
            price_chg = ((curr['close'] - prev['close']) / prev['close'] * 100) if prev['close'] > 0 else 0
            vol_chg = ((curr['volume'] - prev['volume']) / prev['volume'] * 100) if prev['volume'] > 0 else 0
            
            # Classify pullback day
            if price_chg < 0:
                if vol_chg < -20:
                    status = "HEALTHY"
                elif vol_chg < 0:
                    status = "OK"
                else:
                    status = "DANGER"
            elif price_chg > 0:
                status = "STRONG" if vol_chg > 0 else "WEAK_BOUNCE"
            else:
                status = "NEUTRAL"
            
            pullback_log.append({
                "date": curr['time'],
                "price": curr['close'],
                "volume": curr['volume'],
                "price_chg": round(price_chg, 2),
                "vol_chg": round(vol_chg, 2),
                "status": status
            })
        
        # Calculate asymmetry ratio
        volume_up = sum(day['volume'] for day in pullback_log if day.get('price_chg', 0) > 0)
        volume_down = sum(day['volume'] for day in pullback_log if day.get('price_chg', 0) < 0)
        
        if volume_down > 0:
            asymmetry_ratio = round(volume_up / volume_down, 2)
        else:
            asymmetry_ratio = 999.0 if volume_up > 0 else 0
        
        # Determine verdict
        if asymmetry_ratio >= 5:
            verdict = "STRONG_HOLDING"
        elif asymmetry_ratio >= 3:
            verdict = "HOLDING"
        elif asymmetry_ratio >= 1:
            verdict = "NEUTRAL"
        else:
            verdict = "DISTRIBUTING"
        
        return {
            "volume_up_total": volume_up,
            "volume_down_total": volume_down,
            "asymmetry_ratio": asymmetry_ratio,
            "verdict": verdict,
            "days_analyzed": len(pullback_log),
            "pullback_log": pullback_log
        }
    
    def _analyze_accumulation(self, records: List[Dict], spike_index: int) -> Dict:
        """Analyze pre-spike accumulation period."""
        max_lookback = 60
        lookback_end = max(0, spike_index - 5)
        lookback_start = max(0, spike_index - max_lookback)
        
        if lookback_end - lookback_start < 10:
            return self._empty_accumulation("short_history")
        
        # Calculate baseline volume
        baseline_volumes = [r['volume'] for r in records[lookback_start:lookback_end]]
        median_volume = statistics.median(baseline_volumes) if baseline_volumes else 0
        
        accumulation_start = lookback_start
        detection_method = "max_lookback"
        
        # Find start of accumulation
        for i in range(spike_index - 5, lookback_start, -1):
            # Check for previous volume spike
            if median_volume > 0 and records[i]['volume'] > median_volume * 2.5:
                accumulation_start = i
                detection_method = "previous_spike"
                break
            
            # Check for volatility change
            if i > lookback_start + 10:
                window = [r['close'] for r in records[i-10:i]]
                if len(window) >= 10:
                    mean_close = statistics.mean(window)
                    std_close = statistics.stdev(window) if len(window) > 1 else 0
                    cv = (std_close / mean_close * 100) if mean_close > 0 else 999
                    
                    if cv > 6:
                        accumulation_start = i
                        detection_method = "volatility_change"
                        break
        
        # Analyze accumulation period
        accumulation_records = records[accumulation_start:spike_index]
        accumulation_days = len(accumulation_records)
        
        if accumulation_days < 3:
            return self._empty_accumulation(detection_method)
        
        total_volume = sum(r['volume'] for r in accumulation_records)
        avg_daily_volume = total_volume / accumulation_days
        
        # Count up/down days
        up_days = 0
        down_days = 0
        for i in range(1, len(accumulation_records)):
            if accumulation_records[i]['close'] > accumulation_records[i-1]['close']:
                up_days += 1
            elif accumulation_records[i]['close'] < accumulation_records[i-1]['close']:
                down_days += 1
        
        # Net price movement
        start_price = accumulation_records[0]['close']
        end_price = accumulation_records[-1]['close']
        net_movement_pct = ((end_price - start_price) / start_price * 100) if start_price > 0 else 0
        
        # Volume trend
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
            "detection_method": detection_method,
            "accumulation_days": accumulation_days,
            "total_volume": total_volume,
            "avg_daily_volume": round(avg_daily_volume),
            "volume_trend": volume_trend,
            "up_days": up_days,
            "down_days": down_days,
            "net_movement_pct": round(net_movement_pct, 2)
        }
    
    def _empty_result(self) -> Dict:
        """Return empty result structure."""
        return {
            "spike_date": None,
            "spike_source": None,
            "volume_asymmetry": {
                "volume_up_total": 0,
                "volume_down_total": 0,
                "asymmetry_ratio": 0,
                "verdict": "NO_DATA",
                "days_analyzed": 0,
                "pullback_log": []
            },
            "accumulation": self._empty_accumulation("no_data")
        }
    
    def _empty_accumulation(self, method: str) -> Dict:
        """Return empty accumulation structure."""
        return {
            "period_start": None,
            "period_end": None,
            "detection_method": method,
            "accumulation_days": 0,
            "total_volume": 0,
            "avg_daily_volume": 0,
            "volume_trend": "NO_DATA",
            "up_days": 0,
            "down_days": 0,
            "net_movement_pct": 0
        }
