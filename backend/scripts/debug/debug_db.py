import sqlite3
import os

db_path = "data/market_sentinel.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- DB INSPECTION ---")
cursor.execute("SELECT id, ticker, time, action, trade_number FROM rt_raw_history WHERE ticker='TINS' LIMIT 20")
rows = cursor.fetchall()
for r in rows:
    print(r)

cursor.execute("SELECT COUNT(*) FROM rt_raw_history WHERE ticker='TINS'")
print(f"Total TINS: {cursor.fetchone()[0]}")

cursor.execute("SELECT COUNT(DISTINCT id) FROM rt_raw_history WHERE ticker='TINS'")
print(f"Distinct IDs: {cursor.fetchone()[0]}")

cursor.execute("SELECT id, COUNT(*) as c FROM rt_raw_history GROUP BY id HAVING c > 1 LIMIT 5")
dupes = cursor.fetchall()
print(f"Duplicates found: {dupes}")

conn.close()
