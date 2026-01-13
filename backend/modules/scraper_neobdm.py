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
            
            # CRITICAL FIX: Hard reload to clear ALL Dash state (especially after long daily scraping)
            print(f"   [SYNC] Performing hard refresh to clear state...", flush=True)
            await self.page.goto(target_url, wait_until='networkidle', timeout=60000)
            
            # Additional: Reload again to ensure no cached Dash callbacks
            await self.page.reload(wait_until='networkidle', timeout=60000)
            
            # DEBUG: Check where we actually are
            current_url = self.page.url
            current_title = await self.page.title()
            print(f"   [DEBUG] Current URL: {current_url}", flush=True)
            print(f"   [DEBUG] Current OK Title: {current_title}", flush=True)

            # Wait for main controls (Chart might be slow, but controls should appear)
            await self.page.wait_for_selector('#summary-mode', state='visible', timeout=20000)
            
            # Clear any existing table state by scrolling to top
            await self.page.evaluate("window.scrollTo(0, 0);")
            await asyncio.sleep(2)
            
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
            # CRITICAL: Extended wait especially for cumulative after daily (Dash needs time to clear old pagination state)
            await asyncio.sleep(12) # Increased from 8 to 12 seconds for full Dash re-render

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
            await asyncio.sleep(5)
            
        except Exception as e:
            print(f"Error toggling checkboxes: {e}")

        # Wait for the Dash table to load or refresh
        # CRITICAL FIX: Wait for ALL loading indicators to complete
        print("  [LOADING] Waiting for Dash to complete rendering...")
        
        # 1. Wait for primary loading spinner (dash-spreadsheet)
        try:
            await self.page.wait_for_selector('.dash-spreadsheet-inner.dash-loading', timeout=2000)
            print("  [LOADING] Primary spinner detected, waiting for it to hide...")
            await self.page.wait_for_selector('.dash-spreadsheet-inner.dash-loading', state='hidden', timeout=30000)
        except:
            pass
        
        # 2. Wait for global Dash loading overlay (sometimes appears for heavy calculations)
        try:
            await self.page.wait_for_selector('._dash-loading-callback', timeout=2000)
            print("  [LOADING] Global Dash callback spinner detected, waiting...")
            await self.page.wait_for_selector('._dash-loading-callback', state='hidden', timeout=30000)
        except:
            pass
        
        # 3. Additional hard wait to let pagination info update (CRITICAL for cumulative)
        print("  [LOADING] Waiting additional time for pagination to update...")
        await asyncio.sleep(8)  # Give Dash extra time to update pagination counter

        # 4. Wait for the table row content to be present and STABLE
        # Issue: Dash might show old rows for a split second before clearing/updating.
        # Fix: Wait for at least 10 rows if we expect data, or wait for stability
        print("  Waiting for table rows...")
        try:
            # Basic wait for any cell
            await self.page.wait_for_selector('.dash-cell', timeout=20000)
            
            # Additional wait to ensure it's not the old table or empty skeleton
            # We poll the row count until it stabilizes or > 5
            for _ in range(10): # Try for 5 seconds
                row_count = await self.page.locator('.dash-spreadsheet-container tr').count()
                if row_count > 5:
                    break
                await asyncio.sleep(0.5)
            
            # One final hard wait to let Dash render everything
            await asyncio.sleep(2)
            
        except Exception as e:
             print(f"  Warning: waiting for rows timed out: {e}")

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

        # Detect total pages with retry loop - wait for container to be VISIBLE, not just present
        # CRITICAL: After Daily scraping, Cumulative needs MORE time for Dash to reset pagination
        for attempt in range(15):  # Increased from 10 to 15 attempts (up to 75 seconds total)
            try:
                # Wait for pagination container to be VISIBLE (not just present)
                await self.page.wait_for_selector('.previous-next-container', state='visible', timeout=10000)
                
                # Additional check: Ensure the pagination is NOT from the old/previous data
                # by waiting for any loading indicators to finish
                try:
                    await self.page.wait_for_selector('.dash-loading', state='hidden', timeout=2000)
                except:
                    pass  # No loading indicator found, which is fine
                
                total_pages_text = await self.page.inner_text('.page-number .last-page')
                clean_text = total_pages_text.strip().split('/')[-1].strip()
                
                if clean_text and clean_text.isdigit():
                    total_pages = int(clean_text)
                    if total_pages > 0:
                        print(f"   [PAGINATION] Total pages detected: {total_pages} (Attempt {attempt+1})", flush=True)
                        
                        # Additional verification: Check if next button state matches expected pages
                        next_btn = self.page.locator('button.next-page')
                        is_next_enabled = await next_btn.is_enabled() if await next_btn.count() > 0 else False
                        
                        # If total_pages > 1, next button SHOULD be enabled
                        if total_pages > 1 and not is_next_enabled:
                            print(f"   [PAGINATION] WARNING: {total_pages} pages detected but next button disabled. Retrying...", flush=True)
                            await asyncio.sleep(5)
                            continue
                        
                        # Pagination looks good, proceed
                        break
                        
                print(f"   [PAGINATION] Waiting for total pages text... (Attempt {attempt+1})", flush=True)
                await asyncio.sleep(5)  # Increased from 3 to 5 seconds
            except Exception as e:
                # Don't print full error every time, just on last attempt
                if attempt >= 7:
                    print(f"   [PAGINATION] Detection attempt {attempt+1} failed: {e}", flush=True)
                await asyncio.sleep(3)
        else:
            print(f"   [PAGINATION] Could not detect total pages after retries, defaulting to 1", flush=True)

        while current_page <= total_pages:
            print(f"Scraping page {current_page} of {total_pages}...")
            
            # Extract current page data
            page_data = await self.page.evaluate(r"""
                () => {
                    const headers = Array.from(document.querySelectorAll('.dash-header span'))
                        .map(s => s.innerText.trim())
                        .filter(s => s.length > 0);
                        
                    const allTrs = Array.from(document.querySelectorAll('tr')).filter(tr => tr.querySelector('.dash-cell'));
                    
                    const cleanText = (str) => {
                        if (!str) return '';
                        let clean = str.replace(/\|?Add\s+.*?to\s+Watchlist/gi, '').trim();
                        clean = clean.replace(/\|?Remove\s+from\s+Watchlist/gi, '').trim();
                        // Remove leading/trailing pipe symbols
                        clean = clean.replace(/^\|+|\|+$/g, '').trim();
                        return clean;
                    };

                    return allTrs.map(tr => {
                        const allCells = Array.from(tr.querySelectorAll('td, th'));
                        const cells = allCells.slice(-headers.length);
                        
                        let rowData = {};
                        headers.forEach((header, index) => {
                            if (cells[index]) {
                                let rawText = cells[index].textContent.trim();
                                let text = cleanText(rawText);
                                
                                // Enhanced Extraction: Check for title/tooltip
                                // This solves "Value Extraction" by grabbing hidden details in hover states
                                let rawTooltip = cells[index].getAttribute('title');
                                if (!rawTooltip) {
                                    const child = cells[index].querySelector('[title]');
                                    if (child) rawTooltip = child.getAttribute('title');
                                }
                                
                                let tooltip = cleanText(rawTooltip);
                                
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

    async def get_broker_summary(self, ticker: str, date_str: str):
        """
        Scrapes the Broker Summary table for a specific ticker and date.
        date_str: 'YYYY-MM-DD'
        """
        if not self.page:
            return None, None

        try:
            target_url = f"{self.base_url}/broker_summary/"
            
            # Optimization: Only navigate if NOT already on the page
            if self.page.url != target_url:
                print(f"   [SYNC] Navigating to {target_url}...", flush=True)
                await self.page.goto(target_url, wait_until='networkidle', timeout=60000)
                # Wait for main controls initially
                await self.page.wait_for_selector('.Select-control', state='visible', timeout=20000)
            else:
                print(f"   [SYNC] Already on {target_url}, skipping navigation.", flush=True)

            # 1. Select Ticker
            print(f"   [SYNC] Selecting ticker {ticker}...", flush=True)
            try:
                # Based on subagent success: click control, type, click option
                await self.page.click('.Select-control', force=True)
                await asyncio.sleep(1)
                await self.page.keyboard.type(ticker)
                await asyncio.sleep(2)
                
                # Check for the option and click it
                option_selector = f".Select-option:has-text('{ticker}')"
                await self.page.wait_for_selector(option_selector, timeout=5000)
                await self.page.click(option_selector, force=True)
                print(f"   [SYNC] Successfully selected {ticker} from dropdown.")
            except Exception as e:
                print(f"   [WARNING] Ticker selection sequence issue: {e}. Trying simple Enter.")
                await self.page.keyboard.press('Enter')
            
            await asyncio.sleep(2)
            # Click away to ensure dropdown is closed
            await self.page.click('body', force=True)
            await asyncio.sleep(1)

            # 2. Set Date
            print(f"   [SYNC] Setting date to {date_str}...", flush=True)
            # Use evaluate to set the date value (as done by subagent)
            await self.page.evaluate(f"""
                (date) => {{
                    const dateInput = document.getElementById('broksum-date');
                    if (dateInput) {{
                        dateInput.value = date;
                        dateInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        dateInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    }}
                }}
            """, date_str)
            
            # THE MAGIC NUDGE: Right Arrow (as discovered by subagent)
            print("   [SYNC] Nudging with Right Arrow to trigger Dash update...")
            await asyncio.sleep(2)
            await self.page.click('#right-button', force=True)
            await asyncio.sleep(5) 

            # 3. Wait for data to load
            print("  [LOADING] Waiting for data to render...")
            
            # Helper to check if any data row exists
            async def data_present():
                return await self.page.locator('.dash-cell').count() > 0

            # Final check/wait
            if not await data_present():
                 print("   [LOADING] Data not yet present, trying one more nudge...")
                 await self.page.click('#left-button', force=True)
                 await asyncio.sleep(2)
                 await self.page.click('#right-button', force=True)
                 await asyncio.sleep(5)

            await asyncio.sleep(2)

            # 4. Extract Data
            print("   [DATA] Extracting rows from tables...")
            data = await self.page.evaluate(r"""
                () => {
                    const normalize = (text) => text.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
                    const headerKey = (header, avgKey) => {
                        const norm = normalize(header);
                        if (!norm) return null;
                        if (norm.includes('broker') || norm === 'brk') return 'broker';
                        if (norm.includes('nlot') || norm.includes('netlot') || norm === 'lot') return 'nlot';
                        if (norm.includes('nval') || norm.includes('netval') || norm === 'val' || norm.includes('value')) return 'nval';
                        if (norm.includes('bavg') || norm.includes('savg') || norm.includes('avg')) return avgKey;
                        return null;
                    };

                    const dedupeConsecutive = (items) => {
                        const result = [];
                        for (const item of items) {
                            if (result.length === 0 || result[result.length - 1] !== item) {
                                result.push(item);
                            }
                        }
                        return result;
                    };

                    const extract = (table, avgKey) => {
                        if (!table) return [];
                        const headers = Array.from(table.querySelectorAll('th, .dash-header span'))
                            .map(s => s.innerText.trim())
                            .filter(s => s.length > 0);

                        // Find data rows - rows that contain .dash-cell
                        const rows = Array.from(table.querySelectorAll('tr')).filter(tr => tr.querySelector('.dash-cell'));
                        const cellCount = rows.length ? rows[0].querySelectorAll('td.dash-cell').length : 0;
                        const dedupedHeaders = dedupeConsecutive(headers);
                        let effectiveHeaders = headers;
                        if (cellCount && dedupedHeaders.length === cellCount) {
                            effectiveHeaders = dedupedHeaders;
                        } else if (cellCount && headers.length > cellCount) {
                            effectiveHeaders = headers.slice(headers.length - cellCount);
                        }
                        const keyMap = effectiveHeaders.map(h => headerKey(h, avgKey));
                        
                        return rows.map(tr => {
                            const cells = Array.from(tr.querySelectorAll('td.dash-cell'));
                            let rowData = {};
                            keyMap.forEach((key, index) => {
                                if (key && cells[index]) {
                                    rowData[key] = cells[index].textContent.trim();
                                }
                            });
                            return rowData;
                        }).filter(r => r.broker && r.broker.length > 0);
                    };

                    const isBrokerTable = (table) => {
                        const headers = Array.from(table.querySelectorAll('th, .dash-header span'))
                            .map(h => h.innerText.trim());
                        const keys = headers.map(h => headerKey(h, 'avg')).filter(Boolean);
                        return keys.includes('broker') && (keys.includes('nlot') || keys.includes('nval'));
                    };

                    const allTables = Array.from(document.querySelectorAll('table'));
                    const candidateTables = allTables.filter(isBrokerTable);
                    const dashTables = Array.from(document.querySelectorAll('.dash-spreadsheet-container table'));

                    const tables = candidateTables.length >= 2 ? candidateTables : dashTables;
                    if (tables.length < 2) return null;

                    return {
                        buy: extract(tables[0], 'bavg'),
                        sell: extract(tables[1], 'savg')
                    };
                }
            """)

            if not data or (not data['buy'] and not data['sell']):
                # Final attempt: just grab all dash-cells and group them by 4
                print("   [DATA] Specific table match failed. Trying generic cell extraction...")
                data = await self.page.evaluate("""
                    () => {
                        const cells = Array.from(document.querySelectorAll('td.dash-cell'));
                        if (cells.length === 0) return null;
                        
                        // Usually 4 columns: broker, nlot, nval, avg
                        const rows = [];
                        for (let i = 0; i < cells.length; i += 4) {
                            rows.push({
                                broker: cells[i] ? cells[i].textContent.trim() : '',
                                nlot: cells[i+1] ? cells[i+1].textContent.trim() : '',
                                nval: cells[i+2] ? cells[i+2].textContent.trim() : '',
                                avg: cells[i+3] ? cells[i+3].textContent.trim() : ''
                            });
                        }
                        
                        // If we have rows, split them (left table for BUY, right table for SELL)
                        // This assumes the tables are rendered sequentially in the DOM
                        const firstSellIndex = rows.findIndex((r, idx) => idx > 0 && r.broker === rows[0].broker);
                        // Actually, better: just split in half if we have two headers
                        // In the screenshot, they are two separate tables but cells might be flat
                        
                        // Let's just return a flat list if we can't distinguish, 
                        // but the headers approach usually works.
                        return null; // Let the caller decide or retry
                    }
                """)
                if not data:
                    print(f"   [DATA] No broker summary data found for {ticker} on {date_str}")
                    return None

            print(f"   [DATA] Extracted {len(data['buy'])} buy rows and {len(data['sell'])} sell rows.")
            return data

        except Exception as e:
            print(f"   [ERROR] Failed to scrape broker summary: {e}")
            return None

    async def get_broker_summary_batch(self, tasks: list):
        """
        Execute multiple broker summary scrapes in a single session.
        tasks format: [{"ticker": "ANTM", "dates": ["2026-01-12", "2026-01-11"]}, ...]
        """
        if not self.page:
            return []

        results = []
        try:
            # Login once
            login_success = await self.login()
            if not login_success:
                return [{"error": "Login failed"}]

            # Navigate once
            target_url = f"{self.base_url}/broker_summary/"
            await self.page.goto(target_url, wait_until='networkidle', timeout=60000)
            await self.page.wait_for_selector('.Select-control', state='visible', timeout=20000)

            for task in tasks:
                ticker = task.get('ticker')
                dates = task.get('dates', [])
                
                for date_str in dates:
                    print(f"[*] Batch Sync: Processing {ticker} for {date_str}...")
                    data = await self.get_broker_summary(ticker, date_str)
                    
                    if data:
                        results.append({
                            "ticker": ticker,
                            "trade_date": date_str,
                            "buy": data.get('buy', []),
                            "sell": data.get('sell', [])
                        })
                    else:
                        print(f"[!] Batch Sync: No data found for {ticker} on {date_str}")
                    
                    # Small cooldown between ticker/date changes to let Dash breathe
                    await asyncio.sleep(2)

            return results

        except Exception as e:
            print(f"[!] Critical error in Batch Sync: {e}")
            return results

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
            df_cum, ref_date_cum = await scraper.get_market_summary(method='m', period='c')
            if df_cum is not None:
                print(f"Cumulative Market Summary Sample (Date: {ref_date_cum}):")
                print(df_cum.head())
            
            # Test Daily
            df_daily, ref_date_daily = await scraper.get_market_summary(method='m', period='d')
            if df_daily is not None:
                print(f"Daily Market Summary Sample (Date: {ref_date_daily}):")
                print(df_daily.head())
        else:
            print("Verification RESULT: FAILED")
    finally:
        await scraper.close()

if __name__ == "__main__":
    import sys
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(verify_credentials())
