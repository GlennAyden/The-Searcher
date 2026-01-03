import requests
import json

try:
    url = 'http://localhost:8000/api/disclosures?start_date=2025-01-01'
    print(f"Fetching from: {url}")
    r = requests.get(url)
    data = r.json()
    
    print(f"\nTotal Disclosures returned by API: {len(data)}")
    
    for item in data:
        print(f"ID: {item['id']} | Ticker: '{item['ticker']}' | Date: {item['date']} | Title: {item['title']}")
        
except Exception as e:
    print(f"Error: {e}")
