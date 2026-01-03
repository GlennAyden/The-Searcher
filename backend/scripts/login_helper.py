
import asyncio
from playwright.async_api import async_playwright
import os

STORAGE_PATH = "../stockbit_storage.json"

async def main():
    print("--- Stockbit Login Helper ---")
    print("Launching browser...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Go to login
        print("Navigating to Login Page...")
        await page.goto("https://stockbit.com/login", wait_until="domcontentloaded")
        
        print("\n" + "="*50)
        print("ACTION REQUIRED: Please login manually in the browser window.")
        print("Once you see the Dashboard/Chart, return here.")
        print("="*50 + "\n")
        
        # Sniffer to confirm we have a token
        token_found = False
        
        async def handle_request(request):
            nonlocal token_found
            if "exodus.stockbit.com" in request.url and "order-trade" in request.url:
                h = request.headers
                if 'authorization' in h:
                    print(f"[*] Valid Token Detected! ({h['authorization'][:15]}...)")
                    token_found = True

        page.on("request", handle_request)
        
        print("Waiting for valid traffic (open a chart or running trade)...")
        
        # Wait loop
        while not token_found:
            await asyncio.sleep(1)
            
        print("\n[*] Token captured. Saving session...")
        
        # Save
        await context.storage_state(path=STORAGE_PATH)
        print(f"[+++] Session Saved to {os.path.abspath(STORAGE_PATH)}")
        print("You can close the browser now.")
        
        await asyncio.sleep(5) # Give time to read
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
