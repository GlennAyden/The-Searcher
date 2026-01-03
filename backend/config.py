import os

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DOWNLOADS_DIR = os.path.join(BASE_DIR, "downloads")

NEWS_DATA_FILE = os.path.join(DATA_DIR, "news_data.json")
ANALYZED_DATA_FILE = os.path.join(DATA_DIR, "analyzed_news.json")
TICKER_DB_FILE = os.path.join(DATA_DIR, "idn_tickers.json")

# Scraper Settings
BASE_URL = "https://www.emitennews.com/category/emiten"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

# Analyzer Settings
MODEL_NAME = "MoritzLaurer/mDeBERTa-v3-base-mnli-xnli"
SENTIMENT_LABELS = ["Bullish", "Bearish", "Netral"]
HYPOTHESIS_TEMPLATE = "Sentimen berita pasar saham ini adalah {}."
MAX_LENGTH = 512

# Dashboard Settings
PAGE_TITLE = "AI Market Sentinel"
PAGE_ICON = "📈"
DEFAULT_TICKERS = ['^JKSE', 'BBRI.JK', 'BBCA.JK', 'BMRI.JK', 'GOTO.JK', 'TLKM.JK']
