"""
Alpha Hunter Scoring Engine.
Responsible for detecting volume anomalies (Tukang Parkir) and calculating conviction scores.
"""
import pandas as pd
import numpy as np
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from modules.database import DatabaseManager

class AlphaHunterScorer:
    def __init__(self):
        self.db = DatabaseManager()
        
    def scan_market(
        self,
        min_score: int = 60,
        sector: str = None,
        mcap_min: float = None,
        max_tickers: Optional[int] = 100,
        max_runtime_sec: Optional[int] = 20,
        use_market_cap: bool = False
    ) -> List[Dict]:
        """
        Scan market for anomaly signals.
        Returns list of scored tickers.
        """
        # 1. Get list of tickers to scan
        #Ideally we want all tickers, but for performance maybe stick to NeoBDM tickers first
        tickers = self.db.get_neobdm_tickers()
        if max_tickers and max_tickers > 0:
            tickers = tickers[:max_tickers]
        
        start_time = time.monotonic()
        
        results = []
        for ticker in tickers:
            # Skip if filtered by sector/mcap (TODO: implement filters)
            
            if max_runtime_sec and (time.monotonic() - start_time) > max_runtime_sec:
                break
            
            score_data = self.calculate_score(ticker, use_market_cap=use_market_cap)
            if score_data['total_score'] >= min_score:
                results.append(score_data)
                
        # Sort by score descending
        results.sort(key=lambda x: x['total_score'], reverse=True)
        return results

    def calculate_score(self, ticker: str, use_market_cap: bool = True) -> Dict:
        """
        Calculate Alpha Hunter score (0-100) for a single ticker.
        """
        score = 0
        breakdown = {}
        
        # --- 1. Volume Anomaly (40 pts) ---
        # Get recent volume history (last 30 days)
        vol_history = []
        vol_score = 0
        vol_ratio = 1.0
        spike_date = None
        
        try:
            # Calculate date range for last 25 trading days
            from datetime import datetime, timedelta
            end_date = datetime.now().strftime('%Y-%m-%d')
            start_date = (datetime.now() - timedelta(days=40)).strftime('%Y-%m-%d')  # ~25 trading days
            
            vol_history = self.db.get_volume_history(ticker, start_date=start_date, end_date=end_date) or []
        except Exception as e:
            print(f"[!] Error getting volume history for {ticker}: {e}")
            vol_history = []
        
        if vol_history and len(vol_history) >= 21:
            # Sort by date asc
            df = pd.DataFrame(vol_history)
            df['trade_date'] = pd.to_datetime(df['trade_date'])
            df = df.sort_values('trade_date')
            
            # Check last 3 days for spike
            # Compare with 20-day avg BEFORE the spike candidate
            
            last_day = df.iloc[-1]
            prev_20 = df.iloc[-21:-1]
            avg_vol_20 = prev_20['volume'].mean()
            
            if avg_vol_20 > 0:
                current_vol = last_day['volume']
                vol_ratio = current_vol / avg_vol_20
                
                if vol_ratio >= 3.0:
                    vol_score = 40
                elif vol_ratio >= 2.0:
                    vol_score = 30
                elif vol_ratio >= 1.5:
                    vol_score = 15
                
                if vol_score > 0:
                    spike_date = last_day['trade_date'].strftime('%Y-%m-%d')
            
        score += vol_score
        breakdown['volume_score'] = vol_score
        breakdown['volume_ratio'] = round(vol_ratio, 2)
        breakdown['spike_date'] = spike_date
        
        # --- 2. Sideways Compression (30 pts) ---
        # Check volatility before spike
        compress_score = 0
        is_sideways = False
        sideways_days = 0
        
        if spike_date and vol_history and len(vol_history) >= 21:
            try:
                df = pd.DataFrame(vol_history)
                df['trade_date'] = pd.to_datetime(df['trade_date'])
                df = df.sort_values('trade_date')
                
                # Calculate ATR or simple High-Low range pct
                # Using close price std dev for simplicity if OHLC not fully avail
                prices = df.iloc[-21:-1]['close_price'].dropna()
                if not prices.empty and len(prices) > 1:
                    std_dev = prices.std()
                    mean_price = prices.mean()
                    cv = std_dev / mean_price if mean_price > 0 else 1.0 # Coefficient of Variation
                    
                    if cv < 0.03: # Very tight (<3% variability)
                        compress_score = 30
                        is_sideways = True
                        sideways_days = 20 # Placeholder, ideally scan backwards
                    elif cv < 0.05:
                        compress_score = 20
                        is_sideways = True
                        sideways_days = 15
            except Exception as e:
                print(f"[!] Error calculating compression for {ticker}: {e}")
        
        score += compress_score
        breakdown['compression_score'] = compress_score
        breakdown['is_sideways'] = is_sideways
        breakdown['sideways_days'] = sideways_days

        # --- 3. Flow Impact (30 pts) ---
        # Get latest NeoBDM flow
        flow_score = 0
        flow_impact = 0.0
        
        if use_market_cap:
            try:
                # Check latest history record
                history = self.db.get_neobdm_history(ticker, limit=1)
                if history:
                    latest = history[0]
                    # Calculate impact if not present (need market cap)
                    flow_d0 = latest.get('flow_d0', 0)
                    
                    from data_provider import data_provider
                    mcap = data_provider.get_market_cap(ticker)
                    
                    if mcap and mcap > 0:
                        flow_impact = (flow_d0 / mcap) * 100
                        
                        if abs(flow_impact) >= 0.3:
                             flow_score = 30
                        elif abs(flow_impact) >= 0.1:
                             flow_score = 20
                        elif abs(flow_impact) >= 0.05:
                             flow_score = 10
                             
                        # Bonus: Must be positive flow for max score
                        if flow_impact < 0:
                            flow_score = flow_score // 2 # Penalty for big outflow
                            
            except Exception as e:
                print(f"Error calcing flow impact for {ticker}: {e}")
            
        score += flow_score
        breakdown['flow_score'] = flow_score
        breakdown['flow_impact'] = round(flow_impact, 3)
        
        return {
            'ticker': ticker,
            'total_score': score,
            'breakdown': breakdown,
            'signal_level': self._get_signal_level(score),
            'timestamp': datetime.now().isoformat()
        }
        
    def _get_signal_level(self, score):
        if score >= 80: return "FIRE" # 🔥🔥🔥
        if score >= 60: return "HOT"  # 🔥🔥
        return "WARM" # 🔥
