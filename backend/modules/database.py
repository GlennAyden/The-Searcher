"""
Backward-compatible DatabaseManager wrapper.

This maintains the original DatabaseManager interface while delegating to new repositories.
Allows existing code to work without changes during migration.
"""
from db.connection import DatabaseConnection
from db.news_repository import NewsRepository
from db.disclosure_repository import DisclosureRepository
from db.neobdm_repository import NeoBDMRepository
from db.market_metadata_repository import MarketMetadataRepository
from db.alpha_hunter_repository import AlphaHunterRepository
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
        self.market_meta_repo = MarketMetadataRepository(db_path)
        self.alpha_hunter_repo = AlphaHunterRepository(db_path)
    
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
    
    def save_broker_summary_batch(self, ticker, trade_date, buy_data, sell_data):
        return self.neobdm_repo.save_broker_summary_batch(ticker, trade_date, buy_data, sell_data)
    
    def get_broker_summary(self, ticker, trade_date):
        return self.neobdm_repo.get_broker_summary(ticker, trade_date)
    
    def get_available_dates_for_ticker(self, ticker):
        return self.neobdm_repo.get_available_dates_for_ticker(ticker)
    
    def get_broker_journey(self, ticker, brokers, start_date, end_date):
        return self.neobdm_repo.get_broker_journey(ticker, brokers, start_date, end_date)
    
    def get_top_holders_by_net_lot(self, ticker, limit=3):
        return self.neobdm_repo.get_top_holders_by_net_lot(ticker, limit)
    
    def get_floor_price_analysis(self, ticker, days=30):
        return self.neobdm_repo.get_floor_price_analysis(ticker, days)
    
    # Market Metadata operations - delegate to MarketMetadataRepository
    def get_market_cap(self, symbol: str, ttl_hours: int = 24):
        return self.market_meta_repo.get_market_cap(symbol, ttl_hours)
    
    # Volume Daily operations - delegate to NeoBDMRepository
    def save_volume_batch(self, ticker, records):
        return self.neobdm_repo.save_volume_batch(ticker, records)
    
    def get_volume_history(self, ticker, start_date=None, end_date=None):
        return self.neobdm_repo.get_volume_history(ticker, start_date, end_date)
    
    def get_latest_volume_date(self, ticker):
        return self.neobdm_repo.get_latest_volume_date(ticker)

    # Alpha Hunter operations - delegate to AlphaHunterRepository
    def get_alpha_hunter_repo(self):
        """Get Alpha Hunter repository instance."""
        return self.alpha_hunter_repo


