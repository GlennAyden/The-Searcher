
import asyncio
import json
from backend.stockbit_client import StockbitClient

async def test():
    print("Testing session from stockbit_storage.json...")
    client = StockbitClient(headless=True)
    try:
        await client.initialize()
        print(f"Auth Header Sniffed: {client.auth_header[:20] if client.auth_header else 'NONE'}")
        data = await client.get_running_trade(["BBCA"])
        print(f"Data received: {str(data)[:200]}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(test())
