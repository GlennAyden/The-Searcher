"""
Broker Summary Analyzer for NeoBDM.

Provides:
- Broker journey tracking (accumulation/distribution over time)
- Top holders analysis
"""
import pandas as pd
from typing import Dict, List


class BrokerSummaryAnalyzer:
    """Analyzes broker summary data for journey and holder patterns."""
    
    def get_broker_journey(
        self, 
        summary_df: pd.DataFrame,
        ticker: str,
        brokers: List[str],
        start_date: str,
        end_date: str,
        price_data: List[Dict] = None
    ) -> Dict:
        """
        Get broker journey showing accumulation/distribution over time.
        
        Args:
            summary_df: DataFrame from repository with broker summary data
            ticker: Stock ticker symbol
            brokers: List of broker codes to track
            start_date: Start date
            end_date: End date
            price_data: Optional price data list
            
        Returns:
            Dictionary with journey data, summaries, and price correlation
        """
        if summary_df.empty:
            return {
                "ticker": ticker.upper(),
                "date_range": {"start": start_date, "end": end_date},
                "brokers": brokers,
                "journey": [],
                "summaries": {},
                "price_data": price_data or []
            }
        
        # Filter to requested brokers
        broker_set = set(b.upper() for b in brokers)
        filtered_df = summary_df[summary_df['broker_code'].str.upper().isin(broker_set)]
        
        # Build journey data
        journey = []
        for date in sorted(filtered_df['trade_date'].unique()):
            date_data = filtered_df[filtered_df['trade_date'] == date]
            
            daily_entry = {"date": date, "brokers": {}}
            for _, row in date_data.iterrows():
                broker_code = row['broker_code'].upper()
                daily_entry["brokers"][broker_code] = {
                    "net_lot": int(row.get('net_lot', 0)),
                    "net_value": float(row.get('net_value', 0)),
                    "side": row.get('side', 'BUY'),
                    "avg_price": float(row.get('avg_price', 0))
                }
            journey.append(daily_entry)
        
        # Calculate summaries per broker
        summaries = {}
        for broker in brokers:
            broker_upper = broker.upper()
            broker_data = filtered_df[filtered_df['broker_code'].str.upper() == broker_upper]
            
            if broker_data.empty:
                summaries[broker_upper] = {
                    "total_net_lot": 0,
                    "total_net_value": 0,
                    "trade_count": 0,
                    "avg_price": 0,
                    "direction": "NEUTRAL"
                }
            else:
                total_net_lot = int(broker_data['net_lot'].sum())
                total_net_value = float(broker_data['net_value'].sum())
                
                summaries[broker_upper] = {
                    "total_net_lot": total_net_lot,
                    "total_net_value": total_net_value,
                    "trade_count": len(broker_data),
                    "avg_price": float(broker_data['avg_price'].mean()) if 'avg_price' in broker_data else 0,
                    "direction": "BUY" if total_net_lot > 0 else "SELL" if total_net_lot < 0 else "NEUTRAL"
                }
        
        return {
            "ticker": ticker.upper(),
            "date_range": {"start": start_date, "end": end_date},
            "brokers": brokers,
            "journey": journey,
            "summaries": summaries,
            "price_data": price_data or []
        }
    
    def get_top_holders_by_net_lot(
        self,
        summary_df: pd.DataFrame,
        ticker: str,
        limit: int = 3
    ) -> List[Dict]:
        """
        Get top holders based on cumulative net lot across all dates.
        
        Args:
            summary_df: DataFrame with broker summary data
            ticker: Stock ticker symbol
            limit: Number of top holders to return
            
        Returns:
            List of dictionaries with broker stats
        """
        if summary_df.empty:
            return []
        
        # Group by broker and aggregate
        grouped = summary_df.groupby('broker_code').agg({
            'net_lot': 'sum',
            'net_value': 'sum',
            'trade_date': ['count', 'min', 'max']
        }).reset_index()
        
        # Flatten column names
        grouped.columns = ['broker_code', 'total_net_lot', 'total_net_value', 
                          'trade_count', 'first_date', 'last_date']
        
        # Sort by absolute net lot
        grouped['abs_net_lot'] = grouped['total_net_lot'].abs()
        grouped = grouped.sort_values('abs_net_lot', ascending=False)
        
        # Return top N
        result = []
        for _, row in grouped.head(limit).iterrows():
            result.append({
                "broker_code": row['broker_code'],
                "total_net_lot": int(row['total_net_lot']),
                "total_net_value": float(row['total_net_value']),
                "trade_count": int(row['trade_count']),
                "first_date": row['first_date'],
                "last_date": row['last_date'],
                "direction": "BUY" if row['total_net_lot'] > 0 else "SELL"
            })
        
        return result
