import sqlite3

# Connect to the database
conn = sqlite3.connect('backend/data/market_sentinel.db')
cursor = conn.cursor()

print("=" * 90)
print("COMPARING DATA ACROSS DIFFERENT DATES FOR ENRG")
print("=" * 90)

dates_to_check = ['2026-01-13', '2026-01-12', '2026-01-09']

for date in dates_to_check:
    print(f"\n{'='*90}")
    print(f"DATE: {date}")
    print(f"{'='*90}")
    
    cursor.execute("""
        SELECT side, broker, nlot, nval, avg_price
        FROM neobdm_broker_summaries
        WHERE UPPER(ticker) = 'ENRG' 
        AND trade_date = ?
        ORDER BY side DESC, nval DESC
        LIMIT 10
    """, (date,))
    
    records = cursor.fetchall()
    print(f"\nSide | Broker | Net Lot | Net Val | Avg Price")
    print("-" * 60)
    for row in records:
        side, broker, nlot, nval, avg_price = row
        print(f"{side:4s} | {broker:6s} | {nlot:>10.0f} | {nval:>10.2f}B | {avg_price:>8.1f}")

conn.close()
