import sqlite3
import os

def prepare_pending():
    db_path = 'data/market_sentinel.db'
    if not os.path.exists(db_path):
        print(f"DB not found at {db_path}")
        return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('SELECT id, local_path FROM idx_disclosures')
    records = cursor.fetchall()
    
    count = 0
    for r_id, path in records:
        if os.path.exists(path):
            cursor.execute('UPDATE idx_disclosures SET processed_status = ? WHERE id = ?', ('PENDING', r_id))
            print(f"Set {path} to PENDING")
            count += 1
        else:
            print(f"File {path} does not exist.")
            
    conn.commit()
    conn.close()
    print(f"Total updated: {count}")

if __name__ == "__main__":
    prepare_pending()
