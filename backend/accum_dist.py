from typing import List, Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class TickerState:
    def __init__(self):
        self.seen_trade_ids = set()
        # Lifetime totals
        self.total_buy_vol = 0
        self.total_sell_vol = 0
        self.total_buy_freq = 0
        self.total_sell_freq = 0
        self.total_value = 0.0
        
        # Interval totals (e.g., last 15m)
        self.int_buy_vol = 0
        self.int_sell_vol = 0
        self.int_big_orders = 0
        self.int_prices = []
        self.int_start_time = None

class TradeAnalyzer:
    def __init__(self):
        self.states: Dict[str, TickerState] = {}
        
    def _get_state(self, ticker: str) -> TickerState:
        if ticker not in self.states:
            self.states[ticker] = TickerState()
        return self.states[ticker]

    def process_trades(self, ticker: str, trades: List[Dict]) -> Dict:
        """
        Processes a list of trades for a specific ticker, ignoring duplicates.
        """
        state = self._get_state(ticker)
        
        new_buy_vol = 0
        new_sell_vol = 0
        new_buy_freq = 0
        new_sell_freq = 0
        new_value = 0.0
        
        count = 0
        
        # Trades usually come in DESC order (newest first).
        for trade in trades:
            trade_id = trade.get("trade_number") or trade.get("id")
            
            if trade_id in state.seen_trade_ids:
                continue
            
            state.seen_trade_ids.add(trade_id)
            count += 1
            
            try:
                action = trade.get("action", "").lower()
                price_str = str(trade.get("price", "0")).replace(",", "")
                lot_str = str(trade.get("lot", "0")).replace(",", "")
                
                price = float(price_str)
                lot = int(lot_str)
                # Value = price * lot * 100
                value = price * lot * 100
                
                # Big Order check (> 500 lots)
                if lot >= 500:
                    state.int_big_orders += 1

                if action == "buy":
                    new_buy_vol += lot
                    new_buy_freq += 1
                    state.total_buy_vol += lot
                    state.total_buy_freq += 1
                    # Interval Tracking
                    state.int_buy_vol += lot
                elif action == "sell":
                    new_sell_vol += lot
                    new_sell_freq += 1
                    state.total_sell_vol += lot
                    state.total_sell_freq += 1
                    # Interval Tracking
                    state.int_sell_vol += lot
                
                state.int_prices.append(price)
                new_value += value
                state.total_value += value
                
            except Exception as e:
                logger.error(f"Error processing trade {trade} for {ticker}: {e}")
        
        # Calculate Power
        total_vol = state.total_buy_vol + state.total_sell_vol
        buy_power = (state.total_buy_vol / total_vol * 100) if total_vol > 0 else 50.0
        sell_power = (state.total_sell_vol / total_vol * 100) if total_vol > 0 else 50.0
        
        return {
            "ticker": ticker,
            "new_trades_count": count,
            "new_buy_vol": new_buy_vol,
            "new_sell_vol": new_sell_vol,
            "total_buy_vol": state.total_buy_vol,
            "total_sell_vol": state.total_sell_vol,
            "net_vol": state.total_buy_vol - state.total_sell_vol,
            "buy_power": round(buy_power, 2),
            "sell_power": round(sell_power, 2),
            "total_value": state.total_value,
            "last_price": trades[0].get("price") if trades else "N/A",
            "recent_trades": trades[:50]
        }

    def get_interval_snapshot(self, ticker: str) -> Optional[Dict]:
        """Calculates snapshot for the current interval and returns it."""
        if ticker not in self.states: return None
        state = self.states[ticker]
        
        net_vol = state.int_buy_vol - state.int_sell_vol
        avg_price = sum(state.int_prices) / len(state.int_prices) if state.int_prices else 0.0
        
        # Determine status
        if net_vol > 0: status = "Bullish"
        elif net_vol < 0: status = "Bearish"
        else: status = "Neutral"
        
        # Generate Conclusion
        conc_parts = []
        if state.int_big_orders > 0:
            conc_parts.append(f"Detected {state.int_big_orders} big orders (>500 lot).")
        
        if status == "Bullish":
            conc_parts.append(f"Accumulation phase with net buy {net_vol:,} lots.")
        elif status == "Bearish":
            conc_parts.append(f"Distribution phase with net sell {abs(net_vol):,} lots.")
        else:
            conc_parts.append("Sideways movement, no strong volume drive.")
            
        return {
            "ticker": ticker,
            "buy_vol": state.int_buy_vol,
            "sell_vol": state.int_sell_vol,
            "net_vol": net_vol,
            "avg_price": round(avg_price, 2),
            "status": status,
            "big_order_count": state.int_big_orders,
            "conclusion": " ".join(conc_parts)
        }

    def reset_interval(self, ticker: str):
        """Resets interval counters for a specific ticker."""
        if ticker in self.states:
            state = self.states[ticker]
            state.int_buy_vol = 0
            state.int_sell_vol = 0
            state.int_big_orders = 0
            state.int_prices = []

    def reset(self, ticker: Optional[str] = None):
        if ticker:
            if ticker in self.states:
                del self.states[ticker]
        else:
            self.states = {}
