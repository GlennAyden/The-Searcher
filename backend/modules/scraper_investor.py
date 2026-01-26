"""
Investor.id News Scraper.

REFACTORED: Inherits from BaseScraper for standardized session/retry handling.

Scrapes news articles from:
- https://investor.id/corporate-action/indeks
- https://investor.id/market/indeks
"""
import re
import time
import random
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import pytz
from bs4 import BeautifulSoup

from features.scrapers.base import BaseScraper
from modules.utils import extract_tickers, clean_text_regex, is_blacklisted, has_whitelist_keywords
from modules.database import DatabaseManager

JAKARTA_TZ = pytz.timezone('Asia/Jakarta')


def parse_investor_date(date_str: str) -> Optional[datetime]:
    """Parse Investor.id date format (e.g., '24 Jan 2026 | 08:00 WIB')."""
    if not date_str:
        return None
    
    MONTH_MAP = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'mei': 5, 'may': 5,
        'jun': 6, 'jul': 7, 'agu': 8, 'aug': 8, 'sep': 9, 'okt': 10,
        'oct': 10, 'nov': 11, 'des': 12, 'dec': 12,
        'januari': 1, 'februari': 2, 'maret': 3, 'april': 4,
        'juni': 6, 'juli': 7, 'agustus': 8, 'september': 9,
        'oktober': 10, 'november': 11, 'desember': 12
    }
    
    try:
        text = date_str.strip().lower().replace('wib', '').strip()
        
        # Replace month names with numbers
        for id_month, num in MONTH_MAP.items():
            if id_month in text:
                text = text.replace(id_month, str(num).zfill(2))
                break
        
        # Pattern: "24 01 2026 | 08:00"
        match = re.search(r'(\d{1,2})\s+(\d{1,2})\s+(\d{4})\s*\|\s*(\d{1,2}):(\d{2})', text)
        if match:
            day, month, year, hour, minute = map(int, match.groups())
            return JAKARTA_TZ.localize(datetime(year, month, day, hour, minute))
        
        # Pattern without time: "24 01 2026"
        match = re.search(r'(\d{1,2})\s+(\d{1,2})\s+(\d{4})', text)
        if match:
            day, month, year = map(int, match.groups())
            return JAKARTA_TZ.localize(datetime(year, month, day))
            
    except Exception as e:
        pass
    
    return None


class InvestorScraper(BaseScraper):
    """Scraper for Investor.id news with multi-category support."""
    
    BASE_URLS = [
        "https://investor.id/corporate-action/indeks",
        "https://investor.id/market/indeks"
    ]
    RATE_LIMIT_DELAY = 0.5
    
    def get_index_page(self, page: int = 1, base_url: str = None) -> List[Tuple]:
        """Fetch article links and dates from index page."""
        if base_url is None:
            base_url = self.BASE_URLS[0]
        
        url = f"{base_url}/{page}" if page > 1 else base_url
        html = self.fetch_html(url)
        
        if not html:
            return []
        
        soup = BeautifulSoup(html, 'html.parser')
        articles = []
        seen_urls = set()
        
        # Find main container
        main_container = None
        max_links = 0
        
        for div in soup.find_all('div', class_=True):
            if any(c in div.get('class', []) for c in ['col-9', 'col-lg-9', 'col-md-9', 'pr-40']):
                links = div.find_all('a', href=re.compile(r'/[a-zA-Z0-9-]+/\d+'))
                if len(links) > max_links:
                    max_links = len(links)
                    main_container = div
        
        if max_links < 5:
            max_links = 0
            for div in soup.find_all('div', class_=True):
                links = div.find_all('a', href=re.compile(r'/[a-zA-Z0-9-]+/\d+'))
                if len(links) > max_links:
                    max_links = len(links)
                    main_container = div
        
        search_scope = main_container if main_container else soup
        
        for a_tag in search_scope.find_all('a', href=True):
            href = a_tag['href']
            
            if not re.search(r'/(corporate-action|market|stock)/\d+', href):
                continue
            if 'indeks' in href:
                continue
            
            if href.startswith('/'):
                href = 'https://investor.id' + href
            
            if href in seen_urls:
                continue
            seen_urls.add(href)
            
            title = a_tag.get_text(strip=True)
            
            # Find date near link
            date_text = ""
            parent = a_tag.find_parent()
            if parent:
                parent_text = parent.get_text(separator=' ', strip=True)
                date_match = re.search(r'(\d{1,2}\s+\w+\s+\d{4}\s*\|\s*\d{1,2}:\d{2}\s*WIB)', parent_text, re.I)
                if date_match:
                    date_text = date_match.group(1)
                
                if not date_text:
                    grandparent = parent.find_parent()
                    if grandparent:
                        gp_text = grandparent.get_text(separator=' ', strip=True)
                        dm = re.search(r'(\d{1,2}\s+\w+\s+\d{4}\s*\|\s*\d{1,2}:\d{2}\s*WIB)', gp_text, re.I)
                        if dm:
                            date_text = dm.group(1)
            
            estimated_date = parse_investor_date(date_text) or datetime.now(JAKARTA_TZ)
            articles.append((href, estimated_date, title))
        
        return articles
    
    def get_article_detail(self, url: str, estimated_date=None) -> Optional[Dict]:
        """Fetch and extract article details."""
        time.sleep(random.uniform(0.3, 0.8))  # Polite delay
        
        html = self.fetch_html(url)
        if not html:
            return None
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # Title
        h1 = soup.find('h1')
        title = h1.get_text(strip=True) if h1 else ""
        
        # Date
        date_text = ""
        for elem in soup.find_all(['span', 'time', 'div', 'p']):
            text = elem.get_text(strip=True)
            if re.search(r'\d{1,2}\s+\w+\s+\d{4}\s*\|\s*\d{1,2}:\d{2}\s*WIB', text, re.I):
                date_text = text
                break
        
        if not date_text:
            meta_date = soup.find('meta', {'property': 'article:published_time'})
            if meta_date and meta_date.get('content'):
                try:
                    dt = datetime.fromisoformat(meta_date['content'].replace('Z', '+00:00'))
                    article_date = dt.astimezone(JAKARTA_TZ)
                    date_text = article_date.strftime('%d %b %Y | %H:%M WIB')
                except:
                    pass
        
        article_date = parse_investor_date(date_text) or estimated_date or datetime.now(JAKARTA_TZ)
        
        # Content
        content_text = ""
        for selector in ['div.post-content', 'article', 'div.content', 'div.entry-content']:
            content_div = soup.select_one(selector)
            if content_div:
                for tag in content_div.find_all(['script', 'style', 'iframe', 'aside', 'nav']):
                    tag.decompose()
                paragraphs = content_div.find_all('p')
                content_text = '\n'.join([p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)])
                break
        
        if not content_text:
            paragraphs = soup.find_all('p')
            content_text = '\n'.join([p.get_text(strip=True) for p in paragraphs[:15] if p.get_text(strip=True)])
        
        content_text = clean_text_regex(content_text)
        
        # Tickers
        tickers = extract_tickers(title) or extract_tickers(content_text[:1000])
        
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
    
    def run(self, start_date: datetime, end_date: datetime = None, pages: int = 20) -> List[Dict]:
        """Main scraper method with multi-category support."""
        target_start = start_date.date() if isinstance(start_date, datetime) else start_date
        target_end = end_date.date() if isinstance(end_date, datetime) else (end_date or datetime.now().date())
        
        print(f"\n{'='*60}")
        print(f"📈 INVESTOR.ID SCRAPER")
        print(f"   Range: {target_start} → {target_end}, Max Pages: {pages}")
        
        db = DatabaseManager()
        existing_urls = set(db.get_all_urls())
        print(f"   Existing URLs: {len(existing_urls)}")
        
        results = []
        processed_urls = set()
        
        for base_url in self.BASE_URLS:
            category = "corporate-action" if "corporate-action" in base_url else "market"
            print(f"\n[{category.upper()}]")
            
            page = 1
            stop_category = False
            old_streak = 0
            dup_streak = 0
            
            while page <= pages and not stop_category:
                articles = self.get_index_page(page, base_url)
                if not articles:
                    break
                
                for url, estimated_date, index_title in articles:
                    if url in existing_urls or url in processed_urls:
                        dup_streak += 1
                        if dup_streak >= 10:
                            stop_category = True
                            break
                        continue
                    
                    processed_urls.add(url)
                    dup_streak = 0
                    
                    est_date = estimated_date.date()
                    if est_date > target_end:
                        continue
                    if est_date < target_start:
                        old_streak += 1
                        if old_streak >= 10:
                            stop_category = True
                            break
                        continue
                    
                    old_streak = 0
                    
                    is_bad, _ = is_blacklisted(index_title, url)
                    if is_bad:
                        continue
                    
                    article = self.get_article_detail(url, estimated_date)
                    if not article:
                        continue
                    
                    article_date = article['date'].date()
                    if not (target_start <= article_date <= target_end):
                        continue
                    
                    if not article['ticker']:
                        if not has_whitelist_keywords(article['title'] + ' ' + article['clean_text'][:500]):
                            continue
                    
                    results.append(article)
                    print(f"  ✓ [{article_date}] {article['title'][:40]}...")
                
                page += 1
        
        print(f"\n[*] Complete: {len(results)} articles")
        
        if results:
            try:
                from modules.analyzer import SentimentEngine
                engine = SentimentEngine()
                return engine.process_and_save(results)
            except Exception as e:
                print(f"[!] Sentiment error: {e}")
                return results
        
        return []


if __name__ == "__main__":
    scraper = InvestorScraper()
    start = datetime.now() - timedelta(days=3)
    results = scraper.run(start, datetime.now(), pages=3)
    print(f"\n=== {len(results)} articles ===")
