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

        # NeoBDM Broker Summaries (Net Buy & Net Sell)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS neobdm_broker_summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT,
                trade_date TEXT,
                side TEXT,
                broker TEXT,
                nlot REAL,
                nval REAL,
                avg_price REAL,
                scraped_at DATETIME
            );
        """)

        # Broker 5% Watchlist (Manual CRUD)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS broker_five_percent (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                broker_code TEXT NOT NULL,
                label TEXT,
                created_at DATETIME DEFAULT (datetime('now')),
                updated_at DATETIME DEFAULT (datetime('now'))
            );
        """)

        # Migration: ensure broker_five_percent is per-ticker (no global unique broker_code)
        try:
            cursor = conn.execute("PRAGMA table_info(broker_five_percent)")
            columns = [row[1] for row in cursor.fetchall()]
            needs_rebuild = 'ticker' not in columns

            if not needs_rebuild:
                idx_cursor = conn.execute("PRAGMA index_list(broker_five_percent)")
                for idx in idx_cursor.fetchall():
                    idx_name = idx[1]
                    is_unique = idx[2]
                    if not is_unique:
                        continue
                    info = conn.execute(f"PRAGMA index_info('{idx_name}')").fetchall()
                    idx_cols = [row[2] for row in info]
                    if idx_cols == ['broker_code']:
                        needs_rebuild = True
                        break

            if needs_rebuild:
                conn.execute("DROP TABLE IF EXISTS broker_five_percent_old;")
                conn.execute("ALTER TABLE broker_five_percent RENAME TO broker_five_percent_old;")
                conn.execute("""
                    CREATE TABLE broker_five_percent (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticker TEXT NOT NULL,
                        broker_code TEXT NOT NULL,
                        label TEXT,
                        created_at DATETIME DEFAULT (datetime('now')),
                        updated_at DATETIME DEFAULT (datetime('now'))
                    );
                """)
                conn.execute("""
                    INSERT INTO broker_five_percent (ticker, broker_code, label, created_at, updated_at)
                    SELECT '', broker_code, label, created_at, updated_at
                    FROM broker_five_percent_old;
                """)
                conn.execute("DROP TABLE broker_five_percent_old;")
        except sqlite3.OperationalError:
            pass

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
        
        # Volume Daily Records (Incremental Volume Data)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS volume_daily_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                trade_date TEXT NOT NULL,
                volume INTEGER NOT NULL,
                open_price REAL,
                high_price REAL,
                low_price REAL,
                close_price REAL,
                fetched_at TEXT DEFAULT (datetime('now')),
                UNIQUE(ticker, trade_date)
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
        conn.execute("CREATE INDEX IF NOT EXISTS idx_neobdm_broker_lookup ON neobdm_broker_summaries(ticker, trade_date);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_broker_five_ticker ON broker_five_percent(ticker);")
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_broker_five_unique ON broker_five_percent(ticker, broker_code);")
        
        # Market Metadata Indexes
        conn.execute("CREATE INDEX IF NOT EXISTS idx_market_meta_symbol ON market_metadata(symbol);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_market_meta_cached ON market_metadata(cached_at);")
        
        # Volume Daily Indexes
        conn.execute("CREATE INDEX IF NOT EXISTS idx_volume_ticker_date ON volume_daily_records(ticker, trade_date DESC);")
        
        # Done Detail Records (Paste-based trade data)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS done_detail_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                trade_date TEXT NOT NULL,
                trade_time TEXT,
                board TEXT,
                price REAL,
                qty INTEGER,
                buyer_type TEXT,
                buyer_code TEXT,
                seller_code TEXT,
                seller_type TEXT,
                created_at DATETIME DEFAULT (datetime('now'))
            );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_done_detail_lookup ON done_detail_records(ticker, trade_date);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_done_detail_time ON done_detail_records(ticker, trade_date, trade_time);")
        
        conn.commit()
