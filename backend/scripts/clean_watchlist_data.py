import sqlite3
import re
import os

def clean_database():
    db_path = os.path.join('backend', 'data', 'market_sentinel.db')
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Find records that need cleaning
        cursor.execute("SELECT id, symbol FROM neobdm_records WHERE symbol LIKE '%watchlist%'")
        rows = cursor.fetchall()
        
        if not rows:
            print("No records found with 'watchlist' text.")
            return

        print(f"Found {len(rows)} records to clean.")
        
        updates = []
        for row_id, symbol in rows:
            # Clean symbol
            clean_symbol = re.sub(r'\|?Add\s+.*?to\s+Watchlist', '', symbol, flags=re.IGNORECASE)
            clean_symbol = re.sub(r'\|?Remove\s+from\s+Watchlist', '', clean_symbol, flags=re.IGNORECASE)
            clean_symbol = clean_symbol.strip('| ').strip()
            
            updates.append((clean_symbol, row_id))

        # Perform batch update
        cursor.executemany("UPDATE neobdm_records SET symbol = ? WHERE id = ?", updates)
        conn.commit()
        print(f"Successfully cleaned {len(updates)} database records.")

    except Exception as e:
        print(f"Error during cleanup: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    clean_database()
