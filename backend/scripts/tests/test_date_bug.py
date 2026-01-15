"""
Test script to verify if date is being set correctly during batch scraping
"""
import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.scraper_neobdm import NeoBDMScraper

async def test_date_setting():
    scraper = NeoBDMScraper()
    
    try:
        print("="*80)
        print("TESTING DATE MANIPULATION IN BATCH MODE")
        print("="*80)
        
        await scraper.init_browser(headless=False)  # Use visible browser for debugging
        
        login_success = await scraper.login()
        if not login_success:
            print("LOGIN FAILED!")
            return
        
        # Navigate to broker summary page
        target_url = f"{scraper.base_url}/broker_summary/"
        await scraper.page.goto(target_url, wait_until='networkidle', timeout=60000)
        await scraper.page.wait_for_selector('.Select-control', state='visible', timeout=20000)
        
        # Test ticker
        ticker = "ENRG"
        
       # Test dates  
        test_dates = ["2026-01-13", "2026-01-12", "2026-01-09"]
        
        for date_str in test_dates:
            print(f"\n{'='*80}")
            print(f"TEST: Setting date to {date_str}")
            print("="*80)
            
            # Select ticker first
            print(f"Selecting ticker {ticker}...")
            await scraper.page.click('.Select-control', force=True)
            await asyncio.sleep(1)
            await scraper.page.keyboard.type(ticker)
            await asyncio.sleep(2)
            await scraper.page.click(f".Select-option:has-text('{ticker}')", force=True)
            await asyncio.sleep(2)
            await scraper.page.click('body', force=True)
            await asyncio.sleep(1)
            
            # Try to set the date
            print(f"Attempting to set date to {date_str}...")
            success = await scraper._set_broker_summary_date(date_str)
            
            # Verify what date is actually set
            actual_date = await scraper._get_broker_summary_date_value()
            
            print(f"  Set success: {success}")
            print(f"  Expected date: {date_str}")
            print(f"  Actual date: {actual_date}")
            print(f"  Match: {actual_date == date_str}")
            
            # Wait for render
            await scraper._wait_for_broker_summary_render()
            await asyncio.sleep(2)
            
            # Check if data is present
            cell_count = await scraper.page.locator('.dash-cell').count()
            print(f" Cells found: {cell_count}")
            
            # Extract first row data to see if it's changing
            first_row = await scraper.page.evaluate("""
                () => {
                    const cells = Array.from(document.querySelectorAll('.dash-cell'));
                    if (cells.length >= 4) {
                        return {
                            broker: cells[0].textContent.trim(),
                            nlot: cells[1].textContent.trim(),
                            nval: cells[2].textContent.trim(),
                            avg: cells[3].textContent.trim()
                        };
                    }
                    return null;
                }
            """)
            
            print(f"  First row data: {first_row}")
            
            # Wait before next iteration
            await asyncio.sleep(3)
        
        print("\n" + "="*80)
        print("TEST COMPLETE - Check if data changed between dates")
        print("="*80)
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Don't close immediately, let us inspect
        print("Waiting 10 seconds before closing...")
        await asyncio.sleep(10)
        await scraper.close()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(test_date_setting())
