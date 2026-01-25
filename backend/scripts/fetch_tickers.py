"""
Fetch company names for tickers using yfinance.
Outputs directly to idn_tickers.json (single source of truth).
"""
import json
import os
import sys
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add project root to sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(BASE_DIR)

from modules.ticker_utils import get_ticker_list, get_ticker_map

# Configuration
OUTPUT_FILE = os.path.join(BASE_DIR, "data", "idn_tickers.json")
MAX_WORKERS = 10 

def get_company_name(ticker):
    """Fetches company name for a single ticker."""
    full_ticker = f"{ticker}.JK"
    try:
        t = yf.Ticker(full_ticker)
        info = t.info
        name = info.get('longName') or info.get('shortName')
        return ticker, name
    except Exception:
        return ticker, None

def run():
    print(f"[*] Starting Ticker Database update...")
    
    # Load existing ticker data
    existing_map = get_ticker_map()
    tickers = get_ticker_list()
        
    print(f"[*] Found {len(tickers)} tickers in database")
    print(f"[*] Fetching names via yfinance (Concurrent {MAX_WORKERS} workers)...")
    
    ticker_map = existing_map.copy()
    success_count = 0
    fail_count = 0
    updated_count = 0
    
    # Only fetch for tickers without names or with placeholder names
    tickers_to_fetch = [t for t in tickers 
                        if t not in ticker_map 
                        or "VERIFY NAME" in ticker_map.get(t, "")]
    
    if not tickers_to_fetch:
        print("[*] All tickers already have valid names. Nothing to fetch.")
        return
    
    print(f"[*] Need to fetch names for {len(tickers_to_fetch)} tickers...")
    
    # Fetch Data Concurrently
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_ticker = {executor.submit(get_company_name, t): t for t in tickers_to_fetch}
        
        for i, future in enumerate(as_completed(future_to_ticker)):
            ticker, name = future.result()
            if name:
                if ticker not in ticker_map or ticker_map[ticker] != name:
                    ticker_map[ticker] = name
                    updated_count += 1
                success_count += 1
            else:
                fail_count += 1
                
            # Progress bar
            if (i + 1) % 50 == 0:
                print(f"    Progress: {i + 1}/{len(tickers_to_fetch)} (Success: {success_count})")
                
    # Save
    print(f"[*] Completed. Success: {success_count}, Failed: {fail_count}, Updated: {updated_count}")
    
    # Sort by keys before saving
    sorted_map = dict(sorted(ticker_map.items()))
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(sorted_map, f, indent=2, ensure_ascii=False)
        
    print(f"[+] Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    run()
