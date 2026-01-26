"""
Combined Analyzer for Done Detail.

Provides:
- Combined signal analysis (merging Imposter + Speed)
- Range analysis (multi-day aggregation)
- Broker profile analysis
"""
from typing import Dict, List
from shared.utils.broker_utils import get_broker_name


class CombinedAnalyzer:
    """Combined and range-based analysis."""
    
    def get_combined_analysis(
        self,
        imposter_data: Dict,
        speed_data: Dict,
        ticker: str,
        start_date: str,
        end_date: str
    ) -> Dict:
        """
        Merge Imposter and Speed data for trading signals.
        
        Args:
            imposter_data: Result from ImposterAnalyzer
            speed_data: Result from SpeedAnalyzer
            ticker: Stock ticker
            start_date: Start date
            end_date: End date
            
        Returns:
            Dict with combined signal analysis
        """
        # Get top brokers from both analyses
        imposter_brokers = {b["broker"]: b for b in imposter_data.get("by_broker", [])}
        speed_brokers = {b["broker"]: b for b in speed_data.get("speed_by_broker", [])}
        
        # Find power brokers (in both lists)
        power_brokers = []
        for broker in imposter_brokers:
            if broker in speed_brokers:
                imp = imposter_brokers[broker]
                spd = speed_brokers[broker]
                power_brokers.append({
                    "broker": broker,
                    "name": get_broker_name(broker),
                    "imposter_value": imp.get("total_value", 0),
                    "imposter_count": imp.get("count", 0),
                    "speed_trades": spd.get("total_trades", 0),
                    "trades_per_second": spd.get("trades_per_second", 0),
                    "net_direction": "BUY" if imp.get("buy_value", 0) > imp.get("sell_value", 0) else "SELL"
                })
        
        power_brokers.sort(key=lambda x: x["imposter_value"], reverse=True)
        
        # Calculate overall signal
        summary = imposter_data.get("summary", {})
        imposter_value = summary.get("imposter_value", 0)
        strong_count = summary.get("strong_count", 0)
        
        # Net direction from imposter trades
        imposter_trades = imposter_data.get("imposter_trades", [])
        buy_value = sum(t.get("value", 0) for t in imposter_trades if t.get("direction") == "BUY")
        sell_value = sum(t.get("value", 0) for t in imposter_trades if t.get("direction") == "SELL")
        
        net_direction = "BULLISH" if buy_value > sell_value else "BEARISH" if sell_value > buy_value else "NEUTRAL"
        net_value = abs(buy_value - sell_value)
        
        # Signal strength
        if strong_count >= 50 and imposter_value > 1_000_000_000:
            signal_strength = "SANGAT KUAT"
        elif strong_count >= 20 or imposter_value > 500_000_000:
            signal_strength = "KUAT"
        elif strong_count >= 5 or imposter_value > 100_000_000:
            signal_strength = "SEDANG"
        else:
            signal_strength = "LEMAH"
        
        return {
            "ticker": ticker.upper(),
            "date_range": {"start": start_date, "end": end_date},
            "signal": {
                "direction": net_direction,
                "strength": signal_strength,
                "buy_value": buy_value,
                "sell_value": sell_value,
                "net_value": net_value
            },
            "power_brokers": power_brokers[:10],
            "imposter_summary": summary,
            "speed_summary": speed_data.get("summary", {}),
            "burst_events": speed_data.get("burst_events", [])[:20]
        }
    
    def get_range_analysis_from_synthesis(
        self,
        synthesis_list: List[Dict],
        ticker: str,
        start_date: str,
        end_date: str
    ) -> Dict:
        """
        Aggregate range analysis from pre-computed synthesis data.
        
        Args:
            synthesis_list: List of synthesis dicts from repository
            ticker: Stock ticker
            start_date: Start date
            end_date: End date
            
        Returns:
            Range analysis aggregated from synthesis
        """
        if not synthesis_list:
            return self._empty_range_result(ticker, start_date, end_date)
        
        # Aggregate across days
        total_imposter_value = 0
        total_imposter_lot = 0
        total_transactions = 0
        broker_aggregate = {}
        daily_timeline = []
        
        for synth in synthesis_list:
            imp_data = synth.get("imposter_data", {})
            trade_date = synth.get("trade_date", "")
            
            summary = imp_data.get("summary", {})
            total_imposter_value += summary.get("imposter_value", 0)
            total_imposter_lot += summary.get("imposter_lot", 0)
            total_transactions += imp_data.get("total_transactions", 0)
            
            # Daily summary for timeline
            daily_timeline.append({
                "date": trade_date,
                "imposter_value": summary.get("imposter_value", 0),
                "imposter_count": imp_data.get("imposter_count", 0),
                "strong_count": summary.get("strong_count", 0)
            })
            
            # Aggregate broker stats
            for broker in imp_data.get("by_broker", []):
                code = broker.get("broker", "")
                if code not in broker_aggregate:
                    broker_aggregate[code] = {
                        "broker": code,
                        "name": broker.get("name", code),
                        "total_value": 0,
                        "total_lot": 0,
                        "count": 0,
                        "days_active": 0,
                        "buy_value": 0,
                        "sell_value": 0
                    }
                
                agg = broker_aggregate[code]
                agg["total_value"] += broker.get("total_value", 0)
                agg["total_lot"] += broker.get("total_lot", 0)
                agg["count"] += broker.get("count", 0)
                agg["days_active"] += 1
                agg["buy_value"] += broker.get("buy_value", 0)
                agg["sell_value"] += broker.get("sell_value", 0)
        
        # Sort brokers by total value
        top_brokers = sorted(
            broker_aggregate.values(),
            key=lambda x: x["total_value"],
            reverse=True
        )[:20]
        
        # Identify recurring imposters (present on multiple days)
        recurring = [b for b in top_brokers if b["days_active"] > 1]
        
        return {
            "ticker": ticker.upper(),
            "date_range": {"start": start_date, "end": end_date},
            "days_analyzed": len(synthesis_list),
            "summary": {
                "total_imposter_value": total_imposter_value,
                "total_imposter_lot": total_imposter_lot,
                "total_transactions": total_transactions
            },
            "top_brokers": top_brokers,
            "recurring_imposters": recurring,
            "daily_timeline": sorted(daily_timeline, key=lambda x: x["date"])
        }
    
    def _empty_range_result(self, ticker: str, start_date: str, end_date: str) -> Dict:
        """Return empty range result."""
        return {
            "ticker": ticker.upper(),
            "date_range": {"start": start_date, "end": end_date},
            "days_analyzed": 0,
            "summary": {
                "total_imposter_value": 0,
                "total_imposter_lot": 0,
                "total_transactions": 0
            },
            "top_brokers": [],
            "recurring_imposters": [],
            "daily_timeline": []
        }
