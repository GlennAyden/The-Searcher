import asyncio
import json
import os
import sys

# Add path to backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from stockbit_client import StockbitClient

STORAGE_STATE = "backend/stockbit_storage.json"

async def test_full_history():
    if not os.path.exists(STORAGE_STATE):
        print(f"Error: {STORAGE_STATE} not found.")
        return

    # Use the existing client logic
    client = StockbitClient(storage_path=STORAGE_STATE, headless=True)
    try:
        # Test with BBCA on a known date (24-12-2025)
        ticker = "BBCA"
        date = "2025-12-24"
        print(f"Testing full history for {ticker} on {date}...")
        
        result = await client.get_running_trade_history(ticker=ticker, date=date, start_time="08:58:00")
        
        print("\n--- TEST RESULTS ---")
        print(f"Total Trades Fetched: {result.get('count')}")
        
        trades = result.get('trades', [])
        if trades:
            first = trades[0]
            last = trades[-1]
            print(f"Latest Trade: {first.get('time')} (ID: {first.get('id')})")
            print(f"Earliest Trade: {last.get('time')} (ID: {last.get('id')})")
            
            # Verify if we actually reached 08:58:00
            if last.get('time') <= "08:58:00":
                print("[SUCCESS] Reached target start time 08:58:00")
            else:
                print(f"[PARTIAL] Stopped at {last.get('time')}. Check if i range (20) is enough.")

    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(test_full_history())
