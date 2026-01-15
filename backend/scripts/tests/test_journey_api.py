import requests
import json

url = "http://localhost:8000/api/neobdm-broker-summary/journey"
payload = {
    "ticker": "ENRG",
    "brokers": ["YU", "AK", "CC"],
    "start_date": "2026-01-05",
    "end_date": "2026-01-13"
}
headers = {
    'Content-Type': 'application/json'
}

try:
    response = requests.post(url, headers=headers, data=json.dumps(payload))
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        print("Success!")
        print(json.dumps(response.json(), indent=2)[:500])
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
