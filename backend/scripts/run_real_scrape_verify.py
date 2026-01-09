import sys
import os
import asyncio
import pandas as pd
from datetime import datetime

# Setup path to import backend modules
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from modules.scraper_neobdm import NeoBDMScraper
from modules.database import DatabaseManager

# Fix for Windows Event Loop with Playwright
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

async def run_scrape_and_verify():
    print("Starting Manual Scrape and Verification...")
    
    scraper = NeoBDMScraper()
    db_manager = DatabaseManager()
    
    # 1. Scrape One specific method/period (Market Maker / Daily)
    method_code = 'm'
    period_code = 'd'
    
    print(f"[*] Initializing scraper...")
    await scraper.init_browser(headless=True)
    
    if await scraper.login():
        print(f"[*] Login successful. Scraping {method_code}/{period_code}...")
        df, ref_date = await scraper.get_market_summary(method=method_code, period=period_code)
        
        if df is not None and not df.empty:
            print(f"[*] Scraped {len(df)} rows.")
            print(f"[*] Reference Date reported by site: {ref_date}")
            
            # Use ref_date as scraped_at if available, else now
            scraped_at = ref_date if ref_date else datetime.now().strftime('%Y-%m-%d')
            print(f"[*] Using scraped_at: {scraped_at}")
            
            # 2. CLEANUP old data for this specific date/method/period to ensure clean verification
            print("[*] Cleaning up old dictionary entries for this date...")
            conn = db_manager._get_conn()
            # Use simplified cleanup logic matching route
            conn.execute(
                "DELETE FROM neobdm_records WHERE method=? AND period=? AND scraped_at = ?", 
                (method_code, period_code, scraped_at)
            )
            conn.commit()
            conn.close()
            
            # 3. SAVE
            print("[*] Saving to database...")
            data_list = df.to_dict(orient="records")
            db_manager.save_neobdm_record_batch(method_code, period_code, data_list, scraped_at=scraped_at)
            print("[*] Save completed.")
            
            # 4. VERIFY
            print("[*] Verifying data in database...")
            # We fetch exactly what we saved
            df_db = db_manager.get_neobdm_summaries(
                method=method_code, 
                period=period_code, 
                start_date=scraped_at, 
                end_date=scraped_at
            )
            
            print(f"[*] Retrieved DF with shape {df_db.shape} from DB for {scraped_at}.")
            
            if df_db.empty:
                 print("FAILURE: No data retrieved from DB.")
            else:
                # Handle legacy wrapper format
                if 'data_json' in df_db.columns:
                    import json
                    try:
                        saved_list = json.loads(df_db.iloc[0]['data_json'])
                        saved_count = len(saved_list)
                        print(f"[*] Decoded {saved_count} records from data_json.")
                        
                        if saved_count == len(df):
                            print("SUCCESS: Database record count matches scraped count.")
                            print("First 3 records from DB:")
                            # Show first 3 items from decoded list
                            for i in range(min(3, saved_count)):
                                print(f" - {saved_list[i].get('symbol', 'N/A')}: Value={saved_list[i].get('value', 'N/A')}")
                        else:
                            print(f"FAILURE: Data count mismatch! Scraped: {len(df)}, Saved: {saved_count}")
                    except Exception as e:
                         print(f"FAILURE: Could not parse data_json: {e}")
                else:
                    # Individual rows format (if repo behavior changes)
                    if len(df_db) == len(df):
                        print("SUCCESS: Database record count matches scraped count (rows).")
                    else:
                        print(f"FAILURE: Row count mismatch! Scraped: {len(df)}, DB: {len(df_db)}")
                
        else:
            print("[!] No data scraped.")
    else:
        print("[!] Login failed.")
        
    await scraper.close()
    print("[*] Done.")

if __name__ == "__main__":
    asyncio.run(run_scrape_and_verify())
