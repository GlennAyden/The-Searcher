import sqlite3
import json
import os
import sys
from datetime import datetime

# Add the backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from modules.database import DatabaseManager

def generate_dummy_data():
    db_manager = DatabaseManager()
    conn = db_manager._get_conn()
    
    try:
        print("[*] Clearing neobdm_records and neobdm_summaries tables...")
        conn.execute("DELETE FROM neobdm_records")
        conn.execute("DELETE FROM neobdm_summaries")
        conn.commit()
        
        methods = ['m', 'nr', 'f']
        periods = ['c', 'd']
        
        tickers = ['BBRI', 'BBCA', 'BMRI', 'TLKM', 'ASII', 'GOTO', 'BBNI', 'ADRO', 'UNVR', 'AMRT']
        
        daily_cols = [
            'symbol', 'pinky', 'crossing', 'likuid',
            'w-4', 'w-3', 'w-2', 'w-1',
            'd-4', 'd-3', 'd-2', 'd-0',
            '%1d', 'price', '>ma5', '>ma10', '>ma20', '>ma50', '>ma100'
        ]
        
        cumulative_cols = [
            'symbol', 'pinky', 'crossing', 'likuid',
            'c-20', 'c-10', 'c-5', 'c-3',
            '%3d', '%5d', '%10d', '%20d',
            'price', '>ma5', '>ma10', '>ma20', '>ma50', '>ma100'
        ]
        
        for m in methods:
            for p in periods:
                print(f"[>] Generating data for method={m}, period={p}...")
                cols = daily_cols if p == 'd' else cumulative_cols
                
                rows = []
                for ticker in tickers:
                    row = {}
                    for col in cols:
                        if col == 'symbol':
                            row[col] = ticker
                        elif col in ['pinky', 'crossing', 'likuid', 'unusual']:
                            import random
                            row[col] = 'v' if random.random() > 0.7 else '-'
                        elif col.startswith('%') or col.endswith('d'):
                            import random
                            val = random.uniform(-5, 5)
                            row[col] = f"{val:+.2f}%"
                        elif col == 'price':
                            import random
                            row[col] = str(random.randint(100, 10000))
                        elif col.startswith('>ma'):
                            import random
                            row[col] = 'Bullish' if random.random() > 0.5 else 'Bearish'
                        else:
                            # w-* or d-* or c-*
                            import random
                            row[col] = str(random.randint(-1000, 1000))
                    rows.append(row)
                
                db_manager.save_neobdm_record_batch(m, p, rows)
                
        print("[+] Dummy data generation complete!")
        
    except Exception as e:
        print(f"[!] Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    generate_dummy_data()
