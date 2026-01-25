"""
Script untuk menghapus semua berita dari Investor.id di database.
"""
import sqlite3
import sys
import os

# Add parent directory to path for module imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.connection import DatabaseConnection

def delete_investor_news():
    db = DatabaseConnection()
    conn = db._get_conn()
    cursor = conn.cursor()
    
    # Cek jumlah berita sebelum dihapus
    cursor.execute("SELECT COUNT(*) FROM news WHERE url LIKE ?", ('%investor.id%',))
    count_before = cursor.fetchone()[0]
    print(f"Found {count_before} articles from Investor.id")
    
    if count_before > 0:
        # Hapus semua berita dari investor.id
        cursor.execute("DELETE FROM news WHERE url LIKE ?", ('%investor.id%',))
        conn.commit()
        
        # Verifikasi penghapusan
        cursor.execute("SELECT COUNT(*) FROM news WHERE url LIKE ?", ('%investor.id%',))
        count_after = cursor.fetchone()[0]
        print(f"Deleted {count_before - count_after} articles. Remaining: {count_after}")
    else:
        print("No Investor.id articles to delete.")
    
    conn.close()

if __name__ == "__main__":
    delete_investor_news()
