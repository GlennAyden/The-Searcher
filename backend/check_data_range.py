import sqlite3
from datetime import datetime

# Connect to database
conn = sqlite3.connect('data/market_sentinel.db')
cursor = conn.cursor()

# Get date range
print("=== NeoBDM Data Range ===")
cursor.execute("""
    SELECT 
        MIN(scraped_at) as earliest, 
        MAX(scraped_at) as latest,
        COUNT(DISTINCT substr(scraped_at, 1, 10)) as unique_days
    FROM neobdm_records 
    WHERE method='m' AND period='c'
""")
result = cursor.fetchone()
print(f"Earliest: {result[0]}")
print(f"Latest: {result[1]}")
print(f"Unique Days: {result[2]}")

# Get all available dates
print("\n=== Available Dates (Most Recent 20) ===")
cursor.execute("""
    SELECT DISTINCT substr(scraped_at, 1, 10) as date, COUNT(*) as records
    FROM neobdm_records 
    WHERE method='m' AND period='c'
    GROUP BY date
    ORDER BY date DESC 
    LIMIT 20
""")
for row in cursor.fetchall():
    print(f"{row[0]}: {row[1]} records")

# Check specific symbol
print("\n=== Sample Symbol (BBCA) Date Range ===")
cursor.execute("""
    SELECT DISTINCT substr(scraped_at, 1, 10) as date
    FROM neobdm_records 
    WHERE symbol='BBCA' AND method='m' AND period='c'
    ORDER BY date DESC
    LIMIT 10
""")
for row in cursor.fetchall():
    print(row[0])

conn.close()
