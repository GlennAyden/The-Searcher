import asyncio
import os
from playwright.async_api import async_playwright
from rich.console import Console
from rich.logging import RichHandler
import logging

# Setup logging
logging.basicConfig(
    level="INFO",
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(rich_tracebacks=True)]
)
log = logging.getLogger("rich")
console = Console()

STORAGE_STATE = "stockbit_storage.json"

async def verify_profile():
    if not os.path.exists(STORAGE_STATE):
        log.error(f"[!] {STORAGE_STATE} not found.")
        return

    async with async_playwright() as p:
        log.info(f"[*] Launching Headless Browser to verify profile...")
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=STORAGE_STATE)
        page = await context.new_page()

        log.info("[*] Navigating to Stockbit User Profile (@glennayden)...")
        # Direct profile URL
        await page.goto("https://stockbit.com/glennayden", wait_until="networkidle")

        try:
            # Wait for some profile unique element
            await page.wait_for_selector('input[name="fullname"], .sb-settings-content', timeout=20000)
            log.info("[bold green][+] Profile page accessed successfully![/bold green]")
            
            await page.screenshot(path="profile_verification_success.png", full_page=True)
            log.info("[*] Screenshot saved as profile_verification_success.png")
            
            # Print current URL to be sure
            log.info(f"[*] Final URL: {page.url}")
        except Exception as e:
            log.error(f"[-] Profile access failed: {e}")
            await page.screenshot(path="profile_verification_error.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_profile())
