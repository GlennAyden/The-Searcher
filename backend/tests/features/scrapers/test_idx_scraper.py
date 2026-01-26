import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from datetime import datetime, timedelta

from modules.scraper_idx import fetch_idx_disclosures, download_pdf

def test_scraper():
    print("=== Testing IDX Scraper ===")
    
    # Range: Last 30 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    ticker = "BBRI"
    
    print(f"Fetching for {ticker} from {start_date.date()} to {end_date.date()}...")
    
    data = fetch_idx_disclosures(
        ticker=ticker,
        date_from=start_date,
        date_to=end_date,
        limit=10 
    )
    
    if not data:
        print("No disclosures found (or error).")
        return

    print("Success! Showing top 3 results:")
    for i, item in enumerate(data[:3]):
        print(f"[{i+1}] {item['date']} - {item['title']}")
        print(f"    URL: {item['download_url']}")
    
    # Test Download
    print("\n=== Testing Download ===")
    target = data[0]
    save_dir = "test_downloads"
    print(f"Downloading first file: {target['filename']}...")
    
    path = download_pdf(target['download_url'], save_dir)
    
    if path and os.path.exists(path):
        print(f"Downloaded successfully to: {path}")
        print(f"File size: {os.path.getsize(path)} bytes")
    else:
        print("Download failed.")

if __name__ == "__main__":
    test_scraper()
