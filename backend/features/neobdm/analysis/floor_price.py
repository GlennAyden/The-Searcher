"""
Floor Price Analyzer for NeoBDM.

Calculates floor price based on institutional broker buy prices.
Floor Price = Weighted average of buy prices for institutional brokers.
"""
import pandas as pd
from typing import Dict, List
from shared.utils.broker_utils import get_institutional_brokers, get_foreign_brokers, get_broker_name


class FloorPriceAnalyzer:
    """Analyzes floor price from institutional broker data."""
    
    def get_floor_price_analysis(
        self,
        summary_df: pd.DataFrame,
        ticker: str,
        days: int = 30
    ) -> Dict:
        """
        Calculate floor price estimate based on institutional broker buy prices.
        
        Args:
            summary_df: DataFrame with broker summary data (already filtered by date range)
            ticker: Stock ticker symbol
            days: Number of days in the analysis window
            
        Returns:
            Dict with floor_price, confidence, and breakdown by broker
        """
        if summary_df.empty:
            return self._empty_result(ticker, days)
        
        # Get institutional broker sets
        institutional = get_institutional_brokers()
        foreign = get_foreign_brokers()
        smart_money_codes = institutional | foreign
        
        # Filter to buy side from institutional/foreign brokers
        inst_buys = summary_df[
            (summary_df['side'] == 'BUY') & 
            (summary_df['broker_code'].isin(smart_money_codes))
        ]
        
        if inst_buys.empty:
            return self._empty_result(ticker, days)
        
        # Calculate weighted average price
        total_value = float(inst_buys['net_value'].sum())
        total_lot = int(inst_buys['net_lot'].sum())
        
        if total_lot <= 0:
            return self._empty_result(ticker, days)
        
        # Floor price = Total Value / (Total Lot * 100)
        floor_price = total_value / (total_lot * 100)
        
        # Calculate confidence based on sample size and consistency
        unique_brokers = inst_buys['broker_code'].nunique()
        unique_dates = inst_buys['trade_date'].nunique()
        
        # Confidence score (0-100)
        broker_confidence = min(unique_brokers * 10, 30)  # Max 30
        date_confidence = min(unique_dates * 5, 40)  # Max 40
        volume_confidence = min(total_lot / 10000 * 10, 30)  # Max 30
        
        confidence_score = broker_confidence + date_confidence + volume_confidence
        
        # Confidence level
        if confidence_score >= 70:
            confidence_level = "HIGH"
        elif confidence_score >= 40:
            confidence_level = "MEDIUM"
        else:
            confidence_level = "LOW"
        
        # Breakdown by broker
        broker_breakdown = []
        for broker_code in inst_buys['broker_code'].unique():
            broker_data = inst_buys[inst_buys['broker_code'] == broker_code]
            broker_value = float(broker_data['net_value'].sum())
            broker_lot = int(broker_data['net_lot'].sum())
            
            if broker_lot > 0:
                broker_avg_price = broker_value / (broker_lot * 100)
                broker_breakdown.append({
                    "broker_code": broker_code,
                    "broker_name": get_broker_name(broker_code),
                    "total_lot": broker_lot,
                    "total_value": broker_value,
                    "avg_price": round(broker_avg_price, 2),
                    "trade_count": len(broker_data)
                })
        
        # Sort by total lot descending
        broker_breakdown.sort(key=lambda x: x['total_lot'], reverse=True)
        
        # Price range (min/max avg prices from institutional)
        avg_prices = []
        for _, row in inst_buys.iterrows():
            if row.get('avg_price') and row['avg_price'] > 0:
                avg_prices.append(row['avg_price'])
        
        price_min = min(avg_prices) if avg_prices else floor_price
        price_max = max(avg_prices) if avg_prices else floor_price
        
        return {
            "ticker": ticker.upper(),
            "days_analyzed": days,
            "floor_price": round(floor_price, 2),
            "price_range": {
                "min": round(price_min, 2),
                "max": round(price_max, 2)
            },
            "confidence": {
                "score": round(confidence_score, 1),
                "level": confidence_level,
                "factors": {
                    "broker_diversity": unique_brokers,
                    "date_coverage": unique_dates,
                    "volume_size": total_lot
                }
            },
            "totals": {
                "total_lot": total_lot,
                "total_value": total_value,
                "broker_count": unique_brokers
            },
            "broker_breakdown": broker_breakdown[:10]  # Top 10
        }
    
    def _empty_result(self, ticker: str, days: int) -> Dict:
        """Return empty result structure."""
        return {
            "ticker": ticker.upper(),
            "days_analyzed": days,
            "floor_price": 0,
            "price_range": {"min": 0, "max": 0},
            "confidence": {
                "score": 0,
                "level": "LOW",
                "factors": {"broker_diversity": 0, "date_coverage": 0, "volume_size": 0}
            },
            "totals": {"total_lot": 0, "total_value": 0, "broker_count": 0},
            "broker_breakdown": []
        }
