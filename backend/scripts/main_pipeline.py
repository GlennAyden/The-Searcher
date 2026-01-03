import os
import sys
# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from modules.scraper import NewsScraper
from modules.analyzer import SentimentEngine
from modules.database import DatabaseManager
from modules.utils import extract_tickers

def main():
    print("=== AI MARKET SENTINEL PIPELINE ===")
    
    # 1. Scraping
    scraper = NewsScraper()
    news_data = scraper.run(pages=2) # Adjust pages as needed
    
    if not news_data:
        print("[!] No data scraped. Exiting.")
        return

    # 2. Analysis
    engine = SentimentEngine()
    # process_and_save currently saves to JSON as backup, which is fine
    analyzed_data = engine.process_and_save(news_data)
    
    # 3. Data Enrichment (Tickers) & Database Saving
    if analyzed_data:
        print("[*] Enriching data with tickers and saving to Database...")
        db_manager = DatabaseManager()
        
        for article in analyzed_data:
            # Extract tickers using Utils
            # Ensure 'extracted_tickers' is present or we map it to 'ticker'
            # The DB expects 'ticker' string.
            tickers = extract_tickers(article.get('title', ''))
            article['ticker'] = tickers # List of tickers
            
        db_manager.save_news(analyzed_data)

    print("\n[+] Pipeline Finished Successfully.")
    print("    Run 'streamlit run app.py' to view the Dashboard.")

if __name__ == "__main__":
    main()
