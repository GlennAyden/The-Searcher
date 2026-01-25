"""Check for unhandled categories on Investor.id"""
import requests
from bs4 import BeautifulSoup
import re

url = "https://investor.id/corporate-action/indeks"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

resp = requests.get(url, headers=headers)
soup = BeautifulSoup(resp.text, 'html.parser')

print("Scanning for article-like links containing digits but NOT market/corporate-action...")

unhandled = []
for a in soup.find_all('a', href=True):
    href = a['href']
    # Check if it looks like an article (has ID)
    if re.search(r'/\d{5,}', href): # At least 5 digits usually
        # Check if matched by current regex
        if not re.search(r'/(market|corporate-action)/\d+', href):
            if 'indeks' not in href and 'javascript' not in href:
                unhandled.append(href)

unique_unhandled = list(set(unhandled))
print(f"Found {len(unique_unhandled)} unhandled potential articles.")
for u in unique_unhandled[:10]:
    print(f"  - {u}")
