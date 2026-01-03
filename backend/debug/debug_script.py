import requests
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}
try:
    r = requests.get("https://www.cnbcindonesia.com/market/indeks/5", headers=HEADERS, timeout=10)
    with open("debug_cnbc.html", "w", encoding="utf-8") as f:
        f.write(r.text)
    print(f"Saved {len(r.text)} bytes")
except Exception as e:
    print(e)
