"""
Done Detail Repository - CRUD operations only.

This is a slimmed-down repository containing only data access operations.
Analysis logic has been extracted to the analysis/ submodule.

For analysis operations, use DoneDetailService which orchestrates
repository calls with analysis modules.
"""
import pandas as pd
from typing import Optional, List, Dict
from db.connection import BaseRepository


class DoneDetailRepository(BaseRepository):
    """Repository for Done Detail records (pasted trade data)."""
    
    # ========================================================================
    # CRUD - Records
    # ========================================================================
    
    def check_exists(self, ticker: str, trade_date: str) -> bool:
        """Check if data exists for a ticker and date."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                """
                SELECT 1 FROM done_detail_records 
                WHERE ticker = ? AND trade_date = ? 
                LIMIT 1
                """,
                (ticker.upper(), trade_date)
            )
            return cursor.fetchone() is not None
        finally:
            conn.close()
    
    def save_records(self, ticker: str, trade_date: str, records: List[Dict]) -> int:
        """Save parsed trade records."""
        if not records:
            return 0
        
        conn = self._get_conn()
        try:
            # Clear existing records for this ticker/date
            conn.execute(
                "DELETE FROM done_detail_records WHERE ticker = ? AND trade_date = ?",
                (ticker.upper(), trade_date)
            )
            
            # Insert new records
            for rec in records:
                conn.execute(
                    """
                    INSERT INTO done_detail_records 
                    (ticker, trade_date, trade_time, price, qty, 
                     buyer_type, buyer_code, seller_code, seller_type)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        ticker.upper(),
                        trade_date,
                        rec.get('time', ''),
                        rec.get('price', 0),
                        rec.get('qty', 0),
                        rec.get('buyer_type', ''),
                        rec.get('buyer_code', ''),
                        rec.get('seller_code', ''),
                        rec.get('seller_type', '')
                    )
                )
            
            conn.commit()
            return len(records)
        except Exception as e:
            conn.rollback()
            print(f"[!] Error saving done_detail records: {e}")
            raise
        finally:
            conn.close()
    
    def get_records(self, ticker: str, trade_date: str) -> pd.DataFrame:
        """Get records for a specific ticker and date."""
        conn = self._get_conn()
        try:
            query = """
            SELECT * FROM done_detail_records
            WHERE ticker = ? AND trade_date = ?
            ORDER BY trade_time DESC
            """
            df = pd.read_sql(query, conn, params=(ticker.upper(), trade_date))
            return df
        finally:
            conn.close()
    
    def get_records_range(self, ticker: str, start_date: str, end_date: str) -> pd.DataFrame:
        """Get records for a date range."""
        conn = self._get_conn()
        try:
            query = """
            SELECT * FROM done_detail_records
            WHERE ticker = ? AND trade_date >= ? AND trade_date <= ?
            ORDER BY trade_date DESC, trade_time DESC
            """
            df = pd.read_sql(query, conn, params=(ticker.upper(), start_date, end_date))
            return df
        finally:
            conn.close()
    
    def get_saved_history(self) -> pd.DataFrame:
        """Get all saved ticker/date combinations."""
        conn = self._get_conn()
        try:
            query = """
            SELECT ticker, trade_date, COUNT(*) as record_count, 
                   MAX(created_at) as created_at
            FROM done_detail_records
            GROUP BY ticker, trade_date
            ORDER BY trade_date DESC, ticker ASC
            """
            df = pd.read_sql(query, conn)
            return df
        finally:
            conn.close()
    
    def delete_records(self, ticker: str, trade_date: str) -> bool:
        """Delete records for a ticker and date."""
        conn = self._get_conn()
        try:
            conn.execute(
                "DELETE FROM done_detail_records WHERE ticker = ? AND trade_date = ?",
                (ticker.upper(), trade_date)
            )
            conn.commit()
            return True
        except Exception as e:
            print(f"[!] Error deleting records: {e}")
            return False
        finally:
            conn.close()
    
    def mark_raw_as_processed(self, ticker: str, trade_date: str) -> None:
        """Mark raw records as processed."""
        conn = self._get_conn()
        try:
            conn.execute(
                """
                UPDATE done_detail_records 
                SET processed_at = datetime('now')
                WHERE ticker = ? AND trade_date = ?
                """,
                (ticker.upper(), trade_date)
            )
            conn.commit()
        finally:
            conn.close()
    
    def delete_old_raw_data(self, days: int = 7) -> int:
        """Delete raw data older than specified days that has been processed."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                """
                DELETE FROM done_detail_records 
                WHERE processed_at IS NOT NULL 
                AND processed_at < datetime('now', ?)
                """,
                (f"-{days} days",)
            )
            conn.commit()
            return cursor.rowcount
        finally:
            conn.close()
    
    def get_available_tickers(self) -> List[str]:
        """Get list of unique tickers that have saved Done Detail data."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                "SELECT DISTINCT ticker FROM done_detail_records ORDER BY ticker"
            )
            return [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()
    
    def get_date_range(self, ticker: str) -> Dict:
        """Get available date range for a ticker."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                """
                SELECT DISTINCT trade_date 
                FROM done_detail_records 
                WHERE ticker = ? 
                ORDER BY trade_date DESC
                """,
                (ticker.upper(),)
            )
            dates = [row[0] for row in cursor.fetchall()]
            
            if not dates:
                return {"min_date": None, "max_date": None, "dates": []}
            
            return {
                "min_date": min(dates),
                "max_date": max(dates),
                "dates": dates
            }
        finally:
            conn.close()
    
    # ========================================================================
    # CRUD - Synthesis (pre-computed analysis)
    # ========================================================================
    
    def check_synthesis_exists(self, ticker: str, trade_date: str) -> bool:
        """Check if synthesis exists for ticker/date."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                "SELECT 1 FROM done_detail_synthesis WHERE ticker = ? AND trade_date = ? LIMIT 1",
                (ticker.upper(), trade_date)
            )
            return cursor.fetchone() is not None
        finally:
            conn.close()
    
    def save_synthesis(
        self, 
        ticker: str, 
        trade_date: str,
        imposter_data: Dict, 
        speed_data: Dict, 
        combined_data: Dict,
        raw_record_count: int, 
        raw_data_hash: str = None
    ) -> None:
        """Save pre-computed synthesis results."""
        import json
        conn = self._get_conn()
        try:
            # Upsert
            conn.execute(
                """
                INSERT OR REPLACE INTO done_detail_synthesis
                (ticker, trade_date, imposter_data, speed_data, combined_data, 
                 raw_record_count, raw_data_hash, calculated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                """,
                (
                    ticker.upper(),
                    trade_date,
                    json.dumps(imposter_data),
                    json.dumps(speed_data),
                    json.dumps(combined_data),
                    raw_record_count,
                    raw_data_hash
                )
            )
            conn.commit()
        finally:
            conn.close()
    
    def get_synthesis(self, ticker: str, trade_date: str) -> Optional[Dict]:
        """Get pre-computed synthesis for ticker/date."""
        import json
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                """
                SELECT imposter_data, speed_data, combined_data, 
                       raw_record_count, raw_data_hash, calculated_at
                FROM done_detail_synthesis
                WHERE ticker = ? AND trade_date = ?
                """,
                (ticker.upper(), trade_date)
            )
            row = cursor.fetchone()
            if row:
                return {
                    "imposter_data": json.loads(row[0]) if row[0] else {},
                    "speed_data": json.loads(row[1]) if row[1] else {},
                    "combined_data": json.loads(row[2]) if row[2] else {},
                    "raw_record_count": row[3],
                    "raw_data_hash": row[4],
                    "calculated_at": row[5]
                }
            return None
        finally:
            conn.close()
    
    def get_synthesis_range(self, ticker: str, start_date: str, end_date: str) -> List[Dict]:
        """Get synthesis records for a date range."""
        import json
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                """
                SELECT trade_date, imposter_data, speed_data, combined_data
                FROM done_detail_synthesis
                WHERE ticker = ? AND trade_date >= ? AND trade_date <= ?
                ORDER BY trade_date DESC
                """,
                (ticker.upper(), start_date, end_date)
            )
            results = []
            for row in cursor.fetchall():
                results.append({
                    "trade_date": row[0],
                    "imposter_data": json.loads(row[1]) if row[1] else {},
                    "speed_data": json.loads(row[2]) if row[2] else {},
                    "combined_data": json.loads(row[3]) if row[3] else {}
                })
            return results
        finally:
            conn.close()
    
    def delete_synthesis(self, ticker: str, trade_date: str) -> None:
        """Delete synthesis for ticker/date."""
        conn = self._get_conn()
        try:
            conn.execute(
                "DELETE FROM done_detail_synthesis WHERE ticker = ? AND trade_date = ?",
                (ticker.upper(), trade_date)
            )
            conn.commit()
        finally:
            conn.close()
    
    # ========================================================================
    # Query Helpers (used by analysis modules)
    # ========================================================================
    
    def get_trade_flow_data(self, ticker: str, trade_date: str) -> pd.DataFrame:
        """Get aggregated seller->buyer flow for Sankey diagram."""
        conn = self._get_conn()
        try:
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
            return pd.read_sql(query, conn, params=(ticker.upper(), trade_date))
        finally:
            conn.close()
    
    def get_time_series_data(self, ticker: str, trade_date: str) -> pd.DataFrame:
        """Get time-ordered trade data for inventory tracking."""
        conn = self._get_conn()
        try:
            query = """
            SELECT trade_time, price, qty, buyer_code, seller_code
            FROM done_detail_records
            WHERE ticker = ? AND trade_date = ?
            ORDER BY trade_time ASC
            """
            return pd.read_sql(query, conn, params=(ticker.upper(), trade_date))
        finally:
            conn.close()
    
    def get_broker_flows(self, ticker: str, trade_date: str) -> pd.DataFrame:
        """Get buyer/seller/qty flow for accumulation analysis."""
        conn = self._get_conn()
        try:
            query = """
            SELECT buyer_code, seller_code, qty, price
            FROM done_detail_records
            WHERE ticker = ? AND trade_date = ?
            """
            return pd.read_sql(query, conn, params=(ticker.upper(), trade_date))
        finally:
            conn.close()
