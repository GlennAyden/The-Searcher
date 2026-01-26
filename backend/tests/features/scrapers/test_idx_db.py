import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import sqlite3
from modules.scraper_idx import fetch_and_save_pipeline
from modules.database import DatabaseManager

def verify_db_integration():
    print("=== Testing Database Integration ===")
    
    # 1. Run Pipeline for a ticker with small range (e.g. 7 days)
    # Using 'BBRI' is safe
    print("Running Pipeline...")
    fetch_and_save_pipeline(ticker="BBRI", days=7, download_dir="test_downloads_db")
    
    # 2. Verify Data in DB
    print("\nVerifying SQLite Data...")
    db = DatabaseManager()
    conn = db._get_conn()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT COUNT(*) FROM idx_disclosures")
        count = cursor.fetchone()[0]
        print(f"Total rows in idx_disclosures: {count}")
        
        if count > 0:
            cursor.execute("SELECT ticker, title, local_path, processed_status FROM idx_disclosures ORDER BY id DESC LIMIT 3")
            rows = cursor.fetchall()
            print("Recent 3 Entries:")
            for row in rows:
                print(row)
                # Check status
                if row[3] == "DOWNLOADED" and os.path.exists(row[2]):
                     print("   -> Confirmed Downloaded & File Exists")
                else:
                     print(f"   -> Status: {row[3]}, Path: {row[2]}")
        else:
            print("FAILURE: No data found in DB.")
            
    finally:
        conn.close()

if __name__ == "__main__":
    verify_db_integration()
