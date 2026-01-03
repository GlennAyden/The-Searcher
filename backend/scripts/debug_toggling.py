import asyncio
import sys
import os
from playwright.async_api import async_playwright
from dotenv import load_dotenv

load_dotenv()

async def debug_toggling():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False) # Headless=False to see it
        page = await browser.new_page()
        
        email = os.getenv("NEOBDM_EMAIL")
        password = os.getenv("NEOBDM_PASSWORD")
        
        # Login
        print("Logging in...")
        await page.goto("https://neobdm.tech/accounts/login/")
        await page.fill('#id_login', email)
        await page.fill('#id_password', password)
        await page.click('.primaryAction.btn.btn-primary')
        await page.wait_for_url("**/home/", timeout=15000)
        
        print("Navigating to Market Summary...")
        await page.goto("https://neobdm.tech/market_summary/")
        await page.wait_for_selector('input[type="checkbox"]', timeout=15000)
        
        # Helper to print checkbox states
        async def print_states(label):
            print(f"--- {label} ---")
            inputs = await page.evaluate("""() => {
                return Array.from(document.querySelectorAll('input[type="checkbox"]')).map(el => {
                    return `Val: ${el.value} | Checked: ${el.checked} | ParentText: ${el.parentElement ? el.parentElement.innerText.trim() : ''}`
                })
            }""")
            for idx, i in enumerate(inputs):
                print(f"[{idx}] {i}")

        await print_states("Initial State")
        
        # ATTEMPT TOGGLING LOGIC
        print("\nAttempting Logic...")
        
        # 1. Normalize (OFF)
        norm_cb = page.locator('input[value="normalize"]')
        if await norm_cb.count() > 0:
            if await norm_cb.is_checked():
                await norm_cb.uncheck()
                print("Action: Unchecked Normalize")
        else:
            print("ERROR: Normalize input not found by value.")

        # 2. Moving Average (ON)
        # Try generic text search if specific value unknown
        # The user image shows "Moving Average" text.
        # Let's try locating by text deeply
        ma_label = page.locator("label", has_text="Moving Average")
        if await ma_label.count() > 0:
            print("Found 'Moving Average' label.")
            # Find input relative to label (either inside or sibling)
            # Inspect parent
            ma_cb = ma_label.locator("xpath=preceding-sibling::input | descendant::input | ..//input").first
            if await ma_cb.count() > 0:
                 if not await ma_cb.is_checked():
                     await ma_cb.check()
                     print("Action: Checked Moving Average")
                 else:
                     print("Info: Moving Average already checked")
            else:
                 print("ERROR: Input for MA label not found")
        else:
            print("ERROR: 'Moving Average' label not found")

        await asyncio.sleep(2)
        await print_states("Final State")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_toggling())
