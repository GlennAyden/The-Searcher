"""
Alpha Hunter Supply Analyzer.
Provides analysis for Stage 4: 50% Rule, One-Click Hunter, and entry zone recommendations.
"""
from typing import Dict, List, Optional
from datetime import datetime
from modules.database import DatabaseManager
from modules.broker_utils import (
    get_retail_brokers, get_institutional_brokers, get_foreign_brokers,
    classify_broker, is_retail, is_institutional, is_foreign
)


class AlphaHunterSupply:
    def __init__(self):
        self.db = DatabaseManager()
    
    def analyze_supply(self, ticker: str, done_detail_data: List[Dict] = None) -> Dict:
        """
        Analyze supply dynamics from Done Detail data.
        If done_detail_data not provided, tries to fetch from DB.
        """
        ticker = ticker.upper()
        
        result = {
            "ticker": ticker,
            "fifty_pct_rule": {
                "passed": False,
                "retail_initial": 0,
                "retail_remaining": 0,
                "depletion_pct": 0,
                "status": "UNKNOWN"
            },
            "one_click_orders": [],
            "broker_positions": {
                "institutional": [],
                "retail": [],
                "foreign": []
            },
            "entry_recommendation": {
                "zone_low": 0,
                "zone_high": 0,
                "stop_loss": 0,
                "strategy": ""
            },
            "data_available": False,
            "total_trades": 0
        }
        
        # Try to get data from DB if not provided
        if not done_detail_data:
            try:
                from db import DoneDetailRepository
                repo = DoneDetailRepository()
                # Get latest date's data
                dates = repo.get_available_dates(ticker)
                if dates:
                    latest_date = dates[0]
                    done_detail_data = repo.get_raw_trades(ticker, latest_date)
            except Exception as e:
                print(f"[!] Could not fetch from DB: {e}")
        
        if not done_detail_data:
            return result
        
        result["data_available"] = True
        result["total_trades"] = len(done_detail_data)
        
        # Analyze trades
        broker_buy = {}  # broker -> {lot, value}
        broker_sell = {}
        large_orders = []
        
        for trade in done_detail_data:
            buyer = trade.get('buyer', '')
            seller = trade.get('seller', '')
            lot = int(trade.get('lot', 0) or 0)
            price = float(trade.get('price', 0) or 0)
            time_str = trade.get('time', '')
            value = lot * price * 100  # value in IDR
            
            # Aggregate buyer
            if buyer:
                if buyer not in broker_buy:
                    broker_buy[buyer] = {"lot": 0, "value": 0}
                broker_buy[buyer]["lot"] += lot
                broker_buy[buyer]["value"] += value
            
            # Aggregate seller
            if seller:
                if seller not in broker_sell:
                    broker_sell[seller] = {"lot": 0, "value": 0}
                broker_sell[seller]["lot"] += lot
                broker_sell[seller]["value"] += value
            
            # Detect large orders (One-Click Hunter)
            if lot >= 100:  # Threshold: 100 lot = significant
                large_orders.append({
                    "buyer": buyer,
                    "seller": seller,
                    "lot": lot,
                    "price": price,
                    "time": time_str,
                    "type": "ONE_CLICK" if lot >= 500 else "LARGE"
                })
        
        # Sort large orders by lot
        large_orders.sort(key=lambda x: x["lot"], reverse=True)
        result["one_click_orders"] = large_orders[:20]  # Top 20
        
        # Calculate net positions by category
        result["broker_positions"] = self._calculate_positions(broker_buy, broker_sell)
        
        # Calculate 50% Rule
        result["fifty_pct_rule"] = self._check_fifty_rule(broker_buy, broker_sell)
        
        # Calculate entry recommendation
        if done_detail_data:
            prices = [float(t.get('price', 0) or 0) for t in done_detail_data if t.get('price')]
            if prices:
                avg_price = sum(prices) / len(prices)
                min_price = min(prices)
                max_price = max(prices)
                
                result["entry_recommendation"] = {
                    "zone_low": round(min_price, 0),
                    "zone_high": round(avg_price, 0),
                    "stop_loss": round(min_price * 0.95, 0),  # 5% below min
                    "strategy": self._get_strategy(result)
                }
        
        return result
    
    def _calculate_positions(self, broker_buy: Dict, broker_sell: Dict) -> Dict:
        """Calculate net positions grouped by broker type."""
        positions = {
            "institutional": [],
            "retail": [],
            "foreign": []
        }
        
        # Get all brokers
        all_brokers = set(broker_buy.keys()) | set(broker_sell.keys())
        
        for broker in all_brokers:
            buy_lot = broker_buy.get(broker, {}).get("lot", 0)
            sell_lot = broker_sell.get(broker, {}).get("lot", 0)
            net_lot = buy_lot - sell_lot
            
            entry = {
                "broker": broker,
                "buy_lot": buy_lot,
                "sell_lot": sell_lot,
                "net_lot": net_lot
            }
            
            # Use centralized broker classification
            broker_type = classify_broker(broker)
            
            if broker_type == "foreign":
                positions["foreign"].append(entry)
            elif broker_type == "institutional":
                positions["institutional"].append(entry)
            else:
                positions["retail"].append(entry)
        
        # Sort each category by net_lot
        for category in positions:
            positions[category].sort(key=lambda x: x["net_lot"], reverse=True)
            positions[category] = positions[category][:10]  # Top 10
        
        return positions
    
    def _check_fifty_rule(self, broker_buy: Dict, broker_sell: Dict) -> Dict:
        """
        Check 50% Rule: Retail should have sold at least 50% of their holdings.
        """
        result = {
            "passed": False,
            "retail_buy": 0,
            "retail_sell": 0,
            "depletion_pct": 0,
            "status": "UNKNOWN"
        }
        
        # Calculate retail buy and sell using centralized classification
        retail_brokers = get_retail_brokers()
        retail_buy = sum(broker_buy.get(b, {}).get("lot", 0) for b in retail_brokers if b in broker_buy)
        retail_sell = sum(broker_sell.get(b, {}).get("lot", 0) for b in retail_brokers if b in broker_sell)
        
        result["retail_buy"] = retail_buy
        result["retail_sell"] = retail_sell
        
        # Calculate depletion
        if retail_buy > 0:
            # If retail is net selling, that's good
            net_retail = retail_buy - retail_sell
            if net_retail < 0:
                # Retail is net selling - calculate how much
                depletion = abs(net_retail) / max(retail_sell, 1) * 100
                result["depletion_pct"] = round(min(100, depletion), 1)
                
                if result["depletion_pct"] >= 50:
                    result["passed"] = True
                    result["status"] = "RETAIL_CAPITULATED"
                else:
                    result["status"] = "PARTIAL_CAPITULATION"
            else:
                result["status"] = "RETAIL_ACCUMULATING"
        else:
            if retail_sell > 0:
                result["depletion_pct"] = 100
                result["passed"] = True
                result["status"] = "RETAIL_CAPITULATED"
            else:
                result["status"] = "NO_RETAIL_ACTIVITY"
        
        return result
    
    def _get_strategy(self, analysis: Dict) -> str:
        """Generate strategy recommendation based on analysis."""
        fifty_passed = analysis["fifty_pct_rule"]["passed"]
        has_one_click = len(analysis["one_click_orders"]) > 0
        
        inst_positions = analysis["broker_positions"]["institutional"]
        inst_buying = any(p["net_lot"] > 0 for p in inst_positions)
        
        if fifty_passed and inst_buying and has_one_click:
            return "STRONG BUY - All signals aligned"
        elif fifty_passed and inst_buying:
            return "BUY - Institutional accumulating, retail exiting"
        elif inst_buying and has_one_click:
            return "SPECULATIVE BUY - Watch for confirmation"
        elif fifty_passed:
            return "WAIT - Retail exiting but no institutional interest yet"
        else:
            return "AVOID - Conditions not met"
    
    def parse_done_detail_tsv(self, raw_data: str) -> List[Dict]:
        """Parse TSV/tab-separated Done Detail data."""
        lines = raw_data.strip().split('\n')
        trades = []
        
        for line in lines:
            if not line.strip():
                continue
            
            parts = line.split('\t')
            if len(parts) >= 5:
                try:
                    trade = {
                        "time": parts[0].strip() if len(parts) > 0 else "",
                        "price": float(parts[1].strip().replace(',', '')) if len(parts) > 1 else 0,
                        "lot": int(parts[2].strip().replace(',', '')) if len(parts) > 2 else 0,
                        "buyer": parts[3].strip() if len(parts) > 3 else "",
                        "seller": parts[4].strip() if len(parts) > 4 else ""
                    }
                    if trade["lot"] > 0:
                        trades.append(trade)
                except (ValueError, IndexError):
                    continue
        
        return trades
