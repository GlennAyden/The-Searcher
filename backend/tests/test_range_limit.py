import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from modules.scraper_idx import fetch_idx_disclosures
import datetime

def test_wide_range():
    # Try fetching 1 full year for a liquid stock (BBRI) to ensure data exists
    # If the API limits range (e.g. to 3 months), this might return empty or error.
    ticker = "BBRI"
    start_date = datetime.date(2023, 1, 1)
    end_date = datetime.date(2023, 12, 31)
    
    print(f"Testing wide range {start_date} - {end_date} for {ticker}...")
    
    # Limit to 5 just to see if the REQUEST succeeds, not to download everything
    results = fetch_idx_disclosures(
        ticker=ticker, 
        date_from=start_date, 
        date_to=end_date,
        limit=5 
    )
    
    if results:
        print(f"✅ Success! Found {len(results)} items (limit 5). API accepts 1 year range.")
        print(f"Sample: {results[0]['title']} ({results[0]['date']})")
    else:
        print("❌ Failed or No Data. Possible API range limit or empty period.")

if __name__ == "__main__":
    test_wide_range()
