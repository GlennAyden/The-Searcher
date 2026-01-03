import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from modules.scraper_idx import IDXScraper
import datetime

def main():
    scraper = IDXScraper()
    
    # Date range: Last 7 days to ensure we get something
    end_date = datetime.datetime.now()
    start_date = end_date - datetime.timedelta(days=7)
    
    ticker = "BBRI" # Use a big bank, likely to have news
    print(f"Fetching disclosures for {ticker} from {start_date.date()} to {end_date.date()}...")
    
    results = scraper.fetch_idx_disclosures(start_date, end_date, ticker=ticker)
    
    print(f"Found {len(results)} items.")
    
    if results:
        # Print first 3
        for item in results[:3]:
            print(f"\n[Date] {item['date']}")
            print(f"[Title] {item['title']}")
            print(f"[URL] {item['download_url']}")
            
        # Try downloading the first one
        first_item = results[0]
        save_dir = "debug/downloads"
        filename = f"{first_item['ticker']}_{first_item['file_id']}.pdf"
        save_path = os.path.join(save_dir, filename)
        
        print(f"\nAttempting to download to {save_path}...")
        success = scraper.download_pdf(first_item['download_url'], save_path)
        
        if success:
            print("Download SUCCESS!")
            if os.path.exists(save_path):
                 print(f"File size: {os.path.getsize(save_path)} bytes")
        else:
            print("Download FAILED.")
    else:
        print("No results found. Try a wider date range or different ticker.")

if __name__ == "__main__":
    main()
