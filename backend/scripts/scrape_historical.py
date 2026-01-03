import asyncio
import os
import sys
import argparse
from stockbit_client import StockbitClient
from data_provider import DataProvider

async def main():
    parser = argparse.ArgumentParser(description="Scrape historical running trade data.")
    parser.add_argument("ticker", help="The ticker symbol (e.g., ANTM)")
    parser.add_argument("date", help="The date in YYYY-MM-DD format")
    parser.add_argument("--storage", default="stockbit_storage.json", help="Path to session storage file")
    parser.add_argument("--headful", action="store_true", help="Run in headful mode (visible browser)")
    
    args = parser.parse_args()
    
    ticker = args.ticker.upper()
    date = args.date
    storage = args.storage
    
    print(f"--- Starting Scrape for {ticker} on {date} ---")
    
    if not os.path.exists(storage):
        print(f"[!] Error: {storage} not found!")
        return

    client = StockbitClient(storage_path=storage, headless=not args.headful)
    dp = DataProvider()
    
    try:
        await client.initialize()
        print("[*] Stockbit Client initialized.")
        
        # Perform full day scrape
        result = await client.get_running_trade_history_full(ticker=ticker, date=date)
        
        if "error" in result:
            print(f"[!] Scrape failed: {result['error']}")
            return

        trades = result.get("trades", [])
        count = len(trades)
        print(f"[*] TOTAL TRADES FETCHED: {count}")
        
        if count > 0:
            print(f"[*] FIRST TRADE: {trades[0].get('time')} - {trades[0].get('price')} - B/S: {trades[0].get('buyer')}/{trades[0].get('seller')}")
            print(f"[*] LAST TRADE: {trades[-1].get('time')} - {trades[-1].get('price')} - B/S: {trades[-1].get('buyer')}/{trades[-1].get('seller')}")
            
            print("[*] Saving to database...")
            dp.db_manager.save_raw_trades(ticker, date, trades)
            print(f"[+++] SUCCESS: {count} records saved to rt_raw_history for {ticker} on {date}.")
        else:
            print("[!] No trades found for this date/ticker.")

    except Exception as e:
        print(f"[!] Critical Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())
