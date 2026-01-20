"""
Price Volume Repository - Database operations for OHLCV (candlestick) data.

Manages storage and retrieval of daily stock price and volume data fetched from yfinance.
Supports incremental updates to avoid re-fetching historical data.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import logging

from .connection import BaseRepository

logger = logging.getLogger(__name__)


class PriceVolumeRepository(BaseRepository):
    """Repository for OHLCV price and volume data."""
    
    def __init__(self, db_path: Optional[str] = None):
        super().__init__(db_path)
        self._ensure_table_exists()
    
    def _ensure_table_exists(self):
        """Create the price_volume table if it doesn't exist."""
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS price_volume (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker TEXT NOT NULL,
                    trade_date DATE NOT NULL,
                    open REAL NOT NULL,
                    high REAL NOT NULL,
                    low REAL NOT NULL,
                    close REAL NOT NULL,
                    volume INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(ticker, trade_date)
                )
            """)
            
            # Create index for faster lookups
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_price_volume_ticker_date 
                ON price_volume(ticker, trade_date)
            """)
            conn.commit()
        finally:
            conn.close()
    
    def get_ohlcv_data(
        self, 
        ticker: str, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get OHLCV data for a ticker within a date range.
        
        Args:
            ticker: Stock ticker symbol (e.g., 'BBCA')
            start_date: Start date (YYYY-MM-DD), defaults to 9 months ago
            end_date: End date (YYYY-MM-DD), defaults to today
            
        Returns:
            List of OHLCV records sorted by date ascending
        """
        if not start_date:
            start_date = (datetime.now() - timedelta(days=270)).strftime('%Y-%m-%d')
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT trade_date, open, high, low, close, volume
                FROM price_volume
                WHERE ticker = ? AND trade_date BETWEEN ? AND ?
                ORDER BY trade_date ASC
            """, (ticker.upper(), start_date, end_date))
            
            rows = cursor.fetchall()
            return [
                {
                    'time': row[0],
                    'open': row[1],
                    'high': row[2],
                    'low': row[3],
                    'close': row[4],
                    'volume': row[5]
                }
                for row in rows
            ]
        finally:
            conn.close()
    
    def get_latest_date(self, ticker: str) -> Optional[str]:
        """
        Get the most recent trade date for a ticker in the database.
        
        Args:
            ticker: Stock ticker symbol
            
        Returns:
            Date string (YYYY-MM-DD) or None if no data exists
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT MAX(trade_date) FROM price_volume WHERE ticker = ?
            """, (ticker.upper(),))
            result = cursor.fetchone()
            return result[0] if result and result[0] else None
        finally:
            conn.close()
    
    def get_earliest_date(self, ticker: str) -> Optional[str]:
        """
        Get the earliest trade date for a ticker in the database.
        
        Args:
            ticker: Stock ticker symbol
            
        Returns:
            Date string (YYYY-MM-DD) or None if no data exists
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT MIN(trade_date) FROM price_volume WHERE ticker = ?
            """, (ticker.upper(),))
            result = cursor.fetchone()
            return result[0] if result and result[0] else None
        finally:
            conn.close()
    
    def upsert_ohlcv_data(self, ticker: str, data: List[Dict[str, Any]]) -> int:
        """
        Insert or update OHLCV data for a ticker.
        
        Args:
            ticker: Stock ticker symbol
            data: List of OHLCV records with keys: time, open, high, low, close, volume
            
        Returns:
            Number of rows affected
        """
        if not data:
            return 0
        
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            rows_affected = 0
            
            for record in data:
                try:
                    cursor.execute("""
                        INSERT OR REPLACE INTO price_volume 
                        (ticker, trade_date, open, high, low, close, volume)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        ticker.upper(),
                        record['time'],
                        record['open'],
                        record['high'],
                        record['low'],
                        record['close'],
                        record['volume']
                    ))
                    rows_affected += cursor.rowcount
                except Exception as e:
                    logger.error(f"Error inserting record for {ticker}: {e}")
            
            conn.commit()
            return rows_affected
        finally:
            conn.close()
    
    def has_data_for_ticker(self, ticker: str) -> bool:
        """
        Check if any data exists for a ticker.
        
        Args:
            ticker: Stock ticker symbol
            
        Returns:
            True if data exists, False otherwise
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) FROM price_volume WHERE ticker = ?
            """, (ticker.upper(),))
            result = cursor.fetchone()
            return result[0] > 0 if result else False
        finally:
            conn.close()
    
    def get_record_count(self, ticker: str) -> int:
        """
        Get the number of records for a ticker.
        
        Args:
            ticker: Stock ticker symbol
            
        Returns:
            Number of records
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) FROM price_volume WHERE ticker = ?
            """, (ticker.upper(),))
            result = cursor.fetchone()
            return result[0] if result else 0
        finally:
            conn.close()
    
    def get_all_tickers(self) -> List[str]:
        """
        Get all unique tickers that have OHLCV data in the database.
        
        Returns:
            List of ticker symbols
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT DISTINCT ticker FROM price_volume ORDER BY ticker
            """)
            rows = cursor.fetchall()
            return [row[0] for row in rows]
        finally:
            conn.close()
    
    def get_volume_history(
        self, 
        ticker: str, 
        end_date: str,
        days: int = 21
    ) -> List[Dict[str, Any]]:
        """
        Get volume history for a ticker ending at a specific date.
        
        Args:
            ticker: Stock ticker symbol
            end_date: End date (YYYY-MM-DD)
            days: Number of days of history to fetch
            
        Returns:
            List of {date, volume, close} records sorted by date descending
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT trade_date, volume, close
                FROM price_volume
                WHERE ticker = ? AND trade_date <= ?
                ORDER BY trade_date DESC
                LIMIT ?
            """, (ticker.upper(), end_date, days))
            
            rows = cursor.fetchall()
            return [
                {
                    'date': row[0],
                    'volume': row[1],
                    'close': row[2]
                }
                for row in rows
            ]
        finally:
            conn.close()
    
    def detect_unusual_volumes(
        self, 
        scan_days: int = 30,
        lookback_days: int = 20,
        min_ratio: float = 2.0
    ) -> List[Dict[str, Any]]:
        """
        Detect unusual volume events across all tickers.
        
        Uses Median of lookback_days as baseline. Unusual = volume > min_ratio * median.
        
        Args:
            scan_days: Number of recent days to scan for unusual volumes
            lookback_days: Number of days to calculate median baseline
            min_ratio: Minimum volume/median ratio to be considered unusual
            
        Returns:
            List of unusual volume events sorted by ratio descending
        """
        import statistics
        
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=scan_days)).strftime('%Y-%m-%d')
        
        unusual_volumes = []
        tickers = self.get_all_tickers()
        
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            
            for ticker in tickers:
                # Get all data for this ticker in scan period
                cursor.execute("""
                    SELECT trade_date, volume, close, open
                    FROM price_volume
                    WHERE ticker = ? AND trade_date BETWEEN ? AND ?
                    ORDER BY trade_date DESC
                """, (ticker, start_date, end_date))
                
                scan_data = cursor.fetchall()
                
                for i, (trade_date, volume, close, open_price) in enumerate(scan_data):
                    # Get previous N days for median calculation
                    cursor.execute("""
                        SELECT volume
                        FROM price_volume
                        WHERE ticker = ? AND trade_date < ?
                        ORDER BY trade_date DESC
                        LIMIT ?
                    """, (ticker, trade_date, lookback_days))
                    
                    prev_volumes = [row[0] for row in cursor.fetchall()]
                    
                    if len(prev_volumes) < 10:  # Need minimum data for reliable median
                        continue
                    
                    median_volume = statistics.median(prev_volumes)
                    
                    if median_volume > 0:
                        ratio = volume / median_volume
                        
                        if ratio >= min_ratio:
                            # Determine category
                            if ratio >= 5:
                                category = 'extreme'
                            elif ratio >= 3:
                                category = 'high'
                            else:
                                category = 'elevated'
                            
                            # Calculate price change
                            price_change = ((close - open_price) / open_price * 100) if open_price > 0 else 0
                            
                            unusual_volumes.append({
                                'ticker': ticker,
                                'date': trade_date,
                                'volume': volume,
                                'median_20d': round(median_volume),
                                'ratio': round(ratio, 2),
                                'category': category,
                                'close': close,
                                'price_change': round(price_change, 2)
                            })
            
            # Sort by ratio descending
            unusual_volumes.sort(key=lambda x: x['ratio'], reverse=True)
            
            return unusual_volumes
            
        finally:
            conn.close()
    
    def get_volume_spike_markers(
        self,
        ticker: str,
        lookback_days: int = 20,
        min_ratio: float = 2.0
    ) -> List[Dict[str, Any]]:
        """
        Get volume spike markers for a specific ticker to display on chart.
        
        Args:
            ticker: Stock ticker symbol
            lookback_days: Number of days for median calculation
            min_ratio: Minimum volume/median ratio to flag as spike
            
        Returns:
            List of spike markers with date, volume, ratio, and category
        """
        import statistics
        
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            
            # Get all data for this ticker, ordered by date
            cursor.execute("""
                SELECT trade_date, volume, close, open
                FROM price_volume
                WHERE ticker = ?
                ORDER BY trade_date ASC
            """, (ticker.upper(),))
            
            rows = cursor.fetchall()
            
            if len(rows) < lookback_days + 1:
                return []  # Not enough data
            
            spike_markers = []
            
            # For each day (starting after lookback period), check for spikes
            for i in range(lookback_days, len(rows)):
                trade_date = rows[i][0]
                volume = rows[i][1]
                close = rows[i][2]
                open_price = rows[i][3]
                
                # Calculate median of previous N days
                prev_volumes = [rows[j][1] for j in range(i - lookback_days, i)]
                
                if len(prev_volumes) < 10:
                    continue
                
                median_volume = statistics.median(prev_volumes)
                
                if median_volume > 0:
                    ratio = volume / median_volume
                    
                    if ratio >= min_ratio:
                        # Determine category
                        if ratio >= 5:
                            category = 'extreme'
                            color = '#ef4444'  # red
                        elif ratio >= 3:
                            category = 'high'
                            color = '#f59e0b'  # amber
                        else:
                            category = 'elevated'
                            color = '#22c55e'  # green
                        
                        # Calculate price change
                        price_change = ((close - open_price) / open_price * 100) if open_price > 0 else 0
                        
                        spike_markers.append({
                            'time': trade_date,
                            'volume': volume,
                            'median_20d': round(median_volume),
                            'ratio': round(ratio, 2),
                            'category': category,
                            'color': color,
                            'close': close,
                            'price_change': round(price_change, 2),
                            'position': 'aboveBar' if price_change >= 0 else 'belowBar',
                            'shape': 'arrowUp' if price_change >= 0 else 'arrowDown',
                            'text': f'{ratio:.1f}x'
                        })
            
            return spike_markers
            
        finally:
            conn.close()


# Global instance
price_volume_repo = PriceVolumeRepository()

