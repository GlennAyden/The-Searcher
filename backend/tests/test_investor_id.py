"""Quick test script for investor.id website analysis"""
import requests
from bs4 import BeautifulSoup

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
}

# Test index page
print('=== Testing Index Page ===')
resp = requests.get('https://investor.id/corporate-action/indeks', headers=headers, timeout=15)
print(f'Status: {resp.status_code}')

if resp.status_code == 200:
    soup = BeautifulSoup(resp.text, 'html.parser')
    
    # Find article links
    links = []
    for a in soup.find_all('a', href=True):
        href = a['href']
        if '/market/' in href or '/corporate-action/' in href:
            if href not in links and 'indeks' not in href:
                links.append(href)
    
    print(f'Found {len(links)} article links')
    for link in links[:5]:
        print(f'  - {link}')
    
    # Look for pagination
    print('\n=== Pagination ===')
    for a in soup.find_all('a', href=True):
        href = a.get('href', '')
        text = a.text.strip()
        if 'page' in href.lower() or text in ['2', '3', '4', '5', '»', '>>']:
            print(f'  Pagination: {href} | Text: {text[:20]}')
    
    # Look for date elements
    print('\n=== Date Elements ===')
    dates_found = []
    for elem in soup.find_all(text=True):
        text = elem.strip()
        if ('Jan' in text or 'WIB' in text or '2026' in text) and len(text) < 50:
            if text not in dates_found:
                dates_found.append(text)
                print(f'  Date: {text}')
                if len(dates_found) >= 10:
                    break
else:
    print(f'Failed: {resp.status_code}')

# Test article detail page
print('\n\n=== Testing Article Detail Page ===')
resp2 = requests.get('https://investor.id/market/425815/bumi-ungkap-aksi-baru', headers=headers, timeout=15)
print(f'Status: {resp2.status_code}')

if resp2.status_code == 200:
    soup2 = BeautifulSoup(resp2.text, 'html.parser')
    
    # Title
    h1 = soup2.find('h1')
    print(f'Title: {h1.text.strip() if h1 else "NOT FOUND"}')
    
    # Date - look for common patterns
    print('\nDate Candidates:')
    for elem in soup2.find_all(['span', 'time', 'div', 'p']):
        text = elem.get_text(strip=True)
        if ('Jan' in text or '2026' in text or 'WIB' in text) and len(text) < 60:
            print(f'  - {text}')
    
    # Content
    print('\nContent Samples:')
    for p in soup2.find_all('p')[:5]:
        text = p.get_text(strip=True)
        if text and len(text) > 50:
            print(f'  - {text[:80]}...')
