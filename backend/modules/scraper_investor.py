"""
Investor.id News Scraper.

Scrapes news articles from:
- https://investor.id/corporate-action/indeks
- https://investor.id/market/indeks

Following the same architecture as scraper_bisnis.py with hybrid date filtering.
"""

import requests
from bs4 import BeautifulSoup
import time
import random
import re
from datetime import datetime, timedelta
import pytz
from modules.utils import extract_tickers, clean_text_regex, is_blacklisted, has_whitelist_keywords
from modules.database import DatabaseManager

# --- CONFIG & CONSTANTS ---
JAKARTA_TZ = pytz.timezone('Asia/Jakarta')

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://www.google.com/"
}

# Indonesian month mapping (short forms used on investor.id)
MONTH_MAP = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'mei': '05', 'may': '05', 'jun': '06', 'jul': '07', 
    'agu': '08', 'aug': '08', 'sep': '09', 'okt': '10', 
    'oct': '10', 'nov': '11', 'des': '12', 'dec': '12',
    # Full forms
    'januari': '01', 'februari': '02', 'maret': '03', 'april': '04',
    'juni': '06', 'juli': '07', 'agustus': '08', 'september': '09',
    'oktober': '10', 'november': '11', 'desember': '12'
}


def parse_investor_date(date_str):
    """
    Parses Investor.id date format.
    
    Formats:
    - "24 Jan 2026 | 08:00 WIB"
    - "23 Jan 2026 | 18:13 WIB"
    
    Returns: datetime object (aware, Asia/Jakarta) or None if parsing fails.
    """
    if not date_str:
        return None
    
    try:
        text = date_str.strip().lower()
        
        # Remove "WIB" suffix
        text = text.replace('wib', '').strip()
        
        # Replace Indonesian month names with numbers
        for id_month, num in MONTH_MAP.items():
            if id_month in text:
                text = text.replace(id_month, num)
                break
        
        # Try pattern: "24 01 2026 | 08:00"
        match = re.search(r'(\d{1,2})\s+(\d{1,2})\s+(\d{4})\s*\|\s*(\d{1,2}):(\d{2})', text)
        if match:
            day, month, year, hour, minute = map(int, match.groups())
            dt = datetime(year, month, day, hour, minute, 0)
            return JAKARTA_TZ.localize(dt)
        
        # Try pattern without time: "24 01 2026"
        match = re.search(r'(\d{1,2})\s+(\d{1,2})\s+(\d{4})', text)
        if match:
            day, month, year = map(int, match.groups())
            dt = datetime(year, month, day, 0, 0, 0)
            return JAKARTA_TZ.localize(dt)
            
    except Exception as e:
        print(f"[-] Investor date parse error: {e} | Input: {date_str}")
    
    return None


class InvestorScraper:
    """Scraper for Investor.id news with multi-category support."""
    
    # Multiple index pages to scrape
    BASE_URLS = [
        "https://investor.id/corporate-action/indeks",
        "https://investor.id/market/indeks"
    ]
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.news_data = []
    
    def get_index_page_with_dates(self, base_url, page=1):
        """
        Fetches article links AND dates from index page.
        
        Returns: List of tuples (url, estimated_date, title)
        """
        # Path-based pagination: /indeks/2, /indeks/3
        if page > 1:
            url = f"{base_url}/{page}"
        else:
            url = base_url
        
        try:
            resp = self.session.get(url, timeout=15)
            

            if resp.status_code != 200:
                print(f"[-] Index page {page} returned status {resp.status_code}")
                return []
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            articles = []
            seen_urls = set()
            
            # Find all article links with dates
            # Find main articles container to avoid sidebar
            # Investor.id main column usually has class 'col-9' or similar
            # Strategy: Find valid container with MOST article links
            main_container = None
            max_links_count = 0
            
            # 1. Try Preferred Columns First
            for div in soup.find_all('div', class_=True):
                if any(c in div.get('class', []) for c in ['col-9', 'col-lg-9', 'col-md-9', 'pr-40']):
                    links = div.find_all('a', href=re.compile(r'/[a-zA-Z0-9-]+/\d+'))
                    if len(links) > max_links_count:
                        max_links_count = len(links)
                        main_container = div
            
            # 2. Fallback: If no good preferred column, find ANY dense container
            if max_links_count < 5:
                max_links_count = 0
                main_container = None
                for div in soup.find_all('div', class_=True):
                    links = div.find_all('a', href=re.compile(r'/[a-zA-Z0-9-]+/\d+'))
                    if len(links) > max_links_count:
                         max_links_count = len(links)
                         main_container = div

            # Track source category for logging purposes
            source_category = "corporate-action" if "corporate-action" in base_url else "market"

            search_scope = main_container if main_container else soup
            
            # Find all article links with dates
            for a_tag in search_scope.find_all('a', href=True):
                href = a_tag['href']
                
                # Accept any valid article link (corporate-action, market, or stock)
                # Links from /corporate-action/ page may point to /market/ - this is normal behavior
                if not re.search(r'/(corporate-action|market|stock)/\d+', href):
                    continue
                
                # Skip index pages
                if 'indeks' in href:
                    continue
                
                # Normalize URL
                if href.startswith('/'):
                    href = 'https://investor.id' + href
                
                if href in seen_urls:
                    continue
                seen_urls.add(href)
                
                # Get title
                title = a_tag.get_text(strip=True)
                
                # Find date near this link - IMPROVED
                date_text = ""
                parent = a_tag.find_parent()
                if parent:
                    # 1. Check Parent
                    parent_text = parent.get_text(separator=' ', strip=True)
                    date_match = re.search(r'(\d{1,2}\s+\w+\s+\d{4}\s*\|\s*\d{1,2}:\d{2}\s*WIB)', parent_text, re.I)
                    if date_match:
                        date_text = date_match.group(1)
                    
                    # 2. Check Grandparent (fixes missing dates on deeper pages)
                    if not date_text:
                        grandparent = parent.find_parent()
                        if grandparent:
                            gp_text = grandparent.get_text(separator=' ', strip=True)
                            dm = re.search(r'(\d{1,2}\s+\w+\s+\d{4}\s*\|\s*\d{1,2}:\d{2}\s*WIB)', gp_text, re.I)
                            if dm:
                                date_text = dm.group(1)
                
                # If no date found near link, try to find in siblings
                if not date_text:
                    for sibling in a_tag.find_next_siblings():
                        sib_text = sibling.get_text(strip=True) if sibling else ""
                        if 'WIB' in sib_text or re.search(r'\d{2}:\d{2}', sib_text):
                            date_text = sib_text
                            break
                
                estimated_date = parse_investor_date(date_text)
                if not estimated_date:
                    estimated_date = datetime.now(JAKARTA_TZ)
                
                articles.append((href, estimated_date, title))
            
            return articles
            
        except Exception as e:
            print(f"[-] Error fetching index page {page}: {e}")
            return []
    
    def get_article_detail(self, url, estimated_date=None):
        """
        Fetches and extracts article details.
        
        Returns: Dict with article data or None if failed.
        """
        try:
            time.sleep(random.uniform(0.3, 0.8))  # Polite delay
            
            resp = self.session.get(url, timeout=15)
            if resp.status_code != 200:
                return None
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            # 1. Title
            h1 = soup.find('h1')
            title = h1.get_text(strip=True) if h1 else ""
            
            # 2. Date
            date_text = ""
            
            # Look for date pattern in page
            for elem in soup.find_all(['span', 'time', 'div', 'p']):
                text = elem.get_text(strip=True)
                if re.search(r'\d{1,2}\s+\w+\s+\d{4}\s*\|\s*\d{1,2}:\d{2}\s*WIB', text, re.I):
                    date_text = text
                    break
            
            # Try meta tags
            if not date_text:
                meta_date = soup.find('meta', {'property': 'article:published_time'})
                if meta_date and meta_date.get('content'):
                    try:
                        iso_date = meta_date['content']
                        dt = datetime.fromisoformat(iso_date.replace('Z', '+00:00'))
                        article_date = dt.astimezone(JAKARTA_TZ)
                        date_text = article_date.strftime('%d %b %Y | %H:%M WIB')
                    except:
                        pass
            
            article_date = parse_investor_date(date_text)
            if not article_date:
                article_date = estimated_date or datetime.now(JAKARTA_TZ)
            
            # 3. Content
            content_text = ""
            
            # Find main article content
            content_selectors = [
                'div.post-content',
                'article',
                'div.content',
                'div.entry-content'
            ]
            
            content_div = None
            for selector in content_selectors:
                content_div = soup.select_one(selector)
                if content_div:
                    break
            
            if content_div:
                for tag in content_div.find_all(['script', 'style', 'iframe', 'aside', 'nav', 'div.related']):
                    tag.decompose()
                
                paragraphs = content_div.find_all('p')
                content_text = '\n'.join([p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)])
            
            # Fallback: get all <p>
            if not content_text:
                paragraphs = soup.find_all('p')
                content_text = '\n'.join([p.get_text(strip=True) for p in paragraphs[:15] if p.get_text(strip=True)])
            
            content_text = clean_text_regex(content_text)
            
            # 4. Extract Tickers
            tickers = extract_tickers(title)
            if not tickers:
                tickers = extract_tickers(content_text[:1000])
            
            return {
                'title': title,
                'url': url,
                'date': article_date,
                'timestamp': article_date.isoformat(),
                'clean_text': content_text,
                'summary': content_text[:300] + '...' if len(content_text) > 300 else content_text,
                'ticker': ', '.join(tickers) if tickers else '',
                'source': 'Investor.id'
            }
            
        except Exception as e:
            print(f"[-] Error fetching article {url}: {e}")
            return None
    
    def run(self, start_date, end_date=None, pages=20):
        """
        Main scraper method with multi-category support.
        
        Scrapes from both corporate-action and market categories.
        
        Args:
            start_date: Start date (datetime or date)
            end_date: End date (datetime or date), defaults to now
            pages: Maximum pages per category
            
        Returns:
            List of analyzed article dictionaries
        """
        # Normalize dates
        target_start = start_date.date() if isinstance(start_date, datetime) else start_date
        target_end = end_date.date() if isinstance(end_date, datetime) else (end_date or datetime.now().date())
        
        print("\n" + "="*60)
        print("📈 INVESTOR.ID SCRAPER")
        print("="*60)
        print(f"   Target Range: {target_start} → {target_end}")
        print(f"   Max Pages per Category: {pages}")
        
        # Load existing URLs
        db = DatabaseManager()
        existing_urls = set(db.get_all_urls())
        print(f"   Existing URLs in DB: {len(existing_urls)}")
        print("-"*60)
        
        self.news_data = []
        
        # Track URLs processed in this session to prevent duplicates across categories
        processed_urls = set()
        
        # Process each category
        for base_url in self.BASE_URLS:
            category = "corporate-action" if "corporate-action" in base_url else "market"
            category_icon = "[CORP-ACTION]" if category == "corporate-action" else "[MARKET]"
            print(f"\n{'~'*50}")
            print(f"{category_icon} CATEGORY: {category.upper()}")
            print(f"{'~'*50}")
            
            page = 1
            stop_category = False
            old_article_streak = 0
            worthless_streak = 0
            
            while page <= pages and not stop_category:
                print(f"[*] {category} Page {page}...")
                
                articles = self.get_index_page_with_dates(base_url, page)
                if not articles:
                    print("[-] No articles found. Moving to next category.")
                    break
                
                valid_articles = 0
                blacklisted_count = 0  # Track blacklisted articles to reduce log spam
                
                for url, estimated_date, index_title in articles:
                    estimated_date_val = estimated_date.date()
                    
                    # 1. Check if already in DB or already processed in this session
                    if url in existing_urls or url in processed_urls:
                        worthless_streak += 1
                        if worthless_streak >= 10:
                            print(f"[STOP] 10 consecutive existing/duplicate URLs.")
                            stop_category = True
                            break
                        continue
                    
                    # Mark as processed immediately to prevent duplicates
                    processed_urls.add(url)
                    worthless_streak = 0
                    
                    # 2. Index-level date filtering
                    if estimated_date_val > target_end:
                        continue
                    
                    if estimated_date_val < target_start:
                        old_article_streak += 1
                        if old_article_streak >= 10:
                            print(f"[STOP] 10 consecutive old articles.")
                            stop_category = True
                            break
                        continue
                    
                    old_article_streak = 0
                    
                    # 3. Blacklist check
                    is_bad, reason = is_blacklisted(index_title, url)
                    if is_bad:
                        blacklisted_count += 1
                        continue
                    
                    # 4. Fetch article detail
                    article = self.get_article_detail(url, estimated_date)
                    if not article:
                        continue
                    
                    # 5. Precise date check
                    article_date = article['date'].date()
                    
                    if article_date < target_start or article_date > target_end:
                        continue
                    
                    # 6. Ticker/Whitelist check
                    if not article['ticker']:
                        if not has_whitelist_keywords(article['title'] + ' ' + article['clean_text'][:500]):
                            continue
                    
                    # Success!
                    self.news_data.append(article)
                    valid_articles += 1
                    print(f"  [OK] [{article_date}] {article['title'][:50]}...")
                
                print(f"  -> Page {page} done. Valid: {valid_articles}" + (f", Blacklisted: {blacklisted_count}" if blacklisted_count else ""))
                page += 1
        
        print(f"\n[*] Scraping complete. Total: {len(self.news_data)} articles")
        
        # Run sentiment analysis
        if self.news_data:
            try:
                from modules.analyzer import SentimentEngine
                print("[*] Running sentiment analysis...")
                engine = SentimentEngine()
                analyzed_data = engine.process_and_save(self.news_data)
                return analyzed_data
            except Exception as e:
                print(f"[!] Sentiment analysis error: {e}")
                return self.news_data
        
        return []


if __name__ == "__main__":
    # Quick test
    scraper = InvestorScraper()
    start = datetime.now() - timedelta(days=3)
    end = datetime.now()
    results = scraper.run(start, end, pages=3)
    print(f"\n=== Results: {len(results)} articles ===")
    for r in results[:5]:
        print(f"  - {r.get('title', 'N/A')[:60]}")
        print(f"    Date: {r.get('timestamp', 'N/A')}")
        print(f"    Sentiment: {r.get('sentiment_label', 'N/A')}")
