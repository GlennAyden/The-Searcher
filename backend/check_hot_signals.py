import sqlite3

conn = sqlite3.connect('data/market_sentinel.db')
cursor = conn.cursor()

# Check data for latest scrape
cursor.execute("""
    SELECT symbol, d_0, pct_1d, price 
    FROM neobdm_records 
    WHERE scraped_at = (SELECT MAX(scraped_at) FROM neobdm_records WHERE method='m' AND period='c')
      AND method='m' 
      AND period='c'
    LIMIT 10
""")

print("=== Latest Hot Signals Data ===")
print("Symbol | d_0 (Flow) | pct_1d (Change) | Price")
print("-" * 60)
for row in cursor.fetchall():
    symbol = str(row[0] or '')[:8]
    d0 = str(row[1] or '')[:12]
    pct = str(row[2] or '')[:15]
    price = str(row[3] or '')
    print(f"{symbol:8} | {d0:12} | {pct:15} | {price}")

# Check if data has 'B' suffix or is numeric
cursor.execute("""
    SELECT d_0, pct_1d, typeof(d_0), typeof(pct_1d)
    FROM neobdm_records 
    WHERE scraped_at = (SELECT MAX(scraped_at) FROM neobdm_records WHERE method='m' AND period='c')
      AND method='m' 
      AND period='c'
      AND symbol='AHAP'
    LIMIT 1
""")
result = cursor.fetchone()
if result:
    print(f"\n=== Data Type Check (AHAP) ===")
    print(f"d_0 value: '{result[0]}' (type: {result[2]})")
    print(f"pct_1d value: '{result[1]}' (type: {result[3]})")

conn.close()
