import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from modules.scraper_neobdm import NeoBDMScraper

async def debug_scrape():
    scraper = NeoBDMScraper()
    await scraper.init_browser(headless=True)
    await scraper.login()
    print("Scraping Cumulative...")
    df_c, _ = await scraper.get_market_summary(method='m', period='c')
    if df_c is not None and not df_c.empty:
        print("\n[DEBUG] Cumulative Keys:", list(df_c.iloc[0].to_dict().keys()))

    print("\nScraping Daily...")
    df_d, _ = await scraper.get_market_summary(method='m', period='d')
    await scraper.close()
    
    if df_d is not None and not df_d.empty:
        print("\n[DEBUG] Daily Keys:", list(df_d.iloc[0].to_dict().keys()))

if __name__ == "__main__":
    asyncio.run(debug_scrape())
