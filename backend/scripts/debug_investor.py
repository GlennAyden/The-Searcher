"""Debug Investor.id article detection"""
import requests
from bs4 import BeautifulSoup
import re

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}

url = "https://investor.id/corporate-action/indeks"
print(f"Testing: {url}")

resp = requests.get(url, headers=HEADERS, timeout=15)
soup = BeautifulSoup(resp.text, 'html.parser')

print("\n1. All links containing 'corporate-action':")
for a_tag in soup.find_all('a', href=True)[:50]:
    href = a_tag['href']
    if 'corporate-action' in href and 'indeks' not in href:
        print(f"   {href}")

print("\n2. Current scraper regex test on these links:")
for a_tag in soup.find_all('a', href=True)[:50]:
    href = a_tag['href']
    if 'corporate-action' in href:
        match = re.search(r'/(market|corporate-action)/\d+/', href)
        if match:
            print(f"   MATCH: {href}")
        elif 'indeks' not in href:
            print(f"   NO MATCH: {href}")

print("\n3. Sample article URL pattern from page:")
article_links = [a['href'] for a in soup.find_all('a', href=True) 
                 if 'corporate-action' in a['href'] and 'indeks' not in a['href']]

for link in article_links[:5]:
    print(f"   Pattern: {link}")
    # Check if it has article ID
    parts = link.split('/')
    print(f"   Parts: {parts}")
