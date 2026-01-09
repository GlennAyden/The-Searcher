
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
        print("DEBUG: Navigating to Market Maker / Cumulative...")
        df, ref_date = await scraper.get_market_summary(method='m', period='c')
        
        if df is not None:
            print(f"DEBUG: Scrape finished. Total rows: {len(df)}")
            print("DEBUG: Head of data:")
            print(df.head())
        else:
            print("DEBUG: No data returned.")
            
    finally:
        await scraper.close()

if __name__ == "__main__":
    asyncio.run(debug_cumulative())
