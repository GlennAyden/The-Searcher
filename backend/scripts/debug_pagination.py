
import asyncio
import os
from playwright.async_api import async_playwright
from dotenv import load_dotenv

load_dotenv()

async def debug_pagination():
    p = await async_playwright().start()
    b = await p.chromium.launch(headless=True)
    c = await b.new_context()
    page = await c.new_page()
    
    email = os.getenv("NEOBDM_EMAIL")
    pw = os.getenv("NEOBDM_PASSWORD")
    
    await page.goto("https://neobdm.tech/accounts/login/")
    await page.fill('#id_login', email)
    await page.fill('#id_password', pw)
    await page.click('.primaryAction.btn.btn-primary')
    await page.wait_for_url("https://neobdm.tech/home/")
    
    await page.goto("https://neobdm.tech/market_summary/")
    await page.wait_for_selector('.dash-cell')
    await asyncio.sleep(5)
    
    pagination_html = await page.evaluate("""() => {
        const container = document.querySelector('.previous-next-container');
        return container ? container.outerHTML : 'Not found';
    }""")
    
    print("Pagination HTML:")
    print(pagination_html)
    
    total_pages = await page.evaluate("""() => {
        const lp = document.querySelector('.page-number .last-page');
        return lp ? lp.innerText : 'Not found';
    }""")
    print(f"Total pages selector result: {total_pages}")
    
    await b.close()
    await p.stop()

if __name__ == "__main__":
    asyncio.run(debug_pagination())
