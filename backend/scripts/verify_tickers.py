import json

# Load tickers
with open('backend/data/tickers_idx.json', 'r') as f:
    tickers = json.load(f)

# Check for duplicates
seen = set()
duplicates = []
for ticker in tickers:
    if ticker in seen:
        duplicates.append(ticker)
    else:
        seen.add(ticker)

print(f"Total tickers: {len(tickers)}")
print(f"Unique tickers: {len(seen)}")
print(f"Duplicates: {duplicates if duplicates else 'None'}")

# Check alphabetical order
is_sorted = tickers == sorted(tickers)
print(f"Alphabetically sorted: {is_sorted}")
