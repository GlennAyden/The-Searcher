
import sqlite3
import os

db_path = "backend/data/market_sentinel.db"

def clear_data():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Clearing neobdm_records...")
    cursor.execute("DELETE FROM neobdm_records")
    
    print("Clearing neobdm_summaries...")
    cursor.execute("DELETE FROM neobdm_summaries")

    conn.commit()
    conn.close()
    print("Data cleared successfully.")

if __name__ == "__main__":
    clear_data()
