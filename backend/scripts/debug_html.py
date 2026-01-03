import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from modules.scraper_neobdm import NeoBDMScraper

async def debug_html():
    scraper = NeoBDMScraper()
    await scraper.init_browser(headless=True)
    await scraper.login()
    print("Navigating to Market Summary...")
    await scraper.page.goto('https://neobdm.tech/market_summary/')
    await asyncio.sleep(5)
    
    print("Selecting method/period...")
    # Select Method: Market Maker
    await scraper.page.select_option('#method', 'm')
    await scraper.page.evaluate("document.querySelector('#method').dispatchEvent(new Event('change', { bubbles: true }))")
    
    # Select Period: Daily
    await scraper.page.select_option('#summary-mode', 'd')
    await scraper.page.evaluate("document.querySelector('#summary-mode').dispatchEvent(new Event('change', { bubbles: true }))")
    
    # Wait for table
    print("Waiting for table...")
    try:
        await scraper.page.wait_for_selector('.dash-header', timeout=15000)
        await asyncio.sleep(2)
    except:
        print("Timeout waiting for headers")
    
    columns = await scraper.page.evaluate("""
        () => {
            return Array.from(document.querySelectorAll('.dash-header')).map(th => ({
                id: th.getAttribute('data-dash-column'),
                text: th.innerText.trim()
            }));
        }
    """)
    print("\n[DEBUG] Found Columns:")
    for col in columns:
        print(f"ID: {col['id']} | Text: {col['text']}")
    await scraper.close()

if __name__ == "__main__":
    asyncio.run(debug_html())
