"""
Bisnis.com Market News Scraper.

Scrapes news articles from https://www.bisnis.com/index?categoryId=194 (Market section).
Following the same architecture as scraper_cnbc.py with hybrid date filtering.
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

# Indonesian month mapping (short and full)
MONTH_MAP = {
    'januari': '01', 'februari': '02', 'maret': '03', 'april': '04',
    'mei': '05', 'juni': '06', 'juli': '07', 'agustus': '08',
    'september': '09', 'oktober': '10', 'november': '11', 'desember': '12',
    # Short forms (from index page)
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'mei': '05', 'jun': '06', 'jul': '07', 'agu': '08', 'aug': '08',
    'sep': '09', 'okt': '10', 'oct': '10', 'nov': '11', 'des': '12', 'dec': '12'
}

# Indonesian day names (for stripping)
DAY_NAMES = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']


def parse_relative_time(date_str):
    """
    Parses relative time from index page for ESTIMATION.
    
    Formats:
    - "2 menit yang lalu"
    - "1 jam yang lalu"
    - "22 jam yang lalu"
    - "24 Jan 2026 | 12:28 WIB" (absolute)
    
    Returns: datetime object (aware, Asia/Jakarta)
    """
    if not date_str:
        return datetime.now(JAKARTA_TZ)
    
    now = datetime.now(JAKARTA_TZ)
    text = date_str.strip().lower()
    
    try:
        # Pattern 1: "X menit yang lalu" or "X menit"
        minutes_match = re.search(r'(\d+)\s*menit', text)
        if minutes_match:
            mins = int(minutes_match.group(1))
            return now - timedelta(minutes=mins)
        
        # Pattern 2: "X jam yang lalu" or "X jam"
        hours_match = re.search(r'(\d+)\s*jam', text)
        if hours_match:
            hours = int(hours_match.group(1))
            return now - timedelta(hours=hours)
        
        # Pattern 3: "X hari yang lalu"
        days_match = re.search(r'(\d+)\s*hari', text)
        if days_match:
            days = int(days_match.group(1))
            return now - timedelta(days=days)
        
        # Pattern 4: Absolute date "24 Jan 2026 | 12:28 WIB"
        # Replace month names
        clean_date = text
        for id_month, num in MONTH_MAP.items():
            if id_month in clean_date:
                clean_date = clean_date.replace(id_month, num)
                break
        
        # Try to parse "24 01 2026 | 12:28"
        abs_match = re.search(r'(\d{1,2})\s+(\d{1,2})\s+(\d{4})\s*\|\s*(\d{1,2}):(\d{2})', clean_date)
        if abs_match:
            day, month, year, hour, minute = map(int, abs_match.groups())
            return JAKARTA_TZ.localize(datetime(year, month, day, hour, minute, 0))
        
        # Try without time "24 01 2026"
        abs_match2 = re.search(r'(\d{1,2})\s+(\d{1,2})\s+(\d{4})', clean_date)
        if abs_match2:
            day, month, year = map(int, abs_match2.groups())
            return JAKARTA_TZ.localize(datetime(year, month, day, 0, 0, 0))
        
        # Fallback to now
        return now
        
    except Exception as e:
        print(f"[-] Relative time parse error: {e}")
        return now


def parse_bisnis_date(date_str):
    """
    Parses Bisnis.com date format from article detail page.
    
    Format: "Minggu, 25 Januari 2026 | 13:37"
    
    Returns: datetime object (aware, Asia/Jakarta) or None if parsing fails.
    """
    if not date_str:
        return None
    
    try:
        text = date_str.strip().lower()
        
        # Remove day name (e.g., "minggu, ")
        for day in DAY_NAMES:
            if text.startswith(day):
                text = text.replace(day, '').strip()
                if text.startswith(','):
                    text = text[1:].strip()
                break
        
        # Replace Indonesian month names with numbers
        for id_month, num in MONTH_MAP.items():
            if id_month in text:
                text = text.replace(id_month, num)
                break
        
        # Extract using regex "25 01 2026 | 13:37"
        match = re.search(r'(\d{1,2})\s+(\d{1,2})\s+(\d{4})\s*\|\s*(\d{1,2}):(\d{2})', text)
        if match:
            day, month, year, hour, minute = map(int, match.groups())
            dt = datetime(year, month, day, hour, minute, 0)
            return JAKARTA_TZ.localize(dt)
        
        # Fallback: try without time
        match = re.search(r'(\d{1,2})\s+(\d{1,2})\s+(\d{4})', text)
        if match:
            day, month, year = map(int, match.groups())
            dt = datetime(year, month, day, 0, 0, 0)
            return JAKARTA_TZ.localize(dt)
            
    except Exception as e:
        print(f"[-] Bisnis date parse error: {e} | Input: {date_str}")
    
    return None


class BisnisScraper:
    """Scraper for Bisnis.com Market news with hybrid date filtering."""
    
    BASE_URL = "https://www.bisnis.com/index"
    CATEGORY_ID = "194"  # Market category
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.news_data = []
    
    def get_index_page_with_dates(self, page=1):
        """
        Fetches article links AND estimated dates from index page.
        
        Returns: List of tuples (url, estimated_date, title)
        """
        params = {"categoryId": self.CATEGORY_ID}
        if page > 1:
            params["page"] = page
        
        try:
            resp = self.session.get(self.BASE_URL, params=params, timeout=15)
            if resp.status_code != 200:
                print(f"[-] Index page {page} returned status {resp.status_code}")
                return []
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            # Find all article cards
            articles = []
            
            # Find main container to avoid sidebar widgets
            main_container = soup.find('div', class_=re.compile(r'col-left|col-md-8', re.I))
            search_scope = main_container if main_container else soup
            
            # Look for article cards - Bisnis.com uses different structures
            # Pattern 1: div with article link + date span
            for card in search_scope.find_all('div', class_=re.compile(r'(card|item|article)', re.I)):
                link_tag = card.find('a', href=re.compile(r'market\.bisnis\.com/read/'))
                if not link_tag:
                    continue
                
                href = link_tag.get('href', '')
                if not href:
                    continue
                
                # Normalize URL
                if href.startswith('//'):
                    href = 'https:' + href
                elif not href.startswith('http'):
                    href = 'https://market.bisnis.com' + href
                
                # Get title
                title = link_tag.get_text(strip=True) or ""
                # Sometimes title is in h2/h3 inside the card
                if not title:
                    title_tag = card.find(['h2', 'h3', 'h4'])
                    title = title_tag.get_text(strip=True) if title_tag else ""
                
                # Get date - look for date pattern in card text
                date_text = ""
                # Look for spans that might contain date
                for span in card.find_all(['span', 'small', 'time']):
                    span_text = span.get_text(strip=True)
                    # Check if it looks like a date
                    if any(kw in span_text.lower() for kw in ['menit', 'jam', 'hari', 'wib', 'jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des']):
                        date_text = span_text
                        break
                
                # If no date found, try to extract from URL
                if not date_text:
                    url_match = re.search(r'/read/(\d{8})/', href)
                    if url_match:
                        date_str = url_match.group(1)
                        # Convert YYYYMMDD to estimated date
                        try:
                            dt = datetime.strptime(date_str, '%Y%m%d')
                            date_text = dt.strftime('%d %b %Y')
                        except:
                            pass
                
                estimated_date = parse_relative_time(date_text)
                articles.append((href, estimated_date, title))
            
            # Pattern 2: Direct <a> tags with market.bisnis.com/read/
            if not articles:
                seen_urls = set()
                for a_tag in soup.find_all('a', href=re.compile(r'market\.bisnis\.com/read/')):
                    href = a_tag['href']
                    if href in seen_urls:
                        continue
                    seen_urls.add(href)
                    
                    if href.startswith('//'):
                        href = 'https:' + href
                    elif not href.startswith('http'):
                        href = 'https://market.bisnis.com' + href
                    
                    title = a_tag.get_text(strip=True)
                    
                    # Extract date from URL
                    url_match = re.search(r'/read/(\d{8})/', href)
                    if url_match:
                        date_str = url_match.group(1)
                        try:
                            estimated_date = JAKARTA_TZ.localize(
                                datetime.strptime(date_str, '%Y%m%d')
                            )
                        except:
                            estimated_date = datetime.now(JAKARTA_TZ)
                    else:
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
            
            # 2. Date & Author
            date_text = ""
            
            # Try multiple selectors for date
            # Pattern 1: <a> tag with author link followed by date
            author_link = soup.find('a', href=re.compile(r'/user/\d+/'))
            if author_link:
                parent = author_link.find_parent()
                if parent:
                    full_text = parent.get_text(separator=' ', strip=True)
                    date_match = re.search(r'(\w+,\s*\d{1,2}\s+\w+\s+\d{4}\s*\|\s*\d{1,2}:\d{2})', full_text)
                    if date_match:
                        date_text = date_match.group(1)
            
            # Pattern 2: Look for date in meta tags
            if not date_text:
                meta_date = soup.find('meta', {'property': 'article:published_time'})
                if meta_date and meta_date.get('content'):
                    try:
                        iso_date = meta_date['content']
                        dt = datetime.fromisoformat(iso_date.replace('Z', '+00:00'))
                        date_obj = dt.astimezone(JAKARTA_TZ)
                        date_text = date_obj.strftime('%A, %d %B %Y | %H:%M')
                    except:
                        pass
            
            # Pattern 3: Look in time tags
            if not date_text:
                time_tag = soup.find('time')
                if time_tag:
                    date_text = time_tag.get_text(strip=True)
                    if not date_text and time_tag.get('datetime'):
                        date_text = time_tag['datetime']
            
            # Parse date
            article_date = parse_bisnis_date(date_text)
            if not article_date:
                # Fallback to URL date (format: /read/YYYYMMDD/...)
                url_match = re.search(r'/read/(\d{8})/', url)
                if url_match:
                    try:
                        date_str = url_match.group(1)
                        article_date = JAKARTA_TZ.localize(
                            datetime.strptime(date_str, '%Y%m%d')
                        )
                    except:
                        article_date = estimated_date or datetime.now(JAKARTA_TZ)
                else:
                    article_date = estimated_date or datetime.now(JAKARTA_TZ)
            
            # 3. Content
            content_text = ""
            
            content_selectors = [
                'div.detailNews',
                'article.detail',
                'div.content-detail',
                'div[itemprop="articleBody"]'
            ]
            
            content_div = None
            for selector in content_selectors:
                content_div = soup.select_one(selector)
                if content_div:
                    break
            
            if content_div:
                for tag in content_div.find_all(['script', 'style', 'iframe', 'aside', 'nav']):
                    tag.decompose()
                
                paragraphs = content_div.find_all('p')
                content_text = '\n'.join([p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)])
            
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
                'source': 'Bisnis.com'
            }
            
        except Exception as e:
            print(f"[-] Error fetching article {url}: {e}")
            return None
    
    def run(self, start_date, end_date=None, pages=50):
        """
        Main scraper method with HYBRID approach.
        
        Uses index-level date estimation for FAST filtering,
        then validates with detail-level date.
        
        Continues through ALL pages until reaching target_start date,
        instead of stopping at first old article.
        
        Args:
            start_date: Start date (datetime or date)
            end_date: End date (datetime or date), defaults to now
            pages: Maximum pages to scrape
            
        Returns:
            List of analyzed article dictionaries
        """
        # Normalize dates
        target_start = start_date.date() if isinstance(start_date, datetime) else start_date
        target_end = end_date.date() if isinstance(end_date, datetime) else (end_date or datetime.now().date())
        
        print("\n" + "="*60)
        print("📰 BISNIS.COM SCRAPER")
        print("="*60)
        print(f"   Target Range: {target_start} → {target_end}")
        print(f"   Max Pages: {pages}")
        
        # Load existing URLs for incremental scraping
        db = DatabaseManager()
        existing_urls = set(db.get_all_urls())
        print(f"   Existing URLs in DB: {len(existing_urls)}")
        print("-"*60)
        
        self.news_data = []
        processed_urls = set()  # Track URLs processed in this session to prevent duplicates
        page = 1
        stop_scraping = False
        worthless_streak = 0
        old_article_streak = 0  # Track consecutive old articles
        
        while page <= pages and not stop_scraping:
            print(f"[*] Index Page {page}...")
            
            # Get articles WITH dates from index
            articles = self.get_index_page_with_dates(page)
            if not articles:
                print("[-] No articles found. Stopping.")
                break
            
            valid_articles = 0
            blacklisted_count = 0  # Track blacklisted articles to reduce log spam
            page_has_target_range = False  # Track if this page has any articles in range
            
            for url, estimated_date, index_title in articles:
                estimated_date_val = estimated_date.date()
                
                # 1. Check if already in DB or processed in this session (FAST FILTER)
                if url in existing_urls or url in processed_urls:
                    worthless_streak += 1
                    if worthless_streak >= 20:
                        print(f"[STOP] 20 consecutive existing/duplicate URLs. Stopping.")
                        stop_scraping = True
                        break
                    continue
                
                # Mark as processed immediately to prevent duplicates
                processed_urls.add(url)
                worthless_streak = 0
                
                # 2. Index-level date filtering (FAST)
                # Skip if estimated date is NEWER than target_end
                if estimated_date_val > target_end:
                    print(f"  [SKIP] Too new: {estimated_date_val} > {target_end}")
                    continue
                
                # If estimated date is OLDER than target_start, track but DON'T STOP YET
                # (Index dates can be approximate, especially relative times)
                if estimated_date_val < target_start:
                    old_article_streak += 1
                    print(f"  [SKIP] Est. date {estimated_date_val} < {target_start} ({old_article_streak}/10)")
                    
                    # Only stop if we've seen MANY consecutive old articles
                    if old_article_streak >= 10:
                        print(f"[STOP] 10 consecutive articles older than target. Stopping.")
                        stop_scraping = True
                        break
                    continue
                
                # Reset old article streak if we find one in range
                old_article_streak = 0
                page_has_target_range = True
                
                # 3. FAST blacklist check on index title
                is_bad, reason = is_blacklisted(index_title, url)
                if is_bad:
                    blacklisted_count += 1
                    continue
                
                # 4. Fetch article detail for PRECISE date
                article = self.get_article_detail(url, estimated_date)
                if not article:
                    continue
                
                # 5. PRECISE date check from detail page
                article_date = article['date'].date()
                
                if article_date < target_start:
                    print(f"  [SKIP] Detail date {article_date} < start {target_start}")
                    continue
                
                if article_date > target_end:
                    print(f"  [SKIP] Detail date {article_date} > end {target_end}")
                    continue
                
                # 6. Ticker/Whitelist check
                if not article['ticker']:
                    if not has_whitelist_keywords(article['title'] + ' ' + article['clean_text'][:500]):
                        print(f"  [SKIP] No ticker/whitelist: {article['title'][:30]}...")
                        continue
                
                # Success!
                self.news_data.append(article)
                valid_articles += 1
                print(f"  [OK] [{article_date}] {article['title'][:50]}...")
            
            print(f"  -> Page {page} done. Valid: {valid_articles}" + (f", Blacklisted: {blacklisted_count}" if blacklisted_count else ""))
            
            # If entire page had no articles in target range and we had old articles
            if not page_has_target_range and old_article_streak > 0:
                print(f"[*] No articles in target range on page {page}. Continuing to next page...")
            
            page += 1
        
        print(f"[*] Scraping complete. Total: {len(self.news_data)} articles")
        
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
    # Quick test - scrape last 3 days
    scraper = BisnisScraper()
    start = datetime.now() - timedelta(days=3)
    end = datetime.now()
    results = scraper.run(start, end, pages=5)
    print(f"\n=== Results: {len(results)} articles ===")
    for r in results[:5]:
        print(f"  - {r.get('title', 'N/A')[:60]}")
        print(f"    Date: {r.get('timestamp', 'N/A')}")
        print(f"    Sentiment: {r.get('sentiment_label', 'N/A')}")
