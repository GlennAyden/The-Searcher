
import asyncio
import json
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from stockbit_client import StockbitClient

async def main():
    # Use correct path to storage state
    storage_path = os.path.join(os.path.dirname(__file__), '..', 'stockbit_storage.json')
    client = StockbitClient(storage_path=storage_path, headless=False)
    try:
        print("Fetching running trade data for BBCA...")
        # Fetch without specific params (should use default limit=5000 from client code if I update client source, 
        # but here I am importing StockbitClient. 
        # Wait, StockbitClient source on disk HAS limit=5000.
        data = await client.get_running_trade(["BBCA"])
        
        if "error" in data:
            print("Error:", data["error"])
            return

        trades = data.get("data", {}).get("running_trade", [])
        print(f"\n*** GOT {len(trades)} TRADES ***")
        
        if trades:
            first = trades[0]
            last = trades[-1]
            date_info = data.get("data", {}).get("date")
            print(f"Data Date: {date_info}")
            print(f"First Trade Time: {first.get('time')} | Buyer: {first.get('buyer')}")
            print(f"Last Trade Time: {last.get('time')}")

        else:
            print("No trades found.")

    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())
