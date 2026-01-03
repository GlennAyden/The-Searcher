import asyncio
import os
import sys
from stockbit_client import StockbitClient
from data_provider import DataProvider

async def scrape_tins_target():
    ticker = "TINS"
    date = "2025-12-29"
    storage = "stockbit_storage.json"
    
    print(f"--- Starting Scrape for {ticker} on {date} ---")
    
    if not os.path.exists(storage):
        print(f"[!] Error: {storage} not found!")
        return

    client = StockbitClient(storage_path=storage, headless=True)
    dp = DataProvider()
    
    try:
        await client.initialize()
        print("[*] Client initialized.")
        
        # Perform full day scrape
        result = await client.get_running_trade_history_full(ticker=ticker, date=date)
        
        if "error" in result:
            print(f"[!] Scrape failed: {result['error']}")
            return

        trades = result.get("trades", [])
        count = len(trades)
        print(f"[*] TOTAL TRADES FETCHED: {count}")
        if count > 0:
            print(f"[*] FIRST TRADE: {trades[0].get('time')} ID: {trades[0].get('id')} TN: {trades[0].get('trade_number')}")
            print(f"[*] LAST TRADE: {trades[-1].get('time')} ID: {trades[-1].get('id')} TN: {trades[-1].get('trade_number')}")
        
        if count > 0:
            print("[*] Saving to database...")
            dp.db_manager.save_raw_trades(ticker, date, trades)
            print("[+++] SUCCESS: Data saved to rt_raw_history.")
            
            # Verify one sample
            sample = trades[0]
            print(f"[*] Sample: {sample.get('time')} - {sample.get('price')} - Buyer: {sample.get('buyer')} - Seller: {sample.get('seller')}")
        else:
            print("[!] No trades found for this date/ticker.")

    except Exception as e:
        print(f"[!] Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(scrape_tins_target())
