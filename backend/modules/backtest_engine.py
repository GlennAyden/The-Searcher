from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from .technical_analyst import TechnicalAnalyst

class BacktestEngine:
    """
    Simulates the forecasting strategy on historical data.
    Tests technical entry/exit rules to calculate real win rate and returns.
    """
    def __init__(self):
        self.analyst = TechnicalAnalyst()

    def run_backtest(self, symbol: str, days: int = 180) -> Dict:
        """
        Run a backtest for the given symbol over the last N days.
        
        Args:
            symbol: Stock ticker (e.g., BBCA)
            days: Lookback period (default 180 = ~6 months)
            
        Returns:
            Dictionary with win_rate, avg_return, total_trades, etc.
        """
        try:
            import yfinance as yf
            
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days + 60)  # +60 buffer for indicators
            
            # Fetch historical data
            df = yf.download(symbol, start=start_date, end=end_date, progress=False, auto_adjust=True)
            
            if df.empty or len(df) < 50:
                return {"error": "Insufficient historical data"}
            
            # Normalize columns - handle MultiIndex from yfinance
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.droplevel(1)  # Drop ticker level if MultiIndex
            df.columns = [str(c).lower() for c in df.columns]  # Ensure strings before lowering
            
            # Run simulation
            trades = self._simulate_trades(df, days)
            
            # Calculate statistics
            return self._calculate_statistics(trades, symbol, days, len(df))
            
        except Exception as e:
            print(f"Backtest Error for {symbol}: {e}")
            return {"error": str(e)}

    def _simulate_trades(self, df: pd.DataFrame, simulation_days: int) -> List[Dict]:
        """
        Simulate trades by walking through historical data.
        """
        trades = []
        simulation_start_index = max(50, len(df) - simulation_days)
        
        # Debug counters
        days_checked = 0
        no_support_count = 0
        far_from_support_count = 0
        low_volume_count = 0
        poor_rr_count = 0
        
        i = simulation_start_index
        while i < len(df) - 5:  # -5 to allow trade to play out
            days_checked += 1
            historical_window = df.iloc[:i+1].copy()
            current_candle = historical_window.iloc[-1]
            current_price = current_candle['close']
            current_date = historical_window.index[-1]
            
            # Run technical analysis
            supports, resistances = self.analyst.find_support_resistance(historical_window)
            if not supports:
                no_support_count += 1
                i += 1
                continue
            
            # Check for entry signal
            closest_supports = sorted([s for s in supports if s < current_price], reverse=True)
            if not closest_supports:
                i += 1
                continue
            
            nearest_support = closest_supports[0]
            dist_to_support = (current_price - nearest_support) / current_price
            
            # ENTRY CONDITION: Price within reasonable range of support
            # Relaxed to 6% to catch swing trading opportunities in sideways markets
            if dist_to_support <= 0.06 and dist_to_support >= 0:
                # Removed volume filter - sideways markets often have erratic volume
                # Focus on price action and support/resistance structure instead
                
                # Define trade parameters
                stop_loss = nearest_support * 0.97  # 3% below support
                
                # Target: Next resistance or 1:2 R/R
                closest_resistances = sorted([r for r in resistances if r > current_price])
                if closest_resistances:
                    target = closest_resistances[0]
                else:
                    target = current_price * 1.05  # Default 5% upside
                
                # Risk/Reward filter
                risk = current_price - stop_loss
                reward = target - current_price
                if risk <= 0:
                    i += 1
                    continue
                    
                rr = reward / risk
                if rr < 0.8:  # Minimum 0.8:1 R/R (allows near 1:1 trades in sideways markets)
                    poor_rr_count += 1
                    i += 1
                    continue
                
                # Execute simulated trade
                outcome = self._simulate_trade_outcome(df, i+1, stop_loss, target)
                
                if outcome['status'] != 'OPEN':
                    trades.append({
                        "date": current_date,
                        "entry": current_price,
                        "exit": outcome['exit_price'],
                        "status": outcome['status'],
                        "return_pct": ((outcome['exit_price'] - current_price) / current_price) * 100,
                        "days_held": outcome['days_held']
                    })
                    
                    # Skip forward to avoid overlapping trades
                    i += outcome['days_held'] + 1
                    continue
            else:
                if dist_to_support > 0.04:
                    far_from_support_count += 1
            
            i += 1
        
        # Print debug summary
        print(f"\n=== Backtest Debug Summary ===")
        print(f"Days checked: {days_checked}")
        print(f"No support detected: {no_support_count}")
        print(f"Too far from support (>{4}%): {far_from_support_count}")
        print(f"Low volume: {low_volume_count}")
        print(f"Poor R/R ratio (<0.8): {poor_rr_count}")
        print(f"Trades triggered: {len(trades)}")
        print(f"==============================\n")
        
        return trades

    def _simulate_trade_outcome(self, df: pd.DataFrame, start_idx: int, sl: float, tp: float) -> Dict:
        """
        Look forward from start_idx to see if SL or TP is hit first.
        Max holding period: 20 days (swing trade timeframe)
        """
        max_hold = 20
        for j in range(start_idx, min(len(df), start_idx + max_hold)):
            candle = df.iloc[j]
            low = candle['low']
            high = candle['high']
            
            # Check stop loss first (conservative: assume gets stopped before hitting target same day)
            if low <= sl:
                return {"status": "LOSS", "exit_price": sl, "days_held": j - start_idx}
            
            # Check target
            if high >= tp:
                return {"status": "WIN", "exit_price": tp, "days_held": j - start_idx}
        
        # Neither hit after max holding period - close at market
        if start_idx + max_hold < len(df):
            final_price = df.iloc[start_idx + max_hold]['close']
        else:
            final_price = df.iloc[-1]['close']
            
        entry_price = df.iloc[start_idx - 1]['close']
        status = "WIN" if final_price > entry_price else "LOSS"
        
        return {"status": status, "exit_price": final_price, "days_held": max_hold}

    def _calculate_statistics(self, trades: List[Dict], symbol: str, days: int, dataset_size: int) -> Dict:
        """
        Calculate comprehensive backtest statistics.
        """
        if not trades:
            return {
                "symbol": symbol,
                "win_rate": 0,
                "total_trades": 0,
                "wins": 0,
                "losses": 0,
                "avg_return": 0,
                "best_trade": 0,
                "worst_trade": 0,
                "max_drawdown": 0,
                "avg_holding_days": 0,
                "period_days": days,
                "note": "No trades triggered in this period"
            }
        
        wins = [t for t in trades if t['status'] == 'WIN']
        losses = [t for t in trades if t['status'] == 'LOSS']
        win_rate = (len(wins) / len(trades)) * 100
        avg_return = sum(t['return_pct'] for t in trades) / len(trades)
        
        # Additional statistics
        returns = [t['return_pct'] for t in trades]
        best_trade = max(returns) if returns else 0
        worst_trade = min(returns) if returns else 0
        
        # Max Drawdown: worst consecutive losing streak
        max_dd = 0
        current_dd = 0
        for t in trades:
            if t['status'] == 'LOSS':
                current_dd += abs(t['return_pct'])
                max_dd = max(max_dd, current_dd)
            else:
                current_dd = 0  # Reset on win
        
        avg_holding = sum(t['days_held'] for t in trades) / len(trades)
        
        return {
            "symbol": symbol,
            "win_rate": round(win_rate, 1),
            "total_trades": len(trades),
            "wins": len(wins),
            "losses": len(losses),
            "avg_return": round(avg_return, 1),
            "best_trade": round(best_trade, 1),
            "worst_trade": round(worst_trade, 1),
            "max_drawdown": round(max_dd, 1),
            "avg_holding_days": round(avg_holding, 1),
            "period_days": days,
            "dataset_size": dataset_size
        }
