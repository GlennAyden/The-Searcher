import requests
from bs4 import BeautifulSoup
import time
import random
import re
from datetime import datetime, timedelta
import pytz
from modules.utils import extract_tickers, clean_text_regex
from modules.database import DatabaseManager

# --- CONFIG & CONSTANTS ---
JAKARTA_TZ = pytz.timezone('Asia/Jakarta')

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Referer": "https://www.google.com/"
}

MONTH_MAP = {
    'Januari': '01', 'Februari': '02', 'Maret': '03', 'April': '04', 'Mei': '05', 'Juni': '06',
    'Juli': '07', 'Agustus': '08', 'September': '09', 'Oktober': '10', 'November': '11', 'Desember': '12',
    'January': '01', 'February': '02', 'March': '03', 'May': '05', 'June': '06', 
    'July': '07', 'August': '08', 'October': '10', 'December': '12' 
}

def parse_relative_time(date_str):
    """
    Parses 'Relative Time' from the index page for filtering ESTIMATION.
    Formats:
    - "Baru saja" / "Just now"
    - "5 menit yang lalu" / "5 minutes ago"
    - "2 jam yang lalu" / "2 hours ago"
    - "1 hari yang lalu" / "1 day ago"
    - "17 December 2025" (Absolute fallback)
    
    Returns: datetime object (aware, Asia/Jakarta)
    """
    if not date_str:
        return datetime.now(JAKARTA_TZ)
        
    now = datetime.now(JAKARTA_TZ)
    text = date_str.strip().lower()

    try:
        if "baru saja" in text or "just now" in text:
            return now

        # "X menit yang lalu"
        minutes_match = re.search(r'(\d+)\s+menit', text)
        if minutes_match:
            mins = int(minutes_match.group(1))
            return now - timedelta(minutes=mins)

        # "X jam yang lalu"
        hours_match = re.search(r'(\d+)\s+jam', text)
        if hours_match:
            hours = int(hours_match.group(1))
            return now - timedelta(hours=hours)
            
        # "X hari yang lalu"
        days_match = re.search(r'(\d+)\s+hari', text)
        if days_match:
            days = int(days_match.group(1))
            return now - timedelta(days=days)

        # Fallback: Absolute Date Parsing (Index sometimes has it)
        # Try to parse "17 December 2025"
        clean_date = text
        for id_mon, id_num in MONTH_MAP.items():
            if id_mon.lower() in clean_date:
                clean_date = clean_date.replace(id_mon.lower(), id_num)
                break
        
        # Try "17 12 2025"
        try:
             # Try YYYY/MM/DD if meta-like, but usually UI text is Day Month Year
             return datetime.strptime(clean_date, "%d %m %Y").replace(hour=0, minute=0, second=0, microsecond=0).astimezone(JAKARTA_TZ)
        except:
             pass
             
        # Catch-all
        try:
             dt = datetime.strptime(clean_date, "%d %B %Y")
             return dt.astimezone(JAKARTA_TZ)
        except:
             pass
             
        # If all fails, assume NOW (safest execution, let detail page correct it)
        # print(f"[-] Date parse warning (Index): Could not parse '{date_str}'. Defaulting to NOW.")
        return now

    except Exception as e:
        print(f"[-] Date parse error: {e}")
        return now


class CNBCScraper:
    BASE_URL = "https://www.cnbcindonesia.com/market/indeks/5"
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.news_data = []

    def get_article_detail(self, url, estimated_date):
        """
        Fetches the full content AND precise date.
        
        Logic:
        1. Fetch content.
        2. Find absolute date string (The Truth).
        3. Validates against 'estimated_date' (optional, mainly just uses Truth).
        
        Returns: Dict or None
        """
        try:
            # Delay
            time.sleep(random.uniform(0.5, 1.0))
            
            resp = self.session.get(url, timeout=10)
            soup = BeautifulSoup(resp.text, 'html.parser')

            # 1. Title
            h1 = soup.find('h1')
            title = h1.text.strip() if h1 else ""

            # 2. Date Extraction (The Source of Truth)
            # Find element with date class
            date_element = soup.find('div', class_='date')
            final_date = estimated_date # Default fallback
            
            if date_element:
                date_text = date_element.text.strip() # "17 December 2025 10:20"
                # Parse logic
                try:
                    # Clean Indonesian text usually "Market - CNBC Indonesia TV, 17 December 2025 10:20" or just "17 December 2025 10:20"
                    # Often format: "17 December 2025 10:20"
                    # Handle Indonesian months
                    clean_dt_text = date_text
                    for id_mon, id_num in MONTH_MAP.items():
                        if id_mon in clean_dt_text: # Case sensitive map match
                            clean_dt_text = clean_dt_text.replace(id_mon, id_num)
                    
                    # Regex extract date pattern DD MM YYYY HH:MM
                    match = re.search(r'(\d{1,2})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2})', clean_dt_text)
                    if match:
                        d, m, y, H, M = map(int, match.groups())
                        final_date = datetime(y, m, d, H, M, 0).astimezone(JAKARTA_TZ)
                except Exception as e:
                    print(f"    [-] Detail Date Parse Error: {e} -> using estimated")

            # 3. Content Extraction
            content_div = soup.find(class_='detail_text')
            content_text = ""
            if content_div:
                for ignored in content_div(["script", "style", "iframe", "div", "a"]): 
                    ignored.extract()
                content_text = "\n".join([p.text.strip() for p in content_div.find_all('p') if p.text.strip()])
                content_text = clean_text_regex(content_text)
            
            # 4. Tickers
            tickers = extract_tickers(title)
            if not tickers:
                tickers = extract_tickers(content_text[:1000])

            return {
                'title': title,
                'url': url,
                'date': final_date, # This is a datetime object
                'timestamp': final_date.isoformat(),
                'summary': content_text[:300] + "...",
                'ticker': ", ".join(tickers),
                'source': 'CNBC Indonesia'
            }

        except Exception as e:
            print(f"[-] Detail error {url}: {e}")
            return None

    def run(self, start_date, end_date=None, pages=50):
        """
        Hybrid Scraper:
        1. Index: Fast Filter using Relative Time (Stop if too old).
        2. Detail: Precise Date (Use for final check).
        """
        # Normalize targets to date objects (no time) for inclusive comparison
        target_start = start_date.date() if isinstance(start_date, datetime) else start_date
        target_end = end_date.date() if isinstance(end_date, datetime) else end_date

        print(f"[*] CNBC Hybrid Scraper: Target {target_start} -> {target_end}")
        
        # Incremental Scraping Setup
        db = DatabaseManager()
        existing_urls = db.get_all_urls()
        print(f"[*] Loaded {len(existing_urls)} existing URLs from DB for incremental check.")
        
        self.news_data = []
        
        page = 1
        stop_scraping = False
        worthless_streak = 0
        
        while page <= pages and not stop_scraping:
            target_url = f"{self.BASE_URL}?page={page}" if page > 1 else self.BASE_URL
            print(f"[*] Index Page {page}: {target_url}")
            
            try:
                resp = self.session.get(target_url, timeout=10)
                soup = BeautifulSoup(resp.text, 'html.parser')
                
                # Container: <article>
                articles = soup.find_all('article')
                if not articles:
                    print("[-] No articles found. Stopping.")
                    break
                
                valid_articles_found = 0
                # duplicate_count removed, replaced by cross-page worthless_streak
                
                for art in articles:
                    # 1. Link Extraction
                    a_tag = art.find('a')
                    if not a_tag or 'href' not in a_tag.attrs:
                        continue
                    link = a_tag['href']
                    if not link.startswith('http') or 'cnbcindonesia.com' not in link:
                        continue
                        
                    # 1.5 INCREMENTAL CHECK (Optimize)
                    if link in existing_urls:
                        worthless_streak += 1
                        print(f"    [SKIP] URL already exists: {link} ({worthless_streak}/10)")
                        if worthless_streak >= 10:
                            print(f"    [STOP] Found 10 consecutive worthless items (existing/noise). Stopping.")
                            stop_scraping = True
                            break
                        continue
                        
                    # 2. Index Time Estimation (Fast Filter)
                    # Try to find date span
                    date_span = art.find('span', class_='text-gray') # Try this class first
                    if not date_span:
                         # Fallback: find any span that looks like date? 
                         # Actually usually inside .box_text or similar. 
                         # Let's rely on text search if specific class fails?
                         # Or just capture text below title?
                         pass
                    
                    raw_date_str = date_span.text.strip() if date_span else ""
                    estimated_dt = parse_relative_time(raw_date_str)
                    estimated_date_val = estimated_dt.date()
                    
                    # 3. Decision Gate (Index Level)
                    
                    # A. Too Old? -> STOP (Time is descending)
                    if estimated_date_val < target_start:
                        # Allow a small buffer? Relative time might be slightly off ("1 day ago" vs "23 hours ago")
                        # "1 day ago" means >= 24h. If today is 17th, 1 day ago could be 16th or 15th late night.
                        # Strict inequality is safe if we trust sort order.
                        print(f"    [STOP] Index Date {estimated_date_val} < Start {target_start} ({raw_date_str})")
                        stop_scraping = True
                        break
                        
                    # B. Too New? -> SKIP
                    if target_end and estimated_date_val > target_end:
                         # print(f"    [SKIP] Newer: {estimated_date_val}")
                         continue
                         
                    # --- NOISE FILTER STEP 1: KEYWORD BLACKLIST (FAST FAIL) ---
                    # We need the title for this. Try to get it from index if possible.
                    index_title_tag = art.find('h2') # CNBC index usually has h2 for title
                    index_title = index_title_tag.text.strip() if index_title_tag else ""
                    
                    from modules.utils import is_blacklisted, has_whitelist_keywords
                    
                    is_bad, reason = is_blacklisted(index_title, link)
                    if is_bad:
                        worthless_streak += 1
                        print(f"    [SKIP-Noise] Blacklisted: {reason} | Title: {index_title[:40]} ({worthless_streak}/10)")
                        if worthless_streak >= 10:
                            print(f"    [STOP] Found 10 consecutive worthless items (existing/noise). Stopping.")
                            stop_scraping = True
                            break
                        continue
                    # -------------------------------------------------------------

                    # C. In Range (Estimasi) -> PROCESS DETAIL
                    # print(f"    [>] Fetching Detail: {link}...")
                    details = self.get_article_detail(link, estimated_dt)
                    
                    if details:
                        final_dt = details['date']
                        final_date_val = final_dt.date()
                        
                        # 4. Double Check (Detail Level)
                        if final_date_val < target_start:
                            # It actually turned out to be old
                            print(f"    [SKIP] Detail Date {final_date_val} too old.")
                            continue
                            
                        if target_end and final_date_val > target_end:
                            print(f"    [SKIP] Detail Date {final_date_val} too new.")
                            continue
                            
                        # --- NOISE FILTER STEP 2: ENTITY VALIDATION (GATEKEEPER) ---
                        # Check tickers from details
                        article_tickers = details.get('ticker', [])
                        article_title = details.get('title', "")
                        article_summary = details.get('summary', "")
                        
                        # Convert string ticker "BBRI.JK, BMRI.JK" to list if needed (it comes as string from get_article_detail?)
                        # get_article_detail returns "BBRI.JK, BMRI.JK" string.
                        detected_tickers_list = [t.strip() for t in article_tickers.split(",")] if article_tickers else []
                        detected_tickers_list = [t for t in detected_tickers_list if t] # Filter empty
                        
                        if not detected_tickers_list:
                            # NO TICKER detected. Check Whitelist.
                            # Check Title + Summary for whitelist keywords
                            text_to_check = article_title + " " + article_summary
                            if not has_whitelist_keywords(text_to_check):
                                worthless_streak += 1
                                print(f"    [SKIP-Noise] No Ticker & No Whitelist: {article_title[:40]} ({worthless_streak}/10)")
                                if worthless_streak >= 10:
                                    print(f"    [STOP] Found 10 consecutive worthless items (existing/noise). Stopping.")
                                    stop_scraping = True
                                    break
                                continue
                            else:
                                pass
                                # pro: print(f"    [KEEP] Whitelist Match (No Ticker): {article_title[:40]}...")
                        # -----------------------------------------------------------
                            
                        # Success - RESET STREAK
                        worthless_streak = 0
                        self.news_data.append(details)
                        valid_articles_found += 1
                        print(f"       [OK] [{final_date_val}] {details['title'][:50]}...")
                
                print(f"    -> Page {page} finished. Valid articles: {valid_articles_found}")
                page += 1
                
            except Exception as e:
                print(f"[-] Index Error page {page}: {e}")
                page += 1
                
        print(f"[*] Scraping Completed. Raw Total: {len(self.news_data)}")
        
        # --- SENTIMENT ANALYSIS INTEGRATION ---
        # As requested: Scraper calls analyzer
        if self.news_data:
            try:
                from modules.analyzer import SentimentEngine
                print("[*] Running Sentiment Analysis from Scraper...")
                engine = SentimentEngine()
                analyzed_data = engine.process_and_save(self.news_data)
                return analyzed_data
            except Exception as e:
                print(f"[!] Analysis Error in Scraper: {e}")
                return self.news_data # Fallback to raw if analysis fails
        
        return []


if __name__ == "__main__":
    # Test
    s = CNBCScraper()
    # Test last 2 days
    start = datetime.now() - timedelta(days=2)
    end = datetime.now()
    res = s.run(start, end, pages=2)
