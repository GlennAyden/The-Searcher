"""Inspect Bisnis.com container classes"""
import requests
from bs4 import BeautifulSoup

url = "https://www.bisnis.com/index?categoryId=194"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

resp = requests.get(url, headers=headers)
soup = BeautifulSoup(resp.text, 'html.parser')

print("Classes of divs containing 'list' or 'news' or 'feed':")
for div in soup.find_all('div', class_=True):
    classes = div['class']
    for c in classes:
        if any(x in c.lower() for x in ['list', 'news', 'feed', 'main', 'left', 'center']):
            # Check if this div contains article links
            links = div.find_all('a', href=lambda h: h and 'market.bisnis.com/read/' in h)
            if len(links) >= 10:
                print(f"Class: {classes}, Article Links: {len(links)}")
                # Print first text to verify
                print(f"  First text: {div.get_text(strip=True)[:50]}...")

print("\nSpecific check for 'col-md-8' or similar main columns:")
for div in soup.find_all('div', class_=lambda c: c and 'col' in c):
    msg = f"Class: {div['class']}"
    links = div.find_all('a', href=lambda h: h and 'market.bisnis.com/read/' in h)
    if len(links) > 5:
        print(f"{msg} -> {len(links)} links")
