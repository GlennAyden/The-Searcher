"""
DEPRECATED: This module is deprecated. Use features.done_detail instead.

This file is kept for backward compatibility only.
The DoneDetailRepository has been refactored into:
- features/done_detail/repository.py (CRUD operations)
- features/done_detail/service.py (orchestration layer)
- features/done_detail/analysis/ (analysis modules)

For new code, use:
    from features.done_detail import DoneDetailService
    service = DoneDetailService()
    
For existing code (still works):
    from db import DoneDetailRepository
    repo = DoneDetailRepository()
"""
# Import from original location for backward compatibility
# This imports the original 2122-line class until migration is complete
import pandas as pd
from typing import Optional, List, Dict
from .connection import BaseRepository
import json
import os
import numpy as np
from collections import defaultdict


class DoneDetailRepository(BaseRepository):
    """
    Repository for Done Detail records (pasted trade data).
    
    MIGRATION NOTE: This class is being refactored.
    New implementations should use DoneDetailService from features.done_detail
    """
    
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
            conn.execute(
                "DELETE FROM done_detail_records WHERE ticker = ? AND trade_date = ?",
                (ticker.upper(), trade_date)
            )
            
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
            return pd.read_sql(query, conn, params=(ticker.upper(), trade_date))
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
            return pd.read_sql(query, conn)
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
        except:
            return False
        finally:
            conn.close()
    
    def check_synthesis_exists(self, ticker: str, trade_date: str) -> bool:
        """Check if synthesis exists."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                "SELECT 1 FROM done_detail_synthesis WHERE ticker = ? AND trade_date = ? LIMIT 1",
                (ticker.upper(), trade_date)
            )
            return cursor.fetchone() is not None
        finally:
            conn.close()
    
    def save_synthesis(self, ticker: str, trade_date: str, 
                       imposter_data: Dict, speed_data: Dict, combined_data: Dict,
                       raw_record_count: int, raw_data_hash: str = None) -> None:
        """Save synthesis."""
        conn = self._get_conn()
        try:
            conn.execute(
                """
                INSERT OR REPLACE INTO done_detail_synthesis
                (ticker, trade_date, imposter_data, speed_data, combined_data, 
                 raw_record_count, raw_data_hash, calculated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                """,
                (ticker.upper(), trade_date, json.dumps(imposter_data),
                 json.dumps(speed_data), json.dumps(combined_data),
                 raw_record_count, raw_data_hash)
            )
            conn.commit()
        finally:
            conn.close()
    
    def get_synthesis(self, ticker: str, trade_date: str) -> Optional[Dict]:
        """Get synthesis."""
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
        """Get synthesis range."""
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

    def mark_raw_as_processed(self, ticker: str, trade_date: str) -> None:
        """Mark raw as processed."""
        conn = self._get_conn()
        try:
            conn.execute(
                "UPDATE done_detail_records SET processed_at = datetime('now') WHERE ticker = ? AND trade_date = ?",
                (ticker.upper(), trade_date)
            )
            conn.commit()
        finally:
            conn.close()
    
    def delete_old_raw_data(self, days: int = 7) -> int:
        """Delete old raw data."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                "DELETE FROM done_detail_records WHERE processed_at IS NOT NULL AND processed_at < datetime('now', ?)",
                (f"-{days} days",)
            )
            conn.commit()
            return cursor.rowcount
        finally:
            conn.close()
    
    def delete_synthesis(self, ticker: str, trade_date: str) -> None:
        """Delete synthesis."""
        conn = self._get_conn()
        try:
            conn.execute(
                "DELETE FROM done_detail_synthesis WHERE ticker = ? AND trade_date = ?",
                (ticker.upper(), trade_date)
            )
            conn.commit()
        finally:
            conn.close()
    
    def get_available_tickers(self) -> List[str]:
        """Get available tickers."""
        conn = self._get_conn()
        try:
            cursor = conn.execute("SELECT DISTINCT ticker FROM done_detail_records ORDER BY ticker")
            return [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()
    
    def get_date_range(self, ticker: str) -> Dict:
        """Get date range."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                "SELECT DISTINCT trade_date FROM done_detail_records WHERE ticker = ? ORDER BY trade_date DESC",
                (ticker.upper(),)
            )
            dates = [row[0] for row in cursor.fetchall()]
            if not dates:
                return {"min_date": None, "max_date": None, "dates": []}
            return {"min_date": min(dates), "max_date": max(dates), "dates": dates}
        finally:
            conn.close()
    
    def get_records_range(self, ticker: str, start_date: str, end_date: str) -> pd.DataFrame:
        """Get records range."""
        conn = self._get_conn()
        try:
            query = """
            SELECT * FROM done_detail_records
            WHERE ticker = ? AND trade_date >= ? AND trade_date <= ?
            ORDER BY trade_date DESC, trade_time DESC
            """
            return pd.read_sql(query, conn, params=(ticker.upper(), start_date, end_date))
        finally:
            conn.close()
    
    # ==========================================================================
    # Analysis methods - delegate to new analyzers for new code
    # These are kept for backward compatibility with existing routes
    # ==========================================================================
    
    def get_sankey_data(self, ticker: str, trade_date: str) -> Dict:
        """Generate Sankey diagram data."""
        from features.done_detail.analysis.visualization import VisualizationAnalyzer
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
            df = pd.read_sql(query, conn, params=(ticker.upper(), trade_date))
            return VisualizationAnalyzer().get_sankey_data(df)
        except Exception as e:
            print(f"[!] Error: {e}")
            return {"nodes": [], "links": []}
        finally:
            conn.close()
    
    def get_inventory_data(self, ticker: str, trade_date: str, interval_minutes: int = 1) -> Dict:
        """Generate inventory data."""
        from features.done_detail.analysis.visualization import VisualizationAnalyzer
        conn = self._get_conn()
        try:
            query = """
            SELECT trade_time, price, qty, buyer_code, seller_code
            FROM done_detail_records
            WHERE ticker = ? AND trade_date = ?
            ORDER BY trade_time ASC
            """
            df = pd.read_sql(query, conn, params=(ticker.upper(), trade_date))
            return VisualizationAnalyzer().get_inventory_data(df)
        except Exception as e:
            print(f"[!] Error: {e}")
            return {"brokers": [], "timeSeries": [], "priceData": []}
        finally:
            conn.close()
    
    def get_accum_dist_analysis(self, ticker: str, trade_date: str) -> Dict:
        """Analyze accumulation/distribution."""
        from features.done_detail.analysis.visualization import VisualizationAnalyzer
        conn = self._get_conn()
        try:
            query = """
            SELECT buyer_code, seller_code, qty, price
            FROM done_detail_records
            WHERE ticker = ? AND trade_date = ?
            """
            df = pd.read_sql(query, conn, params=(ticker.upper(), trade_date))
            return VisualizationAnalyzer().get_accum_dist_analysis(df)
        except Exception as e:
            return {"status": "ERROR", "error": str(e)}
        finally:
            conn.close()
    
    def detect_imposter_trades(self, ticker: str, start_date: str, end_date: str) -> Dict:
        """Detect imposter trades."""
        from features.done_detail.analysis.imposter import ImposterAnalyzer
        df = self.get_records_range(ticker, start_date, end_date)
        return ImposterAnalyzer().detect_imposter_trades(df, ticker, start_date, end_date)
    
    def analyze_speed(self, ticker: str, start_date: str, end_date: str) -> Dict:
        """Analyze speed."""
        from features.done_detail.analysis.speed import SpeedAnalyzer
        df = self.get_records_range(ticker, start_date, end_date)
        return SpeedAnalyzer().analyze_speed(df, ticker, start_date, end_date)
    
    def get_combined_analysis(self, ticker: str, start_date: str, end_date: str) -> Dict:
        """Get combined analysis."""
        from features.done_detail.analysis.combined import CombinedAnalyzer
        imposter_data = self.detect_imposter_trades(ticker, start_date, end_date)
        speed_data = self.analyze_speed(ticker, start_date, end_date)
        return CombinedAnalyzer().get_combined_analysis(imposter_data, speed_data, ticker, start_date, end_date)
    
    def get_range_analysis_from_synthesis(self, ticker: str, start_date: str, end_date: str) -> Dict:
        """Get range analysis from synthesis."""
        from features.done_detail.analysis.combined import CombinedAnalyzer
        synthesis_list = self.get_synthesis_range(ticker, start_date, end_date)
        return CombinedAnalyzer().get_range_analysis_from_synthesis(synthesis_list, ticker, start_date, end_date)
    
    # Keep other methods as stubs that delegate appropriately
    def get_broker_profile(self, ticker: str, broker_code: str, start_date: str, end_date: str) -> Dict:
        """Broker profile - TODO: migrate to new analyzer."""
        return {"broker": broker_code, "status": "not_implemented_in_new_module"}
    
    def get_range_analysis(self, ticker: str, start_date: str, end_date: str) -> Dict:
        """Range analysis - delegated to synthesis version."""
        return self.get_range_analysis_from_synthesis(ticker, start_date, end_date)
