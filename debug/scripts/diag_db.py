import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from modules.database import DatabaseManager

db = DatabaseManager()
# Use a wide date range
df = db.get_disclosures(start_date="2025-01-01")

print(f"Total rows in DF: {len(df)}")
for _, row in df.iterrows():
    print(f"ID: {row['id']} | Ticker: {row['ticker']} | Title: {row['title']} | Path: {row['local_path']}")
