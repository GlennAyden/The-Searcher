import sqlite3
from datetime import datetime

def check():
    conn = sqlite3.connect('backend/data/market_sentinel.db')
    today = datetime.now().strftime('%Y-%m-%d')
    print(f"Checking records for {today}")
    query = "SELECT method, period, COUNT(*) FROM neobdm_records WHERE scraped_at LIKE ? GROUP BY method, period"
    rows = conn.execute(query, (f"{today}%",)).fetchall()
    for r in rows:
        print(r)
    print(f"\nChecking news for {today}")
    query_news = "SELECT COUNT(*) FROM news WHERE timestamp LIKE ?"
    news_count = conn.execute(query_news, (f"{today}%",)).fetchone()[0]
    print(f"News count: {news_count}")

    print(f"\nChecking disclosures for {today}")
    query_dis = "SELECT ticker, title, published_date FROM idx_disclosures ORDER BY published_date DESC LIMIT 5"
    dis_rows = conn.execute(query_dis).fetchall()
    for r in dis_rows:
        print(r)
    conn.close()

if __name__ == "__main__":
    check()
