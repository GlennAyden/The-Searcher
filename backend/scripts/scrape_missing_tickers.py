"""
Script to scrape and collect missing tickers from TradingView.
This is a temporary script to extract ticker data for IDX stocks.
"""
import requests
from bs4 import BeautifulSoup
import json
import re
from time import sleep

def scrape_tradingview_tickers():
    """Scrape all Indonesian stock tickers from TradingView"""
    url = "https://www.tradingview.com/markets/stocks-indonesia/market-movers-all-stocks/"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    print("Fetching data from TradingView...")
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        print(f"Error: Status code {response.status_code}")
        return None
    
    soup = BeautifulSoup(response.content, 'html.parser')
    
    # Find all links to stock symbols
    ticker_links = soup.find_all('a', href=re.compile(r'/symbols/IDX-[A-Z]+/'))
    
    tickers_data = {}
    
    for link in ticker_links:
        href = link.get('href', '')
        # Extract ticker from URL like /symbols/IDX-AALI/
        match = re.search(r'/symbols/IDX-([A-Z]+)/', href)
        if match:
            ticker = match.group(1)
            # Try to get company name (usually next sibling or in nearby elements)
            company_name = link.get_text(strip=True)
            
            # If ticker is the text, look for company name nearby
            if ticker == company_name or company_name.startswith('PT '):
                tickers_data[ticker] = company_name
            else:
                # The link text might be the company name
                if company_name and not company_name.startswith('['):
                    tickers_data[ticker] = company_name
    
    return tickers_data

def compare_with_existing(tradingview_tickers):
    """Compare TradingView tickers with existing ticker list"""
    
    # Load existing tickers
    with open('backend/data/tickers_idx.json', 'r') as f:
        existing_tickers = json.load(f)
    
    existing_set = set(existing_tickers)
    tradingview_set = set(tradingview_tickers.keys())
    
    missing_tickers = tradingview_set - existing_set
    extra_tickers = existing_set - tradingview_set
    
    print(f"\n📊 Statistics:")
    print(f"- Existing tickers: {len(existing_tickers)}")
    print(f"- TradingView tickers: {len(tradingview_tickers)}")
    print(f"- Missing tickers: {len(missing_tickers)}")
    print(f"- Extra (not in TradingView): {len(extra_tickers)}")
    
    return {
        'missing': sorted(list(missing_tickers)),
        'extra': sorted(list(extra_tickers)),
        'tradingview_data': tradingview_tickers
    }

if __name__ == "__main__":
    print("🔍 Scraping TradingView for Indonesian stock tickers...\n")
    
    tradingview_tickers = scrape_tradingview_tickers()
    
    if tradingview_tickers:
        print(f"\n✅ Found {len(tradingview_tickers)} tickers from TradingView")
        
        comparison = compare_with_existing(tradingview_tickers)
        
        # Save results
        with open('backend/data/missing_tickers_analysis.json', 'w') as f:
            json.dump(comparison, f, indent=2)
        
        print(f"\n💾 Analysis saved to: backend/data/missing_tickers_analysis.json")
        
        if comparison['missing']:
            print(f"\n📝 Sample missing tickers (first 10):")
            for ticker in comparison['missing'][:10]:
                company = tradingview_tickers.get(ticker, 'Unknown')
                print(f"  - {ticker}: {company}")
    else:
        print("❌ Failed to scrape tickers from TradingView")
