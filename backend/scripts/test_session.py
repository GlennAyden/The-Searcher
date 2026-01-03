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

async def test_session():
    if not os.path.exists(STORAGE_STATE):
        log.error(f"[!] {STORAGE_STATE} not found. Please run interactive verification first.")
        return

    async with async_playwright() as p:
        log.info(f"[*] Launching Headless Browser to test session: {STORAGE_STATE}")
        browser = await p.chromium.launch(headless=True)
        
        # Load the session
        context = await browser.new_context(storage_state=STORAGE_STATE)
        page = await context.new_page()

        log.info("[*] Navigating to Stockbit Dashboard...")
        await page.goto("https://stockbit.com/dashboard", wait_until="load")

        # Check for dashboard indicators
        try:
            # Look for common dashboard elements: search bar, profile icon, etc.
            dashboard = await page.wait_for_selector('input[placeholder*="Search"], .sb-header-profile, a[href="/stream"]', timeout=30000)
            if dashboard:
                log.info("[bold green][+] SESSION VERIFIED: Successfully accessed dashboard without login.[/bold green]")
                
                # Double check user info
                user_info = await page.evaluate("() => localStorage.getItem('au')")
                if user_info:
                    log.info("[+] Session belongs to an authenticated user.")
                
                await page.screenshot(path="session_verification_success.png")
                log.info("[*] Screenshot saved as session_verification_success.png")
            else:
                log.error("[-] Session verification failed: Dashboard indicators not found.")
        except Exception as e:
            log.error(f"[-] Session verification failed or timed out: {e}")
            await page.screenshot(path="session_verification_error.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_session())
