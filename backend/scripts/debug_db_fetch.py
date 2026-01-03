import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from modules.database import DatabaseManager
import pandas as pd

def test_db_fetch():
    db = DatabaseManager()
    print("Testing fetch with defaults (method='m', period='c', no date)...")
    df = db.get_neobdm_summaries(method='m', period='c', start_date=None, end_date=None)
    
    if df.empty:
        print("RESULT: Empty DataFrame returned.")
    else:
        print(f"RESULT: DataFrame returned with {len(df)} rows.")
        print(df.iloc[0])

if __name__ == "__main__":
    test_db_fetch()
