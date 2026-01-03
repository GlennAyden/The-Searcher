import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from modules.utils import extract_tickers
import config

# Mock the config path to use the real file
print(f"Testing with DB: {config.TICKER_DB_FILE}")

test_cases = [
    ("BBRI", "Saham BBRI naik hari ini."),
    ("BBRI", "Bank Rakyat Indonesia melaporkan kenaikan laba."),
    ("GOTO", "GoTo Gojek Tokopedia masih rugi bersih."),
    ("BBCA", "PT Bank Central Asia Tbk mencatat rekor baru."),
    ("BMRI", "Bank Mandiri (Persero) Tbk sedang ekspansi."),
    ("TLKM", "Telekomunikasi Indonesia (Persero) Tbk akan membagikan dividen."),
]

print("\n--- Running Tests ---")
passed = 0
for expected, text in test_cases:
    results = extract_tickers(text)
    expected_full = f"{expected}.JK"
    
    print(f"Input: '{text}'")
    print(f"Expected: {expected_full} | Got: {results}")
    
    if expected_full in results:
        print("✅ PASS")
        passed += 1
    else:
        print("❌ FAIL")

print(f"\nResult: {passed}/{len(test_cases)} passed.")
