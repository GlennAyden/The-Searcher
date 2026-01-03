import requests
import datetime

# Constants
IDX_API_URL = "https://www.idx.co.id/primary/NewsAnnouncement/GetNewsAnnouncement"
REFERER_URL = "https://www.idx.co.id/id/perusahaan-tercatat/keterbukaan-informasi/"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def test_connection():
    session = requests.Session()
    
    # Common headers
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Referer": REFERER_URL,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        # "Sec-Fetch-Dest": "empty",
        # "Sec-Fetch-Mode": "cors",
        # "Sec-Fetch-Site": "same-origin",
    })

    # Step 1: Visit main page to get cookies
    print("Visiting main page...")
    try:
        r_main = session.get(REFERER_URL, timeout=10)
        print(f"Main page status: {r_main.status_code}")
    except Exception as e:
        print(f"Main page failed: {e}")

    # Step 2: Hit API
    date_formatted = datetime.date.today().strftime("%Y%m%d")
    
    params = {
        "indexFrom": 0,
        "pageSize": 10,
        "year": "",
        "dateFrom": date_formatted,
        "dateTo": date_formatted,
        "activityType": "",
        "code": "BBRI",
        "keyword": ""
    }

    print("Hitting API...")
    try:
        response = session.get(IDX_API_URL, params=params, timeout=10)
        print(f"API Status: {response.status_code}")
        print(f"API Response Head: {response.text[:200]}")
    except Exception as e:
        print(f"API failed: {e}")

if __name__ == "__main__":
    test_connection()
