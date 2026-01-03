import sqlite3
import pkg_resources

def check_db():
    try:
        conn = sqlite3.connect('data/market_sentinel.db')
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"Tables in market_sentinel.db: {tables}")
        
        for table in tables:
            cursor.execute(f"PRAGMA table_info({table[0]});")
            columns = cursor.fetchall()
            print(f"\nSchema for {table[0]}:")
            for col in columns:
                print(f"  {col[1]} ({col[2]})")
        conn.close()
    except Exception as e:
        print(f"Error checking DB: {e}")

def check_packages():
    required = ['langchain', 'langchain-community', 'langchain-ollama', 'chromadb', 'pypdf', 'tqdm']
    installed = {pkg.key for pkg in pkg_resources.working_set}
    for req in required:
        if req in installed:
            print(f"{req} is installed")
        else:
            print(f"{req} is MISSING")

if __name__ == "__main__":
    print("--- Database Check ---")
    check_db()
    print("\n--- Package Check ---")
    check_packages()
