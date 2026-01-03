
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta

def test_yf():
    ticker = "^JKSE"
    end_dt = datetime.now()
    start_dt = end_dt - timedelta(days=5)
    
    print(f"Fetching {ticker} from {start_dt} to {end_dt}")
    df = yf.download(ticker, start=start_dt, end=end_dt, auto_adjust=True, progress=False)
    
    if df.empty:
        print("Empty DF")
        return
        
    print("DataFrame Head (first 2 rows):")
    print(df.head(2))
    print("\nDataFrame Tail (last 2 rows):")
    print(df.tail(2))
    
    print("\nIndex order:")
    for idx in df.index:
        print(idx)

if __name__ == "__main__":
    test_yf()
