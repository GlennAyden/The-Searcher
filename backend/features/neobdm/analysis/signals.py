"""
Hot Signals Analyzer for NeoBDM.

Multi-factor scoring system for detecting hot signals:
- Phase 1: Timeframe Alignment (D+W+C)
- Phase 2: Momentum Analysis (Velocity/Acceleration)
- Phase 3: Early Warning (Risk Flags)
- Phase 4: Pattern Recognition (6 patterns)
"""
import pandas as pd
import re
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta


class SignalsAnalyzer:
    """Analyzes hot signals with multi-factor scoring."""
    
    def _parse_flow_value(self, value) -> float:
        """Parse flow value from string format."""
        if value is None or value == '':
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        try:
            # Remove commas and B suffix
            clean = str(value).replace(',', '').replace('B', '').strip()
            return float(clean) if clean else 0.0
        except:
            return 0.0
    
    def _parse_numeric(self, value) -> float:
        """Safely parse numeric value with fallback."""
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        try:
            clean = re.sub(r'[^\d.-]', '', str(value))
            return float(clean) if clean else 0.0
        except:
            return 0.0
    
    def _is_eligible_for_scoring(self, record: Dict) -> bool:
        """Pre-filter: Only LIQUID stocks, exclude PINKY."""
        marker_value = record.get('marker', None)
        marker = str(marker_value).upper() if marker_value is not None else ''
        if marker:
            return marker in ['LIQUID', 'ACTIVE']

        likuid = str(record.get('likuid', '')).lower()
        pinky = str(record.get('pinky', '')).lower()
        if pinky == 'v':
            return False
        if likuid == '':
            return True
        return likuid == 'v'
    
    def _calculate_timeframe_alignment(self, record: Dict) -> Tuple[float, str, Dict]:
        """
        Phase 1: Timeframe Alignment.
        Validates signals across Daily, Weekly, and Cumulative timeframes.
        """
        d_0 = self._parse_flow_value(record.get('d_0', 0))
        w_0_value = record.get('w_0')
        if w_0_value in (None, ''):
            w_0_value = record.get('w_1', 0)
        w_0 = self._parse_flow_value(w_0_value)
        avg_value = record.get('avg')
        if avg_value in (None, ''):
            avg_value = record.get('c_20', record.get('c_10', record.get('c_5', record.get('c_3', 0))))
        avg = self._parse_flow_value(avg_value)
        
        # Count aligned timeframes
        aligned = 0
        if d_0 > 0:
            aligned += 1
        if w_0 > 0:
            aligned += 1
        if avg > 0:
            aligned += 1
        
        # Score based on alignment
        if aligned == 3:
            score = 30.0
            status = "STRONG_ALIGNMENT"
        elif aligned == 2:
            score = 15.0
            status = "PARTIAL_ALIGNMENT"
        elif aligned == 1:
            score = 5.0
            status = "WEAK_ALIGNMENT"
        else:
            score = 0.0
            status = "NO_ALIGNMENT"
        
        details = {
            "daily": d_0 > 0,
            "weekly": w_0 > 0,
            "cumulative": avg > 0,
            "aligned_count": aligned
        }
        
        return score, status, details
    
    def _calculate_momentum(self, record: Dict) -> Tuple[float, str, Dict]:
        """
        Phase 2: Momentum Analysis.
        Detects acceleration/deceleration in money flow.
        """
        d_0 = self._parse_flow_value(record.get('d_0', 0))
        d_1_value = record.get('d_1')
        if d_1_value in (None, ''):
            d_1_value = record.get('d_2', 0)
        d_2_value = record.get('d_2')
        if d_2_value in (None, ''):
            d_2_value = record.get('d_3', 0)
        d_1 = self._parse_flow_value(d_1_value)
        d_2 = self._parse_flow_value(d_2_value)
        
        # Calculate velocity (change from yesterday)
        velocity = d_0 - d_1
        
        # Calculate acceleration (change in velocity)
        prev_velocity = d_1 - d_2
        acceleration = velocity - prev_velocity
        
        # Score based on momentum
        score = 0.0
        if velocity > 0 and acceleration > 0:
            score = 20.0
            status = "ACCELERATING"
        elif velocity > 0 and acceleration <= 0:
            score = 10.0
            status = "DECELERATING"
        elif velocity < 0 and acceleration < 0:
            score = -10.0
            status = "FALLING_FAST"
        elif velocity < 0 and acceleration >= 0:
            score = 0.0
            status = "RECOVERING"
        else:
            score = 0.0
            status = "STABLE"
        
        details = {
            "velocity": velocity,
            "acceleration": acceleration,
            "d_0": d_0,
            "d_1": d_1,
            "d_2": d_2
        }
        
        return score, status, details
    
    def _detect_warnings(self, record: Dict, momentum_details: Dict) -> Tuple[float, str, List[str]]:
        """
        Phase 3: Early Warning System.
        Detects weakening signals before full reversal.
        """
        warnings = []
        penalty = 0.0
        
        d_0 = momentum_details.get('d_0', 0)
        velocity = momentum_details.get('velocity', 0)
        acceleration = momentum_details.get('acceleration', 0)
        
        # Yellow warning: Slowing momentum
        if d_0 > 0 and velocity < 0:
            warnings.append("SLOWING_INFLOW")
            penalty -= 5.0
        
        # Orange warning: Negative acceleration with positive flow
        if d_0 > 0 and acceleration < -10:
            warnings.append("RAPID_DECELERATION")
            penalty -= 10.0
        
        # Red warning: Flow reversal
        w_0_value = record.get('w_0')
        if w_0_value in (None, ''):
            w_0_value = record.get('w_1', 0)
        if d_0 < 0 and self._parse_flow_value(w_0_value) > 0:
            warnings.append("DAILY_REVERSAL")
            penalty -= 15.0
        
        # Determine overall status
        if penalty <= -20:
            status = "HIGH_RISK"
        elif penalty <= -10:
            status = "CAUTION"
        elif penalty < 0:
            status = "WATCH"
        else:
            status = "CLEAR"
        
        return penalty, status, warnings
    
    def _detect_patterns(self, record: Dict, momentum_details: Dict) -> Tuple[float, List[str]]:
        """
        Phase 4: Pattern Recognition.
        Identifies 6 key flow patterns.
        """
        patterns = []
        bonus = 0.0
        
        d_0 = momentum_details.get('d_0', 0)
        velocity = momentum_details.get('velocity', 0)
        acceleration = momentum_details.get('acceleration', 0)
        
        # Pattern 1: Fresh Accumulation (new inflow after neutral)
        if d_0 > 0 and abs(momentum_details.get('d_1', 0)) < 1:
            patterns.append("FRESH_ACCUMULATION")
            bonus += 10.0
        
        # Pattern 2: Sustained Buying (3+ days positive)
        d_1 = momentum_details.get('d_1', 0)
        d_2 = momentum_details.get('d_2', 0)
        if d_0 > 0 and d_1 > 0 and d_2 > 0:
            patterns.append("SUSTAINED_BUYING")
            bonus += 15.0
        
        # Pattern 3: Explosive Entry (sudden large inflow)
        if d_0 > 50 and abs(d_1) < 10:
            patterns.append("EXPLOSIVE_ENTRY")
            bonus += 20.0
        
        # Pattern 4: Distribution (outflow after accumulation)
        avg_value = record.get('avg')
        if avg_value in (None, ''):
            avg_value = record.get('c_20', record.get('c_10', record.get('c_5', record.get('c_3', 0))))
        avg = self._parse_flow_value(avg_value)
        if d_0 < 0 and avg > 0:
            patterns.append("DISTRIBUTION")
            bonus -= 15.0
        
        # Pattern 5: Capitulation (extreme selling)
        if d_0 < -100:
            patterns.append("CAPITULATION")
            bonus -= 20.0
        
        # Pattern 6: Recovery (buying after heavy selling)
        if d_0 > 0 and d_1 < -50:
            patterns.append("RECOVERY")
            bonus += 10.0
        
        return bonus, patterns
    
    def _calculate_signal_score(self, record: Dict) -> Dict:
        """
        Multi-Factor Signal Scoring System (Orchestrator).
        Combines all 4 phases into final signal score.
        """
        # Skip ineligible stocks
        if not self._is_eligible_for_scoring(record):
            return None
        
        # Base score from marker
        marker_value = record.get('marker', None)
        marker = str(marker_value).upper() if marker_value is not None else ''
        if not marker:
            likuid = str(record.get('likuid', '')).lower()
            if likuid == 'v':
                marker = 'LIQUID'
        base_score = 50 if marker == 'LIQUID' else 30
        
        # Flow magnitude score
        w_0_value = record.get('w_0')
        if w_0_value in (None, ''):
            w_0_value = record.get('w_1', 0)
        avg_value = record.get('avg')
        if avg_value in (None, ''):
            avg_value = record.get('c_20', record.get('c_10', record.get('c_5', record.get('c_3', 0))))
        avg = self._parse_flow_value(avg_value)
        flow_score = min(abs(avg) / 10, 30)  # Max 30 points
        if avg < 0:
            flow_score = -flow_score
        
        # Phase 1: Timeframe Alignment
        align_score, align_status, align_details = self._calculate_timeframe_alignment(record)
        
        # Phase 2: Momentum
        momentum_score, momentum_status, momentum_details = self._calculate_momentum(record)
        
        # Phase 3: Warnings
        warning_penalty, warning_status, warnings = self._detect_warnings(record, momentum_details)
        
        # Phase 4: Patterns
        pattern_bonus, patterns = self._detect_patterns(record, momentum_details)
        
        # Total score
        total_score = base_score + flow_score + align_score + momentum_score + warning_penalty + pattern_bonus
        
        # Normalize to 0-100
        total_score = max(0, min(100, total_score))
        
        # Signal strength
        if total_score >= 80:
            signal = "STRONG_BUY"
        elif total_score >= 60:
            signal = "BUY"
        elif total_score >= 40:
            signal = "NEUTRAL"
        elif total_score >= 20:
            signal = "SELL"
        else:
            signal = "STRONG_SELL"
        
        return {
            "symbol": record.get('symbol', ''),
            "price": self._parse_numeric(record.get('price', 0)),
            "total_score": round(total_score, 1),
            "signal": signal,
            "components": {
                "base": base_score,
                "flow": round(flow_score, 1),
                "alignment": round(align_score, 1),
                "momentum": round(momentum_score, 1),
                "warnings": round(warning_penalty, 1),
                "patterns": round(pattern_bonus, 1)
            },
            "analysis": {
                "alignment": {"status": align_status, **align_details},
                "momentum": {"status": momentum_status, **momentum_details},
                "warnings": {"status": warning_status, "flags": warnings},
                "patterns": patterns
            },
            "raw": {
                "d_0": self._parse_flow_value(record.get('d_0', 0)),
                "w_0": self._parse_flow_value(w_0_value),
                "avg": avg,
                "marker": marker
            }
        }
    
    def get_latest_hot_signals(self, records_df: pd.DataFrame) -> List[Dict]:
        """
        Get hot signals with advanced multi-factor scoring.
        
        Args:
            records_df: DataFrame with latest neobdm records
            
        Returns:
            List of scored and enriched signal dictionaries
        """
        if records_df.empty:
            return []
        
        results = []
        for _, row in records_df.iterrows():
            record = row.to_dict()
            scored = self._calculate_signal_score(record)
            if scored:
                results.append(scored)
        
        # Sort by total score descending
        results.sort(key=lambda x: x['total_score'], reverse=True)
        
        return results
