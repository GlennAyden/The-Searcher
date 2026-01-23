"""Test yfinance data availability"""
import yfinance as yf
from datetime import datetime, timedelta

# Test tickers
tickers_to_test = ['BBCA', 'TINS', 'DEWA', 'AADI']

today = datetime.now()
start = today - timedelta(days=15)

print(f"Testing yfinance data from {start.strftime('%Y-%m-%d')} to {today.strftime('%Y-%m-%d')}")
print("=" * 60)

for ticker in tickers_to_test:
    yf_ticker = f"{ticker}.JK"
    print(f"\n{ticker} ({yf_ticker}):")
    try:
        stock = yf.Ticker(yf_ticker)
        df = stock.history(start=start.strftime('%Y-%m-%d'), end=today.strftime('%Y-%m-%d'))
        
        if df.empty:
            print("  No data returned!")
        else:
            print(f"  Records: {len(df)}")
            print(f"  Date range: {df.index[0].strftime('%Y-%m-%d')} to {df.index[-1].strftime('%Y-%m-%d')}")
            print(f"  Latest close: {df['Close'].iloc[-1]:.2f}")
            print(f"  Latest volume: {df['Volume'].iloc[-1]:,}")
    except Exception as e:
        print(f"  Error: {e}")

print("\n" + "=" * 60)
print("Done!")
