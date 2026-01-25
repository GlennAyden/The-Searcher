"""Delete Bisnis.com and Investor.id news from database"""
import sys
sys.path.insert(0, 'C:/Data/AI Playground/project-searcher/backend')
from modules.database import DatabaseManager

db = DatabaseManager()
conn = db._get_conn()
cursor = conn.cursor()

# Count
cursor.execute("SELECT COUNT(*) FROM news WHERE url LIKE '%bisnis.com%'")
bisnis = cursor.fetchone()[0]
cursor.execute("SELECT COUNT(*) FROM news WHERE url LIKE '%investor.id%'")
investor = cursor.fetchone()[0]

print(f"Bisnis.com: {bisnis} articles")
print(f"Investor.id: {investor} articles")

# Delete
cursor.execute("DELETE FROM news WHERE url LIKE '%bisnis.com%'")
cursor.execute("DELETE FROM news WHERE url LIKE '%investor.id%'") 
conn.commit()

print(f"\n✅ Deleted {bisnis + investor} articles total")
conn.close()
