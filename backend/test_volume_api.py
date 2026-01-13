"""
Test script untuk Volume Daily API
"""
import requests
import json

# Test API endpoint
url = "http://localhost:8000/api/volume-daily?ticker=BBCA"

print("=" * 60)
print("Testing Volume Daily API Endpoint")
print("=" * 60)
print(f"\nURL: {url}\n")

try:
    response = requests.get(url)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}\n")
    
    if response.status_code == 200:
        data = response.json()
        
        print("✅ SUCCESS! API Response:")
        print("-" * 60)
        print(f"Ticker: {data['ticker']}")
        print(f"Source: {data['source']}")
        print(f"Records Added: {data['records_added']}")
        print(f"Total Records: {len(data['data'])}")
        print("-" * 60)
        
        if data['data']:
            print("\n📊 Sample Data (First 3 records):")
            for i, record in enumerate(data['data'][:3], 1):
                print(f"\n  Record {i}:")
                print(f"    Date: {record['trade_date']}")
                print(f"    Volume: {record['volume']:,}")
                print(f"    Close: {record.get('close_price', 'N/A')}")
        
        print("\n" + "=" * 60)
        print("✅ Volume Daily feature is working!")
        print("=" * 60)
        
    else:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"❌ Exception: {e}")
