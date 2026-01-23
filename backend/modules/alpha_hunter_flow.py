"""
Alpha Hunter Smart Money Flow Analyzer.
Provides validation logic for Stage 3: checking institutional accumulation,
retail capitulation, imposter activity, and floor price safety.
"""
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from modules.database import DatabaseManager
from modules.broker_utils import get_retail_brokers, get_imposter_suspects


class AlphaHunterFlow:
    def __init__(self):
        self.db = DatabaseManager()
        
    def analyze_smart_money_flow(self, ticker: str, days: int = 7) -> Dict:
        """
        Aggregate validation metrics for Stage 3.
        Returns checklist with pass/fail status.
        """
        ticker = ticker.upper()
        
        # Initialize result structure
        result = {
            "ticker": ticker,
            "institutional_accumulation": {
                "passed": False,
                "net_lot": 0,
                "net_value": 0,
                "top_brokers": []
            },
            "retail_capitulation": {
                "passed": False,
                "net_lot": 0,
                "pct_sold": 0
            },
            "imposter_detected": {
                "passed": False,
                "suspects": []
            },
            "floor_price_safe": {
                "passed": False,
                "floor_price": 0,
                "current_price": 0,
                "gap_pct": 0
            },
            "overall_conviction": "LOW",
            "checks_passed": 0,
            "total_checks": 4,
            "data_available": False
        }
        
        try:
            # 1. Get Floor Price Analysis (includes institutional brokers data)
            floor_data = self.db.get_floor_price_analysis(ticker, days=days if days > 0 else 9999)
            
            if floor_data and floor_data.get('confidence') != 'NO_DATA':
                result["data_available"] = True
                
                # Floor Price Check
                floor_price = floor_data.get('floor_price', 0)
                result["floor_price_safe"]["floor_price"] = floor_price
                
                # Get current price from volume history
                vol_history = self.db.get_volume_history(ticker)
                if vol_history:
                    current_price = vol_history[-1].get('close_price', 0)
                    result["floor_price_safe"]["current_price"] = current_price
                    
                    if floor_price > 0 and current_price > 0:
                        gap_pct = ((current_price - floor_price) / floor_price) * 100
                        result["floor_price_safe"]["gap_pct"] = round(gap_pct, 2)
                        
                        # Pass if current price is within 10% above floor
                        if gap_pct <= 10:
                            result["floor_price_safe"]["passed"] = True
                            result["checks_passed"] += 1
                
                # Institutional Accumulation Check
                inst_lot = floor_data.get('institutional_buy_lot', 0)
                inst_value = floor_data.get('institutional_buy_value', 0)
                inst_brokers = floor_data.get('institutional_brokers', [])
                
                result["institutional_accumulation"]["net_lot"] = inst_lot
                result["institutional_accumulation"]["net_value"] = inst_value
                result["institutional_accumulation"]["top_brokers"] = [
                    {"code": b.get('code'), "lot": b.get('total_lot'), "avg_price": b.get('avg_price')}
                    for b in inst_brokers[:5]
                ]
                
                # Pass if institutional gross buy > 0
                if inst_lot > 0:
                    result["institutional_accumulation"]["passed"] = True
                    result["checks_passed"] += 1
            
            # 2. Check Retail Capitulation (from broker summary)
            # We need to aggregate retail broker net sell
            retail_analysis = self._analyze_retail_flow(ticker, days)
            if retail_analysis:
                result["retail_capitulation"] = retail_analysis
                if retail_analysis["passed"]:
                    result["checks_passed"] += 1
            
            # 3. Check for Imposters
            imposter_analysis = self._detect_imposters(ticker, days)
            if imposter_analysis:
                result["imposter_detected"] = imposter_analysis
                if imposter_analysis["passed"]:
                    result["checks_passed"] += 1
            
            # 4. Calculate Overall Conviction
            if result["checks_passed"] >= 4:
                result["overall_conviction"] = "HIGH"
            elif result["checks_passed"] >= 3:
                result["overall_conviction"] = "MEDIUM"
            else:
                result["overall_conviction"] = "LOW"
                
        except Exception as e:
            print(f"[!] Error analyzing flow for {ticker}: {e}")
            result["error"] = str(e)
        
        return result
    
    def _analyze_retail_flow(self, ticker: str, days: int) -> Dict:
        """Analyze retail broker net flow."""
        # Use centralized broker classification
        retail_brokers = get_retail_brokers()
        
        result = {
            "passed": False,
            "net_lot": 0,
            "pct_sold": 0
        }
        
        try:
            # Get available dates
            dates_data = self.db.get_available_dates_for_ticker(ticker)
            if not dates_data or not dates_data.get('available_dates'):
                return result
            
            available_dates = sorted(dates_data['available_dates'], reverse=True)
            dates_to_check = available_dates[:min(days, len(available_dates))]
            
            total_retail_net = 0
            
            for date in dates_to_check:
                summary = self.db.get_broker_summary(ticker, date)
                if not summary:
                    continue
                    
                buy_data = summary.get('buy', [])
                sell_data = summary.get('sell', [])
                
                # Create lookup for buy/sell by broker
                buy_by_broker = {b['broker']: b for b in buy_data}
                sell_by_broker = {s['broker']: s for s in sell_data}
                
                for broker in retail_brokers:
                    buy_lot = float(buy_by_broker.get(broker, {}).get('nlot', 0) or 0)
                    sell_lot = float(sell_by_broker.get(broker, {}).get('nlot', 0) or 0)
                    total_retail_net += (buy_lot - sell_lot)
            
            result["net_lot"] = int(total_retail_net)
            
            # Retail capitulation = net sell (negative net)
            if total_retail_net < 0:
                result["passed"] = True
                
        except Exception as e:
            print(f"[!] Error analyzing retail flow: {e}")
            
        return result
    
    def _detect_imposters(self, ticker: str, days: int) -> Dict:
        """Detect potential imposters (retail brokers with institutional behavior)."""
        # Use centralized broker classification
        suspect_brokers = get_imposter_suspects()
        
        result = {
            "passed": False,
            "suspects": []
        }
        
        try:
            dates_data = self.db.get_available_dates_for_ticker(ticker)
            if not dates_data or not dates_data.get('available_dates'):
                return result
            
            available_dates = sorted(dates_data['available_dates'], reverse=True)
            dates_to_check = available_dates[:min(days, len(available_dates))]
            
            broker_activity = {}
            
            for date in dates_to_check:
                summary = self.db.get_broker_summary(ticker, date)
                if not summary:
                    continue
                    
                buy_data = summary.get('buy', [])
                
                for item in buy_data:
                    broker = item.get('broker', '')
                    if broker in suspect_brokers:
                        lot = float(item.get('nlot', 0) or 0)
                        value = float(item.get('nval', 0) or 0)
                        
                        if broker not in broker_activity:
                            broker_activity[broker] = {"total_lot": 0, "total_value": 0, "days": 0}
                        
                        broker_activity[broker]["total_lot"] += lot
                        broker_activity[broker]["total_value"] += value
                        broker_activity[broker]["days"] += 1
            
            # Identify imposters: retail brokers with unusually large positions
            for broker, data in broker_activity.items():
                # Threshold: > 1000 lot accumulation = suspicious
                if data["total_lot"] > 1000:
                    result["suspects"].append({
                        "broker": broker,
                        "total_lot": int(data["total_lot"]),
                        "total_value": round(data["total_value"], 2),
                        "days_active": data["days"]
                    })
            
            # Sort by lot size
            result["suspects"].sort(key=lambda x: x["total_lot"], reverse=True)
            
            # Pass if we found any imposters (this is a positive signal!)
            if len(result["suspects"]) > 0:
                result["passed"] = True
                
        except Exception as e:
            print(f"[!] Error detecting imposters: {e}")
            
        return result
