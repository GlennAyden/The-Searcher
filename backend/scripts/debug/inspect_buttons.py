"""
Script to inspect page and find correct arrow button selectors
"""
import asyncio
import sys
sys.path.insert(0, 'backend')

from modules.scraper_neobdm import NeoBDMScraper

async def inspect_arrow_buttons():
    scraper = NeoBDMScraper()
    
    try:
        await scraper.init_browser(headless=False)
        
        login_success = await scraper.login()
        if not login_success:
            print("LOGIN FAILED!")
            return
        
        # Navigate to broker summary
        target_url = f"{scraper.base_url}/broker_summary/"
        await scraper.page.goto(target_url, wait_until='networkidle', timeout=60000)
        await scraper.page.wait_for_selector('.Select-control', state='visible', timeout=20000)
        await asyncio.sleep(3)
        
        # Select ENRG
        if await scraper._select_ticker_robust("ENRG"):
            print("[OK] Ticker selected")
        
        await asyncio.sleep(3)
        
        # Find all buttons near the date field
        print("\n" + "="*80)
        print("INSPECTING ALL BUTTONS ON PAGE")
        print("="*80)
        
        buttons_info = await scraper.page.evaluate("""
            () => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.map((btn, idx) => ({
                    index: idx,
                    text: btn.textContent.trim(),
                    className: btn.className,
                    id: btn.id,
                    ariaLabel: btn.getAttribute('aria-label'),
                    disabled: btn.disabled,
                    html: btn.outerHTML.substring(0, 200)
                }));
            }
        """)
        
        print(f"\nFound {len(buttons_info)} buttons total\n")
        
        for btn in buttons_info:
            print(f"Button #{btn['index']}:")
            print(f"  Text: '{btn['text']}'")
            print(f"  Class: {btn['className']}")
            print(f"  ID: {btn['id']}")
            print(f"  Aria-label: {btn['ariaLabel']}")
            print(f"  Disabled: {btn['disabled']}")
            print(f"  HTML: {btn['html'][:100]}...")
            print()
        
        print("\n" + "="*80)
        print("BROWSER WILL STAY OPEN FOR 60 SECONDS")
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
    asyncio.run(inspect_arrow_buttons())
