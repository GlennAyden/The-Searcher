"""
Visualization Analyzer for Done Detail.

Generates chart data:
- Sankey diagram (broker flow)
- Inventory chart (position over time)
- Accumulation/Distribution analysis
"""
import pandas as pd
from typing import Dict, List
from shared.utils.broker_utils import get_broker_categories


class VisualizationAnalyzer:
    """Generates visualization data from trade records."""
    
    def get_sankey_data(self, flow_df: pd.DataFrame) -> Dict:
        """
        Generate Sankey diagram data from aggregated flow data.
        
        Args:
            flow_df: DataFrame with seller_code, buyer_code, total_qty, total_value, avg_price
            
        Returns:
            Dict with nodes and links for Sankey chart
        """
        if flow_df.empty:
            return {"nodes": [], "links": []}
        
        # Build unique broker list
        sellers = flow_df['seller_code'].unique().tolist()
        buyers = flow_df['buyer_code'].unique().tolist()
        
        # Create nodes: sellers first, then buyers
        nodes = []
        seller_idx = {}
        buyer_idx = {}
        
        for i, s in enumerate(sellers):
            seller_idx[s] = i
            nodes.append({"name": s, "type": "seller"})
        
        offset = len(sellers)
        for i, b in enumerate(buyers):
            buyer_idx[b] = offset + i
            nodes.append({"name": b, "type": "buyer"})
        
        # Create links
        links = []
        for _, row in flow_df.iterrows():
            links.append({
                "source": seller_idx[row['seller_code']],
                "target": buyer_idx[row['buyer_code']],
                "value": int(row['total_qty']),
                "lot": int(row['total_qty']),
                "val": float(row['total_value']) if row['total_value'] else 0,
                "avgPrice": float(row['avg_price']) if row['avg_price'] else 0
            })
        
        return {"nodes": nodes, "links": links}
    
    def get_inventory_data(self, time_series_df: pd.DataFrame) -> Dict:
        """
        Generate Daily Inventory chart data.
        
        Args:
            time_series_df: DataFrame with trade_time, price, qty, buyer_code, seller_code
            
        Returns:
            Dict with brokers, timeSeries, and priceData
        """
        if time_series_df.empty:
            return {"brokers": [], "timeSeries": [], "priceData": []}
        
        # Calculate net position per broker over time
        broker_positions = {}
        time_series = []
        price_data = []
        
        # Get unique brokers
        all_brokers = set(time_series_df['buyer_code'].unique()) | set(time_series_df['seller_code'].unique())
        for broker in all_brokers:
            broker_positions[broker] = 0
        
        # Process trades chronologically
        current_time = None
        snapshot = {}
        
        for _, row in time_series_df.iterrows():
            time = row['trade_time']
            price = row['price']
            qty = row['qty']
            buyer = row['buyer_code']
            seller = row['seller_code']
            
            # Update positions
            broker_positions[buyer] = broker_positions.get(buyer, 0) + qty
            broker_positions[seller] = broker_positions.get(seller, 0) - qty
            
            # Add time point
            if time != current_time:
                if current_time is not None:
                    time_series.append({"time": current_time, **snapshot.copy()})
                current_time = time
                snapshot = {b: broker_positions[b] for b in all_brokers}
                price_data.append({"time": time, "price": price})
            else:
                snapshot = {b: broker_positions[b] for b in all_brokers}
        
        # Add final snapshot
        if current_time:
            time_series.append({"time": current_time, **snapshot})
        
        return {
            "brokers": list(all_brokers),
            "timeSeries": time_series,
            "priceData": price_data
        }
    
    def get_accum_dist_analysis(self, broker_flows_df: pd.DataFrame) -> Dict:
        """
        Analyze accumulation/distribution pattern based on broker classification.
        
        Args:
            broker_flows_df: DataFrame with buyer_code, seller_code, qty, price
            
        Returns:
            Dict with status (AKUMULASI/DISTRIBUSI/NETRAL) and breakdown
        """
        if broker_flows_df.empty:
            return {
                "status": "NO_DATA",
                "retail_net_lot": 0,
                "institutional_net_lot": 0,
                "foreign_net_lot": 0,
                "retail_brokers": [],
                "institutional_brokers": [],
                "foreign_brokers": [],
                "total_volume": 0
            }
        
        # Calculate net lot per broker
        broker_net = {}
        for _, row in broker_flows_df.iterrows():
            buyer = row['buyer_code']
            seller = row['seller_code']
            qty = row['qty']
            
            broker_net[buyer] = broker_net.get(buyer, 0) + qty
            broker_net[seller] = broker_net.get(seller, 0) - qty
        
        # Aggregate by category
        retail_net = 0
        institutional_net = 0
        foreign_net = 0
        
        retail_brokers = []
        institutional_brokers = []
        foreign_brokers = []
        
        for broker_code, net_lot in broker_net.items():
            categories = get_broker_categories(broker_code)
            broker_info = {"code": broker_code, "net_lot": int(net_lot)}
            
            if 'retail' in categories:
                retail_net += net_lot
                retail_brokers.append(broker_info)
            if 'institutional' in categories:
                institutional_net += net_lot
                institutional_brokers.append(broker_info)
            if 'foreign' in categories:
                foreign_net += net_lot
                foreign_brokers.append(broker_info)
            
            # Unknown category treated as retail
            if 'unknown' in categories or len(categories) == 0:
                retail_net += net_lot
                retail_brokers.append(broker_info)
        
        # Sort by absolute net_lot
        retail_brokers.sort(key=lambda x: abs(x['net_lot']), reverse=True)
        institutional_brokers.sort(key=lambda x: abs(x['net_lot']), reverse=True)
        foreign_brokers.sort(key=lambda x: abs(x['net_lot']), reverse=True)
        
        # Determine status
        total_volume = int(broker_flows_df['qty'].sum())
        
        if institutional_net > 0 and retail_net < 0:
            status = "AKUMULASI"
        elif institutional_net < 0 and retail_net > 0:
            status = "DISTRIBUSI"
        else:
            status = "NETRAL"
        
        return {
            "status": status,
            "retail_net_lot": int(retail_net),
            "institutional_net_lot": int(institutional_net),
            "foreign_net_lot": int(foreign_net),
            "retail_brokers": retail_brokers[:10],
            "institutional_brokers": institutional_brokers[:10],
            "foreign_brokers": foreign_brokers[:10],
            "total_volume": total_volume
        }
