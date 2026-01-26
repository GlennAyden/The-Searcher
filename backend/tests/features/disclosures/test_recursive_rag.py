import asyncio
import sys
import os

# Direct import assuming we're in the backend directory
try:
    from rag_client import rag_client
    import config
    import modules.database as database
except ImportError:
    import sys
    sys.path.append(os.getcwd())
    from rag_client import rag_client

async def test_recursive_retrieval():
    print("[*] Testing Recursive Retrieval...")
    
    db_path = os.path.join("data", "market_sentinel.db")
    if not os.path.exists(db_path):
        # try one more level if run from project root
        db_path = os.path.join("backend", "data", "market_sentinel.db")
        if not os.path.exists(db_path):
            print(f"[!] DB not found at {db_path}")
            return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, title FROM idx_disclosures WHERE processed_status = 'COMPLETED' LIMIT 1")
    row = cursor.fetchone()
    conn.close()

    if not row:
        print("[!] No completed disclosures found to test.")
        return

    doc_id, doc_title = row
    print(f"[*] Testing with Doc ID {doc_id}: {doc_title}")

    # Test Query
    question = "Apa isi utama dari dokumen ini?"
    print(f"[*] Question: {question}")
    
    # We call aquery (which is async)
    response = await rag_client.aquery(doc_id, doc_title, question)
    
    print("\n[+] Response:")
    print("-" * 50)
    print(response)
    print("-" * 50)

if __name__ == "__main__":
    asyncio.run(test_recursive_retrieval())
