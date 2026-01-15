"""
Quick test script to verify the broker journey API fix.
Tests that the endpoint now returns valid JSON without numpy type errors.
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_broker_journey_fix():
    """Test POST /api/neobdm-broker-summary/journey"""
    print("\n" + "="*70)
    print("Testing Broker Journey API After Numpy Type Fix")
    print("="*70 + "\n")
    
    endpoint = f"{BASE_URL}/api/neobdm-broker-summary/journey"
    
    # Test payload based on the screenshot (ENRG ticker with YU broker)
    payload = {
        "ticker": "ENRG",
        "brokers": ["YU"],
        "start_date": "2026-01-05",
        "end_date": "2026-01-13"
    }
    
    print(f"📡 Request: POST {endpoint}")
    print(f"📦 Payload:")
    print(json.dumps(payload, indent=2))
    print()
    
    try:
        response = requests.post(endpoint, json=payload, timeout=10)
        
        print(f"📊 Status Code: {response.status_code}")
        print()
        
        if response.status_code == 200:
            try:
                data = response.json()
                print("✅ SUCCESS! Response is valid JSON\n")
                print(json.dumps(data, indent=2))
                
                # Validate structure
                print("\n" + "="*70)
                print("VALIDATIONS")
                print("="*70)
                
                assert 'ticker' in data, "Missing 'ticker' field"
                print(f"✅ Ticker: {data['ticker']}")
                
                assert 'brokers' in data, "Missing 'brokers' field"
                print(f"✅ Brokers field present")
                
                if data['brokers']:
                    broker = data['brokers'][0]
                    print(f"\n📊 Broker Data for {broker['broker_code']}:")
                    print(f"   - Days Active: {broker['summary']['days_active']}")
                    print(f"   - Net Value: {broker['summary']['net_value']}B")
                    print(f"   - Is Accumulating: {broker['summary']['is_accumulating']}")
                    print(f"   - Total Buy: {broker['summary']['total_buy_value']}B")
                    print(f"   - Total Sell: {broker['summary']['total_sell_value']}B")
                    
                    # Check data types
                    assert isinstance(broker['summary']['is_accumulating'], bool), \
                        f"is_accumulating is {type(broker['summary']['is_accumulating'])}, expected bool"
                    print(f"\n✅ 'is_accumulating' is Python bool (not numpy.bool)")
                    
                    assert isinstance(broker['summary']['days_active'], int), \
                        "days_active should be int"
                    print(f"✅ 'days_active' is Python int")
                    
                    print(f"\n📈 Daily Data Points: {len(broker['daily_data'])}")
                    if broker['daily_data']:
                        first_day = broker['daily_data'][0]
                        print(f"   Sample (first day):")
                        print(f"   - Date: {first_day['date']}")
                        print(f"   - Buy Value: {first_day['buy_value']}B")
                        print(f"   - Cumulative Net: {first_day['cumulative_net_value']}B")
                
                print("\n" + "="*70)
                print("🎉 ALL TESTS PASSED! The numpy type fix is working!")
                print("="*70)
                return True
                
            except json.JSONDecodeError as e:
                print(f"❌ JSON Decode Error: {e}")
                print(f"Response text: {response.text[:500]}")
                return False
        else:
            print(f"❌ ERROR! Status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"❌ Cannot connect to {BASE_URL}")
        print("⚠️  Make sure backend is running!")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("""
    ╔══════════════════════════════════════════════════════════════════╗
    ║  Broker Journey API Fix Validation                              ║
    ║  Testing numpy.bool serialization fix                           ║
    ╚══════════════════════════════════════════════════════════════════╝
    """)
    
    success = test_broker_journey_fix()
    
    if success:
        print("\n✨ Backend is ready! You can now test in browser.\n")
    else:
        print("\n⚠️  Please check backend logs for errors.\n")
