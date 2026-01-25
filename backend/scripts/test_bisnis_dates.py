"""Test Bisnis.com date extraction on Page 2"""
import sys
sys.path.insert(0, 'C:/Data/AI Playground/project-searcher/backend')
from modules.scraper_bisnis import BisnisScraper
from datetime import datetime

scraper = BisnisScraper()

print("\n" + "="*60)
print("TESTING BISNIS.COM PAGE 2 DATES")
print("="*60)

# Fetch Page 2
articles = scraper.get_index_page_with_dates(page=2)
print(f"Found {len(articles)} articles on Page 2")

for i, (url, date_val, title) in enumerate(articles[:10]):
    print(f"\nItem {i+1}:")
    print(f"  Title: {title}")
    print(f"  Date:  {date_val}")
    print(f"  URL:   {url}")

# Check if any date is today (fallback) when it shouldn't be
now_date = datetime.now().date()
fallback_count = 0
for _, date_val, _ in articles:
    if date_val.date() == now_date:
        fallback_count += 1

print(f"\nPotential fallbacks (today's date): {fallback_count}/{len(articles)}")
