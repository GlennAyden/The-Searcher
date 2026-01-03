
import sqlite3
import os

db_path = "backend/data/market_sentinel.db"

def deduplicate():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Check for duplicates (Multiple rows for same symbol, method, period at exact same scraped_at)
    print("Checking for exact duplicates...")
    query = """
    SELECT symbol, method, period, scraped_at, COUNT(*) 
    FROM neobdm_records 
    GROUP BY symbol, method, period, scraped_at 
    HAVING COUNT(*) > 1
    """
    cursor.execute(query)
    duplicates = cursor.fetchall()
    
    if duplicates:
        print(f"Found {len(duplicates)} duplicate sets. Removing exact duplicates...")
        # Keep only the one with the smallest ID for each set
        delete_query = """
        DELETE FROM neobdm_records 
        WHERE id NOT IN (
            SELECT MIN(id) 
            FROM neobdm_records 
            GROUP BY symbol, method, period, scraped_at
        )
        """
        cursor.execute(delete_query)
        print(f"Removed exact duplicates. Rows deleted: {cursor.rowcount}")
    else:
        print("No exact duplicates found.")

    # 2. Check for redundant batches (Multiple scrapes for the same method/period today)
    print("\nChecking for redundant batches today (2025-12-22)...")
    query_batches = """
    SELECT method, period, scraped_at, COUNT(*) 
    FROM neobdm_records 
    WHERE substr(scraped_at, 1, 10) = '2025-12-22'
    GROUP BY method, period, scraped_at
    """
    cursor.execute(query_batches)
    batches = cursor.fetchall()

    methods_periods = {}
    for method, period, scraped_at, count in batches:
        key = (method, period)
        if key not in methods_periods:
            methods_periods[key] = []
        methods_periods[key].append(scraped_at)

    for (m, p), times in methods_periods.items():
        if len(times) > 1:
            print(f"Found {len(times)} batches for {m}/{p} today. Keeping the LATEST one only ({max(times)}).")
            # Remove all but the latest batch for this method/period today
            latest = max(times)
            others = [t for t in times if t != latest]
            for other in others:
                cursor.execute("DELETE FROM neobdm_records WHERE method=? AND period=? AND scraped_at=?", (m, p, other))
                print(f"  Deleted batch from {other}")
        else:
            print(f"Only 1 batch found for {m}/{p} today. No cleanup needed.")

    conn.commit()
    conn.close()
    print("\nDeduplication complete.")

if __name__ == "__main__":
    deduplicate()
