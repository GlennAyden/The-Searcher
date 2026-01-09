
import sys
import os
import asyncio
import pandas as pd

# Setup path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from modules.scraper_neobdm import NeoBDMScraper

async def debug_cumulative():
    print("DEBUG: Starting Cumulative Scrape Investigation...")
    scraper = NeoBDMScraper()
    await scraper.init_browser(headless=True) # Run headless False to see? User cannot see, so headless=True + screenshots if needed.
    
    try:
        await scraper.login()
        
        # Go to Cumulative
        # df, ref_date = await scraper.get_market_summary(method='m', period='c')
        df = None
        
        # SKIP CUMULATIVE FOR NOW to debug Daily
        if False: # df is not None:
             with open("debug_output.txt", "w", encoding="utf-8") as f:
                # ...
                pass
                f.write(f"DEBUG: Cumulative Scrape finished. Total rows: {len(df)}\n")
                f.write(f"DEBUG: Columns found: {df.columns.tolist()}\n")
                
                # Check likely column names for Change
                change_col = next((c for c in df.columns if 'Change' in c or 'Chg' in c), None)
                code_col = next((c for c in df.columns if 'Code' in c or 'Ticker' in c or 'Symbol' in c), None)
                
                if change_col and code_col:
                    f.write(f"DEBUG: Sample data for {code_col} and {change_col}:\n")
                    f.write(df[[code_col, change_col]].head(20).to_string() + "\n")
                    
                    # Check how many are 0.00 or 0
                    zero_count = df[df[change_col].astype(str).str.contains(r'^0\.?0*$', regex=True)].shape[0]
                    f.write(f"DEBUG: Rows with 0.00 change: {zero_count} out of {len(df)}\n")
                else:
                    f.write("DEBUG: Could not identify Code/Change columns in Cumulative.\n")
                    f.write("DEBUG: Head of data:\n")
                    f.write(df.head().to_string() + "\n")
             
             
        # NOW SCRAPE DAILY
        print("DEBUG: Navigating to Market Maker / Daily...")
        df_d, ref_date_d = await scraper.get_market_summary(method='m', period='d')
        
        with open("debug_output.txt", "w", encoding="utf-8") as f:
            f.write("\n\n=== DAILY DATA ===\n")
            if df_d is not None:
                f.write(f"DEBUG: Daily Scrape finished. Total rows: {len(df_d)}\n")
                f.write(f"DEBUG: Columns found: {df_d.columns.tolist()}\n")
                
                change_col_d = next((c for c in df_d.columns if 'Change' in c or 'Chg' in c or '%1d' in c), None)
                code_col_d = next((c for c in df_d.columns if 'Code' in c or 'Ticker' in c or 'Symbol' in c), None)
                
                if change_col_d and code_col_d:
                    f.write(f"DEBUG: Sample data for {code_col_d} and {change_col_d}:\n")
                    f.write(df_d[[code_col_d, change_col_d]].head(20).to_string() + "\n")
                        # Check how many are 0.00 or 0
                    zero_count = df_d[df_d[change_col_d].astype(str).str.contains(r'^0\.?0*$', regex=True)].shape[0]
                    f.write(f"DEBUG: Rows with 0.00 change: {zero_count} out of {len(df_d)}\n")
                else:
                    f.write("DEBUG: Could not identify Code/Change columns in Daily.\n")
                    f.write("DEBUG: Head of data:\n")
                    f.write(df_d.head().to_string() + "\n")
            else:
                f.write("DEBUG: No Daily data returned.\n")

        print("DEBUG: Output written to debug_output.txt")
            
    finally:
        await scraper.close()

if __name__ == "__main__":
    asyncio.run(debug_cumulative())
