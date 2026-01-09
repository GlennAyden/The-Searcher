"""
Backward-compatible DatabaseManager wrapper.

This maintains the original DatabaseManager interface while delegating to new repositories.
Allows existing code to work without changes during migration.
"""
from db.connection import DatabaseConnection
from db.news_repository import NewsRepository
from db.disclosure_repository import DisclosureRepository
from db.neobdm_repository import NeoBDMRepository
from db.running_trade_repository import RunningTradeRepository
from db.market_metadata_repository import MarketMetadataRepository
from typing import Optional


class DatabaseManager:
    """
    Backward-compatible database manager.
    
    Delegates all operations to specialized repository classes.
    This allows gradual migration of existing code to use repositories directly.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """Initialize database manager with all repositories."""
        # Initialize database schema
        self.db_connection = DatabaseConnection(db_path)
        self.db_path = self.db_connection.db_path
        
        # Initialize repositories
        self.news_repo = NewsRepository(db_path)
        self.disclosure_repo = DisclosureRepository(db_path)
        self.neobdm_repo = NeoBDMRepository(db_path)
        self.rt_repo = RunningTradeRepository(db_path)
        self.market_meta_repo = MarketMetadataRepository(db_path)
    
    def _get_conn(self):
        """Get database connection (for backward compatibility)."""
        return self.db_connection._get_conn()
    
    # News operations - delegate to NewsRepository
    def save_news(self, news_list):
        return self.news_repo.save_news(news_list)
    
    def get_news(self, ticker=None, start_date=None, end_date=None, limit=None, offset=None, sentiment_label=None, source=None):
        return self.news_repo.get_news(ticker, start_date, end_date, limit, offset, sentiment_label, source)
    
    def check_url_exists(self, url):
        return self.news_repo.check_url_exists(url)
    
    def get_all_urls(self):
        return self.news_repo.get_all_urls()
    
    # Disclosure operations - delegate to DisclosureRepository
    def insert_disclosure(self, data):
        return self.disclosure_repo.insert_disclosure(data)
    
    def get_disclosures(self, ticker=None, start_date=None, end_date=None, limit=None, offset=None):
        return self.disclosure_repo.get_disclosures(ticker, start_date, end_date, limit, offset)
    
    def get_all_disclosures_paths(self):
        return self.disclosure_repo.get_all_disclosures_paths()
    
    # NeoBDM operations - delegate to NeoBDMRepository
    def save_neobdm_summary(self, method, period, data_list):
        return self.neobdm_repo.save_neobdm_summary(method, period, data_list)
    
    def save_neobdm_record_batch(self, method, period, data_list, scraped_at=None):
        return self.neobdm_repo.save_neobdm_record_batch(method, period, data_list, scraped_at)
    
    def get_neobdm_summaries(self, method=None, period=None, start_date=None, end_date=None):
        return self.neobdm_repo.get_neobdm_summaries(method, period, start_date, end_date)
    
    def get_available_neobdm_dates(self):
        return self.neobdm_repo.get_available_neobdm_dates()
    
    def get_neobdm_history(self, symbol, method='m', period='c', limit=30):
        return self.neobdm_repo.get_neobdm_history(symbol, method, period, limit)
    
    def get_neobdm_tickers(self):
        return self.neobdm_repo.get_neobdm_tickers()
    
    def get_latest_hot_signals(self):
        return self.neobdm_repo.get_latest_hot_signals()
    
    # Running Trade operations - delegate to RunningTradeRepository
    def save_rt_snapshot(self, data):
        return self.rt_repo.save_rt_snapshot(data)
    
    def get_rt_history(self, ticker, days=1):
        return self.rt_repo.get_rt_history(ticker, days)
    
    def save_raw_trades(self, ticker, date_str, trades):
        return self.rt_repo.save_raw_trades(ticker, date_str, trades)
    
    def get_raw_trades(self, ticker, date_str):
        return self.rt_repo.get_raw_trades(ticker, date_str)
    
    def get_raw_history_inventory(self):
        return self.rt_repo.get_raw_history_inventory()
    
    def delete_raw_trades(self, ticker, date_str):
        return self.rt_repo.delete_raw_trades(ticker, date_str)
    
    # Market Metadata operations - delegate to MarketMetadataRepository
    def get_market_cap(self, symbol: str, ttl_hours: int = 24):
        return self.market_meta_repo.get_market_cap(symbol, ttl_hours)

