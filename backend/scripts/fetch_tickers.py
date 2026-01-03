import json
import os
import sys
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

# Add project root to sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(BASE_DIR)

# Configuration
INPUT_FILE = os.path.join(BASE_DIR, "data/tickers_idx.json")
OUTPUT_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "idn_tickers.json")
MAX_WORKERS = 10 

def get_company_name(ticker):
    """Fetches company name for a single ticker."""
    full_ticker = f"{ticker}.JK"
    try:
        # Fast way to get name without full history download
        t = yf.Ticker(full_ticker)
        # Accessing .info triggers the request
        info = t.info
        name = info.get('longName') or info.get('shortName')
        return ticker, name
    except Exception:
        return ticker, None

def run():
    print(f"[*] Starting Master Ticker Database generation...")
    
    # 1. Load Tickers
    if not os.path.exists(INPUT_FILE):
        print(f"[!] Error: {INPUT_FILE} not found. Cannot proceed with yfinance method.")
        return

    with open(INPUT_FILE, 'r') as f:
        tickers = json.load(f)
        
    print(f"[*] Loaded {len(tickers)} tickers from {INPUT_FILE}")
    print(f"[*] Fetching names via yfinance (Concurrent {MAX_WORKERS} workers)...")
    
    ticker_map = {}
    success_count = 0
    fail_count = 0
    
    # 2. Fetch Data Concurrently
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_ticker = {executor.submit(get_company_name, t): t for t in tickers}
        
        for i, future in enumerate(as_completed(future_to_ticker)):
            ticker, name = future.result()
            if name:
                ticker_map[ticker] = name
                success_count += 1
            else:
                fail_count += 1
                
            # Progress bar
            if (i + 1) % 50 == 0:
                print(f"    Progress: {i + 1}/{len(tickers)} (Success: {success_count})")
                
    # 3. Save
    print(f"[*] Completed. Success: {success_count}, Failed: {fail_count}")
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(ticker_map, f, indent=2)
        
    print(f"[+] Saved to {OUTPUT_FILE}")
    
    # Preview
    preview = {k: ticker_map[k] for k in list(ticker_map.keys())[:5]}
    print("    Preview:", json.dumps(preview, indent=2))

if __name__ == "__main__":
    run()
