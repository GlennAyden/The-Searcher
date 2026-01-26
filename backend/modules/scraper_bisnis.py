"""
Bisnis.com Market News Scraper.

REFACTORED: Inherits from BaseScraper for standardized session/retry handling.

Scrapes news from https://www.bisnis.com/index?categoryId=194 (Market section).
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
DAY_NAMES = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']
MONTH_MAP = {
    'januari': 1, 'februari': 2, 'maret': 3, 'april': 4, 'mei': 5, 'juni': 6,
    'juli': 7, 'agustus': 8, 'september': 9, 'oktober': 10, 'november': 11, 'desember': 12,
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'jun': 6, 'jul': 7,
    'agu': 8, 'aug': 8, 'sep': 9, 'okt': 10, 'oct': 10, 'nov': 11, 'des': 12, 'dec': 12
}


def parse_relative_time(date_str: str) -> datetime:
    """Parse relative time (e.g., '2 menit yang lalu') or absolute date."""
    if not date_str:
        return datetime.now(JAKARTA_TZ)
    
    now = datetime.now(JAKARTA_TZ)
    text = date_str.strip().lower()
    
    try:
        if m := re.search(r'(\d+)\s*menit', text):
            return now - timedelta(minutes=int(m.group(1)))
        if m := re.search(r'(\d+)\s*jam', text):
            return now - timedelta(hours=int(m.group(1)))
        if m := re.search(r'(\d+)\s*hari', text):
            return now - timedelta(days=int(m.group(1)))
        
        # Absolute date
        clean = text
        for id_month, num in MONTH_MAP.items():
            if id_month in clean:
                clean = clean.replace(id_month, str(num).zfill(2))
                break
        
        if m := re.search(r'(\d{1,2})\s+(\d{1,2})\s+(\d{4})\s*\|\s*(\d{1,2}):(\d{2})', clean):
            day, month, year, hour, minute = map(int, m.groups())
            return JAKARTA_TZ.localize(datetime(year, month, day, hour, minute))
        
        if m := re.search(r'(\d{1,2})\s+(\d{1,2})\s+(\d{4})', clean):
            day, month, year = map(int, m.groups())
            return JAKARTA_TZ.localize(datetime(year, month, day))
    except:
        pass
    
    return now


def parse_bisnis_date(date_str: str) -> Optional[datetime]:
    """Parse Bisnis.com date (e.g., 'Minggu, 25 Januari 2026 | 13:37')."""
    if not date_str:
        return None
    
    try:
        text = date_str.strip().lower()
        
        # Remove day name
        for day in DAY_NAMES:
            if text.startswith(day):
                text = text.replace(day, '').lstrip(', ').strip()
                break
        
        # Replace month name
        for id_month, num in MONTH_MAP.items():
            if id_month in text:
                text = text.replace(id_month, str(num).zfill(2))
                break
        
        if m := re.search(r'(\d{1,2})\s+(\d{1,2})\s+(\d{4})\s*\|\s*(\d{1,2}):(\d{2})', text):
            day, month, year, hour, minute = map(int, m.groups())
            return JAKARTA_TZ.localize(datetime(year, month, day, hour, minute))
        
        if m := re.search(r'(\d{1,2})\s+(\d{1,2})\s+(\d{4})', text):
            day, month, year = map(int, m.groups())
            return JAKARTA_TZ.localize(datetime(year, month, day))
    except:
        pass
    
    return None


class BisnisScraper(BaseScraper):
    """Scraper for Bisnis.com Market news with hybrid date filtering."""
    
    BASE_URL = "https://www.bisnis.com/index"
    CATEGORY_ID = "194"  # Market category
    RATE_LIMIT_DELAY = 0.5
    
    def get_index_page(self, page: int = 1) -> List[Tuple]:
        """Fetch article links and dates from index page."""
        params = {"categoryId": self.CATEGORY_ID}
        if page > 1:
            params["page"] = page
        
        response = self.fetch_url(self.BASE_URL, params=params)
        if not response:
            return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        articles = []
        
        # Find main container
        main_container = soup.find('div', class_=re.compile(r'col-left|col-md-8', re.I))
        search_scope = main_container if main_container else soup
        
        # Pattern 1: Article cards
        for card in search_scope.find_all('div', class_=re.compile(r'(card|item|article)', re.I)):
            link = card.find('a', href=re.compile(r'market\.bisnis\.com/read/'))
            if not link:
                continue
            
            href = link.get('href', '')
            if href.startswith('//'):
                href = 'https:' + href
            elif not href.startswith('http'):
                href = 'https://market.bisnis.com' + href
            
            title = link.get_text(strip=True) or ""
            if not title:
                t = card.find(['h2', 'h3', 'h4'])
                title = t.get_text(strip=True) if t else ""
            
            # Find date
            date_kw = ['menit', 'jam', 'hari', 'wib', 'jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des']
            date_text = ""
            for span in card.find_all(['span', 'small', 'time']):
                t = span.get_text(strip=True)
                if any(kw in t.lower() for kw in date_kw):
                    date_text = t
                    break
            
            if not date_text:
                if m := re.search(r'/read/(\d{8})/', href):
                    try:
                        dt = datetime.strptime(m.group(1), '%Y%m%d')
                        date_text = dt.strftime('%d %b %Y')
                    except:
                        pass
            
            articles.append((href, parse_relative_time(date_text), title))
        
        # Pattern 2: Fallback - direct links
        if not articles:
            seen = set()
            for a in soup.find_all('a', href=re.compile(r'market\.bisnis\.com/read/')):
                href = a['href']
                if href in seen:
                    continue
                seen.add(href)
                
                if href.startswith('//'):
                    href = 'https:' + href
                
                title = a.get_text(strip=True)
                
                if m := re.search(r'/read/(\d{8})/', href):
                    try:
                        dt = JAKARTA_TZ.localize(datetime.strptime(m.group(1), '%Y%m%d'))
                    except:
                        dt = datetime.now(JAKARTA_TZ)
                else:
                    dt = datetime.now(JAKARTA_TZ)
                
                articles.append((href, dt, title))
        
        return articles
    
    def get_article_detail(self, url: str, estimated_date=None) -> Optional[Dict]:
        """Fetch and extract article details."""
        time.sleep(random.uniform(0.3, 0.8))
        
        html = self.fetch_html(url)
        if not html:
            return None
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # Title
        h1 = soup.find('h1')
        title = h1.get_text(strip=True) if h1 else ""
        
        # Date
        date_text = ""
        author = soup.find('a', href=re.compile(r'/user/\d+/'))
        if author and (parent := author.find_parent()):
            if m := re.search(r'(\w+,\s*\d{1,2}\s+\w+\s+\d{4}\s*\|\s*\d{1,2}:\d{2})', parent.get_text(separator=' ', strip=True)):
                date_text = m.group(1)
        
        if not date_text:
            meta = soup.find('meta', {'property': 'article:published_time'})
            if meta and meta.get('content'):
                try:
                    dt = datetime.fromisoformat(meta['content'].replace('Z', '+00:00'))
                    date_text = dt.astimezone(JAKARTA_TZ).strftime('%A, %d %B %Y | %H:%M')
                except:
                    pass
        
        if not date_text:
            time_tag = soup.find('time')
            if time_tag:
                date_text = time_tag.get_text(strip=True) or time_tag.get('datetime', '')
        
        article_date = parse_bisnis_date(date_text)
        if not article_date:
            if m := re.search(r'/read/(\d{8})/', url):
                try:
                    article_date = JAKARTA_TZ.localize(datetime.strptime(m.group(1), '%Y%m%d'))
                except:
                    pass
        if not article_date:
            article_date = estimated_date or datetime.now(JAKARTA_TZ)
        
        # Content
        content_text = ""
        for selector in ['div.detailNews', 'article.detail', 'div.content-detail', 'div[itemprop="articleBody"]']:
            if div := soup.select_one(selector):
                for tag in div.find_all(['script', 'style', 'iframe', 'aside', 'nav']):
                    tag.decompose()
                content_text = '\n'.join([p.get_text(strip=True) for p in div.find_all('p') if p.get_text(strip=True)])
                break
        
        if not content_text:
            content_text = '\n'.join([p.get_text(strip=True) for p in soup.find_all('p')[:15] if p.get_text(strip=True)])
        
        content_text = clean_text_regex(content_text)
        tickers = extract_tickers(title) or extract_tickers(content_text[:1000])
        
        return {
            'title': title, 'url': url, 'date': article_date, 'timestamp': article_date.isoformat(),
            'clean_text': content_text, 'summary': content_text[:300] + '...' if len(content_text) > 300 else content_text,
            'ticker': ', '.join(tickers) if tickers else '', 'source': 'Bisnis.com'
        }
    
    def run(self, start_date: datetime, end_date: datetime = None, pages: int = 50) -> List[Dict]:
        """Main scraper with hybrid date filtering."""
        target_start = start_date.date() if isinstance(start_date, datetime) else start_date
        target_end = end_date.date() if isinstance(end_date, datetime) else (end_date or datetime.now().date())
        
        print(f"\n{'='*60}\n📰 BISNIS.COM SCRAPER\n   Range: {target_start} → {target_end}, Max Pages: {pages}")
        
        db = DatabaseManager()
        existing_urls = set(db.get_all_urls())
        print(f"   Existing URLs: {len(existing_urls)}")
        
        results = []
        processed = set()
        page = 1
        stop = False
        old_streak = dup_streak = 0
        
        while page <= pages and not stop:
            articles = self.get_index_page(page)
            if not articles:
                break
            
            for url, est_date, title in articles:
                if url in existing_urls or url in processed:
                    dup_streak += 1
                    if dup_streak >= 10:
                        stop = True
                        break
                    continue
                
                processed.add(url)
                est_dt = est_date.date()
                
                if est_dt > target_end:
                    continue
                if est_dt < target_start:
                    old_streak += 1
                    if old_streak >= 10:
                        stop = True
                        break
                    continue
                
                old_streak = dup_streak = 0
                
                is_bad, _ = is_blacklisted(title, url)
                if is_bad:
                    continue
                
                article = self.get_article_detail(url, est_date)
                if not article:
                    continue
                
                art_dt = article['date'].date()
                if not (target_start <= art_dt <= target_end):
                    continue
                
                if not article['ticker'] and not has_whitelist_keywords(article['title'] + ' ' + article['clean_text'][:500]):
                    continue
                
                results.append(article)
                print(f"  ✓ [{art_dt}] {article['title'][:40]}...")
            
            page += 1
        
        print(f"\n[*] Complete: {len(results)} articles")
        
        if results:
            try:
                from modules.analyzer import SentimentEngine
                return SentimentEngine().process_and_save(results)
            except Exception as e:
                print(f"[!] Sentiment error: {e}")
                return results
        
        return []


if __name__ == "__main__":
    scraper = BisnisScraper()
    results = scraper.run(datetime.now() - timedelta(days=3), datetime.now(), pages=5)
    print(f"\n=== {len(results)} articles ===")
