"""
Technical Analyst Module
Responsible for "Human-like" Technical Analysis logic.
- Finds Support/Resistance (Swing Highs/Lows)
- Calculates ATR (Average True Range)
- Generates Trade Plans
"""
import pandas as pd
import numpy as np
from typing import List, Dict, Tuple

class TechnicalAnalyst:
    
    @staticmethod
    def find_support_resistance(df: pd.DataFrame, window: int = 5) -> Tuple[List[float], List[float]]:
        """
        Identify Reference Levels (Support & Resistance) using Swing Highs/Lows.
        
        Args:
            df: DataFrame with 'high', 'low' columns
            window: Number of candles to look left and right (e.g., 5 means 5 days before & after)
            
        Returns:
            (supports, resistances) - List of price levels
        """
        # Ensure we have enough data
        if len(df) < window * 2:
            return [], []
            
        # Identify Swing Highs
        # Only if High[i] is max in window centered at i
        # Using rolling max with center=True
        rolling_max = df['high'].rolling(window=window*2+1, center=True).max()
        swing_highs = df[df['high'] == rolling_max]['high'].tolist()
        
        # Identify Swing Lows
        rolling_min = df['low'].rolling(window=window*2+1, center=True).min()
        swing_lows = df[df['low'] == rolling_min]['low'].tolist()
        
        # Clean and Filter (Remove duplicates and very close levels)
        # Sort and group levels within 2% distance
        
        def consolidate_levels(levels):
            if not levels: return []
            levels = sorted(levels)
            consolidated = []
            
            while levels:
                current = levels.pop(0)
                group = [current]
                
                # Check next levels
                while levels and levels[0] <= current * 1.02: # 2% tolerance
                    group.append(levels.pop(0))
                
                # Take average or most significant (here avg)
                consolidated.append(sum(group) / len(group))
            
            return consolidated

        return consolidate_levels(swing_lows), consolidate_levels(swing_highs)

    @staticmethod
    def calculate_atr(df: pd.DataFrame, period: int = 14) -> float:
        """
        Calculate Average True Range (ATR) for volatility measurement.
        """
        if len(df) < period + 1:
            return 0.0
            
        high = df['high']
        low = df['low']
        close = df['close']
        
        # True Range Calculation
        tr1 = high - low
        tr2 = (high - close.shift()).abs()
        tr3 = (low - close.shift()).abs()
        
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        
        # RMA (Running Moving Average) usually used for ATR, or simple rolling mean
        # Using simple rolling mean for simplicity and robustness here
        atr = tr.rolling(window=period).mean().iloc[-1]
        
        return float(atr) if not pd.isna(atr) else 0.0

    def generate_trade_plan(self, current_price: float, supports: List[float], resistances: List[float], atr: float) -> Dict:
        """
        Generate a Trade Plan based on current price, S/R levels, and ATR.
        
        Returns:
            Dict containing Action, Entry Zone, Targets, Stop Loss, and Rationale.
        """
        # 1. Determine Trend / Position relative to S/R
        # Find nearest support below current price
        valid_supports = [s for s in supports if s < current_price]
        nearest_support = max(valid_supports) if valid_supports else current_price * 0.9 # Fallback
        
        # Find nearest resistance above current price
        valid_resistances = [r for r in resistances if r > current_price]
        nearest_resistance = min(valid_resistances) if valid_resistances else current_price * 1.1 # Fallback
        
        # 2. Strategy Logic
        dist_to_support = (current_price - nearest_support) / current_price
        dist_to_resistance = (nearest_resistance - current_price) / current_price
        
        action = "WAIT"
        rationale = ""
        
        # Entry Zone: 2-3% above support
        entry_zone_low = nearest_support
        entry_zone_high = nearest_support * 1.03
        
        # Logic:
        # If price is within 3% of support -> BUY ON WEAKNESS
        # If price is far from support but has high upside -> BUY ON BREAKOUT (if near resistance) or WAIT
        
        if dist_to_support <= 0.04: # Close to support
            action = "BUY_ON_WEAKNESS"
            rationale = "Price is near strong support area. Low risk entry."
        elif dist_to_resistance <= 0.03: # Near resistance
            action = "WAIT_BREAKOUT"
            rationale = "Price nearing resistance. Wait for breakout confirmation."
        else:
            action = "WAIT"
            rationale = "Price in no-man's land. Wait for pullback to support."

        # 3. Targets (TP)
        # TP1 = Nearest Resistance
        # TP2 = Next Resistance or TP1 * 1.1
        tp1 = nearest_resistance
        
        next_resistances = [r for r in valid_resistances if r > tp1 * 1.02]
        tp2 = min(next_resistances) if next_resistances else tp1 * 1.1
        
        # 4. Stop Loss
        # SL = Support - 1x ATR (Buffer for volatility)
        # If ATR is 0/invalid, use 3% below support
        buffer = atr if atr > 0 else nearest_support * 0.03
        stop_loss = nearest_support - buffer
        
        # 5. Success Probability & Scenarios (Phase B)
        # Basic technical probability
        # Base on R/R and distance to support
        rr = (tp1 - current_price) / (current_price - stop_loss) if (current_price - stop_loss) > 0 else 0
        
        # Base probability around 50%, adjust by context
        prob = 50 
        if action == "BUY_ON_WEAKNESS": prob += 10
        if dist_to_support <= 0.02: prob += 5
        if rr > 2: prob += 5
        
        # Cap probability
        success_probability = min(max(prob, 30), 85)
        
        scenarios = {
            "berhasil": {
                "label": "Bullish Scenario",
                "condition": f"Price breaks above {int(tp1)}",
                "upside": f"+{round(((tp1 - current_price) / current_price) * 100, 1)}%",
                "probability": success_probability
            },
            "gagal": {
                "label": "Bearish Scenario",
                "condition": f"Price drops below {int(stop_loss)}",
                "downside": f"-{round(((current_price - stop_loss) / current_price) * 100, 1)}%",
                "probability": 100 - success_probability
            }
        }
        
        return {
            "action": action,
            "rationale": rationale,
            "entry_zone": {
                "low": int(entry_zone_low),
                "high": int(entry_zone_high)
            },
            "targets": [int(tp1), int(tp2)],
            "stop_loss": int(stop_loss),
            "risk_reward_ratio": round(rr, 2),
            "success_probability": success_probability,
            "scenarios": scenarios
        }
