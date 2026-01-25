"""Analyze Investor.id page structure"""
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}

# Test both URL patterns
urls_to_test = [
    "https://investor.id/corporate-action/indeks",       # Page 1 original
    "https://investor.id/corporate-action/indeks/1",     # Page 1 with /1
    "https://investor.id/corporate-action/indeks/10",    # Page 2 (offset 10?)
]

for url in urls_to_test:
    print(f"\n{'='*60}")
    print(f"Testing: {url}")
    print('='*60)
    
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        print(f"Status: {resp.status_code}")
        
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # Try to find article elements
        # Check for article links
        all_links = soup.find_all('a', href=True)
        
        # Filter for potential article links
        article_links = []
        for link in all_links:
            href = link['href']
            # Articles usually contain category paths
            if '/corporate-action/' in href and '/indeks' not in href:
                article_links.append(href)
        
        unique_links = list(set(article_links))[:5]  # Show first 5
        print(f"\nFound {len(set(article_links))} unique article links")
        for link in unique_links:
            print(f"  - {link}")
        
        # Look for pagination
        print("\nPagination analysis:")
        pagination = soup.find_all('a', href=lambda x: x and 'indeks/' in x)
        for p in pagination[:5]:
            print(f"  - {p.get('href')}: {p.text.strip()}")
        
        # Look for date elements
        print("\nSample date elements:")
        date_elements = soup.find_all(text=lambda t: t and ('WIB' in t or '2026' in str(t) or '2025' in str(t)))[:3]
        for d in date_elements:
            print(f"  - {d.strip()[:60]}")
            
    except Exception as e:
        print(f"Error: {e}")
