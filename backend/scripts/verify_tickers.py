"""
Verify ticker database consistency and integrity.
"""
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from modules.ticker_utils import get_ticker_list, get_ticker_map, get_ticker_count

def verify_tickers():
    """Verify ticker database integrity."""
    print("=== Ticker Database Verification ===\n")
    
    # Load data
    ticker_list = get_ticker_list()
    ticker_map = get_ticker_map()
    
    # Check count
    print(f"Total tickers: {get_ticker_count()}")
    
    # Check for duplicates (shouldn't happen since it's a dict)
    ticker_set = set(ticker_list)
    if len(ticker_list) != len(ticker_set):
        print(f"❌ Duplicates found: {len(ticker_list) - len(ticker_set)}")
    else:
        print("✅ No duplicates")
    
    # Check alphabetical order
    is_sorted = ticker_list == sorted(ticker_list)
    if is_sorted:
        print("✅ Alphabetically sorted")
    else:
        print("❌ NOT sorted!")
        for i in range(len(ticker_list) - 1):
            if ticker_list[i] > ticker_list[i+1]:
                print(f"   First out of order: {ticker_list[i]} > {ticker_list[i+1]}")
                break
    
    # Check for placeholders
    placeholders = {k: v for k, v in ticker_map.items() if "VERIFY NAME" in v}
    if placeholders:
        print(f"\n⚠️  Found {len(placeholders)} tickers with placeholder names:")
        for ticker, name in list(placeholders.items())[:5]:
            print(f"  - {ticker}: {name}")
        if len(placeholders) > 5:
            print(f"  ... and {len(placeholders) - 5} more")
    else:
        print("✅ No placeholder names")
    
    # Summary
    print("\n=== Summary ===")
    if is_sorted and len(ticker_list) == len(ticker_set):
        print("✅ All checks passed!")
        print(f"📊 Total valid tickers: {get_ticker_count()}")
    else:
        print("❌ Some issues found, please review above")

if __name__ == "__main__":
    verify_tickers()
