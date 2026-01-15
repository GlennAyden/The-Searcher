"""
Merge missing tickers into the existing ticker lists.
This script handles the merge carefully by:
1. Adding missing tickers from TradingView
2. Preserving existing tickers (even if not in TradingView)
3. Sorting alphabetically
4. Ensuring both files are in sync
"""
import json

def merge_tickers():
    # Load existing tickers
    with open('backend/data/tickers_idx.json', 'r') as f:
        existing_tickers = json.load(f)
    
    with open('backend/data/idn_tickers.json', 'r') as f:
        existing_ticker_names = json.load(f)
    
    # Load analysis
    with open('backend/data/missing_tickers_analysis.json', 'r') as f:
        analysis = json.load(f)
    
    missing_tickers = analysis['missing']
    tradingview_data = analysis['tradingview_data']
    
    # Combine: keep all existing + add missing
    updated_ticker_list = sorted(set(existing_tickers + missing_tickers))
    
    # Update ticker names dictionary
    updated_ticker_names = existing_ticker_names.copy()
    
    # Add missing tickers from TradingView
    for ticker in missing_tickers:
        if ticker in tradingview_data and ticker not in updated_ticker_names:
            updated_ticker_names[ticker] = tradingview_data[ticker]
    
    # Add any ticker from updated_ticker_list that's not in names dict yet
    # (with placeholder names for manual update later)
    for ticker in updated_ticker_list:
        if ticker not in updated_ticker_names:
            # Try to get from TradingView first
            if ticker in tradingview_data:
                updated_ticker_names[ticker] = tradingview_data[ticker]
            else:
                # Placeholder - will need manual update
                updated_ticker_names[ticker] = f"PT {ticker} Tbk (VERIFY NAME)"
                print(f"⚠️  Warning: No company name found for {ticker}, added placeholder")
    
    # Sort ticker names by key
    updated_ticker_names = dict(sorted(updated_ticker_names.items()))
    
    # Verify both lists match
    assert set(updated_ticker_list) == set(updated_ticker_names.keys()), "Mismatch between ticker lists!"
    
    print(f"Before: {len(existing_tickers)} tickers")
    print(f"After: {len(updated_ticker_list)} tickers")
    print(f"Added: {len(updated_ticker_list) - len(existing_tickers)} new tickers")
    
    # Save updated lists
    with open('backend/data/tickers_idx.json', 'w') as f:
        json.dump(updated_ticker_list, f, indent=2)
    
    with open('backend/data/idn_tickers.json', 'w') as f:
        json.dump(updated_ticker_names, f, indent=2, ensure_ascii=False)
    
    print("\n✅ Successfully updated both ticker files!")
    print(f"📝 Total tickers: {len(updated_ticker_list)}")
    
    # Show first 10 added tickers
    newly_added = [t for t in updated_ticker_list if t not in existing_tickers]
    print(f"\n📊 Sample of newly added tickers (first 10):")
    for ticker in newly_added[:10]:
        name = updated_ticker_names.get(ticker, "Unknown")
        print(f"  - {ticker}: {name}")

if __name__ == "__main__":
    merge_tickers()
