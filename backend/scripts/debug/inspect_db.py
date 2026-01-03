import sqlite3
import json
import os

def inspect():
    db_path = os.path.join('data', 'market_sentinel.db')
    if not os.path.exists(db_path):
        print(f"File not found: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('SELECT symbol, scraped_at, d_0, d_2, d_3, d_4, w_1 FROM neobdm_records WHERE method="m" AND period="d" LIMIT 10;')
    rows = cursor.fetchall()
    print("DAILY RECORDS (method='m', period='d'):")
    for row in rows:
        print(row)
    
    cursor.execute('SELECT symbol, scraped_at, c_3, c_5, c_10, c_20 FROM neobdm_records WHERE method="m" AND period="c" LIMIT 10;')
    rows = cursor.fetchall()
    print("\nCUMULATIVE RECORDS (method='m', period='c'):")
    for row in rows:
        print(row)
    conn.close()

if __name__ == "__main__":
    inspect()
