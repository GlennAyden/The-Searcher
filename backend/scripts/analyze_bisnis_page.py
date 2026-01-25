"""Analyze Bisnis.com page structure"""
import requests
from bs4 import BeautifulSoup
import re

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}

# Test URLs
urls_to_test = [
    "https://www.bisnis.com/index?categoryId=194",       # Page 1
    "https://www.bisnis.com/index?categoryId=194&page=2", # Page 2
]

for url in urls_to_test:
    print(f"\n{'='*60}")
    print(f"Testing: {url}")
    print('='*60)
    
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        print(f"Status: {resp.status_code}")
        
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # Look for article links
        # Current scraper looks for: market.bisnis.com/read/
        all_links = soup.find_all('a', href=True)
        
        market_links = []
        for link in all_links:
            href = link['href']
            if 'market.bisnis.com/read/' in href:
                market_links.append(href)
        
        print(f"\nFound {len(set(market_links))} unique market article links")
        for link in list(set(market_links))[:5]:
            print(f"  - {link}")
            
        # Look for pagination
        print("\nPagination analysis:")
        # Usually pagination links contain "page="
        pagination = soup.find_all('a', href=lambda x: x and 'page=' in x)
        for p in pagination[:5]:
            print(f"  - {p.get('href')}: {p.text.strip()}")
            
        # Look for date elements (inspecting common classes)
        print("\nSample potential date elements:")
        # Try to find dates based on current scraper logic or common classes
        found_dates = []
        for div in soup.find_all(['div', 'span'], class_=re.compile(r'(date|time|meta)', re.I)):
            text = div.get_text(strip=True)
            if any(m in text.lower() for m in ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des', 'wib', 'lalu']):
                found_dates.append(text)
        
        for d in found_dates[:5]:
            print(f"  - {d}")

    except Exception as e:
        print(f"Error: {e}")
