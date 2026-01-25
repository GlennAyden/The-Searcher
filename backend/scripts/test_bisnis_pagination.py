"""Test Bisnis.com pagination"""
import sys
sys.path.insert(0, 'C:/Data/AI Playground/project-searcher/backend')
from modules.scraper_bisnis import BisnisScraper
from datetime import datetime
import time

scraper = BisnisScraper()

print("\n" + "="*60)
print("TESTING BISNIS.COM PAGINATION")
print("="*60)

# Fetch Page 1
print("\nFetching Page 1...")
page1 = scraper.get_index_page_with_dates(page=1)
titles1 = [t[2] for t in page1]
print(f"Found {len(page1)} articles on Page 1")
for t in titles1[:3]:
    print(f"  - {t}")

# Fetch Page 2
print("\nFetching Page 2...")
page2 = scraper.get_index_page_with_dates(page=2)
titles2 = [t[2] for t in page2]
print(f"Found {len(page2)} articles on Page 2")
for t in titles2[:3]:
    print(f"  - {t}")

# Check overlap
overlap = set(titles1).intersection(set(titles2))
print(f"\nOverlap: {len(overlap)} articles")
if len(overlap) == len(titles1) and len(titles1) > 0:
    print("❌ ERROR: Page 1 and Page 2 are identical!")
elif len(titles2) == 0:
    print("❌ ERROR: Page 2 is empty!")
else:
    print("✅ Pagination seems to be working (different content found).")
