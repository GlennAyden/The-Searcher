"""
Test script for Bisnis.com scraper.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from modules.scraper_bisnis import parse_bisnis_date, BisnisScraper


def test_parse_bisnis_date():
    """Test Indonesian date parsing."""
    print("=== Testing Date Parsing ===")
    
    test_cases = [
        ("Minggu, 25 Januari 2026 | 13:37", datetime(2026, 1, 25, 13, 37)),
        ("Jumat, 24 Januari 2026 | 09:15", datetime(2026, 1, 24, 9, 15)),
        ("Senin, 1 Desember 2025 | 08:00", datetime(2025, 12, 1, 8, 0)),
        ("Rabu, 15 Februari 2026 | 14:30", datetime(2026, 2, 15, 14, 30)),
    ]
    
    passed = 0
    for input_str, expected in test_cases:
        result = parse_bisnis_date(input_str)
        if result:
            # Compare without timezone
            result_naive = result.replace(tzinfo=None)
            if result_naive == expected:
                print(f"  [PASS] '{input_str}' -> {result}")
                passed += 1
            else:
                print(f"  [FAIL] '{input_str}'")
                print(f"         Expected: {expected}")
                print(f"         Got: {result_naive}")
        else:
            print(f"  [FAIL] '{input_str}' -> None")
    
    print(f"\n  Results: {passed}/{len(test_cases)} passed\n")
    return passed == len(test_cases)


def test_get_index_page():
    """Test fetching index page links."""
    print("=== Testing Index Page Fetch ===")
    
    scraper = BisnisScraper()
    links = scraper.get_index_page(page=1)
    
    print(f"  Found {len(links)} links on page 1")
    
    if links:
        print(f"  Sample links:")
        for link in links[:3]:
            print(f"    - {link}")
        return True
    else:
        print("  [WARN] No links found - may be network issue")
        return False


def test_get_article_detail():
    """Test fetching article detail."""
    print("\n=== Testing Article Detail Fetch ===")
    
    # Use a sample URL
    test_url = "https://market.bisnis.com/read/20260125/7/1946968/ini-biang-kerok-pasar-saham-ri-dilanda-aksi-jual-asing-rp325-triliun"
    
    scraper = BisnisScraper()
    article = scraper.get_article_detail(test_url)
    
    if article:
        print(f"  Title: {article['title'][:60]}...")
        print(f"  Date: {article['timestamp']}")
        print(f"  Ticker: {article['ticker'] or 'None'}")
        print(f"  Content Length: {len(article['clean_text'])} chars")
        return True
    else:
        print("  [FAIL] Could not fetch article")
        return False


def test_full_scrape():
    """Test full scrape (limited)."""
    print("\n=== Testing Full Scrape (1 day, 1 page) ===")
    
    from datetime import timedelta
    
    scraper = BisnisScraper()
    start = datetime.now() - timedelta(days=1)
    end = datetime.now()
    
    # Only 1 page for test
    results = scraper.run(start, end, pages=1)
    
    print(f"  Scraped {len(results)} articles")
    
    if results:
        print(f"  Sample:")
        for r in results[:2]:
            print(f"    - {r.get('title', 'N/A')[:50]}...")
            print(f"      Sentiment: {r.get('sentiment_label', 'N/A')}")
        return True
    else:
        print("  [WARN] No results - may be expected if no new articles")
        return True  # Not necessarily a failure


if __name__ == "__main__":
    print("\n" + "="*50)
    print(" BISNIS.COM SCRAPER TEST SUITE")
    print("="*50 + "\n")
    
    all_passed = True
    
    # Test 1: Date parsing (offline)
    if not test_parse_bisnis_date():
        all_passed = False
    
    # Test 2: Index page (requires network)
    if not test_get_index_page():
        all_passed = False
    
    # Test 3: Article detail (requires network)
    if not test_get_article_detail():
        all_passed = False
    
    # Test 4: Full scrape (requires network + GPU for sentiment)
    # Uncomment to run full test:
    # if not test_full_scrape():
    #     all_passed = False
    
    print("\n" + "="*50)
    if all_passed:
        print(" ALL TESTS PASSED")
    else:
        print(" SOME TESTS FAILED")
    print("="*50 + "\n")
