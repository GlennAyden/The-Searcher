import asyncio
import json
from stockbit_client import StockbitClient

if __name__ == "__main__":
    async def main():
        client = StockbitClient(headless=False) # Headful to ensure token sniff works
        
        try:
            print("--- 1. Fetching First Page (Latest) ---")
            data1 = await client.get_running_trade(symbols=["BUVA"], date="2025-12-24")
            
            if "error" in data1:
                print(f"Error Page 1: {data1['error']}")
                return

            trades1 = data1.get("data", {}).get("running_trade", [])
            print(f"Page 1 Trades: {len(trades1)}")
            
            if not trades1:
                print("No trades found in Page 1.")
                return

            last_trade = trades1[-1]
            last_id = last_trade.get("id")
            last_time = last_trade.get("time")
            print(f"Last Trade P1: Time={last_time}, ID={last_id}")
            
            print("\n--- 2. Fetching Second Page (Pagination) ---")
            data2 = await client.get_running_trade(symbols=["BUVA"], date="2025-12-24", id_lt=last_id)
            
            trades2 = data2.get("data", {}).get("running_trade", [])
            print(f"Page 2 Trades: {len(trades2)}")
            
            if trades2:
                first_trade_p2 = trades2[0]
                print(f"First Trade P2: Time={first_trade_p2.get('time')}, ID={first_trade_p2.get('id')}")
                
                if first_trade_p2.get('time') <= last_time:
                    print("SUCCESS: Time moved backwards!")
                else:
                    print("FAILURE: Time did not move backwards (or is same).")
            else:
                print("Page 2 is empty.")

        finally:
            await client.close()

    asyncio.run(main())
