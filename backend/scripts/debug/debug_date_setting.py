"""
Debug script to test date setting in isolation
"""
import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.scraper_neobdm import NeoBDMScraper

async def test_date_setting_detailed():
    scraper = NeoBDMScraper()
    
    try:
        print("="*80)
        print("DEBUG: TESTING DATE MANIPULATION")
        print("="*80)
        
        await scraper.init_browser(headless=False)  # Visible browser
        
        login_success = await scraper.login()
        if not login_success:
            print("LOGIN FAILED!")
            return
        
        # Navigate to broker summary
        target_url = f"{scraper.base_url}/broker_summary/"
        await scraper.page.goto(target_url, wait_until='networkidle', timeout=60000)
        await scraper.page.wait_for_selector('.Select-control', state='visible', timeout=20000)
        await asyncio.sleep(3)
        
        # Select ticker ENRG
        ticker = "ENRG"
        print(f"\n[1] Selecting ticker {ticker}...")
        if await scraper._select_ticker_robust(ticker):
            print(f"[OK] Ticker selected")
        else:
            print(f"[FAIL] Ticker selection failed")
            return
        
        await asyncio.sleep(3)
        
        # Get initial date value
        initial_date = await scraper._get_broker_summary_date_value()
        print(f"\n[2] Initial date value in field: {initial_date}")
        
        # Get initial data fingerprint
        initial_fingerprint = await scraper._get_data_fingerprint()
        print(f"[2] Initial data fingerprint: {initial_fingerprint}")
        
        # Test dates
        test_dates = ["2026-01-12", "2026-01-09", "2026-01-13"]
        
        for test_date in test_dates:
            print(f"\n{'='*80}")
            print(f"TESTING DATE: {test_date}")
            print("="*80)
            
            # Try to set date
            print(f"[3] Attempting to set date to {test_date}...")
            success = await scraper._set_broker_summary_date(test_date)
            print(f"[3] Set result: {success}")
            
            # Verify what's in the field
            actual_date = await scraper._get_broker_summary_date_value()
            print(f"[4] Date field now shows: {actual_date}")
            print(f"[4] Match expected: {actual_date == test_date}")
            
            # Wait for data to render
            print(f"[5] Waiting for data to render...")
            await scraper._wait_for_broker_summary_render()
            await asyncio.sleep(5)  # Extra wait
            
            # Get new fingerprint
            new_fingerprint = await scraper._get_data_fingerprint()
            print(f"[6] Data fingerprint after change: {new_fingerprint}")
            print(f"[6] Data changed from initial: {new_fingerprint != initial_fingerprint}")
            
            # Also extract first few broker names to see if they match the screenshot
            first_brokers = await scraper.page.evaluate("""
                () => {
                    const cells = Array.from(document.querySelectorAll('.dash-cell'));
                    const brokers = [];
                    for (let i = 0; i < Math.min(20, cells.length); i += 4) {
                        brokers.push(cells[i].textContent.trim());
                    }
                    return brokers;
                }
            """)
            print(f"[7] First 5 brokers (buy side): {first_brokers[:5]}")
            
            # Pause before next iteration
            await asyncio.sleep(5)
        
        print("\n" + "="*80)
        print("BROWSER WILL STAY OPEN FOR 60 SECONDS - CHECK MANUALLY")
        print("="*80)
        await asyncio.sleep(60)
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        await asyncio.sleep(30)
    finally:
        await scraper.close()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(test_date_setting_detailed())
