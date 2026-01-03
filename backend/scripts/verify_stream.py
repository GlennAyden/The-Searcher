import os
import asyncio
import json
from playwright.async_api import async_playwright
from dotenv import load_dotenv
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

load_dotenv()

STORAGE_STATE = "stockbit_storage.json"

class StockbitVerifier:
    def __init__(self):
        self.email = os.getenv("STOCKBIT_EMAIL")
        self.password = os.getenv("STOCKBIT_PASSWORD")
        if not self.email or not self.password:
            log.error("[!] STOCKBIT_EMAIL or STOCKBIT_PASSWORD not found in .env")
            exit(1)
        
        self.base_url = "https://stockbit.com"
        self.browser = None
        self.context = None
        self.page = None
        self.data_count = 0
        self.target_data = []

    async def init(self, headless=False):
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=headless)
        
        # Load existing session if available
        if os.path.exists(STORAGE_STATE):
            log.info(f"[*] Loading existing session from {STORAGE_STATE}")
            self.context = await self.browser.new_context(storage_state=STORAGE_STATE)
        else:
            log.info("[*] No existing session found. Creating new context.")
            self.context = await self.browser.new_context()
            
        self.page = await self.context.new_page()

    async def login(self):
        log.info("[*] Navigating to Stockbit Login...")
        try:
            await self.page.goto(f"{self.base_url}/login", wait_until="load", timeout=60000)
        except Exception as e:
            log.error(f"[-] Navigation failed: {e}")
            return False
        
        # Give it a moment to settle
        await asyncio.sleep(2)

        # Check if already logged in
        try:
            await self.page.wait_for_selector('input[placeholder*="Search"], .sb-header-profile', timeout=10000)
            log.info("[+] Already logged in via session.")
            return True
        except:
            log.info("[*] Need to login...")

        # Predictable input prompts
        print("PROMPT:ENTER_EMAIL")
        self.email = input("Email/Username: ")
        print("PROMPT:ENTER_PASSWORD")
        self.password = input("Password: ")

        # Fill credentials using direct selectors to be sure
        try:
            log.info("[*] Filling username...")
            # Try to find any input that looks like username/email
            await self.page.wait_for_selector('input[name="username"], input[name="email"], input[placeholder*="Email"]', timeout=20000)
            await self.page.fill('input[name="username"], input[name="email"], input[placeholder*="Email"]', self.email)
            
            log.info("[*] Filling password...")
            await self.page.fill('input[name="password"], input#password', self.password)
            
            log.info("[*] Clicking login...")
            await self.page.click('button:has-text("Login"), button[type="submit"], #loginbutton', timeout=10000)
        except Exception as e:
            log.error(f"[-] Fill/Click failed: {e}")
            await self.page.screenshot(path="login_error_during_fill.png")
            return False

        # Check for 2FA
        log.info("[*] Checking for 2FA...")
        try:
            # Wait a bit for 2FA screen to appear
            await asyncio.sleep(3)
            otp_selectors = [
                'input[placeholder*="Code"]',
                'input[name*="otp"]',
                'input[name*="verification"]',
                'input[placeholder="Verification Code"]'
            ]
            
            for sel in otp_selectors:
                if await self.page.query_selector(sel):
                    log.warning("[!] 2FA Required!")
                    print("PROMPT:ENTER_2FA")
                    code = input("Enter 2FA Code: ")
                    await self.page.fill(sel, code)
                    await self.page.press(sel, "Enter")
                    break
        except Exception as e:
            log.debug(f"2FA check error (possibly none): {e}")

        # Wait for dashboard
        log.info("[*] Waiting for dashboard (up to 60s)...")
        try:
            await self.page.wait_for_selector('input[placeholder*="Search"], .sb-header-profile, a[href="/stream"]', timeout=60000)
            log.info("[+] Login Successful!")
            await self.context.storage_state(path=STORAGE_STATE)
            log.info(f"[*] Session saved to {STORAGE_STATE}")
            return True
        except Exception as e:
            log.error(f"[-] Login confirm failed: {e}")
            await self.page.screenshot(path="login_final_timeout.png")
            return False

    async def listen_running_trade(self, ticker="BBCA"):
        log.info(f"[*] Navigating to {ticker} stream...")
        # Navigate to a page that has the running trade widget
        # In Stockbit, usually /symbol/TICKER
        await self.page.goto(f"{self.base_url}/symbol/{ticker}")
        
        log.info("[*] Listening for network data...")

        # Setup request listener to intercept potential trade data
        async def handle_response(response):
            # Stockbit often uses WebSockets or internal APIs for real-time data
            # We look for common patterns in URL or content type
            if "runningtrade" in response.url.lower() or "stream" in response.url.lower():
                try:
                    if self.data_count < 10:
                        data = await response.json()
                        self.target_data.append(data)
                        self.data_count += 1
                        log.info(f"[v] Captured Packet {self.data_count}")
                except:
                    pass

        self.page.on("response", handle_response)

        # Wait for data or timeout
        count = 0
        while self.data_count < 10 and count < 60: # 60 seconds timeout
            await asyncio.sleep(1)
            count += 1
            if count % 10 == 0:
                log.info(f"[*] Still waiting for stream data... ({count}s)")

        if self.data_count > 0:
            console.print("\n[bold green]Captured Data Samples:[/bold green]")
            console.print_json(data=json.dumps(self.target_data[:10]))
        else:
            log.error("[-] No running trade data captured in 60 seconds.")

    async def close(self):
        if self.browser:
            await self.browser.close()

async def main():
    verifier = StockbitVerifier()
    try:
        await verifier.init(headless=False) # Headful to handle manual 2FA if needed
        if await verifier.login():
            # Example ticker, can be changed
            await verifier.listen_running_trade("BBCA")
    finally:
        await verifier.close()

if __name__ == "__main__":
    asyncio.run(main())
