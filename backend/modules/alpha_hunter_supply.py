"""
Alpha Hunter Supply Analyzer.
Provides analysis for Stage 4: retail inventory (50% rule), imposter detection,
one-click hunter, and entry zone recommendations.
"""
from typing import Dict, List, Optional, Set
import math
from db import DoneDetailRepository
from modules.database import DatabaseManager
from modules.broker_utils import (
    get_retail_brokers,
    get_mixed_brokers,
    classify_broker
)


class AlphaHunterSupply:
    def __init__(self):
        self.db = DatabaseManager()
    
    def analyze_supply(
        self,
        ticker: str,
        done_detail_data: List[Dict] = None,
        analysis_start_date: Optional[str] = None,
        analysis_end_date: Optional[str] = None
    ) -> Dict:
        """
        Analyze supply dynamics from Done Detail data.
        If done_detail_data not provided, use DB data and range analysis.
        """
        ticker = ticker.upper()
        
        result = {
            "ticker": ticker,
            "fifty_pct_rule": {
                "passed": False,
                "retail_buy": 0,
                "retail_sell": 0,
                "retail_initial": 0,
                "retail_remaining": 0,
                "depletion_pct": 0,
                "status": "UNKNOWN",
                "safe_count": 0,
                "holding_count": 0,
                "source": "single_day",
                "date_range": {"start": None, "end": None},
                "top_brokers": []
            },
            "imposter_detection": {
                "passed": False,
                "total_imposter_trades": 0,
                "avg_daily_imposter_pct": 0,
                "top_ghost_broker": None,
                "peak_day": None,
                "brokers": [],
                "source": "single_day",
                "date_range": {"start": None, "end": None}
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
            "analysis_range": {"start": None, "end": None},
            "data_available": False,
            "total_trades": 0
        }
        
        range_analysis = None
        repo = DoneDetailRepository()

        # Try to get data from DB if not provided
        if not done_detail_data:
            try:
                date_range = repo.get_date_range(ticker)
                range_start = analysis_start_date or date_range.get("min_date")
                range_end = analysis_end_date or date_range.get("max_date")

                if range_start and range_end:
                    range_analysis = repo.get_range_analysis_from_synthesis(
                        ticker,
                        range_start,
                        range_end
                    )
                    if range_analysis and not range_analysis.get("error"):
                        result["analysis_range"] = {"start": range_start, "end": range_end}
                        result["fifty_pct_rule"]["source"] = "range"
                        result["imposter_detection"]["source"] = "range"

                latest_date = date_range.get("max_date") or (date_range.get("dates") or [None])[0]
                if latest_date:
                    records_df = repo.get_records(ticker, latest_date)
                    done_detail_data = self._normalize_trades(records_df.to_dict("records"))
            except Exception as e:
                print(f"[!] Could not fetch from DB: {e}")
        else:
            done_detail_data = self._normalize_trades(done_detail_data)
        
        if not done_detail_data and not (range_analysis and not range_analysis.get("error")):
            return result

        done_detail_data = done_detail_data or []
        if done_detail_data:
            result["data_available"] = True
            result["total_trades"] = len(done_detail_data)
        elif range_analysis and not range_analysis.get("error"):
            result["data_available"] = True
        
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
        
        # Range-based inventory + imposter detection (preferred)
        if range_analysis and not range_analysis.get("error"):
            result["fifty_pct_rule"] = self._build_fifty_rule_from_range(range_analysis)
            result["imposter_detection"] = self._build_imposter_from_range(range_analysis)
            result["analysis_range"] = {
                "start": range_analysis.get("date_range", {}).get("start"),
                "end": range_analysis.get("date_range", {}).get("end")
            }
        else:
            result["fifty_pct_rule"] = self._check_fifty_rule_single_day(broker_buy, broker_sell)
            result["imposter_detection"] = self._detect_imposter_from_trades(done_detail_data)
        
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
    
    def _normalize_trades(self, trades: List[Dict]) -> List[Dict]:
        """Normalize trade fields from DB or pasted TSV into a common schema."""
        normalized = []
        for trade in trades or []:
            buyer = trade.get('buyer')
            seller = trade.get('seller')
            if buyer is None:
                buyer = trade.get('buyer_code', '')
            if seller is None:
                seller = trade.get('seller_code', '')

            lot = trade.get('lot')
            if lot is None:
                lot = trade.get('qty', 0)

            time_str = trade.get('time')
            if time_str is None:
                time_str = trade.get('trade_time', '')

            normalized.append({
                "time": time_str or "",
                "price": float(trade.get('price', 0) or 0),
                "lot": int(lot or 0),
                "buyer": str(buyer or "").strip(),
                "seller": str(seller or "").strip()
            })
        return normalized

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
    
    def _check_fifty_rule_single_day(self, broker_buy: Dict, broker_sell: Dict) -> Dict:
        """
        Check 50% Rule: Retail should have sold at least 50% of their holdings.
        """
        result = {
            "passed": False,
            "retail_buy": 0,
            "retail_sell": 0,
            "retail_initial": 0,
            "retail_remaining": 0,
            "depletion_pct": 0,
            "status": "UNKNOWN",
            "safe_count": 0,
            "holding_count": 0,
            "source": "single_day",
            "date_range": {"start": None, "end": None},
            "top_brokers": []
        }
        
        # Calculate retail buy and sell using centralized classification
        retail_brokers = get_retail_brokers()
        retail_buy = sum(broker_buy.get(b, {}).get("lot", 0) for b in retail_brokers if b in broker_buy)
        retail_sell = sum(broker_sell.get(b, {}).get("lot", 0) for b in retail_brokers if b in broker_sell)
        
        result["retail_buy"] = retail_buy
        result["retail_sell"] = retail_sell
        result["retail_initial"] = retail_buy
        result["retail_remaining"] = max(0, retail_buy - retail_sell)
        
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

    def _build_fifty_rule_from_range(self, range_analysis: Dict) -> Dict:
        """Build 50% rule result from range analysis."""
        retail_cap = range_analysis.get("retail_capitulation", {})
        brokers = retail_cap.get("brokers", [])
        overall_pct = float(retail_cap.get("overall_pct", 0) or 0)

        total_peak = sum(b.get("peak_position", 0) for b in brokers)
        total_current = sum(b.get("current_position", 0) for b in brokers)

        passed = overall_pct >= 50
        status = "RETAIL_CAPITULATED" if passed else "RETAIL_HOLDING"

        return {
            "passed": passed,
            "retail_buy": 0,
            "retail_sell": 0,
            "retail_initial": round(total_peak, 2),
            "retail_remaining": round(max(0, total_current), 2),
            "depletion_pct": round(overall_pct, 1),
            "status": status,
            "safe_count": retail_cap.get("safe_count", 0),
            "holding_count": retail_cap.get("holding_count", 0),
            "source": "range",
            "date_range": range_analysis.get("date_range", {"start": None, "end": None}),
            "top_brokers": [
                {
                    "broker": b.get("broker"),
                    "distribution_pct": b.get("distribution_pct"),
                    "peak_position": b.get("peak_position"),
                    "current_position": b.get("current_position"),
                    "is_safe": b.get("is_safe")
                }
                for b in brokers[:5]
            ]
        }

    def _build_imposter_from_range(self, range_analysis: Dict) -> Dict:
        """Build imposter result from range analysis."""
        summary = range_analysis.get("summary", {})
        imposter = range_analysis.get("imposter_recurrence", {})
        brokers = imposter.get("brokers", [])

        return {
            "passed": bool(summary.get("total_imposter_trades")),
            "total_imposter_trades": summary.get("total_imposter_trades", 0),
            "avg_daily_imposter_pct": summary.get("avg_daily_imposter_pct", 0),
            "top_ghost_broker": summary.get("top_ghost_broker"),
            "peak_day": summary.get("peak_day"),
            "brokers": [
                {
                    "broker": b.get("broker"),
                    "recurrence_pct": b.get("recurrence_pct"),
                    "avg_lot": b.get("avg_lot"),
                    "total_value": b.get("total_value"),
                    "total_count": b.get("total_count")
                }
                for b in brokers[:10]
            ],
            "source": "range",
            "date_range": range_analysis.get("date_range", {"start": None, "end": None})
        }

    def _detect_imposter_from_trades(self, trades: List[Dict]) -> Dict:
        """Detect imposters from a single-day trade list."""
        retail_brokers = set(get_retail_brokers()) | set(get_mixed_brokers())
        lots = [int(t.get("lot", 0) or 0) for t in trades if int(t.get("lot", 0) or 0) > 0]

        if not lots:
            return {
                "passed": False,
                "total_imposter_trades": 0,
                "avg_daily_imposter_pct": 0,
                "top_ghost_broker": None,
                "peak_day": None,
                "brokers": [],
                "source": "single_day",
                "date_range": {"start": None, "end": None}
            }

        lots_sorted = sorted(lots)
        threshold_index = max(0, int(math.ceil(len(lots_sorted) * 0.95)) - 1)
        threshold = lots_sorted[threshold_index]

        broker_stats = {}
        total_imposter = 0
        for trade in trades:
            lot = int(trade.get("lot", 0) or 0)
            if lot < threshold:
                continue

            buyer = trade.get("buyer", "")
            seller = trade.get("seller", "")
            price = float(trade.get("price", 0) or 0)
            value = lot * price * 100

            for broker in [buyer, seller]:
                if broker in retail_brokers:
                    stats = broker_stats.setdefault(broker, {"total_value": 0, "total_count": 0, "lot_sum": 0})
                    stats["total_value"] += value
                    stats["total_count"] += 1
                    stats["lot_sum"] += lot
                    total_imposter += 1

        brokers = []
        for broker, stats in broker_stats.items():
            avg_lot = stats["lot_sum"] / max(1, stats["total_count"])
            brokers.append({
                "broker": broker,
                "recurrence_pct": 100,
                "avg_lot": round(avg_lot, 0),
                "total_value": round(stats["total_value"], 2),
                "total_count": stats["total_count"]
            })

        brokers.sort(key=lambda x: x["total_value"], reverse=True)
        avg_daily_pct = round((total_imposter / max(1, len(trades))) * 100, 1)

        return {
            "passed": total_imposter > 0,
            "total_imposter_trades": total_imposter,
            "avg_daily_imposter_pct": avg_daily_pct,
            "top_ghost_broker": brokers[0]["broker"] if brokers else None,
            "peak_day": None,
            "brokers": brokers[:10],
            "source": "single_day",
            "date_range": {"start": None, "end": None}
        }
    
    def _get_strategy(self, analysis: Dict) -> str:
        """Generate strategy recommendation based on analysis."""
        fifty_passed = analysis["fifty_pct_rule"]["passed"]
        has_one_click = len(analysis["one_click_orders"]) > 0
        has_imposter = analysis.get("imposter_detection", {}).get("passed", False)
        
        inst_positions = analysis["broker_positions"]["institutional"]
        inst_buying = any(p["net_lot"] > 0 for p in inst_positions)
        
        if fifty_passed and inst_buying and has_one_click and has_imposter:
            return "STRONG BUY - All signals aligned"
        if fifty_passed and inst_buying and has_imposter:
            return "BUY - Smart money confirmed"
        if fifty_passed and inst_buying:
            return "BUY - Institutional accumulating, retail exiting"
        if inst_buying and has_one_click:
            return "SPECULATIVE BUY - Watch for confirmation"
        if fifty_passed:
            return "WAIT - Retail exiting but no institutional interest yet"
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
