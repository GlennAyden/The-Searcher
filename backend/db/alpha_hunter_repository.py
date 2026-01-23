"""Repository for Alpha Hunter data management."""
from .connection import BaseRepository
from typing import List, Dict, Optional
import json

class AlphaHunterRepository(BaseRepository):
    """Repository for Alpha Hunter watchlist and tracking."""
    
    def __init__(self, db_path: Optional[str] = None):
        super().__init__(db_path)
        self._init_tables()
        
    def _init_tables(self):
        """Initialize Alpha Hunter tables."""
        conn = self._get_conn()
        try:
            # Watchlist table
            conn.execute("""
            CREATE TABLE IF NOT EXISTS alpha_hunter_watchlist (
                ticker TEXT PRIMARY KEY,
                spike_date TEXT NOT NULL,
                initial_score INTEGER,
                current_stage INTEGER DEFAULT 1,
                detect_info TEXT, -- JSON string with detection details
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_updated TIMESTAMP
            )
            """)
            
            # Tracking table (Healthy Pullback)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS alpha_hunter_tracking (
                ticker TEXT,
                trade_date TEXT,
                price REAL,
                price_change_pct REAL,
                volume REAL,
                volume_change_pct REAL,
                health_status TEXT, 
                health_score INTEGER,
                meta_data TEXT, -- JSON string for extra metrics
                PRIMARY KEY (ticker, trade_date)
            )
            """)
            conn.commit()
        finally:
            conn.close()
            
    def add_to_watchlist(self, ticker: str, spike_date: str, score: int, detect_info: Dict) -> bool:
        """Add ticker to watchlist."""
        conn = self._get_conn()
        try:
            conn.execute("""
            INSERT OR REPLACE INTO alpha_hunter_watchlist 
            (ticker, spike_date, initial_score, current_stage, detect_info, last_updated)
            VALUES (?, ?, ?, 1, ?, datetime('now'))
            """, (ticker.upper(), spike_date, score, json.dumps(detect_info)))
            conn.commit()
            return True
        except Exception as e:
            print(f"[!] Error adding to watchlist: {e}")
            return False
        finally:
            conn.close()
            
    def remove_from_watchlist(self, ticker: str) -> bool:
        """Remove ticker from watchlist."""
        conn = self._get_conn()
        try:
            conn.execute("DELETE FROM alpha_hunter_watchlist WHERE ticker = ?", (ticker.upper(),))
            conn.execute("DELETE FROM alpha_hunter_tracking WHERE ticker = ?", (ticker.upper(),))
            conn.commit()
            return True
        except Exception as e:
            print(f"[!] Error removing from watchlist: {e}")
            return False
        finally:
            conn.close()
            
    def get_watchlist(self) -> List[Dict]:
        """Get all watchlist items."""
        conn = self._get_conn()
        try:
            cursor = conn.execute("""
            SELECT ticker, spike_date, initial_score, current_stage, detect_info, added_at
            FROM alpha_hunter_watchlist
            ORDER BY added_at DESC
            """)
            
            items = []
            for row in cursor.fetchall():
                items.append({
                    "ticker": row[0],
                    "spike_date": row[1],
                    "initial_score": row[2],
                    "current_stage": row[3],
                    "detect_info": json.loads(row[4]) if row[4] else {},
                    "added_at": row[5]
                })
            return items
        except Exception as e:
            print(f"[!] Error getting watchlist: {e}")
            return []
        finally:
            conn.close()

    def get_watchlist_item(self, ticker: str) -> Optional[Dict]:
        """Get a single watchlist item by ticker."""
        conn = self._get_conn()
        try:
            cursor = conn.execute("""
            SELECT ticker, spike_date, initial_score, current_stage, detect_info, added_at
            FROM alpha_hunter_watchlist
            WHERE ticker = ?
            """, (ticker.upper(),))
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "ticker": row[0],
                "spike_date": row[1],
                "initial_score": row[2],
                "current_stage": row[3],
                "detect_info": json.loads(row[4]) if row[4] else {},
                "added_at": row[5]
            }
        except Exception as e:
            print(f"[!] Error getting watchlist item: {e}")
            return None
        finally:
            conn.close()
            
    def update_stage(self, ticker: str, stage: int) -> bool:
        """Update investigation stage."""
        conn = self._get_conn()
        try:
            conn.execute("""
            UPDATE alpha_hunter_watchlist 
            SET current_stage = ?, last_updated = datetime('now')
            WHERE ticker = ?
            """, (stage, ticker.upper()))
            conn.commit()
            return True
        except Exception as e:
            print(f"[!] Error updating stage: {e}")
            return False
        finally:
            conn.close()

    def save_tracking_snapshot(self, ticker: str, date: str, metrics: Dict) -> bool:
        """Save daily tracking snapshot."""
        conn = self._get_conn()
        try:
            conn.execute("""
            INSERT OR REPLACE INTO alpha_hunter_tracking
            (ticker, trade_date, price, price_change_pct, volume, volume_change_pct, health_status, health_score, meta_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                ticker.upper(),
                date,
                metrics.get('price'),
                metrics.get('price_change_pct'),
                metrics.get('volume'),
                metrics.get('volume_change_pct'),
                metrics.get('health_status'),
                metrics.get('health_score'),
                json.dumps(metrics.get('meta_data', {}))
            ))
            conn.commit()
            return True
        except Exception as e:
            print(f"[!] Error saving tracking snapshot: {e}")
            return False
        finally:
            conn.close()
            
    def get_tracking_history(self, ticker: str) -> List[Dict]:
        """Get tracking history for a ticker."""
        conn = self._get_conn()
        try:
            cursor = conn.execute("""
            SELECT trade_date, price, price_change_pct, volume, volume_change_pct, health_status, health_score, meta_data
            FROM alpha_hunter_tracking
            WHERE ticker = ?
            ORDER BY trade_date DESC
            """, (ticker.upper(),))
            
            history = []
            for row in cursor.fetchall():
                history.append({
                    "trade_date": row[0],
                    "price": row[1],
                    "price_change_pct": row[2],
                    "volume": row[3],
                    "volume_change_pct": row[4],
                    "health_status": row[5],
                    "health_score": row[6],
                    "meta_data": json.loads(row[7]) if row[7] else {}
                })
            return history
        except Exception as e:
            print(f"[!] Error getting tracking history: {e}")
            return []
        finally:
            conn.close()
