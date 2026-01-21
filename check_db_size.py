import sqlite3
import os

# DATA_DIR is backend/data
db_path = 'backend/data/market_sentinel.db'
if not os.path.exists(db_path):
    # Try absolute path just in case
    db_path = os.path.join(os.getcwd(), 'backend', 'data', 'market_sentinel.db')
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        # Search for it
        for root, dirs, files in os.walk('.'):
            if 'market_sentinel.db' in files:
                db_path = os.path.join(root, 'market_sentinel.db')
                print(f"Found DB at {db_path}")
                break
        else:
            exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get table info
cursor.execute("PRAGMA table_info(done_detail_records)")
columns = cursor.fetchall()
print("Table Schema (done_detail_records):")
for col in columns:
    print(col)

# Get specific example: BRMS on 2026-01-20
ticker = 'BRMS'
date = '2026-01-20'
cursor.execute("SELECT COUNT(*) FROM done_detail_records WHERE ticker = ? AND trade_date = ?", (ticker, date))
count = cursor.fetchone()[0]
print(f"\nRecord count for {ticker} on {date}: {count}")

# Estimated size per row
# Based on schema: 
# id (int), ticker (text ~4), trade_date (text ~10), trade_time (text ~8), 
# board (text ~2), price (real ~8), qty (int ~4), buyer_type (text ~1), 
# buyer_code (text ~2), seller_code (text ~2), seller_type (text ~1), 
# created_at (text ~19)
# Total rough estimate: ~70-100 bytes per row in memory/json

estimated_row_size = 100 # bytes
total_size = count * estimated_row_size
print(f"Estimated raw data size: {total_size / (1024*1024):.2f} MB")

conn.close()
