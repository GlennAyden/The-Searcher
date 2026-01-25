"""
Complete verification of ticker database.
(Simplified version - idn_tickers.json is now the single source of truth)
"""
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from modules.ticker_utils import get_ticker_list, get_ticker_map, get_ticker_count

def verify_complete():
    """Complete verification of ticker database."""
    print("=== Complete Ticker Database Verification ===\n")
    
    ticker_list = get_ticker_list()
    ticker_map = get_ticker_map()
    
    # Stats
    print(f"📊 Total tickers: {get_ticker_count()}")
    print(f"📊 Unique tickers: {len(set(ticker_list))}")
    
    issues = []
    
    # Check alphabetical order
    is_sorted = ticker_list == sorted(ticker_list)
    if not is_sorted:
        issues.append("Tickers not sorted alphabetically")
        for i in range(len(ticker_list) - 1):
            if ticker_list[i] > ticker_list[i+1]:
                print(f"❌ First out of order: {ticker_list[i]} > {ticker_list[i+1]} at index {i}")
                break
    else:
        print("✅ Alphabetically sorted")
    
    # Check for empty names
    empty_names = [k for k, v in ticker_map.items() if not v or not v.strip()]
    if empty_names:
        issues.append(f"Found {len(empty_names)} tickers with empty names")
        print(f"❌ Tickers with empty names: {empty_names[:5]}")
    else:
        print("✅ All tickers have names")
    
    # Check for placeholders
    placeholders = {k: v for k, v in ticker_map.items() if "VERIFY NAME" in v}
    if placeholders:
        print(f"\n⚠️  Found {len(placeholders)} tickers with placeholder names:")
        for ticker, name in list(placeholders.items())[:5]:
            print(f"  - {ticker}: {name}")
        if len(placeholders) > 5:
            print(f"  ... and {len(placeholders) - 5} more")
    
    # Check for unusual ticker formats
    unusual = [t for t in ticker_list if len(t) < 4 or len(t) > 5 or not t.isupper()]
    if unusual:
        print(f"\n⚠️  Unusual ticker formats: {unusual[:10]}")
    
    # Summary
    print("\n=== Summary ===")
    if not issues:
        print("✅ All checks passed!")
        print(f"📊 Total valid tickers: {get_ticker_count()}")
    else:
        print("❌ Issues found:")
        for issue in issues:
            print(f"  - {issue}")

if __name__ == "__main__":
    verify_complete()
