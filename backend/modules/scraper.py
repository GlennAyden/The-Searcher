import requests
from bs4 import BeautifulSoup
import trafilatura
import json
import time
import os
import config
from concurrent.futures import ThreadPoolExecutor, as_completed
from modules.utils import clean_text_regex, extract_tickers
from datetime import datetime, date
from modules.database import DatabaseManager

class NewsScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": config.USER_AGENT})
        self.news_data = []
        self.db = DatabaseManager() # Initialize DB connection

    def get_links(self, pages=3):
        """Crawls pagination to discover links."""
        # This method is used by run(), but we can also optimize it if needed.
        # For now, keeping sequential link discovery as it's fast enough compared to content extraction.
        unique_links = set()
        print(f"[*] Starting link discovery for {pages} pages on {config.BASE_URL}...")
        
        for i in range(1, pages + 1):
            links = self.get_links_from_page(i)
            unique_links.update(links)
        
        print(f"[*] Found {len(unique_links)} unique links.")
        return list(unique_links)

    def get_links_from_page(self, page_num):
        """Extracts news links from a specific page number."""
        offset = (page_num - 1) * 9
        if page_num == 1:
            url = config.BASE_URL
        else:
            url = f"{config.BASE_URL}/{offset}"
            
        print(f" [DEBUG] Fetching: {url}")
        
        links = set()
        try:
            resp = self.session.get(url, timeout=10)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, 'html.parser')
                found = soup.find_all('a', href=True)
                for link in found:
                    href = link['href']
                    if "/news/" in href:
                         if href.startswith("/"):
                             href = "https://www.emitennews.com" + href
                         links.add(href)
        except Exception as e:
            print(f" [!] Error crawling page {page_num}: {e}")
        return list(links)

    def process_single_url(self, url):
        """
        Process a single URL: Fetch -> Extract -> Parse Date -> Clean -> Ticker.
        Returns the article dictionary or None if failed.
        NO DB OPERATIONS HERE.
        """
        try:
            downloaded = trafilatura.fetch_url(url)
            if not downloaded:
                return None
            
            # Use Trafilatura for robust extraction
            result = trafilatura.extract(
                downloaded, 
                include_comments=False,
                include_tables=False,
                no_fallback=False, 
                output_format='json',
                with_metadata=True
            )
            
            if result:
                data = json.loads(result)
                
                # Fallback Title
                if not data.get('title'):
                    resp = self.session.get(url, timeout=10)
                    s = BeautifulSoup(resp.text, 'html.parser')
                    t = s.find('h1')
                    if t:
                        data['title'] = t.get_text(strip=True)

                # Fallback Timestamp
                if not data.get('date'):
                    resp = self.session.get(url, timeout=10)
                    s = BeautifulSoup(resp.text, 'html.parser')
                    time_span = s.select_one('span.time-posted')
                    if time_span:
                        data['date'] = time_span.get_text(strip=True)
                    else:
                        data['date'] = time.strftime("%Y-%m-%d") # Default to today
                
                # Check date validity parsing
                timestamp = data.get('date')
                try:
                    # Normalize timestamp for easier usage later
                    if timestamp and "T" in timestamp:
                        pass # ISO format is fine
                    elif timestamp:
                        # Try to ensure YYYY-MM-DD
                        pass 
                except:
                    pass

                # Clean text
                clean_text = clean_text_regex(data.get('text', ''))
                
                # Extract Tickers
                title = data.get('title', '')
                tickers = extract_tickers(title)
                
                return {
                    "timestamp": timestamp,
                    "title": title,
                    "url": url,
                    "clean_text": clean_text,
                    "ticker": tickers # Added ticker field
                }
            
        except Exception as e:
            print(f" [!] Error extraction {url}: {e}")
            return None
        
        return None

    def run_date_range(self, start_date, end_date):
        """
        Scrapes news within a specific date range using Parallel Execution.
        """
        # Ensure dates are date objects
        if isinstance(start_date, datetime): start_date = start_date.date()
        if isinstance(end_date, datetime): end_date = end_date.date()
        
        print(f"[*] Starting Time Machine Scraper (Parallel): {start_date} to {end_date}")
        
        extracted_articles = []
        page = 1
        stop_scraping = False
        prev_links_set = set()
        
        while not stop_scraping:
            print(f" -> Scanning Page {page}...")
            links = self.get_links_from_page(page)
            current_links_set = set(links)
            
            # GHOST PAGINATION CHECK
            if not current_links_set:
                print(" [!] No links found on this page. Ending.")
                break
                
            if current_links_set == prev_links_set:
                print(f" [-] Ghost Pagination Detected! Page {page} has same content. Stopping.")
                break
            
            prev_links_set = current_links_set
            
            # 1. Prepare URLs to scrape (Filter Existing in DB)
            urls_to_scrape = []
            for url in links:
                if not self.db.check_url_exists(url):
                    urls_to_scrape.append(url)
            
            if not urls_to_scrape:
                print("  [i] All links on this page already exist in DB.")
                # We don't stop here, we just continue to next page unless empty
            else:
                print(f"  [+] Scaping {len(urls_to_scrape)} new URLs with ThreadPool...")
                
                # 2. Parallel Processing
                batch_results = []
                with ThreadPoolExecutor(max_workers=5) as executor:
                    future_to_url = {executor.submit(self.process_single_url, url): url for url in urls_to_scrape}
                    
                    for future in as_completed(future_to_url):
                        processed_data = future.result()
                        if processed_data:
                            batch_results.append(processed_data)

                # 3. Post-Process & Date Check
                processed_on_page = 0
                for article in batch_results:
                    # Parse Date for filtering
                    try:
                        art_date_str = article['timestamp']
                        if "T" in art_date_str:
                            art_date = datetime.fromisoformat(art_date_str).date()
                        else:
                            art_date = datetime.strptime(art_date_str, "%Y-%m-%d").date()
                    except:
                        # If date parse fails, keep it or skip? Let's keep, assume recent.
                         art_date = date.today()

                    if art_date > end_date:
                        continue # Skip future/out of range
                    elif art_date < start_date:
                        print(f"  [Stop] Found article from {art_date} (Target Start: {start_date}). Stopping.")
                        stop_scraping = True
                        # Don't break immediately, we might want to save valid ones in this batch
                        # But we won't go to next page
                    else:
                        extracted_articles.append(article)
                        processed_on_page += 1
                
                print(f"  [+] Added {processed_on_page} articles from this page.")

            page += 1
            if page > 50: 
                print("  [!] Reached Max Page limit (50). Stopping.")
                break
                
        return extracted_articles

    def run(self, pages=1):
        """
        Main execution method (Simple mode).
        Refactored to also use Parallel Processing.
        """
        links = self.get_links(pages)
        print(f"[*] Extracting content from {len(links)} links (Parallel)...")
        
        processed_count = 0
        self.news_data = [] # Reset
        
        # Parallel logic
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_url = {executor.submit(self.process_single_url, url): url for url in links}
            
            for future in as_completed(future_to_url):
                article = future.result()
                if article:
                    self.news_data.append(article)
                    processed_count += 1
                    print(f"  -> Processed: {article.get('title')[:30]}...")
        
        return self.news_data
