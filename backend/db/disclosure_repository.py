"""Disclosure repository for IDX disclosures operations."""
import pandas as pd
from typing import Optional, List, Dict, Tuple
from .connection import BaseRepository


class DisclosureRepository(BaseRepository):
    """Repository for IDX corporate disclosures."""
    
    def insert_disclosure(self, data: Dict):
        """
        Insert a single disclosure record into database.
        Uses INSERT OR IGNORE to skip duplicates based on download_url.
        
        Args:
            data: Disclosure data dictionary
        """
        conn = self._get_conn()
        try:
            query = """
            INSERT OR IGNORE INTO idx_disclosures 
            (ticker, title, published_date, download_url, local_path)
            VALUES (?, ?, ?, ?, ?)
            """
            
            row = (
                data.get('ticker', '').strip(),
                data.get('title'),
                data.get('date'),
                data.get('download_url'),
                data.get('local_path', '')
            )
            
            conn.execute(query, row)
            conn.commit()
        except Exception as e:
            print(f"[!] Error inserting disclosure: {e}")
        finally:
            conn.close()
    
    def get_disclosures(
        self,
        ticker: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> pd.DataFrame:
        """
        Fetch corporate disclosures from database.
        
        Args:
            ticker: Filter by ticker symbol
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            limit: Maximum number of records
            offset: Offset for pagination
        
        Returns:
            Pandas DataFrame with disclosures
        """
        conn = self._get_conn()
        try:
            query = "SELECT * FROM idx_disclosures WHERE 1=1"
            params = []

            # Ticker Filter
            if ticker and ticker != "^JKSE":
                # Handle cases where ticker passes in as "BBRI.JK" vs "BBRI"
                clean_ticker = ticker.replace(".JK", "")
                query += " AND ticker LIKE ?"
                params.append(f"%{clean_ticker}%")

            # Date Filter
            if start_date:
                query += " AND date(published_date) >= date(?)"
                params.append(str(start_date))

            if end_date:
                query += " AND date(published_date) <= date(?)"
                params.append(str(end_date))

            query += " ORDER BY published_date DESC"

            # Pagination
            if limit is not None:
                query += " LIMIT ?"
                params.append(limit)
                if offset is not None:
                    query += " OFFSET ?"
                    params.append(offset)

            df = pd.read_sql(query, conn, params=params)
            return df

        except Exception as e:
            print(f"[!] Error fetching disclosures from DB: {e}")
            return pd.DataFrame()
        finally:
            conn.close()
    
    def get_all_disclosures_paths(self) -> List[Tuple[int, str]]:
        """
        Get raw IDs and paths for all disclosures.
        
        Returns:
            List of (id, local_path) tuples
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id, local_path FROM idx_disclosures")
            return cursor.fetchall()
        finally:
            conn.close()
