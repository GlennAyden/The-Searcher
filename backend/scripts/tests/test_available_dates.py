"""
Test script untuk validasi available dates API endpoint.
Tes ini memverifikasi bahwa endpoint returns data yang benar dari database.
"""
import requests
import json

# Configuration
BASE_URL = "http://localhost:8000"
TICKER = "ENRG"  # Ticker yang terlihat di screenshot

def test_available_dates_endpoint():
    """Test GET /api/neobdm-broker-summary/available-dates/{ticker}"""
    print(f"\n{'='*60}")
    print(f"Testing Available Dates API for ticker: {TICKER}")
    print(f"{'='*60}\n")
    
    endpoint = f"{BASE_URL}/api/neobdm-broker-summary/available-dates/{TICKER}"
    
    try:
        print(f"📡 Request: GET {endpoint}")
        response = requests.get(endpoint)
        
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ SUCCESS! Response:")
            print(json.dumps(data, indent=2))
            
            # Validations
            print(f"\n{'='*60}")
            print("VALIDATIONS")
            print(f"{'='*60}")
            
            assert 'ticker' in data, "❌ Missing 'ticker' field"
            print(f"✅ Ticker field present: {data['ticker']}")
            
            assert 'available_dates' in data, "❌ Missing 'available_dates' field"
            print(f"✅ Available dates field present")
            
            assert 'total_count' in data, "❌ Missing 'total_count' field"
            print(f"✅ Total count field present: {data['total_count']}")
            
            assert isinstance(data['available_dates'], list), "❌ 'available_dates' bukan list"
            print(f"✅ Available dates is a list")
            
            assert len(data['available_dates']) == data['total_count'], "❌ Length mismatch"
            print(f"✅ Length matches total_count: {len(data['available_dates'])} dates")
            
            if data['available_dates']:
                print(f"\n📅 Available Dates:")
                for i, date in enumerate(data['available_dates'][:10], 1):
                    print(f"   {i}. {date}")
                if len(data['available_dates']) > 10:
                    print(f"   ... and {len(data['available_dates']) - 10} more")
                    
                # Validate date format
                from datetime import datetime
                for date in data['available_dates']:
                    try:
                        datetime.strptime(date, '%Y-%m-%d')
                    except ValueError:
                        print(f"❌ Invalid date format: {date}")
                        return False
                print(f"✅ All dates have valid format (YYYY-MM-DD)")
            else:
                print(f"⚠️  No dates found for ticker {TICKER}")
            
            print(f"\n{'='*60}")
            print("🎉 ALL VALIDATIONS PASSED!")
            print(f"{'='*60}\n")
            return True
            
        else:
            print(f"❌ FAILED! Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"❌ ERROR: Cannot connect to {BASE_URL}")
        print(f"⚠️  Make sure backend is running!")
        return False
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False


def test_multiple_tickers():
    """Test dengan beberapa ticker berbeda"""
    print(f"\n{'='*60}")
    print("Testing Multiple Tickers")
    print(f"{'='*60}\n")
    
    tickers = ["ENRG", "ANTM", "BBCA", "TLKM", "BRMS"]
    results = {}
    
    for ticker in tickers:
        endpoint = f"{BASE_URL}/api/neobdm-broker-summary/available-dates/{ticker}"
        try:
            response = requests.get(endpoint)
            if response.status_code == 200:
                data = response.json()
                count = data.get('total_count', 0)
                results[ticker] = count
                print(f"✅ {ticker}: {count} dates available")
            else:
                results[ticker] = 0
                print(f"⚠️  {ticker}: No data")
        except Exception as e:
            results[ticker] = 'ERROR'
            print(f"❌ {ticker}: {str(e)}")
    
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    for ticker, count in results.items():
        print(f"{ticker}: {count}")


if __name__ == "__main__":
    print("""
    ╔══════════════════════════════════════════════════════╗
    ║  Available Dates API Validation Test                ║
    ║  Testing Broker Summary Feature                      ║
    ╚══════════════════════════════════════════════════════╝
    """)
    
    # Test 1: Main endpoint
    success = test_available_dates_endpoint()
    
    # Test 2: Multiple tickers (jika test 1 berhasil)
    if success:
        test_multiple_tickers()
    
    print("\n✨ Test completed!\n")
