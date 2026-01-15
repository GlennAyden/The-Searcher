"""Repository for Broker 5% CRUD operations."""
import sqlite3
from typing import List, Dict, Optional
from .connection import BaseRepository


class BrokerFiveRepository(BaseRepository):
    """Repository for broker 5% watchlist codes."""

    def _row_to_dict(self, row) -> Dict:
        return {
            "id": row[0],
            "ticker": row[1],
            "broker_code": row[2],
            "label": row[3],
            "created_at": row[4],
            "updated_at": row[5]
        }

    def list_brokers(self, ticker: str) -> List[Dict]:
        """Return broker codes for a ticker."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                """
                SELECT id, ticker, broker_code, label, created_at, updated_at
                FROM broker_five_percent
                WHERE ticker = ?
                ORDER BY broker_code ASC
                """,
                (ticker,)
            )
            rows = cursor.fetchall()
            return [self._row_to_dict(row) for row in rows]
        finally:
            conn.close()

    def get_broker(self, broker_id: int) -> Optional[Dict]:
        """Get broker by id."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                """
                SELECT id, ticker, broker_code, label, created_at, updated_at
                FROM broker_five_percent
                WHERE id = ?
                """,
                (broker_id,)
            )
            row = cursor.fetchone()
            return self._row_to_dict(row) if row else None
        finally:
            conn.close()

    def create_broker(self, ticker: str, broker_code: str, label: Optional[str] = None) -> Optional[Dict]:
        """Create a new broker code."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                """
                INSERT INTO broker_five_percent (ticker, broker_code, label, created_at, updated_at)
                VALUES (?, ?, ?, datetime('now'), datetime('now'))
                """,
                (ticker, broker_code, label)
            )
            conn.commit()
            return self.get_broker(cursor.lastrowid)
        except sqlite3.IntegrityError:
            return None
        finally:
            conn.close()

    def update_broker(self, broker_id: int, ticker: str, broker_code: str, label: Optional[str] = None):
        """Update an existing broker code."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                """
                UPDATE broker_five_percent
                SET broker_code = ?, label = ?, updated_at = datetime('now')
                WHERE id = ? AND ticker = ?
                """,
                (broker_code, label, broker_id, ticker)
            )
            conn.commit()
            if cursor.rowcount == 0:
                return None
            return self.get_broker(broker_id)
        except sqlite3.IntegrityError:
            return "duplicate"
        finally:
            conn.close()

    def delete_broker(self, broker_id: int, ticker: str) -> bool:
        """Delete broker by id."""
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                "DELETE FROM broker_five_percent WHERE id = ? AND ticker = ?",
                (broker_id, ticker)
            )
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()
