import sqlite3
import sys

# Connect to the database
conn = sqlite3.connect('backend/data/market_sentinel.db')
cursor = conn.cursor()

# 1. List all tables
print("=" * 60)
print("AVAILABLE TABLES:")
print("=" * 60)
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
for table in tables:
    print(f"  - {table[0]}")

# 2. Check broker summary data for ENRG
print("\n" + "=" * 60)
print("BROKER SUMMARY RECORDS FOR ENRG:")
print("=" * 60)

try:
    cursor.execute("""
        SELECT ticker, trade_date, side, broker, nlot, nval, avg_price, scraped_at
        FROM broker_summaries
        WHERE UPPER(ticker) = 'ENRG'
        ORDER BY trade_date DESC, nval DESC
        LIMIT 20
    """)
    
    records = cursor.fetchall()
    if records:
        print(f"Found {len(records)} records")
        print("\nTrade Date | Side | Broker | Net Lot | Net Val | Avg Price | Scraped At")
        print("-" * 90)
        for row in records:
            ticker, trade_date, side, broker, nlot, nval, avg_price, scraped_at = row
            print(f"{trade_date} | {side:4s} | {broker:4s} | {nlot:>10} | {nval:>10.2f}B | {avg_price:>6} | {scraped_at}")
    else:
        print("No records found for ENRG")
        
except sqlite3.OperationalError as e:
    print(f"Error: {e}")
    print("\nTrying alternative table name...")
    try:
        cursor.execute("""
            SELECT ticker, trade_date, side, broker, nlot, nval, avg_price, scraped_at
            FROM neobdm_broker_summaries
            WHERE UPPER(ticker) = 'ENRG'
            ORDER BY trade_date DESC, nval DESC
            LIMIT 20
        """)
        
        records = cursor.fetchall()
        if records:
            print(f"Found {len(records)} records in neobdm_broker_summaries")
            print("\nTrade Date | Side | Broker | Net Lot | Net Val | Avg Price | Scraped At")
            print("-" * 90)
            for row in records:
                ticker, trade_date, side, broker, nlot, nval, avg_price, scraped_at = row
                print(f"{trade_date} | {side:4s} | {broker:4s} | {nlot:>10} | {nval:>10.2f}B | {avg_price:>6} | {scraped_at}")
        else:
            print("No records found for ENRG in neobdm_broker_summaries")
    except sqlite3.OperationalError as e2:
        print(f"Error with alternative table: {e2}")

# 3. Check unique dates
print("\n" + "=" * 60)
print("UNIQUE TRADE DATES FOR ENRG:")
print("=" * 60)

try:
    cursor.execute("""
        SELECT DISTINCT trade_date, COUNT(*) as record_count, MIN(scraped_at) as first_scraped
        FROM broker_summaries
        WHERE UPPER(ticker) = 'ENRG'
        GROUP BY trade_date
        ORDER BY trade_date DESC
    """)
    
    dates = cursor.fetchall()
    for date_row in dates:
        trade_date, count, scraped_at = date_row
        print(f"  {trade_date}: {count} records (scraped: {scraped_at})")
except:
    try:
        cursor.execute("""
            SELECT DISTINCT trade_date, COUNT(*) as record_count, MIN(scraped_at) as first_scraped
            FROM neobdm_broker_summaries
            WHERE UPPER(ticker) = 'ENRG'
            GROUP BY trade_date
            ORDER BY trade_date DESC
        """)
        
        dates = cursor.fetchall()
        for date_row in dates:
            trade_date, count, scraped_at = date_row
            print(f"  {trade_date}: {count} records (scraped: {scraped_at})")
    except Exception as e:
        print(f"Error: {e}")

conn.close()
