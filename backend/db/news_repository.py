"""News repository for news article operations."""
import pandas as pd
from typing import Optional, Set, List, Dict
from .connection import BaseRepository


class NewsRepository(BaseRepository):
    """Repository for news articles and sentiment data."""
    
    def save_news(self, news_list: List[Dict]):
        """
        Save a list of news dictionaries to the database.
        Uses INSERT OR REPLACE (UPSERT behavior) based on URL.
        
        Args:
            news_list: List of news article dictionaries
        """
        if not news_list:
            return

        conn = self._get_conn()
        try:
            query = """
            INSERT OR REPLACE INTO news (url, timestamp, ticker, title, content, sentiment_label, sentiment_score, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            data_to_insert = []
            for item in news_list:
                # Prepare Ticker string if it's a list
                tickers = item.get('ticker')
                if isinstance(tickers, list):
                    tickers = ", ".join(tickers)
                elif tickers is None:
                    tickers = ""
                
                # Content mapping could be 'clean_text' or 'content'
                content = item.get('clean_text') or item.get('content') or ""
                
                row = (
                    item.get('url'),
                    item.get('timestamp'),
                    tickers,
                    item.get('title'),
                    content,
                    item.get('sentiment_label'),
                    item.get('sentiment_score'),
                    item.get('summary')
                )
                data_to_insert.append(row)

            conn.executemany(query, data_to_insert)
            conn.commit()
            print(f"[*] Saved {len(data_to_insert)} news records to SQLite.")
            
        except Exception as e:
            print(f"[!] Error saving news to DB: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def get_news(
        self,
        ticker: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        sentiment_label: Optional[str] = None,
        source: Optional[str] = None
    ) -> pd.DataFrame:
        """
        Fetch news from database with filters.
        
        Args:
            ticker: Filter by ticker symbol
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            limit: Maximum number of records
            offset: Offset for pagination
            sentiment_label: Filter by sentiment (Bullish/Bear ish/Netral)
            source: Filter by source (CNBC/EmitenNews/IDX)
        
        Returns:
            Pandas DataFrame with news articles
        """
        conn = self._get_conn()
        try:
            base_query = "SELECT * FROM news WHERE 1=1"
            params = []

            # Ticker Filter
            if ticker and ticker != "^JKSE": 
                base_query += " AND ticker LIKE ?"
                params.append(f"%{ticker}%")

            # Date Filter
            if start_date:
                base_query += " AND date(timestamp) >= date(?)"
                params.append(str(start_date))
            
            if end_date:
                base_query += " AND date(timestamp) <= date(?)"
                params.append(str(end_date))

            # Source Filter (Based on domain parsing)
            if source and source != "All":
                if source == "CNBC":
                    base_query += " AND url LIKE '%cnbc.com%'"
                elif source == "EmitenNews":
                    base_query += " AND url LIKE '%emitennews.com%'"
                elif source == "IDX":
                    base_query += " AND (url LIKE '%idx.co.id%' OR source = 'IDX')"

            # Order by latest
            base_query += " ORDER BY timestamp DESC"

            # Pagination
            if limit is not None:
                base_query += " LIMIT ?"
                params.append(limit)
                if offset is not None:
                    base_query += " OFFSET ?"
                    params.append(offset)

            df = pd.read_sql(base_query, conn, params=params)
            return df
            
        except Exception as e:
            print(f"[!] Error fetching news from DB: {e}")
            return pd.DataFrame()
        finally:
            conn.close()
    
    def check_url_exists(self, url: str) -> bool:
        """
        Check if a URL already exists in the database.
        
        Args:
            url: URL to check
            
        Returns:
            True if URL exists, False otherwise
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM news WHERE url = ? LIMIT 1", (url,))
            return cursor.fetchone() is not None
        finally:
            conn.close()
    
    def get_all_urls(self) -> Set[str]:
        """
        Get all URLs currently in the database.
        
        Returns:
            Set of URLs
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT url FROM news")
            rows = cursor.fetchall()
            return {row[0] for row in rows}
        except Exception as e:
            print(f"[!] Error fetching URLs: {e}")
            return set()
        finally:
            conn.close()
