"""
Centralized Settings Module

All application configuration is consolidated here.
This replaces the scattered config.py at root level.

Usage:
    from config.settings import BASE_DIR, DATA_DIR, TICKER_DB_FILE
    # or
    from config import BASE_DIR, DATA_DIR
"""
import os
from pathlib import Path

# ============================================================================
# PATHS
# ============================================================================

# Base directory (backend root)
BASE_DIR = Path(__file__).resolve().parent.parent

# Data directories
DATA_DIR = BASE_DIR / "data"
DOWNLOADS_DIR = BASE_DIR / "downloads"
CACHE_DIR = BASE_DIR / "cache"
LOGS_DIR = BASE_DIR / "logs"

# Database
DATABASE_FILE = BASE_DIR / "database.db"
CHROMA_DB_DIR = BASE_DIR / "chroma_db"

# Data files
NEWS_DATA_FILE = DATA_DIR / "news_data.json"
ANALYZED_DATA_FILE = DATA_DIR / "analyzed_news.json"
TICKER_DB_FILE = DATA_DIR / "idn_tickers.json"
BROKER_DB_FILE = DATA_DIR / "brokers_idx.json"

# ============================================================================
# SCRAPER SETTINGS
# ============================================================================

# EmittenNews
EMITEN_NEWS_BASE_URL = "https://www.emitennews.com/category/emiten"
BASE_URL = EMITEN_NEWS_BASE_URL

# Common headers
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/91.0.4472.124 Safari/537.36"
)

# ============================================================================
# ANALYZER SETTINGS (Sentiment Analysis)
# ============================================================================

MODEL_NAME = "MoritzLaurer/mDeBERTa-v3-base-mnli-xnli"
SENTIMENT_LABELS = ["Bullish", "Bearish", "Netral"]
HYPOTHESIS_TEMPLATE = "Sentimen berita pasar saham ini adalah {}."
MAX_LENGTH = 512

# ============================================================================
# DASHBOARD SETTINGS
# ============================================================================

PAGE_TITLE = "AI Market Sentinel"
PAGE_ICON = "📈"
DEFAULT_TICKERS = ['^JKSE', 'BBRI.JK', 'BBCA.JK', 'BMRI.JK', 'GOTO.JK', 'TLKM.JK']

# ============================================================================
# API SETTINGS
# ============================================================================

API_VERSION = "2.0.0"
API_TITLE = "Financial Sentiment Analysis & Market Intelligence API"
API_DESCRIPTION = "Comprehensive market intelligence system with sentiment analysis and flow tracking"

# CORS
CORS_ORIGINS = ["*"]  # More permissive for local dev
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ["*"]
CORS_ALLOW_HEADERS = ["*"]

# GZip
GZIP_MINIMUM_SIZE = 1000

# ============================================================================
# DONE DETAIL SETTINGS
# ============================================================================

DONE_DETAIL_CLEANUP_DAYS = 7  # Grace period before raw data cleanup

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def ensure_directories():
    """Ensure all required directories exist."""
    for dir_path in [DATA_DIR, DOWNLOADS_DIR, CACHE_DIR, LOGS_DIR]:
        dir_path.mkdir(parents=True, exist_ok=True)
