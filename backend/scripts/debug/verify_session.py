import asyncio
import os
from stockbit_client import StockbitClient

async def verify_session():
    # Initialize client with the existing storage file
    client = StockbitClient(storage_path="stockbit_storage.json", headless=True)
    
    print("--- Verifying Stockbit Session ---")
    if not os.path.exists("stockbit_storage.json"):
        print("[!] Error: stockbit_storage.json not found!")
        return

    try:
        await client.initialize()
        print("[*] Browser initialized with storage state.")
        
        # Try to fetch running trade for a popular ticker
        print("[*] Attempting to fetch Running Trade for BBCA...")
        resp = await client.get_running_trade(["BBCA"])
        
        if "error" in resp:
            print(f"[!] API Error: {resp['error']}")
            return

        trades = resp.get("data", {}).get("running_trade", [])
        if not trades:
            print("[!] No trades found. Session might be invalid or market is closed (but API should still return structure).")
            return

        # Check if Buyer/Seller data exists (Login proof)
        first_trade = trades[0]
        buyer = first_trade.get("buyer")
        seller = first_trade.get("seller")
        
        print(f"[*] Success! Fetched {len(trades)} trades.")
        print(f"[*] Sample Trade: {first_trade.get('time')} - {first_trade.get('price')} - Buyer: {buyer} - Seller: {seller}")
        
        if buyer and seller and buyer != "-" and seller != "-":
            print("[+++] VERIFIED: Session is ACTIVE and provides Buyer/Seller data.")
        else:
            print("[---] WARNING: Session found, but Buyer/Seller data is missing. You might need to re-login on the real Running Trade page.")

    except Exception as e:
        print(f"[!] Critical Error: {str(e)}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(verify_session())
