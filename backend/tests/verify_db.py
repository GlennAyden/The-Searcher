import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from modules.database import DatabaseManager
import pandas as pd

db = DatabaseManager()
df = db.get_news()

print(f"Total Records: {len(df)}")
print("Sample Tickers (first 10 with values):")
print(df[df['ticker'] != ""]['ticker'].head(10))
print("\nSample Sentiment:")
print(df[['title', 'sentiment_label', 'sentiment_score']].head(5))
