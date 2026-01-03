"""Running Trade repository for real-time trade monitoring."""
import pandas as pd
from typing import Optional, List, Dict, Tuple
from datetime import timedelta
from .connection import BaseRepository


class RunningTradeRepository(BaseRepository):
    """Repository for running trade snapshots and raw trade data."""
    
    def save_rt_snapshot(self, data: Dict):
        """
        Save a 15-minute running trade snapshot.
        
        Args:
            data: Snapshot data dictionary
        """
        conn = self._get_conn()
        try:
            query = """
            INSERT INTO rt_snapshots (
                ticker, interval_start, interval_end, buy_vol, sell_vol, net_vol, 
                avg_price, status, big_order_count, conclusion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            row = (
                data['ticker'], data['interval_start'], data['interval_end'],
                data['buy_vol'], data['sell_vol'], data['net_vol'],
                data['avg_price'], data['status'], data['big_order_count'],
                data['conclusion']
            )
            conn.execute(query, row)
            conn.commit()
            print(f"[*] Saved RT snapshot for {data['ticker']} ({data['interval_start']})")
        except Exception as e:
            print(f"[!] Error saving RT snapshot: {e}")
        finally:
            conn.close()
    
    def get_rt_history(self, ticker: str, days: int = 1) -> pd.DataFrame:
        """
        Fetch historical snapshots for a ticker.
        
        Args:
            ticker: Stock symbol
            days: Number of days to fetch
        
        Returns:
            Pandas DataFrame with snapshots
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT * FROM rt_snapshots 
            WHERE ticker = ? 
            AND interval_start >= datetime('now', ?)
            ORDER BY interval_start DESC
            """
            df = pd.read_sql(query, conn, params=(ticker, f'-{days} days'))
            return df
        except Exception as e:
            print(f"[!] Error fetching RT history: {e}")
            return pd.DataFrame()
        finally:
            conn.close()
    
    def save_raw_trades(self, ticker: str, date_str: str, trades: List[Dict]):
        """
        Save raw trade data for a full trading day.
        
        Args:
            ticker: Stock symbol
            date_str: Date string (YYYY-MM-DD)
            trades: List of trade dictionaries
        """
        conn = self._get_conn()
        try:
            query = """
            INSERT OR REPLACE INTO rt_raw_history 
            (id, ticker, time, action, price, lot, buyer, seller, trade_number, market_board, scrape_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            rows = []
            for trade in trades:
                trade_id = f"{ticker}_{date_str}_{trade.get('time', '')}_{trade.get('trade_number', '')}"
                row = (
                    trade_id,
                    ticker,
                    trade.get('time'),
                    trade.get('action'),
                    trade.get('price'),
                    trade.get('lot'),
                    trade.get('buyer'),
                    trade.get('seller'),
                    trade.get('trade_number'),
                    trade.get('market_board'),
                    date_str
                )
                rows.append(row)
            
            conn.executemany(query, rows)
            conn.commit()
            print(f"[*] Saved {len(rows)} raw trades for {ticker} on {date_str}")
        except Exception as e:
            print(f"[!] Error saving raw trades: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def get_raw_trades(self, ticker: str, date_str: str) -> pd.DataFrame:
        """
        Fetch raw trades for a specific ticker and date.
        
        Args:
            ticker: Stock symbol
            date_str: Date string (YYYY-MM-DD)
        
        Returns:
            Pandas DataFrame with raw trades
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT * FROM rt_raw_history
            WHERE ticker = ? AND scrape_date = ?
            ORDER BY time ASC
            """
            df = pd.read_sql(query, conn, params=(ticker, date_str))
            return df
        except Exception as e:
            print(f"[!] Error fetching raw trades: {e}")
            return pd.DataFrame()
        finally:
            conn.close()
    
    def get_raw_history_inventory(self) -> pd.DataFrame:
        """
        Get inventory of all scraped historical data.
        
        Returns unique ticker and scrape_date pairs.
        
        Returns:
            Pandas DataFrame with inventory
        """
        conn = self._get_conn()
        try:
            query = """
            SELECT ticker, scrape_date, COUNT(*) as trade_count
            FROM rt_raw_history
            GROUP BY ticker, scrape_date
            ORDER BY scrape_date DESC, ticker ASC
            """
            df = pd.read_sql(query, conn)
            return df
        except Exception as e:
            print(f"[!] Error fetching inventory: {e}")
            return pd.DataFrame()
        finally:
            conn.close()
    
    def delete_raw_trades(self, ticker: str, date_str: str) -> bool:
        """
        Delete raw trades for a ticker and date.
        
        Args:
            ticker: Stock symbol
            date_str: Date string (YYYY-MM-DD)
        
        Returns:
            True if successful, False otherwise
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM rt_raw_history WHERE ticker = ? AND scrape_date = ?",
                (ticker, date_str)
            )
            conn.commit()
            deleted_count = cursor.rowcount
            print(f"[*] Deleted {deleted_count} trades for {ticker} on {date_str}")
            return deleted_count > 0
        except Exception as e:
            print(f"[!] Error deleting trades: {e}")
            return False
        finally:
            conn.close()
