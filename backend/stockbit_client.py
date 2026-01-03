import json
import os
import logging
import asyncio
import random
from typing import Optional, Dict, List
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StockbitClient:
    def __init__(self, storage_path: str = "stockbit_storage.json", headless: bool = True):
        self.storage_path = storage_path
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.playwright = None
        self.auth_header = None
        self.lock = asyncio.Lock()

    async def initialize(self):
        """Initializes the browser session."""
        if self.page:
            return

        async with self.lock:
            if self.page: return
            
            logger.info("Initializing StockbitClient (Playwright Sniffer)...")
            self.playwright = await async_playwright().start()
            
            if not os.path.exists(self.storage_path):
                self.browser = await self.playwright.chromium.launch(headless=self.headless)
                self.context = await self.browser.new_context()
            else:
                self.browser = await self.playwright.chromium.launch(headless=self.headless)
                self.context = await self.browser.new_context(storage_state=self.storage_path)
            
            self.page = await self.context.new_page()
            
            # Setup Sniffer
            async def handle_request(request):
                if "exodus.stockbit.com" in request.url and "order-trade" in request.url:
                    h = request.headers
                    if 'authorization' in h:
                        new_token = h['authorization']
                        if new_token != self.auth_header:
                            self.auth_header = new_token
                            logger.info(f"Sniffed Auth Token (New/Updated): {self.auth_header[:20]}...")

            self.page.on("request", handle_request)
            
            try:
                # Navigate to trigger traffic
                await self.page.goto("https://stockbit.com/symbol/BBCA", wait_until="networkidle")
                # Wait for token
                for _ in range(10):
                    if self.auth_header: break
                    await asyncio.sleep(1)
                
                if not self.auth_header:
                    logger.warning("Failed to sniff token. API calls may fail.")

            except Exception as e:
                logger.error(f"Failed to navigate: {e}")

    async def get_running_trade(self, symbols: Optional[List[str]] = None, date: Optional[str] = None, max_retries: int = 3, **kwargs) -> Dict:
        """Fetches running trade data for multiple symbols or all stocks, with optional date and pagination support."""
        await self.initialize()
        
        # Build symbols query string if filters are provided
        # Reduced limit to 500 for better server stability during peak hours
        query_parts = ["sort=DESC", "limit=500", "order_by=RUNNING_TRADE_ORDER_BY_TIME", "is_show_bs=true"]
        
        if symbols:
            for s in symbols:
                query_parts.append(f"symbols[]={s}")
        
        if date:
            query_parts.append(f"date={date}")

        for k, v in kwargs.items():
            query_parts.append(f"{k}={v}")
            
        url = f"https://exodus.stockbit.com/order-trade/running-trade?{'&'.join(query_parts)}"
        auth_val = self.auth_header if self.auth_header else ""
        
        for attempt in range(max_retries):
            try:
                # We use page.evaluate to fetch using the browser's authenticated context
                data = await self.page.evaluate(f"""
                    async () => {{
                        try {{
                            const authHeader = '{auth_val}';
                            const headers = {{ 'Content-Type': 'application/json' }};
                            if (authHeader) headers['Authorization'] = authHeader;
                            
                            const response = await fetch('{url}', {{ headers: headers }});
                            
                            if (response.status !== 200) {{
                                return {{ "error": "Status " + response.status, "status": response.status }};
                            }}
                            return await response.json();
                        }} catch (e) {{
                            return {{ "error": e.toString() }};
                        }}
                    }}
                """)
                
                # Check for server-side error (500, 502, 503, 504)
                status = data.get("status")
                if status and status >= 500:
                    wait_time = (2 ** attempt) + (random.random() * 2)
                    logger.warning(f"Stockbit API returned {status} (Attempt {attempt+1}/{max_retries}). Retrying in {wait_time:.2f}s...")
                    await asyncio.sleep(wait_time)
                    continue
                
                return data
            except Exception as e:
                logger.error(f"Error fetching trade data: {e}")
                if attempt == max_retries - 1:
                    return {"error": str(e)}
                await asyncio.sleep(1)
        
        return {"error": "Maximum retries exceeded"}

    async def get_running_trade_history(self, ticker: str, date: str, start_time: str = "08:58:00") -> Dict:
        """Fetches all trades for a ticker on a specific date until start_time using pagination."""
        all_trades = []
        last_id = None
        
        logger.info(f"Fetching history for {ticker} on {date} until {start_time}...")
        
        for i in range(20): # Safety limit to prevent infinite loops (e.g., 20 requests * 2000 = 40,000 trades)
            kwargs = {}
            if last_id:
                kwargs['id_lt'] = last_id
            
            resp = await self.get_running_trade(symbols=[ticker], date=date, **kwargs)
            
            if "error" in resp:
                logger.error(f"Error in pagination loop: {resp['error']}")
                break
                
            trades = resp.get("data", {}).get("running_trade", [])
            if not trades:
                logger.info("No more trades found in pagination.")
                break
                
            all_trades.extend(trades)
            
            # Check the time of the last trade in this batch
            last_item = trades[-1]
            last_time = last_item.get('time', '23:59:59')
            last_id = last_item.get('id')
            
            logger.info(f"Page {i+1}: Fetched {len(trades)} trades. Last time: {last_time} (ID: {last_id})")
            
            if last_time <= start_time:
                logger.info(f"Reached target start time: {last_time} <= {start_time}")
                break
                
            # Rate limiting / polite delay
            await asyncio.sleep(0.5)
            
        return {"trades": all_trades, "count": len(all_trades)}

    async def get_running_trade_history_full(self, ticker: str, date: str, start_time: str = "08:58:00") -> Dict:
        """Fetches ALL trades for a ticker on a specific date until start_time using pagination."""
        all_trades = []
        last_id = None
        
        logger.info(f"Fetching FULL history for {ticker} on {date} until {start_time}...")
        
        prev_last_id = None
        for i in range(500): 
            kwargs = {}
            if last_id:
                # Prefer id_lt for more reliable pagination, fallback to trade_number
                kwargs['id_lt'] = last_id
            
            # Detect infinite loop where last_id doesn't progress
            if last_id and last_id == prev_last_id:
                logger.warning(f"Pagination stuck at ID {last_id}. Breaking loop.")
                break
            prev_last_id = last_id

            resp = await self.get_running_trade(symbols=[ticker], date=date, **kwargs)
            
            if "error" in resp:
                logger.error(f"Error in pagination loop: {resp['error']}")
                break
                
            trades = resp.get("data", {}).get("running_trade", [])
            if not trades:
                logger.info("No more trades found in pagination.")
                break
                
            all_trades.extend(trades)
            
            last_item = trades[-1]
            last_time = last_item.get('time', '23:59:59')
            # Prefer ID for paging, it is more consistent than trade_number
            last_id = last_item.get('id') or last_item.get('trade_number')
            
            logger.info(f"Page {i+1}: Fetched {len(trades)} trades. Cumulative: {len(all_trades)}. Last time: {last_time} (ID: {last_id})")
            
            if last_time <= start_time:
                logger.info(f"Reached target start time: {last_time} <= {start_time}")
                break
                
            await asyncio.sleep(0.5)
            
        return {"trades": all_trades, "count": len(all_trades)}

    async def save_session(self):
        """Saves current browser context state to storage_path."""
        if self.context:
            await self.context.storage_state(path=self.storage_path)
            logger.info(f"Session saved to {self.storage_path}")

    async def close(self):
        """Closes the browser."""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        self.page = None
        self.browser = None
        self.context = None
        logger.info("StockbitClient closed.")

if __name__ == "__main__":
    async def main():
        client = StockbitClient(headless=False) # Headful for debugging
        try:
            print("Fetching BBCA...")
            data = await client.get_running_trade("BBCA")
            print(json.dumps(data, indent=2)[:500] + "...") # Print first 500 chars
        finally:
            await client.close()
            
    asyncio.run(main())
