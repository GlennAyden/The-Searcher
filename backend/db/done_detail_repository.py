"""Done Detail repository for paste-based trade data analysis."""
import pandas as pd
from typing import Optional, List, Dict
from .connection import BaseRepository


class DoneDetailRepository(BaseRepository):
    """Repository for Done Detail records (pasted trade data)."""
    
    def check_exists(self, ticker: str, trade_date: str) -> bool:
        """
        Check if data exists for a ticker and date.
        
        Args:
            ticker: Stock symbol
            trade_date: Date string (YYYY-MM-DD)
        
        Returns:
            True if data exists
        """
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                "SELECT COUNT(*) FROM done_detail_records WHERE ticker = ? AND trade_date = ?",
                (ticker.upper(), trade_date)
            )
            count = cursor.fetchone()[0]
            return count > 0
        except Exception as e:
            print(f"[!] Error checking done detail exists: {e}")
            return False
        finally:
            conn.close()
    
    def save_records(self, ticker: str, trade_date: str, records: List[Dict]) -> int:
        """
        Save parsed trade records.
        
        Args:
            ticker: Stock symbol
            trade_date: Date string (YYYY-MM-DD)
            records: List of trade dictionaries
        
        Returns:
            Number of records saved
        """
        conn = self._get_conn()
        try:
            # Delete existing records for this ticker/date
            conn.execute(
                "DELETE FROM done_detail_records WHERE ticker = ? AND trade_date = ?",
                (ticker.upper(), trade_date)
            )
            
            query = """
            INSERT INTO done_detail_records 
            (ticker, trade_date, trade_time, board, price, qty, buyer_type, buyer_code, seller_code, seller_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            rows = []
            for rec in records:
                row = (
                    ticker.upper(),
                    trade_date,
                    rec.get('time'),
                    rec.get('board'),
                    rec.get('price'),
                    rec.get('qty'),
                    rec.get('buyer_type'),
                    rec.get('buyer_code'),
                    rec.get('seller_code'),
                    rec.get('seller_type')
                )
                rows.append(row)
            
            conn.executemany(query, rows)
            conn.commit()
            print(f"[*] Saved {len(rows)} done detail records for {ticker} on {trade_date}")
            return len(rows)
        except Exception as e:
            print(f"[!] Error saving done detail records: {e}")
            conn.rollback()
            return 0
        finally:
            conn.close()
    
    def get_records(self, ticker: str, trade_date: str) -> pd.DataFrame:
        """
        Get records for a specific ticker and date.
        
        Args:
            ticker: Stock symbol
            trade_date: Date string (YYYY-MM-DD)
        
        Returns:
            DataFrame with trade records
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT * FROM done_detail_records
            WHERE ticker = ? AND trade_date = ?
            ORDER BY trade_time ASC
            """
            df = pd.read_sql(query, conn, params=(ticker.upper(), trade_date))
            return df
        except Exception as e:
            print(f"[!] Error fetching done detail records: {e}")
            return pd.DataFrame()
        finally:
            conn.close()
    
    def get_saved_history(self) -> pd.DataFrame:
        """
        Get all saved ticker/date combinations.
        
        Returns:
            DataFrame with ticker, trade_date, record_count, created_at
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT ticker, trade_date, COUNT(*) as record_count, MAX(created_at) as created_at
            FROM done_detail_records
            GROUP BY ticker, trade_date
            ORDER BY created_at DESC
            """
            df = pd.read_sql(query, conn)
            return df
        except Exception as e:
            print(f"[!] Error fetching done detail history: {e}")
            return pd.DataFrame()
        finally:
            conn.close()
    
    def delete_records(self, ticker: str, trade_date: str) -> bool:
        """
        Delete records for a ticker and date.
        
        Args:
            ticker: Stock symbol
            trade_date: Date string (YYYY-MM-DD)
        
        Returns:
            True if successful
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM done_detail_records WHERE ticker = ? AND trade_date = ?",
                (ticker.upper(), trade_date)
            )
            conn.commit()
            deleted = cursor.rowcount
            print(f"[*] Deleted {deleted} done detail records for {ticker} on {trade_date}")
            return deleted > 0
        except Exception as e:
            print(f"[!] Error deleting done detail records: {e}")
            return False
        finally:
            conn.close()
    
    def get_sankey_data(self, ticker: str, trade_date: str) -> Dict:
        """
        Generate Sankey diagram data from trade records.
        
        Args:
            ticker: Stock symbol
            trade_date: Date string (YYYY-MM-DD)
        
        Returns:
            Dict with nodes and links for Sankey chart
        """
        conn = self._get_conn()
        try:
            # Aggregate flows between seller -> buyer
            # Note: Use qty * price directly (matching NeoBDM calculation)
            query = """
            SELECT seller_code, buyer_code, 
                   SUM(qty) as total_qty, 
                   SUM(qty * price) as total_value,
                   AVG(price) as avg_price
            FROM done_detail_records
            WHERE ticker = ? AND trade_date = ?
            GROUP BY seller_code, buyer_code
            ORDER BY total_qty DESC
            """
            df = pd.read_sql(query, conn, params=(ticker.upper(), trade_date))
            
            if df.empty:
                return {"nodes": [], "links": []}
            
            # Build unique broker list: sellers on one side, buyers on other
            sellers = df['seller_code'].unique().tolist()
            buyers = df['buyer_code'].unique().tolist()
            
            # Create nodes: sellers first (index 0..n-1), then buyers (index n..m)
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
            for _, row in df.iterrows():
                links.append({
                    "source": seller_idx[row['seller_code']],
                    "target": buyer_idx[row['buyer_code']],
                    "value": int(row['total_qty']),
                    "lot": int(row['total_qty']),
                    "val": float(row['total_value']) if row['total_value'] else 0,
                    "avgPrice": float(row['avg_price']) if row['avg_price'] else 0
                })
            
            return {"nodes": nodes, "links": links}
        except Exception as e:
            print(f"[!] Error generating sankey data: {e}")
            return {"nodes": [], "links": []}
        finally:
            conn.close()
    
    def get_inventory_data(self, ticker: str, trade_date: str, interval_minutes: int = 1) -> Dict:
        """
        Generate Daily Inventory chart data.
        
        Args:
            ticker: Stock symbol
            trade_date: Date string (YYYY-MM-DD)
            interval_minutes: Time interval for aggregation
        
        Returns:
            Dict with time series data per broker
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT trade_time, price, qty, buyer_code, seller_code
            FROM done_detail_records
            WHERE ticker = ? AND trade_date = ?
            ORDER BY trade_time ASC
            """
            df = pd.read_sql(query, conn, params=(ticker.upper(), trade_date))
            
            if df.empty:
                return {"brokers": [], "timeSeries": [], "priceData": []}
            
            # Calculate net position per broker over time
            # For each broker: buy = +qty, sell = -qty
            broker_positions = {}
            time_series = []
            price_data = []
            
            # Get unique brokers
            all_brokers = set(df['buyer_code'].unique()) | set(df['seller_code'].unique())
            for broker in all_brokers:
                broker_positions[broker] = 0
            
            # Process trades chronologically
            current_time = None
            snapshot = {}
            
            for _, row in df.iterrows():
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
        except Exception as e:
            print(f"[!] Error generating inventory data: {e}")
            return {"brokers": [], "timeSeries": [], "priceData": []}
        finally:
            conn.close()
