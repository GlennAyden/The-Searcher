import sqlite3
import os

db_path = "data/market_sentinel.db"
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
else:
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT symbol FROM neobdm_records")
        rows = cursor.fetchall()
        print("Available Tickers:", [r[0] for r in rows])
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
