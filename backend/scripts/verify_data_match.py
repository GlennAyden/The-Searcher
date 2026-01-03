import asyncio
import sys
import os
import sqlite3
import pandas as pd
from datetime import datetime

# Add path to modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from modules.scraper_neobdm import NeoBDMScraper

async def verify_integrity_full():
    print("=== STARTING FULL SYSTEM VERIFICATION ===")
    
    methods = ['m', 'nr', 'f']
    periods = ['c', 'd']
    
    scraper = NeoBDMScraper()
    await scraper.init_browser(headless=True)
    if not await scraper.login():
        print("Login failed. Aborting.")
        await scraper.close()
        return

    conn = sqlite3.connect('backend/data/market_sentinel.db')
    cursor = conn.cursor()

    try:
        for method in methods:
            for period in periods:
                print(f"\n[>>>] Verifying: Method='{method}' / Period='{period}'")
                
                # 1. Fetch Live
                df_live, ref_date = await scraper.get_market_summary(method, period)
                if df_live is None:
                    print(f" [!] Failed to scrape live data.")
                    continue
                
                count_live = len(df_live)
                
                # 2. Fetch DB
                # Verify date matches
                query = "SELECT symbol, unusual, ma50 FROM neobdm_records WHERE method=? AND period=? AND scraped_at LIKE ? ORDER BY id ASC"
                cursor.execute(query, (method, period, f"{ref_date}%"))
                db_rows = cursor.fetchall()
                count_db = len(db_rows)
                
                print(f"     Date: {ref_date}")
                print(f"     Rows: Live={count_live} vs DB={count_db}")
                
                if count_db == 0:
                     print(f" [!] WARNING: No DB records found for {method}/{period} with date like '{ref_date}%'.")
                     # Check if we have ANY data for this method/period
                     cursor.execute("SELECT DISTINCT scraped_at FROM neobdm_records WHERE method=? AND period=? ORDER BY scraped_at DESC LIMIT 1", (method, period))
                     params = cursor.fetchone()
                     if params:
                         fallback_date = params[0]
                         print(f"     [+] Retrying with latest DB date: {fallback_date}")
                         cursor.execute("SELECT symbol, unusual, ma50 FROM neobdm_records WHERE method=? AND period=? AND scraped_at=? ORDER BY id ASC", (method, period, fallback_date))
                         db_rows = cursor.fetchall()
                         count_db = len(db_rows)
                         print(f"     Rows (Fallback): Live={count_live} vs DB={count_db}")
                     else:
                        print("     [X] No data at all in DB.")
                        continue

                if count_live != count_db:
                    print(f" [X] COUNT MISMATCH! Expected {count_live}, got {count_db}")
                    match_ok = False
                else:
                     print(f" [v] Count OK.")
                
                # 3. Compare Content (Top 3)
                print("     Checking Top 3 Rows (Symbol | Unusual | MA50)...")
                match_ok = True
                for i in range(min(3, count_live)):
                     # Live row
                     row_l = df_live.iloc[i]
                     # DB row (tuple: symbol, unusual, ma50)
                     row_d = db_rows[i]
                     
                     sym_l = str(row_l.get('symbol', '')).strip()
                     unu_l = str(row_l.get('unusual', '')).strip()
                     ma_l  = str(row_l.get('>ma50', '')).strip()
                     
                     sym_d = str(row_d[0] or '').strip()
                     unu_d = str(row_d[1] or '').strip()
                     ma_d  = str(row_d[2] or '').strip()
                     
                     # Normalize check
                     # MA might be 'v' in Live and 'v' in DB.
                     # unusual might be 'v' or 'x'.
                     
                     if sym_l != sym_d or unu_l != unu_d or ma_l != ma_d:
                         print(f"     [!] MISMATCH at Row {i+1}:")
                         print(f"         Live: {sym_l} | {unu_l} | {ma_l}")
                         print(f"         DB  : {sym_d} | {unu_d} | {ma_d}")
                         match_ok = False
                
                if match_ok:
                    print(" [v] Content (Top 3) MATCHED perfectly.")

    finally:
        await scraper.close()
        conn.close()
        print("\n=== VERIFICATION COMPLETE ===")

if __name__ == "__main__":
    asyncio.run(verify_integrity_full())
