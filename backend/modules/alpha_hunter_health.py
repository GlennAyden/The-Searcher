"""
Alpha Hunter Health Tracker.
Responsible for monitoring post-spike correction health (Healthy Pullback).
"""
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional
from modules.database import DatabaseManager

class AlphaHunterHealth:
    def __init__(self):
        self.db = DatabaseManager()
        
    def check_pullback_health(self, ticker: str, spike_date: str = None) -> Dict:
        """
        Analyze price/volume correlation after an anomaly spike.
        Target: Price Down + Volume Down = HEALTHY (Accumulation held)
        """
        # 1. Get history since spike
        # If spike_date not provided, try to find it from watchlist or scan
        if not spike_date:
            # Try watchlist first
            repo = self.db.get_alpha_hunter_repo()
            # This requires a get_watchlist_item method or we scan all
            # For simplicity, let's assume caller provides spike_date or we auto-detect
            # Auto-detect fallback:
            pass # TODO: auto-detect logic if needed
            
        # Get daily data from spike_date to NOW
        # We need data starting from spike_date
        records = self.db.get_volume_history(ticker)
        
        if not records:
             return {"error": "No data found"}
             
        df = pd.DataFrame(records)
        df['trade_date'] = pd.to_datetime(df['trade_date'])
        df = df.sort_values('trade_date')
        
        if spike_date:
             mask = df['trade_date'] >= pd.to_datetime(spike_date)
             df_tracking = df[mask].copy()
        else:
             # Default to last 14 days if no spike date
             df_tracking = df.tail(14).copy()
             
        # Analysis
        health_score = 100
        tracking_log = []
        
        # Calculate daily mutations
        df_tracking['prev_price'] = df_tracking['close_price'].shift(1)
        df_tracking['prev_vol'] = df_tracking['volume'].shift(1)
        
        # Skip first row (spike day) for change calc, but include in log
        for idx, row in df_tracking.iterrows():
            if pd.isna(row['prev_price']): 
                continue
                
            price_chg = (row['close_price'] - row['prev_price']) / row['prev_price'] * 100
            vol_chg = (row['volume'] - row['prev_vol']) / row['prev_vol'] * 100 if row['prev_vol'] > 0 else 0
            
            status = "NEUTRAL"
            penalty = 0
            
            # Logic: Healthy Pullback
            if price_chg < 0: # Price Down
                if vol_chg < -20:
                    status = "HEALTHY" # ✅ Vol drying up
                elif vol_chg < 0:
                    status = "OK" # ⚠️ Vol stable/down
                    penalty = 5
                else:
                    status = "DANGER" # 🚨 Price down on rising volume = Distribution
                    penalty = 25
            elif price_chg > 0: # Price Up
                 if vol_chg > 0:
                     status = "STRONG" # ✅ Price up on vol up
                 else:
                     status = "WEAK_BOUNCE" # ⚠️ Price up on vol down
                     penalty = 5
                     
            health_score = max(0, health_score - penalty)
            
            tracking_log.append({
                "date": row['trade_date'].strftime('%Y-%m-%d'),
                "price": row['close_price'],
                "volume": row['volume'],
                "price_chg": round(price_chg, 2),
                "vol_chg": round(vol_chg, 2),
                "status": status
            })
            
        # Determine verdict
        if health_score >= 80: verdict = "HEALTHY PULLBACK"
        elif health_score >= 50: verdict = "WATCHLIST"
        else: verdict = "BROKEN / DISTRIBUTION"
        
        return {
            "ticker": ticker,
            "health_score": health_score,
            "verdict": verdict,
            "days_tracked": len(tracking_log),
            "log": tracking_log
        }
