import os
import sys
# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pandas as pd
from modules.database import DatabaseManager
from modules.analyzer import SentimentEngine
from modules.utils import extract_tickers

def run_backfill():
    print("=========================================")
    print("   AI MARKET SENTINEL - BACKFILL JOB")
    print("=========================================")
    
    # 1. Fetch All Data
    print("[*] Fetching all news from SQLite...")
    db = DatabaseManager()
    df = db.get_news()
    
    if df.empty:
        print("[!] Database is empty. Nothing to analyze.")
        return

    print(f"[*] Loaded {len(df)} records.")
    
    # Convert to list of dicts for processing
    # Ensure 'clean_text' (used by analyzer) is populated from 'content' if missing
    news_list = df.to_dict('records')
    
    # 2. Enrich Tickers (Name-to-Ticker)
    print("[*] Updating Ticker Mappings (Name Detection)...")
    updated_count = 0
    
    for item in news_list:
        # Construct full text for search
        title = item.get('title', '') or ''
        content = item.get('content', '') or ''
        full_text = f"{title}. {content}"
        
        # Extract using new logic
        detected_tickers = extract_tickers(full_text)
        
        # Update item
        # Join list to string for DB
        old_ticker = item.get('ticker', '')
        new_ticker_str = ", ".join(detected_tickers)
        
        if new_ticker_str != old_ticker:
            item['ticker'] = new_ticker_str
            # item['ticker'] needs to be list for analyzer? 
            # effectively analyzer doesn't use 'ticker', it just passes it through.
            # But database.save_news expects a list or string?
            # Let's look at save_news: "if isinstance(tickers, list): tickers = ', '.join(tickers)"
            # So passing a list is safer if we want to be consistent with other parts, 
            # BUT save_news handles both. Let's keep it as string since we just joined it.
            # Wait, save_news logic:
            # tickers = item.get('ticker')
            # if isinstance(tickers, list)...
            # So if we pass a string, it stays a string.
            
            # However, for consistency with `extract_tickers` returning a list,
            # let's store it as a list in the object passed to save_news, 
            # so the save_news logic works as intended (it joins lists).
            item['ticker'] = detected_tickers 
            updated_count += 1
        else:
            # Ensure it's in the format save_news handles (it handles strings/lists/None)
            pass

    print(f"[*] Updated tickers for {updated_count} articles.")

    # 3. Re-Run Sentiment Analysis
    print("[*] Initializing Sentiment Engine...")
    engine = SentimentEngine()
    
    # Ensure 'clean_text' is present (analyzer expects it)
    for item in news_list:
        if 'clean_text' not in item or not item['clean_text']:
            item['clean_text'] = item.get('content', '')

    print("[*] re-running inference on all items...")
    analyzed_data = engine.process_and_save(news_list)
    
    # 4. Save Back to DB
    print("[*] Saving updates to SQLite...")
    db.save_news(analyzed_data)
    print("[+] Backfill Complete!")

if __name__ == "__main__":
    run_backfill()
