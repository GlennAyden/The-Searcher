import sqlite3

conn = sqlite3.connect('data/market_sentinel.db')
cursor = conn.cursor()

# Check NULL counts per date
cursor.execute("""
    SELECT 
        substr(scraped_at,1,10) as date,
        COUNT(*) as total,
        SUM(CASE WHEN d_0 IS NULL OR d_0 = '' THEN 1 ELSE 0 END) as null_d0,
        SUM(CASE WHEN pct_1d IS NULL OR pct_1d = '' THEN 1 ELSE 0 END) as null_pct
    FROM neobdm_records 
    WHERE method='m' AND period='c'
    GROUP BY date
    ORDER BY date DESC
""")

print("Date       | Total | Null d_0 | Null pct_1d")
print("-" * 50)
for row in cursor.fetchall():
    print(f"{row[0]} | {row[1]:5} | {row[2]:8} | {row[3]:11}")

# Check one specific row for debugging
print("\n=== Sample Row (BBCA, latest) ===")
cursor.execute("""
    SELECT symbol, d_0, d_2, d_3, d_4, w_1, w_2, c_3, c_5, c_10, c_20, pct_1d, price
    FROM neobdm_records
    WHERE symbol = 'BBCA' AND method='m' AND period='c'
    ORDER BY scraped_at DESC
    LIMIT 1
""")
row = cursor.fetchone()
if row:
    fields = ['symbol', 'd_0', 'd_2', 'd_3', 'd_4', 'w_1', 'w_2', 'c_3', 'c_5', 'c_10', 'c_20', 'pct_1d', 'price']
    for i, field in enumerate(fields):
        print(f"{field:10}: {row[i]}")
else:
    print("No BBCA record found")

conn.close()
