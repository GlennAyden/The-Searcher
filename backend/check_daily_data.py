import sqlite3

conn = sqlite3.connect('data/market_sentinel.db')
cursor = conn.cursor()

# Check period='d' data
print("=== Checking period='d' (Daily) data ===")
cursor.execute("""
    SELECT symbol, d_0, pct_1d, price
    FROM neobdm_records 
    WHERE method='m' AND period='d'
    ORDER BY scraped_at DESC
    LIMIT 5
""")

for row in cursor.fetchall():
    print(f"Symbol: {row[0]}, d_0: {row[1]}, pct_1d: {row[2]}, price: {row[3]}")

# Count NON-NULL in period='d'
cursor.execute("""
    SELECT 
        SUM(CASE WHEN d_0 IS NOT NULL AND d_0 != '' THEN 1 ELSE 0 END) as has_d0,
        SUM(CASE WHEN pct_1d IS NOT NULL AND pct_1d != '' THEN 1 ELSE 0 END) as has_pct,
        COUNT(*) as total
    FROM neobdm_records
    WHERE method='m' AND period='d'
""")
result = cursor.fetchone()
print(f"\nPeriod='d' stats: {result[0]}/{result[2]} have d_0, {result[1]}/{result[2]} have pct_1d")

conn.close()
