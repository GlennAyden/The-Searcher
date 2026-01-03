import sqlite3
import os
from datetime import datetime, timedelta
import random

def seed_rt_history():
    db_path = os.path.join("data", "market_sentinel.db")
    if not os.path.exists(db_path):
        # Try absolute path from workspace root
        db_path = os.path.join(os.getcwd(), "backend", "data", "market_sentinel.db")
        if not os.path.exists(db_path):
            print(f"DB not found at {db_path}")
            return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Ensure table exists
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS rt_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT,
        interval_start DATETIME,
        interval_end DATETIME,
        buy_vol INTEGER,
        sell_vol INTEGER,
        net_vol INTEGER,
        avg_price REAL,
        status TEXT,
        big_order_count INTEGER,
        conclusion TEXT
    );
    """)
    
    tickers = ["BBCA", "PANI", "TINS"]
    now = datetime.now()
    
    # Clear old dummy data if needed
    # cursor.execute("DELETE FROM rt_snapshots")
    
    snapshots = []
    for ticker in tickers:
        for i in range(5): # 5 intervals = 75 mins
            end_time = now - timedelta(minutes=15 * i)
            start_time = end_time - timedelta(minutes=15)
            
            buy_vol = random.randint(1000, 5000)
            sell_vol = random.randint(1000, 5000)
            net_vol = buy_vol - sell_vol
            big_orders = random.randint(0, 5)
            
            status = "Bullish" if net_vol > 500 else "Bearish" if net_vol < -500 else "Neutral"
            conclusion = f"Detected {big_orders} big orders. "
            if status == "Bullish":
                conclusion += f"Strong accumulation with {net_vol} net lots."
            elif status == "Bearish":
                conclusion += f"Heavy distribution observed."
            else:
                conclusion += "Sideways Consolidation."
            
            snapshots.append((
                ticker, 
                start_time.strftime('%Y-%m-%d %H:%M:%S'),
                end_time.strftime('%Y-%m-%d %H:%M:%S'),
                buy_vol, sell_vol, net_vol,
                8000.0 + random.randint(-100, 100),
                status, big_orders, conclusion
            ))
            
    query = """
    INSERT INTO rt_snapshots (
        ticker, interval_start, interval_end, buy_vol, sell_vol, net_vol, 
        avg_price, status, big_order_count, conclusion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    cursor.executemany(query, snapshots)
    conn.commit()
    conn.close()
    print(f"Successfully seeded {len(snapshots)} snapshots.")

if __name__ == "__main__":
    seed_rt_history()
