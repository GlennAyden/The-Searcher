import sqlite3

# Connect to the database
conn = sqlite3.connect('backend/data/market_sentinel.db')
cursor = conn.cursor()

print("=" * 80)
print("CLEANING UP ENRG DATA FROM DATABASE")
print("=" * 80)

# Count before
cursor.execute("SELECT COUNT(*) FROM neobdm_broker_summaries WHERE ticker='ENRG'")
before_count = cursor.fetchone()[0]
print(f"Records before cleanup: {before_count}")

# Delete
cursor.execute("DELETE FROM neobdm_broker_summaries WHERE ticker='ENRG'")
conn.commit()

# Count after
cursor.execute("SELECT COUNT(*) FROM neobdm_broker_summaries WHERE ticker='ENRG'")
after_count = cursor.fetchone()[0]
print(f"Records after cleanup: {after_count}")
print(f"Deleted: {before_count - after_count} records")

conn.close()
print("\nDatabase cleanup complete!")
