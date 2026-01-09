"""Base database connection and schema management."""
import sqlite3
import os
import config
from typing import Optional


class BaseRepository:
    """Base repository class with shared connection management."""
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize repository with database connection.
        
        Args:
            db_path: Path to SQLite database file. Uses default if None.
        """
        self.db_path = db_path if db_path else os.path.join(config.DATA_DIR, "market_sentinel.db")
    
    def _get_conn(self) -> sqlite3.Connection:
        """Get database connection."""
        return sqlite3.connect(self.db_path)


class DatabaseConnection:
    """Database connection and schema manager."""
    
    def __init__(self, db_path: Optional[str] = None):
        """Initialize database with schema setup."""
        self.db_path = db_path if db_path else os.path.join(config.DATA_DIR, "market_sentinel.db")
        self._init_db()
    
    def _get_conn(self) -> sqlite3.Connection:
        """Get database connection."""
        return sqlite3.connect(self.db_path)
    
    def _init_db(self):
        """Initialize database and enable WAL mode."""
        conn = self._get_conn()
        try:
            # Enable Write Ahead Logging for concurrency/performance
            conn.execute("PRAGMA journal_mode=WAL;")
            self._create_tables(conn)
        finally:
            conn.close()
    
    def _create_tables(self, conn: sqlite3.Connection):
        """
        Create all database tables if they don't exist.
        
        Centralized schema definition for all modules.
        """
        # News table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS news (
                url TEXT PRIMARY KEY,
                timestamp TEXT,
                ticker TEXT,
                title TEXT,
                content TEXT,
                sentiment_label TEXT,
                sentiment_score REAL,
                summary TEXT
            );
        """)
        
        # IDX Disclosures table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS idx_disclosures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT,
                title TEXT,
                published_date DATETIME,
                download_url TEXT UNIQUE,
                local_path TEXT,
                processed_status TEXT DEFAULT 'PENDING',
                ai_summary TEXT
            );
        """)
        
        # NeoBDM Records (Structured)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS neobdm_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scraped_at DATETIME,
                method TEXT,
                period TEXT,
                symbol TEXT,
                pinky TEXT,
                crossing TEXT,
                likuid TEXT,
                w_4 TEXT,
                w_3 TEXT,
                w_2 TEXT,
                w_1 TEXT,
                d_4 TEXT,
                d_3 TEXT,
                d_2 TEXT,
                d_0 TEXT,
                pct_1d TEXT,
                c_20 TEXT,
                c_10 TEXT,
                c_5 TEXT,
                c_3 TEXT,
                pct_3d TEXT,
                pct_5d TEXT,
                pct_10d TEXT,
                pct_20d TEXT,
                price TEXT,
                ma5 TEXT,
                ma10 TEXT,
                ma20 TEXT,
                ma50 TEXT,
                ma100 TEXT,
                unusual TEXT
            );
        """)
        
        # NeoBDM Summaries (Legacy JSON)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS neobdm_summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scraped_at DATETIME,
                method TEXT,
                period TEXT,
                data_json TEXT
            );
        """)
        
        # Running Trade Snapshots (15m intervals)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS rt_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT,
                interval_start DATETIME,
                interval_end DATETIME,
                buy_vol INTEGER,
                sell_vol INTEGER,
                net_vol INTEGER,
                avg_price REAL,
                status TEXT,
                big_order_count INTEGER,
                conclusion TEXT
            );
        """)
        
        # Raw Running Trade History (Full Day)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS rt_raw_history (
                id TEXT PRIMARY KEY,
                ticker TEXT,
                time TEXT,
                action TEXT,
                price REAL,
                lot INTEGER,
                buyer TEXT,
                seller TEXT,
                trade_number TEXT,
                market_board TEXT,
                scrape_date TEXT
            );
        """)

        # Market Analytics Cache (OHLCV Data for Forecasting)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS market_analytics_cache (
                ticker TEXT,
                date DATE,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                volume REAL,
                PRIMARY KEY (ticker, date)
            );
        """)
        
        # Market Metadata Cache (Market Cap with TTL)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS market_metadata (
                symbol TEXT PRIMARY KEY,
                market_cap REAL NOT NULL,
                currency TEXT DEFAULT 'IDR',
                cached_at DATETIME NOT NULL,
                source TEXT DEFAULT 'yfinance'
            );
        """)
        
        # Safe migration for existing tables
        try:
            conn.execute("ALTER TABLE news ADD COLUMN summary TEXT")
        except sqlite3.OperationalError:
            pass  # Column already exists
        
        # Optimization: Create indexes
        conn.execute("CREATE INDEX IF NOT EXISTS idx_news_ticker ON news(ticker);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_news_timestamp ON news(timestamp);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_dis_ticker ON idx_disclosures(ticker);")
        
        # NeoBDM Optimization Indexes
        conn.execute("CREATE INDEX IF NOT EXISTS idx_neobdm_rec_lookup ON neobdm_records(method, period, scraped_at);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_neobdm_rec_symbol ON neobdm_records(symbol);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_neobdm_sum_lookup ON neobdm_summaries(method, period, scraped_at);")
        
        # Market Metadata Indexes
        conn.execute("CREATE INDEX IF NOT EXISTS idx_market_meta_symbol ON market_metadata(symbol);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_market_meta_cached ON market_metadata(cached_at);")
        
        conn.commit()
