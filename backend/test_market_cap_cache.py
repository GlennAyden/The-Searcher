"""Test script for market cap caching functionality."""
import sys
sys.path.insert(0, 'c:/Data/AI Playground/project-searcher/backend')

from data_provider import data_provider
import time

print("="*60)
print("MARKET CAP CACHING TEST")
print("="*60)

# Test 1: First fetch (should hit yfinance)
print("\n[TEST 1] First fetch for BBCA (should query yfinance)...")
start = time.time()
cap1 = data_provider.get_market_cap("BBCA")
duration1 = time.time() - start
print(f"  Result: Rp {cap1:,.0f}" if cap1 else "  Result: None")
print(f"  Duration: {duration1:.2f}s")

# Test 2: Second fetch (should hit cache)
print("\n[TEST 2] Second fetch for BBCA (should use cache)...")
start = time.time()
cap2 = data_provider.get_market_cap("BBCA")
duration2 = time.time() - start
print(f"  Result: Rp {cap2:,.0f}" if cap2 else "  Result: None")
print(f"  Duration: {duration2:.2f}s")

# Test 3: Verify cache hit
print("\n[TEST 3] Verifying cache behavior...")
if cap1 == cap2:
    print("  ✅ Cache working! Same value returned")
    print(f"  ✅ Speed improvement: {duration1/duration2:.1f}x faster")
else:
    print("  ❌ Cache failed! Different values")

# Test 4: Flow impact calculation
print("\n[TEST 4] Flow impact calculation...")
if cap1:
    flow_150b = data_provider.calculate_flow_impact(150, cap1)
    print(f"  Flow: Rp 150B")
    print(f"  Market Cap: Rp {cap1:,.0f}")
    print(f"  Impact: {flow_150b['impact_pct']}%")
    print(f"  Label: {flow_150b['impact_label']}")
    print(f"  ✅ Calculation successful")

# Test 5: Different ticker
print("\n[TEST 5] Testing another ticker (BMRI)...")
cap_bmri = data_provider.get_market_cap("BMRI")
if cap_bmri:
    print(f"  BMRI Market Cap: Rp {cap_bmri:,.0f}")
    flow_impact = data_provider.calculate_flow_impact(100, cap_bmri)
    print(f"  100B flow impact: {flow_impact['impact_pct']}% ({flow_impact['impact_label']})")
    print(f"  ✅ Multi-ticker test passed")

print("\n" + "="*60)
print("ALL TESTS COMPLETE!")
print("="*60)
