"""Volume data fetcher using Yahoo Finance for Indonesian stocks."""
import yfinance as yf
from datetime import datetime, timedelta
from typing import Optional, List, Dict
import logging


class VolumeFetcher:
    """Fetch volume data from Yahoo Finance for Indonesian stocks."""
    
    START_DATE = "2025-12-22"  # Fixed start date as per requirement
    
    def __init__(self):
        """Initialize volume fetcher."""
        self.logger = logging.getLogger(__name__)
    
    def _format_ticker(self, ticker: str) -> str:
        """
        Format ticker for Yahoo Finance Indonesia.
        
        Args:
            ticker: Stock ticker (e.g., 'BBCA')
        
        Returns:
            Formatted ticker with .JK suffix (e.g., 'BBCA.JK')
        """
        ticker = ticker.upper().strip()
        if not ticker.endswith('.JK'):
            ticker = f"{ticker}.JK"
        return ticker
    
    def get_volume_data(
        self, 
        ticker: str, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None
    ) -> List[Dict]:
        """
        Fetch volume data for a ticker from Yahoo Finance.
        
        Args:
            ticker: Stock ticker (e.g., 'BBCA')
            start_date: Start date (YYYY-MM-DD), defaults to START_DATE
            end_date: End date (YYYY-MM-DD), defaults to today
        
        Returns:
            List of volume records with OHLCV data
            Format: [
                {
                    'trade_date': '2025-12-22',
                    'volume': 12500000,
                    'open_price': 8700.0,
                    'high_price': 8750.0,
                    'low_price': 8650.0,
                    'close_price': 8725.0
                },
                ...
            ]
        """
        try:
            # Format ticker
            yf_ticker = self._format_ticker(ticker)
            
            # Set date range
            if not start_date:
                start_date = self.START_DATE
            if not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
            
            self.logger.info(f"Fetching volume data for {yf_ticker} from {start_date} to {end_date}")
            
            # Fetch data from yfinance
            stock = yf.Ticker(yf_ticker)
            hist = stock.history(start=start_date, end=end_date)
            
            if hist.empty:
                self.logger.warning(f"No data found for {yf_ticker}")
                return []
            
            # Convert to list of dicts
            records = []
            for date, row in hist.iterrows():
                # Skip if volume is 0 (market holiday/weekend)
                if row['Volume'] == 0:
                    continue
                
                record = {
                    'trade_date': date.strftime('%Y-%m-%d'),
                    'volume': int(row['Volume']),
                    'open_price': float(row['Open']),
                    'high_price': float(row['High']),
                    'low_price': float(row['Low']),
                    'close_price': float(row['Close'])
                }
                records.append(record)
            
            self.logger.info(f"Fetched {len(records)} volume records for {ticker}")
            return records
            
        except Exception as e:
            self.logger.error(f"Error fetching volume data for {ticker}: {e}")
            return []
    
    def get_latest_date(self, ticker: str) -> Optional[str]:
        """
        Get the latest available trading date for a ticker.
        
        Args:
            ticker: Stock ticker
        
        Returns:
            Latest date in YYYY-MM-DD format, or None if no data
        """
        try:
            yf_ticker = self._format_ticker(ticker)
            stock = yf.Ticker(yf_ticker)
            
            # Get last 5 days to ensure we get at least one trading day
            end_date = datetime.now()
            start_date = end_date - timedelta(days=5)
            
            hist = stock.history(start=start_date, end=end_date)
            
            if hist.empty:
                return None
            
            # Get the latest date
            latest_date = hist.index[-1].strftime('%Y-%m-%d')
            return latest_date
            
        except Exception as e:
            self.logger.error(f"Error getting latest date for {ticker}: {e}")
            return None
