import sqlite3

conn = sqlite3.connect('data/market_data.db')
cur = conn.cursor()

# Check DEWA records
cur.execute('SELECT COUNT(*) FROM price_volume WHERE ticker = ?', ('DEWA',))
print('DEWA records:', cur.fetchone()[0])

# Sample tickers
cur.execute('SELECT DISTINCT ticker FROM price_volume LIMIT 10')
print('Sample tickers:', [r[0] for r in cur.fetchall()])

# Total tickers
cur.execute('SELECT COUNT(DISTINCT ticker) FROM price_volume')
print('Total unique tickers:', cur.fetchone()[0])

conn.close()
