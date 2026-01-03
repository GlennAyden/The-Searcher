import asyncio
import json
import os
from playwright.async_api import async_playwright
from rich.console import Console
from rich.logging import RichHandler
import logging

# Setup high-fidelity logging
logging.basicConfig(
    level="INFO",
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(rich_tracebacks=True)]
)
log = logging.getLogger("rich")
console = Console()

STORAGE_STATE = "stockbit_storage.json"

class StockbitInteractive:
    def __init__(self):
        self.base_url = "https://stockbit.com"
        self.data_count = 0
        self.captured_trades = []

    async def run(self):
        async with async_playwright() as p:
            log.info("[bold cyan][*] Launching Browser (Headful Mode)...[/bold cyan]")
            browser = await p.chromium.launch(headless=False)
            
            # Load existing session if available to speed up
            if os.path.exists(STORAGE_STATE):
                log.info(f"[*] Loading existing session from {STORAGE_STATE}")
                context = await browser.new_context(storage_state=STORAGE_STATE)
            else:
                context = await browser.new_context()

            page = await context.new_page()

            log.info("[*] Navigating to Stockbit Login...")
            await page.goto(f"{self.base_url}/login")

            log.info("[bold yellow][!] WAITING FOR MANUAL LOGIN...[/bold yellow]")
            log.info("[*] Please enter your credentials and 2FA in the browser window.")
            
            # Wait for URL to change to dashboard or stream, which indicates success
            try:
                # We wait indefinitely for URL to match dashboard/stream
                await page.wait_for_url(lambda url: "stockbit.com/dashboard" in url or "stockbit.com/stream" in url or "stockbit.com/symbol/" in url, timeout=0)
                log.info("[bold green][+] Login Successful Detected![/bold green]")
            except Exception as e:
                log.error(f"[-] Wait for login failed: {e}")
                return

            # Save the session state immediately after successful login
            await context.storage_state(path=STORAGE_STATE)
            log.info(f"[*] Session captured and saved to {STORAGE_STATE}")

            # Optionally navigate to a specific symbol if not already there
            current_url = page.url
            if "/symbol/" not in current_url:
                ticker = "BBCA" # Default check
                log.info(f"[*] Navigating to {ticker} to capture running trades...")
                await page.goto(f"{self.base_url}/symbol/{ticker}")

            log.info("[bold cyan][*] Listening for WebSocket Traffic (Running Trades)...[/bold cyan]")

            # Define handler for WebSocket frames
            async def handle_websocket(ws):
                log.info(f"[*] WebSocket Opened: {ws.url}")
                
                @ws.on("framereceived")
                def on_frame(payload):
                    if self.data_count >= 10:
                        return

                    try:
                        # Payloads in WS can be binary or string
                        content = payload.decode() if isinstance(payload, bytes) else payload
                        
                        # Stockbit raw data often comes in a specific JSON or prefixed format
                        # We try to parse it as JSON to see if it contains trade data
                        if "{" in content:
                            # Try to find a JSON-like substring
                            start = content.find("{")
                            end = content.rfind("}") + 1
                            json_str = content[start:end]
                            data = json.loads(json_str)
                            
                            # Heuristic: Check for common trade keys
                            # Note: Actual keys depend on Stockbit's WS protocol (likely 'trade', 'p', 'v', 'a', etc.)
                            # We'll print anything that looks like structured data for now
                            if any(k in str(data).lower() for k in ['price', 'vol', 'trade', 'type', 'last']):
                                self.data_count += 1
                                self.captured_trades.append(data)
                                log.info(f"[bold green][v] Captured Packet {self.data_count}/10[/bold green]")
                                
                                # If we hit 10, we can stop
                                if self.data_count >= 10:
                                    log.info("[+] Target reached. Completing verification.")
                    except:
                        pass

            page.on("websocket", handle_websocket)

            # Keep alive and wait for data capture
            log.info("[*] Monitoring pulses... (Timeout in 120s)")
            wait_time = 0
            while self.data_count < 10 and wait_time < 120:
                await asyncio.sleep(1)
                wait_time += 1

            if self.data_count > 0:
                console.print("\n[bold green]Captured WebSocket Trade Packets (Sample):[/bold green]")
                console.print_json(data=json.dumps(self.captured_trades))
                log.info("[+] Verification SUCCESS.")
            else:
                log.error("[-] No valid trade packets captured via WebSocket.")

            log.info("[*] Closing browser...")
            await browser.close()

if __name__ == "__main__":
    verifier = StockbitInteractive()
    asyncio.run(verifier.run())
