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

class EmitenNewsScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": config.USER_AGENT})
        self.news_data = []
        self.db = DatabaseManager() # Initialize DB connection

    def get_links(self, pages=3):
        """Crawls pagination to discover links."""
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

    def run(self, start_date, end_date):
        """
        Scrapes news within a specific date range using Parallel Execution.
        Standardized method name: run(start_date, end_date)
        """
        # Ensure dates are date objects
        if isinstance(start_date, datetime): start_date = start_date.date()
        if isinstance(end_date, datetime): end_date = end_date.date()
        
        print(f"\n" + "="*60)
        print(" EMITENNEWS SCRAPER")
        print("="*60)
        print(f"   Target Range: {start_date} -> {end_date}")
        print("-"*60)
        
        extracted_articles = []
        page = 1
        stop_scraping = False
        session_seen_urls = set()
        
        while not stop_scraping:
            print(f" -> Scanning Page {page}...")
            links = self.get_links_from_page(page)
            
            # GHOST PAGINATION / REDUNDANCY CHECK
            if not links:
                print(" [!] No links found on this page. Ending.")
                break
                
            # Hitung duplikat di sesi ini
            duplicates_in_page = [url for url in links if url in session_seen_urls]

            # Jika 100% isi halaman ini sudah pernah dilihat di sesi ini
            if len(duplicates_in_page) == len(links) and len(links) > 0:
                print(f"[-] STOP: Semua {len(links)} berita di halaman ini duplikat (Redundancy Limit).")
                print(f"[!] Redundancy detected on Page {page}. Stopping process.")
                break

            # 1. Prepare URLs to scrape (Double Filter: DB + Session Memory)
            # 1. Prepare URLs to scrape (Double Filter: DB + Session Memory)
            urls_to_scrape = []
            db_duplicate_count = 0
            
            for url in links:
                is_in_db = self.db.check_url_exists(url)
                if is_in_db:
                    db_duplicate_count += 1
                    
                # Validasi dua kali: Cek Histori Lama (DB) & Cek Histori Baru (Session)
                if not is_in_db and url not in session_seen_urls:
                    urls_to_scrape.append(url)

            # LOGIKA BARU: STOP JIKA SATU HALAMAN FULL DUPLIKAT DI DB (Known Data Boundary)
            if db_duplicate_count == len(links) and len(links) > 0:
                print(f"[-] Stopping: Halaman {page} sepenuhnya berisi data yang sudah tersimpan (Known Data Boundary).")
                break

            # Update memory
            session_seen_urls.update(links)
            
            if not urls_to_scrape:
                print("  [i] No new links found on this page (All exist in DB or Session). Stopping.")
                break
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
                        print(f"   -> [{art_date}] {article['title'][:50]}...")
                
                print(f"  [+] Added {processed_on_page} articles from this page.")

            page += 1
            if page > 50: 
                print("  [!] Reached Max Page limit (50). Stopping.")
                break
                
        # Existing code returned extracted_articles, but run(pages) returned self.news_data.
        # Let's return extracted_articles to be consistent. 
        self.news_data = extracted_articles
        return extracted_articles
