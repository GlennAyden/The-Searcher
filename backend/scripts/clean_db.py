import sqlite3
import os

db_path = "data/market_sentinel.db"

if __name__ == "__main__":
    if not os.path.exists(db_path):
        print(f"DB not found at {db_path}")
    else:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        # Check count before
        cur.execute("SELECT COUNT(*) FROM rt_raw_history WHERE ticker='BUVA' AND scrape_date='2025-12-24'")
        print(f"Count Before: {cur.fetchone()[0]}")
        
        # Delete
        cur.execute("DELETE FROM rt_raw_history WHERE ticker='BUVA' AND scrape_date='2025-12-24'")
        conn.commit()
        
        # Check count after
        cur.execute("SELECT COUNT(*) FROM rt_raw_history WHERE ticker='BUVA' AND scrape_date='2025-12-24'")
        print(f"Count After: {cur.fetchone()[0]}")
        
        conn.close()
