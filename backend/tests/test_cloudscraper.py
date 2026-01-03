import cloudscraper
import json

def test_cloudscraper():
    print("Testing cloudscraper...")
    scraper = cloudscraper.create_scraper()  # returns a CloudScraper instance
    
    url = "https://www.idx.co.id/primary/NewsAnnouncement/GetNewsAnnouncement?indexFrom=0&pageSize=10&year=&dateFrom=20251218&dateTo=20251218&activityType=&code=BBRI&keyword="
    headers = {
        "Referer": "https://www.idx.co.id/id/perusahaan-tercatat/keterbukaan-informasi/",
        "X-Requested-With": "XMLHttpRequest"
    }
    
    try:
        response = scraper.get(url, headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("Success!")
            print(str(response.json())[:200])
        else:
            print(f"Failed. Response: {response.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_cloudscraper()
