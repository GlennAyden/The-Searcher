import sqlite3
import os

db_path = "data/market_sentinel.db"
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
ticker = "BBCA"
date = "2025-12-24"

count = conn.execute("SELECT COUNT(*) FROM rt_raw_history WHERE ticker=? AND scrape_date=?", (ticker, date)).fetchone()[0]
min_max = conn.execute("SELECT MIN(time), MAX(time) FROM rt_raw_history WHERE ticker=? AND scrape_date=?", (ticker, date)).fetchone()

print(f"Total trades for {ticker} on {date}: {count}")
print(f"Time Range: {min_max[0]} to {min_max[1]}")
conn.close()
