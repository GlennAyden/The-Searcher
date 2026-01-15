"""
Additional verification - check consistency between both files
"""
import json

# Load both files
with open('backend/data/tickers_idx.json', 'r') as f:
    tickers_idx = json.load(f)

with open('backend/data/idn_tickers.json', 'r') as f:
    idn_tickers = json.load(f)

# Verify
print("=== Ticker Files Verification ===\n")

# Check lengths
print(f"tickers_idx.json: {len(tickers_idx)} tickers")
print(f"idn_tickers.json: {len(idn_tickers)} tickers")

# Check for duplicates
tickers_set = set(tickers_idx)
print(f"\nUnique tickers in idx: {len(tickers_set)}")
print(f"Duplicates in idx: {len(tickers_idx) - len(tickers_set)}")

# Check consistency
idx_set = set(tickers_idx)
idn_set = set(idn_tickers.keys())

print(f"\n=== Consistency Check ===")
print(f"Both files match: {idx_set == idn_set}")

if idx_set != idn_set:
    print(f"In idx but not in idn: {idx_set - idn_set}")
    print(f"In idn but not in idx: {idn_set - idx_set}")

# Check alphabetical order
is_sorted = tickers_idx == sorted(tickers_idx)
print(f"\n=== Alphabetical Order ===")
print(f"tickers_idx.json sorted: {is_sorted}")

if not is_sorted:
    print("❌ NOT sorted! Need to sort...")
    # Find first out of order
    for i in range(len(tickers_idx) - 1):
        if tickers_idx[i] > tickers_idx[i+1]:
            print(f"First out of order: {tickers_idx[i]} > {tickers_idx[i+1]} at index {i}")
            break
else:
    print("✅ Properly sorted!")

# Check for placeholders
placeholders = {k: v for k, v in idn_tickers.items() if "VERIFY NAME" in v}
if placeholders:
    print(f"\n⚠️  Found {len(placeholders)} tickers with placeholder names:")
    for ticker, name in list(placeholders.items())[:5]:
        print(f"  - {ticker}: {name}")
    if len(placeholders) > 5:
        print(f"  ... and {len(placeholders) - 5} more")

print("\n=== Summary ===")
if idx_set == idn_set and is_sorted and len(tickers_idx) == len(tickers_set):
    print("✅ All checks passed!")
    print(f"📊 Total valid tickers: {len(tickers_idx)}")
else:
    print("❌ Some issues found, please review above")
