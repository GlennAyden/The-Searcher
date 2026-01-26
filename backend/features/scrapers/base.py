"""
Base Scraper - Common functionality for all scrapers.

Provides:
- Session management with proper headers
- Retry logic with exponential backoff
- Rate limiting
- Common date parsing utilities
- Error handling and logging
"""
import requests
import logging
import time
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

import config

logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    """
    Abstract base class for all scrapers.
    
    Subclasses must implement:
    - get_index_page(): Fetch article links from index/listing page
    - get_article_detail(): Fetch full article content
    - run(): Main execution method
    """
    
    # Override in subclasses
    BASE_URL: str = ""
    MAX_RETRIES: int = 3
    RETRY_DELAY: float = 1.0  # seconds
    REQUEST_TIMEOUT: int = 30  # seconds
    RATE_LIMIT_DELAY: float = 0.5  # seconds between requests
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": getattr(config, 'USER_AGENT', 
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        })
        self.last_request_time = 0
    
    def _rate_limit(self):
        """Enforce rate limiting between requests."""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.RATE_LIMIT_DELAY:
            time.sleep(self.RATE_LIMIT_DELAY - elapsed)
        self.last_request_time = time.time()
    
    def fetch_url(self, url: str, **kwargs) -> Optional[requests.Response]:
        """
        Fetch URL with retry logic and rate limiting.
        
        Args:
            url: URL to fetch
            **kwargs: Additional arguments for requests.get()
            
        Returns:
            Response object or None if all retries failed
        """
        self._rate_limit()
        
        for attempt in range(self.MAX_RETRIES):
            try:
                response = self.session.get(
                    url, 
                    timeout=self.REQUEST_TIMEOUT,
                    **kwargs
                )
                response.raise_for_status()
                return response
                
            except requests.RequestException as e:
                logger.warning(f"Request failed (attempt {attempt + 1}/{self.MAX_RETRIES}): {url} - {e}")
                if attempt < self.MAX_RETRIES - 1:
                    time.sleep(self.RETRY_DELAY * (2 ** attempt))  # Exponential backoff
                    
        logger.error(f"All retries exhausted for: {url}")
        return None
    
    def fetch_html(self, url: str) -> Optional[str]:
        """Fetch URL and return HTML content."""
        response = self.fetch_url(url)
        if response:
            return response.text
        return None
    
    def process_parallel(
        self, 
        items: List, 
        processor_func, 
        max_workers: int = 5,
        desc: str = "Processing"
    ) -> List[Dict]:
        """
        Process items in parallel using ThreadPoolExecutor.
        
        Args:
            items: List of items to process
            processor_func: Function to call for each item
            max_workers: Max concurrent threads
            desc: Description for logging
            
        Returns:
            List of results (non-None only)
        """
        results = []
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(processor_func, item): item for item in items}
            
            for future in as_completed(futures):
                try:
                    result = future.result()
                    if result:
                        results.append(result)
                except Exception as e:
                    logger.error(f"Error processing item: {e}")
        
        logger.info(f"{desc}: {len(results)}/{len(items)} successful")
        return results
    
    @abstractmethod
    def get_index_page(self, page: int = 1) -> List[Tuple]:
        """
        Fetch article links from index/listing page.
        
        Args:
            page: Page number to fetch
            
        Returns:
            List of tuples (url, date, title)
        """
        pass
    
    @abstractmethod
    def get_article_detail(self, url: str, **kwargs) -> Optional[Dict]:
        """
        Fetch and parse article details.
        
        Args:
            url: Article URL
            **kwargs: Additional context (e.g., estimated_date)
            
        Returns:
            Dict with article data or None if failed
        """
        pass
    
    @abstractmethod
    def run(self, start_date: datetime, end_date: datetime = None, **kwargs) -> List[Dict]:
        """
        Main execution method.
        
        Args:
            start_date: Start of date range
            end_date: End of date range (defaults to now)
            **kwargs: Scraper-specific arguments
            
        Returns:
            List of article dictionaries
        """
        pass
    
    # ========================================================================
    # Utility Methods
    # ========================================================================
    
    @staticmethod
    def parse_date_indonesian(date_str: str) -> Optional[datetime]:
        """
        Parse Indonesian date format to datetime.
        
        Handles formats like:
        - "24 Jan 2026 | 08:00 WIB"
        - "Minggu, 25 Januari 2026 | 13:37"
        """
        import pytz
        
        MONTH_MAP = {
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'mei': 5, 'jun': 6,
            'jul': 7, 'agu': 8, 'aug': 8, 'sep': 9, 'okt': 10, 'oct': 10,
            'nov': 11, 'des': 12, 'dec': 12,
            'januari': 1, 'februari': 2, 'maret': 3, 'april': 4,
            'juni': 6, 'juli': 7, 'agustus': 8, 'september': 9,
            'oktober': 10, 'november': 11, 'desember': 12
        }
        
        try:
            # Clean the string
            clean = date_str.lower().strip()
            
            # Remove day names and extra words
            for day in ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']:
                clean = clean.replace(day, '')
            clean = clean.replace(',', '').replace('wib', '').replace('|', '').strip()
            
            # Split into parts
            parts = clean.split()
            if len(parts) < 3:
                return None
            
            day = int(parts[0])
            month = MONTH_MAP.get(parts[1][:3], 0)
            year = int(parts[2])
            
            hour, minute = 0, 0
            if len(parts) >= 4 and ':' in parts[3]:
                time_parts = parts[3].split(':')
                hour = int(time_parts[0])
                minute = int(time_parts[1]) if len(time_parts) > 1 else 0
            
            tz = pytz.timezone('Asia/Jakarta')
            return tz.localize(datetime(year, month, day, hour, minute))
            
        except (ValueError, IndexError, KeyError) as e:
            logger.debug(f"Could not parse date '{date_str}': {e}")
            return None
    
    @staticmethod
    def is_date_in_range(date: datetime, start: datetime, end: datetime) -> bool:
        """Check if date falls within range (inclusive)."""
        if date is None:
            return False
        
        # Normalize to date for comparison
        if hasattr(date, 'date'):
            date = date.date()
        if hasattr(start, 'date'):
            start = start.date()
        if hasattr(end, 'date'):
            end = end.date()
        
        return start <= date <= end
