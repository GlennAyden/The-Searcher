import os
import asyncio
import pandas as pd
from playwright.async_api import async_playwright
from dotenv import load_dotenv

load_dotenv()

class NeoBDMScraper:
    def __init__(self):
        self.email = os.getenv("NEOBDM_EMAIL")
        self.password = os.getenv("NEOBDM_PASSWORD")
        self.base_url = "https://neobdm.tech"
        self.browser = None
        self.context = None
        self.page = None

    async def init_browser(self, headless=True):
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=headless)
        self.context = await self.browser.new_context()
        self.page = await self.context.new_page()

    async def login(self):
        print(f"Attempting login for {self.email}...")
        await self.page.goto(f"{self.base_url}/accounts/login/")
        
        # Fill login form based on actual IDs found
        await self.page.fill('#id_login', self.email)
        await self.page.fill('#id_password', self.password)
        
        # Submit using the primary action button class
        await self.page.click('.primaryAction.btn.btn-primary')
        
        # Wait for navigation/dashboard indicator
        try:
            # Check if we are redirected to home
            await self.page.wait_for_url(f"{self.base_url}/home/", timeout=15000)
            print("Login successful!")
            return True
        except Exception as e:
            print(f"Login failed: {e}")
            # Check for error messages
            error_msg = await self.page.query_selector('.alert-danger')
            if error_msg:
                print(f"Error detail: {await error_msg.inner_text()}")
            return False

    async def get_market_summary(self, method='m', period='d'):
        """
        Scrapes the Market Summary table.
        method: 'm' (Market Maker), 'nr' (Non-Retail), 'f' (Foreign Flow)
        period: 'd' (Daily), 'c' (Cumulative)
        """
        if not self.page:
            return None, None
            
        try:
            target_url = f"{self.base_url}/market_summary/"
            
            # Simplified sturdy navigation: Always GOTO (forces refresh/clear state)
            print(f"   [SYNC] Navigating to market summary...", flush=True)
            await self.page.goto(target_url, wait_until='networkidle', timeout=60000)
            
            # DEBUG: Check where we actually are
            current_url = self.page.url
            current_title = await self.page.title()
            print(f"   [DEBUG] Current URL: {current_url}", flush=True)
            print(f"   [DEBUG] Current OK Title: {current_title}", flush=True)

            # Wait for main controls (Chart might be slow, but controls should appear)
            await self.page.wait_for_selector('#summary-mode', state='visible', timeout=20000)
            
            # Trigger change events manually to ensure Dash sees the update
            await self.page.evaluate("""
                (args) => {
                    const methodSelect = document.querySelector('#method');
                    const periodSelect = document.querySelector('#summary-mode');
                    if (methodSelect) {
                        methodSelect.value = args.m;
                        methodSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    if (periodSelect) {
                        periodSelect.value = args.p;
                        periodSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            """, {"m": method, "p": period})

            print(f"   [SYNC] Setting analysis parameters...", flush=True)
            await asyncio.sleep(5) # Increased wait for Dash callback execution

        except Exception as e:
            print(f"   [SYNC] Error refreshing/setting parameters: {e}")
            # We continue, hoping that the checkboxes/scraping might still work or it will fail later gracefully

        # --- Handle Checkboxes (Normalize OFF, Moving Average ON) ---
        try:
            # 1. Normalize -> Uncheck
            # Using value="normalize" if available, else label text
            norm_cb = self.page.locator('input[value="normalize"]')
            if await norm_cb.count() > 0:
                if await norm_cb.is_checked():
                    await norm_cb.uncheck()
                    print("Unchecked 'Normalize'")
            else:
                print("Warning: 'Normalize' checkbox not found by value.")

            # 2. Moving Average -> Check
            # Try value="ma" first, then label text
            ma_cb = self.page.locator('input[value="ma"]')
            if await ma_cb.count() == 0:
                 # Fallback to label text using robust xpath from debug_toggling
                 ma_label = self.page.locator('label', has_text="Moving Average")
                 if await ma_label.count() > 0:
                     ma_cb = ma_label.locator("xpath=preceding-sibling::input | descendant::input | ..//input").first
            
            if await ma_cb.count() > 0:
                if not await ma_cb.is_checked():
                    await ma_cb.check()
                    print("Checked 'Moving Average'")
            else:
                print("Warning: 'Moving Average' checkbox not found.")
                
            # 3. Compatible Only -> Check
            comp_cb = self.page.locator('input[value="compatible"]')
            if await comp_cb.count() > 0:
                if not await comp_cb.is_checked():
                    await comp_cb.check()
                    print("Checked 'Compatible Only'")
            else:
                # Fallback to label
                comp_label = self.page.locator('label', has_text="Compatible Only")
                if await comp_label.count() > 0:
                    comp_cb = comp_label.locator("xpath=preceding-sibling::input | descendant::input | ..//input").first
                    if await comp_cb.count() > 0 and not await comp_cb.is_checked():
                        await comp_cb.check()
                        print("Checked 'Compatible Only'")

            # Wait a bit for table update after checkboxes
            await asyncio.sleep(2)
            
        except Exception as e:
            print(f"Error toggling checkboxes: {e}")

        # Wait for the Dash table to load or refresh
        # 1. Wait for spinner to appear (if any)
        try:
            await self.page.wait_for_selector('.dash-spreadsheet-inner.dash-loading', timeout=2000)
            print("  Waiting for loading spinner to disappear...")
            await self.page.wait_for_selector('.dash-spreadsheet-inner.dash-loading', state='hidden', timeout=15000)
        except:
            # Spinner might be too fast or already gone
            pass

        # Wait for the table row content to be present
        await self.page.wait_for_selector('.dash-cell', timeout=20000)

        # Extract Reference Date from title (e.g., "Market Maker Analysis Summary [2024-12-19]")
        reference_date = None
        try:
            title_text = await self.page.inner_text('label.mb-0.form-label')
            if '[' in title_text and ']' in title_text:
                reference_date = title_text.split('[')[1].split(']')[0]
                print(f"   [DATA] Extracted Reference Date: {reference_date}")
        except Exception as e:
            print(f"   [DATA] Failed to extract reference date: {e}")

        # Extraction logic for Plotly Dash Table via JS
        all_data = []
        current_page = 1
        total_pages = 1

        # Detect total pages with retry loop
        for attempt in range(5):
            try:
                # Wait for pagination container
                await self.page.wait_for_selector('.previous-next-container', timeout=5000)
                total_pages_text = await self.page.inner_text('.page-number .last-page')
                clean_text = total_pages_text.strip().split('/')[-1].strip()
                if clean_text and clean_text.isdigit():
                    total_pages = int(clean_text)
                    if total_pages > 0:
                        print(f"   [PAGINATION] Total pages detected: {total_pages} (Attempt {attempt+1})", flush=True)
                        break
                print(f"   [PAGINATION] Waiting for total pages text... (Attempt {attempt+1})", flush=True)
                await asyncio.sleep(2)
            except Exception as e:
                print(f"   [PAGINATION] Detection attempt {attempt+1} failed: {e}", flush=True)
                await asyncio.sleep(2)
        else:
            print(f"   [PAGINATION] Could not detect total pages after retries, defaulting to 1", flush=True)

        while current_page <= total_pages:
            print(f"Scraping page {current_page} of {total_pages}...")
            
            # Extract current page data
            page_data = await self.page.evaluate("""
                () => {
                    const headers = Array.from(document.querySelectorAll('.dash-header span'))
                        .map(s => s.innerText.trim())
                        .filter(s => s.length > 0);
                        
                    const allTrs = Array.from(document.querySelectorAll('tr')).filter(tr => tr.querySelector('.dash-cell'));
                    
                    return allTrs.map(tr => {
                        const allCells = Array.from(tr.querySelectorAll('td, th'));
                        const cells = allCells.slice(-headers.length);
                        
                        let rowData = {};
                        headers.forEach((header, index) => {
                            if (cells[index]) {
                                let text = cells[index].textContent.trim();
                                
                                // Clean unwanted text patterns (Watchlist buttons, etc.)
                                text = text.replace(/Add\s+\w+\s+to\s+Watchlist/gi, '').trim();
                                text = text.replace(/Remove\s+from\s+Watchlist/gi, '').trim();
                                
                                // Enhanced Extraction: Check for title/tooltip
                                // This solves "Value Extraction" by grabbing hidden details in hover states
                                let tooltip = cells[index].getAttribute('title');
                                if (!tooltip) {
                                    const child = cells[index].querySelector('[title]');
                                    if (child) tooltip = child.getAttribute('title');
                                }
                                
                                // Check for SVG/Icon titles (common in Dash conditional formatting)
                                if (!tooltip && (text === '' || text.toLowerCase() === 'v')) {
                                     // Try to find aria-label or other indicators if simple text hidden
                                     const icon = cells[index].querySelector('svg, i');
                                     if (icon) tooltip = "Marker Present"; 
                                }

                                if (tooltip && tooltip !== text) {
                                    // Append tooltip info. stored as "Value|Tooltip"
                                    if (text) text = `${text}|${tooltip}`;
                                    else text = tooltip;
                                }
                                
                                rowData[header] = text;
                            }
                        });
                        return rowData;
                    });
                }
            """)
            
            if page_data:
                all_data.extend(page_data)
                print(f"  Extracted {len(page_data)} rows from page {current_page}.")
            else:
                print(f"  Warning: No data found on page {current_page}.")

            if current_page < total_pages:
                try:
                    # Capture signature of first row to detect change
                    first_row_signature = str(page_data[0]) if page_data else None
                    
                    # Click Next
                    next_btn = self.page.locator('button.next-page')
                    
                    # Retry logic: Wait for button to be enabled (sometimes it lags)
                    btn_enabled = False
                    for _ in range(10): # Wait up to 10s
                        if await next_btn.is_enabled():
                            btn_enabled = True
                            break
                        await asyncio.sleep(1)
                        
                    if btn_enabled:
                        await next_btn.click()
                        
                        # Wait for either spinner OR content change
                        # Wait for up to 5 seconds for change
                        for _ in range(10):
                            await asyncio.sleep(0.5)
                            new_page_data = await self.page.evaluate("""
                                () => {
                                    const firstCell = document.querySelector('.dash-cell');
                                    return firstCell ? firstCell.textContent.trim() : null;
                                }
                            """)
                            # If we had data and now first cell text is different, we definitely moved pages
                            # (Simplification: just checking if table refreshed)
                            if page_data and new_page_data != page_data[0].get(list(page_data[0].keys())[0]):
                                break
                        
                        current_page += 1
                    else:
                        print(f"  Next button disabled. Assuming end of filtered data (Footer mismatch). Stopping.")
                        break
                except Exception as e:
                    print(f"  Error navigating to next page: {e}")
                    break
            else:
                break
        
        if all_data:
            df = pd.DataFrame(all_data)
            # Remove duplicates if any (Dash sometimes overlaps during transitions)
            df = df.drop_duplicates().reset_index(drop=True)
            print(f"Successfully extracted total {len(df)} unique rows.")
            return df, reference_date
        else:
            print("No data found across any pages.")
            return None, reference_date

    async def close(self):
        if self.browser:
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()

async def verify_credentials():
    scraper = NeoBDMScraper()
    try:
        await scraper.init_browser(headless=True)
        success = await scraper.login()
        if success:
            print("Verification RESULT: SUCCESS")
            # Test Cumulative
            df_cum = await scraper.get_market_summary(method='m', period='c')
            if df_cum is not None:
                print("Cumulative Market Summary Sample:")
                print(df_cum.head())
            
            # Test Daily
            df_daily = await scraper.get_market_summary(method='m', period='d')
            if df_daily is not None:
                print("Daily Market Summary Sample:")
                print(df_daily.head())
        else:
            print("Verification RESULT: FAILED")
    finally:
        await scraper.close()

if __name__ == "__main__":
    asyncio.run(verify_credentials())
