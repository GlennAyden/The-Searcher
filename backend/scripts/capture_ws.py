import asyncio
import json
import os
from playwright.async_api import async_playwright
from rich.console import Console

console = Console()
STORAGE_STATE = "stockbit_storage.json"

async def capture_raw_ws(ticker="BBCA"):
    if not os.path.exists(STORAGE_STATE):
        print(f"Error: {STORAGE_STATE} not found.")
        return

    async with async_playwright() as p:
        print(f"[*] Launching Headless Browser to capture WS for {ticker}...")
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            storage_state=STORAGE_STATE,
            viewport={'width': 1920, 'height': 1080}
        )
        page = await context.new_page()
        
        CAPTURE_DURATION = 60
        frames = []

        async def handle_websocket(ws):
            print(f"[*] WS Opened: {ws.url}")
            
            def on_frame_received(payload):
                process_frame(payload, "IN")
            
            def on_frame_sent(payload):
                process_frame(payload, "OUT")

            def process_frame(payload, direction):
                try:
                    import gzip
                    # Try to decode as text first
                    if isinstance(payload, str):
                        content = payload
                    else:
                        # Binary payload: check if it's GZIP
                        try:
                            content = gzip.decompress(payload).decode('utf-8')
                        except:
                            # Not GZIP or decompression failed, try UTF-8 direct
                            try:
                                content = payload.decode('utf-8')
                            except:
                                # FULL HEX for binary
                                content = f"BINARY:{payload.hex()}"
                    
                    frames.append({"dir": direction, "data": content, "ts": asyncio.get_event_loop().time()})
                    if len(frames) % 50 == 0:
                        print(f"[*] Captured {len(frames)} frames...")
                except Exception as e:
                    print(f"Error processing frame: {e}")
            
            ws.on("framereceived", on_frame_received)
            ws.on("framesent", on_frame_sent)

        # Log all network requests
        request_log = []
        async def handle_request(request):
            request_log.append(f"{request.method} {request.url}")

        page.on("request", handle_request)
        
        async def handle_response(response):
            # Also catch REST API responses that might contain trade data
            if "runningtrade" in response.url.lower() or "price" in response.url.lower() or "trade" in response.url.lower():
                try:
                    data = await response.json()
                    frames.append({"dir": "API", "url": response.url, "data": data})
                except:
                    pass

        page.on("websocket", handle_websocket)
        page.on("response", handle_response)

        # Navigate to the specific symbol page
        print(f"[*] Navigating to {ticker} page...")
        await page.goto(f"https://stockbit.com/symbol/{ticker}", wait_until="networkidle")
        await asyncio.sleep(5)

        # Look for the Running Trade button in the right sidebar
        # It's usually a clock icon.
        try:
            try:
                print("[*] Attempting to click Running Trade button...")
                
                # Use JS to find the button with the clock icon or specific title
                await page.evaluate("""
                    () => {
                        const selectors = [
                            'button[title*="Running Trade"]',
                            'div[title*="Running Trade"]',
                            'a[title*="Running Trade"]',
                            '.sb-sidebar-right div[role="button"]:nth-child(3)',
                            'aside div[role="button"]:nth-child(3)'
                        ];
                        
                        for (const s of selectors) {
                            const el = document.querySelector(s);
                            if (el) {
                                el.click();
                                console.log("Clicked using selector: " + s);
                                return true;
                            }
                        }
                        return false;
                    }
                """)
                
                await asyncio.sleep(5)
                await page.screenshot(path="capture_running_trade_verify.png")
                print("[*] Screenshot saved as capture_running_trade_verify.png")

            except Exception as e:
                print(f"[!] Error clicking sidebar: {e}")

            # Listen for CAPTURE_DURATION seconds
            print(f"[*] Listening for {CAPTURE_DURATION} seconds...")
            await asyncio.sleep(CAPTURE_DURATION)

        finally:
            # Save to file
            with open("raw_ws_dump.json", "w") as f:
                json.dump(frames, f, indent=2)
                
            with open("network_log.txt", "w") as f:
                f.write("\n".join(request_log))
            
            print(f"[+] Captured {len(frames)} frames. Saved to raw_ws_dump.json")
            print(f"[+] Captured {len(request_log)} requests. Saved to network_log.txt")
            await browser.close()

if __name__ == "__main__":
    import sys
    ticker = sys.argv[1] if len(sys.argv) > 1 else "BBCA"
    asyncio.run(capture_raw_ws(ticker))
