"""
Alpha Hunter Smart Money Flow Analyzer.
Provides validation logic for Stage 3: smart money vs retail flow and floor price safety.
"""
from typing import Dict, List, Optional, Set
import math
from db.broker_five_repository import BrokerFiveRepository
from modules.database import DatabaseManager
from modules.broker_utils import (
    get_retail_brokers,
    get_institutional_brokers,
    get_foreign_brokers,
    get_stage3_smart_money_overrides,
    get_stage3_retail_overrides
)


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
            "smart_money_accumulation": {
                "passed": False,
                "net_lot": 0,
                "net_value": 0,
                "active_days": 0,
                "total_days": 0,
                "top_brokers": []
            },
            "retail_capitulation": {
                "passed": False,
                "net_lot": 0,
                "net_value": 0,
                "active_days": 0,
                "total_days": 0
            },
            "smart_vs_retail": {
                "passed": False,
                "dominance_pct": 0,
                "smart_net_lot": 0,
                "retail_net_lot": 0
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
            "data_available": False,
            "broker_groups": {
                "smart_money": [],
                "retail": [],
                "broker_five": []
            }
        }
        
        try:
            broker_groups = self._prepare_broker_groups(ticker)
            smart_brokers = set(broker_groups["smart_money"])
            retail_brokers = set(broker_groups["retail"])
            result["broker_groups"] = broker_groups

            flow_summary = self._aggregate_group_flow(ticker, days, smart_brokers, retail_brokers)
            if flow_summary:
                result["data_available"] = True
                result["smart_money_accumulation"]["net_lot"] = flow_summary["smart_net_lot"]
                result["smart_money_accumulation"]["net_value"] = flow_summary["smart_net_value"]
                result["smart_money_accumulation"]["active_days"] = flow_summary["smart_days_buy"]
                result["smart_money_accumulation"]["total_days"] = flow_summary["days_checked"]
                result["smart_money_accumulation"]["top_brokers"] = flow_summary["smart_top_brokers"]

                result["retail_capitulation"]["net_lot"] = flow_summary["retail_net_lot"]
                result["retail_capitulation"]["net_value"] = flow_summary["retail_net_value"]
                result["retail_capitulation"]["active_days"] = flow_summary["retail_days_sell"]
                result["retail_capitulation"]["total_days"] = flow_summary["days_checked"]

                smart_pass = flow_summary["smart_net_lot"] > 0 and flow_summary["smart_days_buy"] >= flow_summary["consistency_threshold"]
                retail_pass = flow_summary["retail_net_lot"] < 0 and flow_summary["retail_days_sell"] >= flow_summary["consistency_threshold"]
                dominance_pass = (
                    flow_summary["dominance_pct"] >= 60
                    and flow_summary["smart_net_lot"] > 0
                    and flow_summary["retail_net_lot"] < 0
                )

                result["smart_money_accumulation"]["passed"] = smart_pass
                result["retail_capitulation"]["passed"] = retail_pass
                result["smart_vs_retail"] = {
                    "passed": dominance_pass,
                    "dominance_pct": flow_summary["dominance_pct"],
                    "smart_net_lot": flow_summary["smart_net_lot"],
                    "retail_net_lot": flow_summary["retail_net_lot"]
                }

                if smart_pass:
                    result["checks_passed"] += 1
                if retail_pass:
                    result["checks_passed"] += 1
                if dominance_pass:
                    result["checks_passed"] += 1

            # Floor Price Analysis (institutional gross buy based)
            floor_data = self.db.get_floor_price_analysis(ticker, days=days if days > 0 else 0)
            if floor_data and floor_data.get('confidence') != 'NO_DATA':
                result["data_available"] = True

                floor_price = floor_data.get('floor_price', 0)
                result["floor_price_safe"]["floor_price"] = floor_price

                vol_history = self.db.get_volume_history(ticker)
                if vol_history:
                    current_price = vol_history[-1].get('close_price', 0)
                    result["floor_price_safe"]["current_price"] = current_price

                    if floor_price > 0 and current_price > 0:
                        gap_pct = ((current_price - floor_price) / floor_price) * 100
                        result["floor_price_safe"]["gap_pct"] = round(gap_pct, 2)

                        if gap_pct <= 10:
                            result["floor_price_safe"]["passed"] = True
                            result["checks_passed"] += 1

            # Calculate Overall Conviction
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
    
    def _prepare_broker_groups(self, ticker: str) -> Dict[str, List[str]]:
        """Prepare smart money and retail broker groups with overrides."""
        broker_five_repo = BrokerFiveRepository()
        broker_five_rows = broker_five_repo.list_brokers(ticker)
        broker_five = {item["broker_code"].upper() for item in broker_five_rows}

        smart_overrides = get_stage3_smart_money_overrides()
        retail_overrides = get_stage3_retail_overrides()

        smart_money = set(smart_overrides) | broker_five
        retail = set(retail_overrides)

        if not smart_money:
            smart_money.update(get_institutional_brokers())
            smart_money.update(get_foreign_brokers())
        if not retail:
            retail.update(get_retail_brokers())

        # Overrides win in case of overlaps.
        smart_money -= retail_overrides
        retail -= smart_overrides

        smart_money.discard("")
        retail.discard("")

        return {
            "smart_money": sorted(smart_money),
            "retail": sorted(retail),
            "broker_five": sorted(broker_five)
        }

    def _aggregate_group_flow(
        self,
        ticker: str,
        days: int,
        smart_brokers: Set[str],
        retail_brokers: Set[str]
    ) -> Optional[Dict]:
        """Aggregate net flow for broker groups across recent dates."""
        available_dates = self.db.get_available_dates_for_ticker(ticker)
        if not available_dates:
            return None

        dates_to_check = sorted(available_dates, reverse=True)[:min(days, len(available_dates))]
        if not dates_to_check:
            return None

        smart_net_lot = 0.0
        smart_net_value = 0.0
        retail_net_lot = 0.0
        retail_net_value = 0.0
        smart_days_buy = 0
        retail_days_sell = 0
        days_checked = 0
        smart_broker_net = {}

        for date in dates_to_check:
            summary = self.db.get_broker_summary(ticker, date)
            if not summary:
                continue

            net_by_broker = {}
            for item in summary.get('buy', []):
                broker = (item.get('broker') or '').upper()
                lot = float(item.get('nlot', 0) or 0)
                value = float(item.get('nval', 0) or 0)
                net_by_broker.setdefault(broker, {"net_lot": 0.0, "net_value": 0.0})
                net_by_broker[broker]["net_lot"] += lot
                net_by_broker[broker]["net_value"] += value

            for item in summary.get('sell', []):
                broker = (item.get('broker') or '').upper()
                lot = float(item.get('nlot', 0) or 0)
                value = float(item.get('nval', 0) or 0)
                net_by_broker.setdefault(broker, {"net_lot": 0.0, "net_value": 0.0})
                net_by_broker[broker]["net_lot"] -= lot
                net_by_broker[broker]["net_value"] -= value

            if not net_by_broker:
                continue

            days_checked += 1
            smart_day_lot = 0.0
            smart_day_value = 0.0
            retail_day_lot = 0.0
            retail_day_value = 0.0

            for broker, net in net_by_broker.items():
                if broker in smart_brokers:
                    smart_day_lot += net["net_lot"]
                    smart_day_value += net["net_value"]
                    smart_broker_net.setdefault(broker, {"net_lot": 0.0, "net_value": 0.0})
                    smart_broker_net[broker]["net_lot"] += net["net_lot"]
                    smart_broker_net[broker]["net_value"] += net["net_value"]
                if broker in retail_brokers:
                    retail_day_lot += net["net_lot"]
                    retail_day_value += net["net_value"]

            smart_net_lot += smart_day_lot
            smart_net_value += smart_day_value
            retail_net_lot += retail_day_lot
            retail_net_value += retail_day_value

            if smart_day_lot > 0:
                smart_days_buy += 1
            if retail_day_lot < 0:
                retail_days_sell += 1

        if days_checked == 0:
            return None

        denom = abs(smart_net_value) + abs(retail_net_value)
        dominance_pct = round((abs(smart_net_value) / denom) * 100, 1) if denom > 0 else 0
        consistency_threshold = max(1, math.ceil(days_checked * 0.5))

        top_brokers = [
            {
                "code": broker,
                "net_lot": int(net["net_lot"]),
                "net_value": round(net["net_value"], 2)
            }
            for broker, net in smart_broker_net.items()
            if net["net_lot"] > 0
        ]
        top_brokers.sort(key=lambda x: x["net_lot"], reverse=True)

        return {
            "smart_net_lot": int(smart_net_lot),
            "smart_net_value": round(smart_net_value, 2),
            "retail_net_lot": int(retail_net_lot),
            "retail_net_value": round(retail_net_value, 2),
            "smart_days_buy": smart_days_buy,
            "retail_days_sell": retail_days_sell,
            "days_checked": days_checked,
            "dominance_pct": dominance_pct,
            "consistency_threshold": consistency_threshold,
            "smart_top_brokers": top_brokers[:5]
        }
