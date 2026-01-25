"""
Merge missing tickers into the ticker database.
Uses ticker_utils module for all operations.
"""
import json
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from modules.ticker_utils import get_ticker_map, add_ticker, get_ticker_count

def merge_tickers():
    """Merge missing tickers from analysis file into database."""
    
    analysis_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'missing_tickers_analysis.json')
    
    if not os.path.exists(analysis_file):
        print("❌ No analysis file found. Run scrape_missing_tickers.py first.")
        return
    
    # Load analysis
    with open(analysis_file, 'r') as f:
        analysis = json.load(f)
    
    missing_tickers = analysis.get('missing', [])
    tradingview_data = analysis.get('tradingview_data', {})
    
    if not missing_tickers:
        print("✅ No missing tickers to add!")
        return
    
    count_before = get_ticker_count()
    added_count = 0
    
    print(f"📊 Current database: {count_before} tickers")
    print(f"📊 Missing tickers to add: {len(missing_tickers)}")
    
    # Add missing tickers
    for ticker in missing_tickers:
        # Get company name from TradingView data or use placeholder
        company_name = tradingview_data.get(ticker)
        if not company_name:
            company_name = f"PT {ticker} Tbk (VERIFY NAME)"
            print(f"⚠️  No company name for {ticker}, using placeholder")
        
        if add_ticker(ticker, company_name):
            added_count += 1
            print(f"  ✅ Added: {ticker} - {company_name}")
        else:
            print(f"  ⏭️  Skipped (already exists): {ticker}")
    
    count_after = get_ticker_count()
    
    print(f"\n=== Summary ===")
    print(f"Before: {count_before} tickers")
    print(f"After: {count_after} tickers")
    print(f"Added: {added_count} new tickers")
    print("✅ Merge completed!")

if __name__ == "__main__":
    merge_tickers()
