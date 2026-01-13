import os
import sys
import asyncio
import argparse
from datetime import datetime
from typing import List, Optional

# Add parent directory to sys.path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.scraper_neobdm import NeoBDMScraper
from db.neobdm_repository import NeoBDMRepository
from db.connection import DatabaseConnection

def _parse_csv_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]

def _print_verification(ticker: str, date_str: str, data: dict):
    print("\n" + "=" * 50)
    print(f"VERIFICATION DATA ({ticker} - {date_str})")
    print("=" * 50)
    print("TOP 5 BUYS:")
    for i, row in enumerate(data.get('buy', [])[:5]):
        broker = row.get('broker', 'N/A')
        nlot = row.get('nlot', row.get('net lot', '0'))
        nval = row.get('nval', row.get('net val', '0'))
        bavg = row.get('bavg', row.get('avg price', '0'))
        print(f"  {i+1}. {broker}: {nlot} lots | {nval}B | Avg: {bavg}")

    print("-" * 30)
    print("TOP 5 SELLS:")
    for i, row in enumerate(data.get('sell', [])[:5]):
        broker = row.get('broker', 'N/A')
        nlot = row.get('nlot', row.get('net lot', '0'))
        nval = row.get('nval', row.get('net val', '0'))
        savg = row.get('savg', row.get('avg price', '0'))
        print(f"  {i+1}. {broker}: {nlot} lots | {nval}B | Avg: {savg}")
    print("=" * 50)

async def scrape_action(ticker, date_str, verify=False, tickers=None, dates=None):
    # Ensure tables exist
    DatabaseConnection()

    scraper = NeoBDMScraper()
    repo = NeoBDMRepository()

    try:
        print(f"[*] Initializing browser...")
        await scraper.init_browser(headless=True)

        if tickers and dates:
            batch_tasks = [{"ticker": t.upper(), "dates": dates} for t in tickers]
            print(f"[*] Running batch scrape for {len(tickers)} tickers and {len(dates)} dates...")
            results = await scraper.get_broker_summary_batch(batch_tasks)
            for result in results:
                if "error" in result:
                    print(f"[!] Batch error: {result['error']}")
                    continue
                repo.save_broker_summary_batch(
                    ticker=result['ticker'],
                    trade_date=result['trade_date'],
                    buy_data=result['buy'],
                    sell_data=result['sell']
                )
                if verify:
                    _print_verification(result['ticker'], result['trade_date'], result)
            print("[OK] Batch scraping complete.")
            return

        print(f"[*] Logging in to NeoBDM...")
        login_success = await scraper.login()
        if not login_success:
            print("[!] Login failed. Check your credentials in .env")
            return

        print(f"[*] Scraping broker summary for {ticker} on {date_str}...")
        data = await scraper.get_broker_summary(ticker, date_str)

        if data:
            print(f"[*] Saving to database...")
            repo.save_broker_summary_batch(
                ticker=ticker,
                trade_date=date_str,
                buy_data=data['buy'],
                sell_data=data['sell']
            )
            print("[OK] Scraping and saving complete.")

            if verify:
                _print_verification(ticker, date_str, data)
        else:
            print("[!] No data retrieved.")

    except Exception as e:
        print(f"[!] Critical Error: {e}")
    finally:
        await scraper.close()

def main():
    parser = argparse.ArgumentParser(description="NeoBDM Broker Summary Scraper")
    parser.add_argument("--ticker", help="Ticker symbol (e.g., ANTM)")
    parser.add_argument("--date", help="Date string YYYY-MM-DD (defaults to today)", default=datetime.now().strftime('%Y-%m-%d'))
    parser.add_argument("--tickers", help="Comma-separated tickers for batch mode (e.g., ANTM,BBCA)")
    parser.add_argument("--dates", help="Comma-separated dates for batch mode (e.g., 2025-01-12,2025-01-13)")
    parser.add_argument("--verify", action="store_true", help="Print sample data for verification")

    # Handle Windows event loop policy
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    args = parser.parse_args()
    tickers = _parse_csv_list(args.tickers)
    dates = _parse_csv_list(args.dates)

    if tickers or dates:
        if not tickers or not dates:
            parser.error("Batch mode requires both --tickers and --dates.")
        asyncio.run(scrape_action(args.ticker, args.date, args.verify, tickers=tickers, dates=dates))
    else:
        if not args.ticker:
            parser.error("--ticker is required unless batch mode is used.")
        asyncio.run(scrape_action(args.ticker, args.date, args.verify))

if __name__ == "__main__":
    main()
