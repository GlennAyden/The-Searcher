import asyncio
import json
import os
import logging
from playwright.async_api import async_playwright
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("StockbitScraper")

class StockbitScraper:
    def __init__(self, storage_state_path="stockbit_storage.json", ticker="BBCA"):
        self.storage_state_path = storage_state_path
        self.ticker = ticker.upper()
        self.base_url = "https://stockbit.com"
        self.browser = None
        self.context = None
        self.page = None
        self.is_running = False
        self.on_trade_callback = None

    async def start(self, headless=True):
        """Initializes the browser and starts monitoring."""
        if not os.path.exists(self.storage_state_path):
            logger.error(f"Storage state file {self.storage_state_path} not found.")
            return False

        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=headless)
        self.context = await self.browser.new_context(storage_state=self.storage_state_path)
        self.page = await self.context.new_page()

        logger.info(f"Navigating to {self.ticker} symbol page...")
        await self.page.goto(f"{self.base_url}/symbol/{self.ticker}", wait_until="load")

        # Setup WebSocket interception
        self.page.on("websocket", self._handle_websocket)
        
        self.is_running = True
        logger.info(f"Monitoring started for {self.ticker}")
        return True

    def set_on_trade_callback(self, callback):
        """Sets a callback function to be called when new trade data is filtered."""
        self.on_trade_callback = callback

    async def _handle_websocket(self, ws):
        logger.info(f"WebSocket connection detected: {ws.url}")
        
        @ws.on("framereceived")
        def on_frame(payload):
            try:
                content = payload.decode() if isinstance(payload, bytes) else payload
                
                # Stockbit WebSocket packets usually have a specific structure.
                # Many real-time apps use prefixes like 42[...], 42/v1,[...]
                if "{" in content:
                    start = content.find("{")
                    end = content.rfind("}") + 1
                    json_str = content[start:end]
                    data = json.loads(json_str)
                    
                    # Pattern matching for trade data
                    # Actual Stockbit WS structure often looks like: ["trade", {...}] or similar
                    # We'll normalize it and look for price/quantity/time
                    self._process_data(data)
            except Exception as e:
                # Silently fail for non-JSON or malformed packets
                pass

    def _process_data(self, data):
        """Filters and processes incoming JSON data for trade information."""
        # Note: This heuristic needs to be refined once we see the actual packet structure
        # Common keys in Stockbit WS for trades might include 'last', 'price', 'quantity', 'trade'
        # To make it robust, we'll look for numeric price/vol pairs in identified 'trade' objects
        
        trades = []
        
        # Scenario 1: Direct trade object
        if isinstance(data, dict):
            # Check for keys that indicate a trade (e.g., price, volume, side)
            if all(k in data for k in ['price', 'volume', 'type']):
                 trades.append(self._normalize_trade(data))
            # Scenario 2: Nested in a list (e.g., Socket.io event name + data)
            elif 'data' in data and isinstance(data['data'], (dict, list)):
                 # Recurse or handle
                 pass
        
        # Emit to callback if exists
        if trades and self.on_trade_callback:
            for t in trades:
                self.on_trade_callback(t)

    def _normalize_trade(self, raw):
        """Convert raw Stockbit data to our standard format."""
        return {
            "time": datetime.now().strftime("%H:%M:%S"),
            "ticker": self.ticker,
            "price": raw.get("price"),
            "lot": int(raw.get("volume", 0) / 100) if raw.get("volume") else 0,
            "value": raw.get("value"),
            "type": raw.get("type"), # 'B' for Buy (Haka), 'S' for Sell (Haki)
            "raw": raw
        }

    async def stop(self):
        self.is_running = False
        if self.browser:
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()
        logger.info("Monitoring stopped.")

# Quick test script if run as main
if __name__ == "__main__":
    async def test():
        scraper = StockbitScraper(ticker="BBCA")
        if await scraper.start(headless=True):
            def log_trade(trade):
                print(f"[{trade['time']}] {trade['ticker']} | {trade['price']} | {trade['lot']} Lot | {trade['type']}")
                
            scraper.set_on_trade_callback(log_trade)
            
            # Keep running for 60 seconds
            print("Listening for trades for 60 seconds...")
            await asyncio.sleep(60)
            await scraper.stop()
            
    asyncio.run(test())
