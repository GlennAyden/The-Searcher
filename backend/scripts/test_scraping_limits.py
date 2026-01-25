"""
Script to test scraping limits - find earliest reachable date
"""
import sys
sys.path.insert(0, 'C:/Data/AI Playground/project-searcher/backend')

from datetime import datetime, timedelta
from modules.database import DatabaseManager

def delete_all_news():
    """Delete ALL news to test fresh scraping"""
    db = DatabaseManager()
    conn = db._get_conn()
    
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM news")
        total = cursor.fetchone()[0]
        print(f"Found {total} total news articles")
        
        # Just delete Bisnis and Investor for now
        cursor.execute("DELETE FROM news WHERE url LIKE '%bisnis.com%' OR url LIKE '%investor.id%'")
        deleted = cursor.rowcount
        conn.commit()
        
        print(f"✅ Deleted {deleted} Bisnis.com + Investor.id articles")
        
    finally:
        conn.close()

def test_bisnis_limit():
    """Test Bisnis.com scraping limit"""
    from modules.scraper_bisnis import BisnisScraper
    
    # Very old start date to force max pagination
    target_start = datetime(2026, 1, 1)
    target_end = datetime.now()
    
    print("\n" + "="*60)
    print("TESTING BISNIS.COM (pages=30)")
    print("="*60)
    
    scraper = BisnisScraper()
    results = scraper.run(target_start, target_end, pages=30)
    
    if results:
        dates = []
        for r in results:
            d = r.get('date') or r.get('timestamp')
            if d:
                if isinstance(d, datetime):
                    dates.append(d.strftime('%Y-%m-%d'))
                else:
                    dates.append(str(d)[:10])
        
        dates = sorted(set(dates))
        print(f"\n📊 BISNIS.COM RESULTS:")
        print(f"   Total articles: {len(results)}")
        if dates:
            print(f"   Earliest date: {dates[0]}")
            print(f"   Latest date: {dates[-1]}")
            print(f"   All dates: {dates}")
    else:
        print("No results from Bisnis.com")
    
    return results

def test_investor_limit():
    """Test Investor.id scraping limit"""
    from modules.scraper_investor import InvestorScraper
    
    target_start = datetime(2026, 1, 1)
    target_end = datetime.now()
    
    print("\n" + "="*60)
    print("TESTING INVESTOR.ID (pages=30)")
    print("="*60)
    
    scraper = InvestorScraper()
    results = scraper.run(target_start, target_end, pages=30)
    
    if results:
        dates = []
        for r in results:
            d = r.get('date') or r.get('timestamp')
            if d:
                if isinstance(d, datetime):
                    dates.append(d.strftime('%Y-%m-%d'))
                else:
                    dates.append(str(d)[:10])
        
        dates = sorted(set(dates))
        print(f"\n📊 INVESTOR.ID RESULTS:")
        print(f"   Total articles: {len(results)}")
        if dates:
            print(f"   Earliest date: {dates[0]}")
            print(f"   Latest date: {dates[-1]}")
            print(f"   All dates: {dates}")
    else:
        print("No results from Investor.id")
    
    return results

if __name__ == "__main__":
    print("="*60)
    print("STEP 1: CLEAR BISNIS + INVESTOR NEWS")
    print("="*60)
    delete_all_news()
    
    print("\n" + "="*60)
    print("STEP 2: TEST SCRAPING LIMITS")
    print("="*60)
    
    bisnis_results = test_bisnis_limit()
    investor_results = test_investor_limit()
    
    print("\n" + "="*60)
    print("FINAL SUMMARY")
    print("="*60)
    print(f"Bisnis.com: {len(bisnis_results) if bisnis_results else 0} articles")
    print(f"Investor.id: {len(investor_results) if investor_results else 0} articles")
