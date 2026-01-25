"""Quick test of Investor.id scraper"""
import sys
sys.path.insert(0, 'C:/Data/AI Playground/project-searcher/backend')

from datetime import datetime, timedelta
from modules.scraper_investor import InvestorScraper

# Test scraping last 3 days with only 2 pages
scraper = InvestorScraper()
start = datetime.now() - timedelta(days=3)
end = datetime.now()

print("Running Investor.id scraper (2 pages per category)...")
results = scraper.run(start, end, pages=2)

print(f"\n\nFinal: {len(results) if results else 0} articles")
if results:
    for r in results[:3]:
        print(f"  - [{r.get('ticker', 'N/A')}] {r.get('title', '')[:50]}")
