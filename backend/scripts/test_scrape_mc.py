
import asyncio
import sys
import os
sys.path.append('backend')
from modules.scraper_neobdm import NeoBDMScraper

async def run():
    s = NeoBDMScraper()
    try:
        await s.init_browser()
        await s.login()
        df, dt = await s.get_market_summary('m', 'c')
        if df is not None:
            print(f"COMPLETE: {len(df)} rows found.")
        else:
            print("COMPLETE: No data found.")
    finally:
        await s.close()

if __name__ == "__main__":
    asyncio.run(run())
