"""Test incremental fetching logic"""
import sys
sys.path.insert(0, 'backend')

from datetime import datetime, timedelta
from db.price_volume_repository import price_volume_repo

# Test with BBCA
ticker = "BBCA"
months = 9

# Get current database state
latest_date = price_volume_repo.get_latest_date(ticker)
earliest_date = price_volume_repo.get_earliest_date(ticker)

print(f"=== Current Database State for {ticker} ===")
print(f"Latest date in DB: {latest_date}")
print(f"Earliest date in DB: {earliest_date}")

# Simulate the logic in price_volume.py
end_date = datetime.now()
start_date = end_date - timedelta(days=months * 30)
today = datetime.now().date()

print(f"\n=== Fetch Logic Simulation ===")
print(f"Today: {today}")
print(f"Requested range: {start_date.date()} to {end_date.date()}")

if not latest_date:
    print("need_fetch = True (No data exists)")
else:
    latest_dt = datetime.strptime(latest_date, '%Y-%m-%d')
    earliest_dt = datetime.strptime(earliest_date, '%Y-%m-%d')
    
    print(f"latest_dt.date(): {latest_dt.date()}")
    print(f"today - 1 day: {today - timedelta(days=1)}")
    print(f"Condition check: {latest_dt.date()} < {today - timedelta(days=1)} = {latest_dt.date() < today - timedelta(days=1)}")
    
    if start_date.date() < earliest_dt.date():
        print("need_fetch = True (Requested older data)")
    elif latest_dt.date() < today - timedelta(days=1):
        fetch_start = latest_dt + timedelta(days=1)
        print(f"need_fetch = True (Incremental fetch from {fetch_start.date()})")
    else:
        print("need_fetch = False (Data is up to date)")

print("\n=== Testing actual yfinance fetch ===")
import yfinance as yf

if latest_date:
    latest_dt = datetime.strptime(latest_date, '%Y-%m-%d')
    fetch_start = latest_dt + timedelta(days=1)
    yf_ticker = f"{ticker}.JK"
    
    print(f"Fetching {yf_ticker} from {fetch_start.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
    
    stock = yf.Ticker(yf_ticker)
    df = stock.history(start=fetch_start.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'))
    
    if df.empty:
        print("WARNING: No data returned from yfinance!")
    else:
        print(f"yfinance returned {len(df)} records")
        print(f"Date range: {df.index[0].strftime('%Y-%m-%d')} to {df.index[-1].strftime('%Y-%m-%d')}")
        
        # Check what records would be added
        new_records = []
        for date_idx, row in df.iterrows():
            new_records.append({
                'time': date_idx.strftime('%Y-%m-%d'),
                'close': float(row['Close']),
                'volume': int(row['Volume'])
            })
        
        print("\nNew records to add:")
        for r in new_records:
            print(f"  {r['time']}: Close={r['close']:.2f}, Volume={r['volume']:,}")
