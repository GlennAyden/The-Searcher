import sqlite3
import pandas as pd
import os

db_path = "data/market_sentinel.db"
if not os.path.exists(db_path):
    if os.path.exists("../data/market_sentinel.db"):
        db_path = "../data/market_sentinel.db"

conn = sqlite3.connect(db_path)
ticker = "TINS"
date = "2025-12-29"

df = pd.read_sql("SELECT * FROM rt_raw_history WHERE ticker=? AND scrape_date=?", conn, params=(ticker, date))

# Calculate stats
# My UI logic for codes:
def parse_code(raw):
    if not raw or raw == '-': return '-'
    if '[' in raw:
        return raw.split(']')[1].strip() if ']' in raw else raw
    return raw

# Actually, let's just use raw matching for now to see if the data is there
print("Total rows:", len(df))

# Buyers
buy_stats = df.groupby('buyer')['lot'].sum().sort_values(ascending=False).head(10)
print("\nTop Buyers (Raw):")
print(buy_stats)

# Sellers
sell_stats = df.groupby('seller')['lot'].sum().sort_values(ascending=False).head(10)
print("\nTop Sellers (Raw):")
print(sell_stats)

conn.close()
