import os
import sys
import sqlite3
from tqdm import tqdm

# Add project root to sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(BASE_DIR)

# LangChain & Ollama Imports
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma

# Configuration
DB_PATH = os.path.join(BASE_DIR, "data", "market_sentinel.db")
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")
COLLECTION_NAME = "idx_rag"
LLM_MODEL = "llama3.2:latest"
EMBED_MODEL = "nomic-embed-text:latest"

def run_processor():
    print("=== IDX DISCLOSURE PROCESSOR (RAG + AI SUMMARY) ===")
    
    # 1. Initialize DB & Models
    if not os.path.exists(DB_PATH):
        print(f"[!] Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print(f"[*] Initializing Models (LLM: {LLM_MODEL}, Embeddings: {EMBED_MODEL})...")
    llm = ChatOllama(model=LLM_MODEL, temperature=0)
    embeddings = OllamaEmbeddings(model=EMBED_MODEL)
    
    # Initialize ChromaDB
    vector_db = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=CHROMA_PATH
    )

    # 2. Query Pending Disclosures
    cursor.execute("SELECT id, local_path, ticker, title FROM idx_disclosures WHERE processed_status = 'PENDING'")
    pending_items = cursor.fetchall()
    
    if not pending_items:
        print("[*] No pending disclosures found.")
        conn.close()
        return

    print(f"[*] Found {len(pending_items)} files to process.")
    
    # 3. Processing Loop
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    
    for doc_id, rel_path, ticker, title in tqdm(pending_items, desc="Processing PDFs"):
        try:
            # Handle path (could be relative or absolute in DB)
            abs_path = rel_path if os.path.isabs(rel_path) else os.path.join(BASE_DIR, rel_path)
            
            if not os.path.exists(abs_path):
                print(f"\n[!] File not found: {abs_path}. Skipping.")
                cursor.execute("UPDATE idx_disclosures SET processed_status = 'FILE_NOT_FOUND' WHERE id = ?", (doc_id,))
                conn.commit()
                continue

            # Step A: Load PDF
            loader = PyPDFLoader(abs_path)
            documents = loader.load()
            
            # Step B: Split Text
            chunks = text_splitter.split_documents(documents)
            
            # Step C: Add to Vector DB (Embed)
            # Add metadata for filtering
            for chunk in chunks:
                chunk.metadata.update({
                    "source_id": doc_id,
                    "ticker": ticker,
                    "title": title
                })
            
            # Unique IDs for chunks to avoid duplicates if re-run (simplified)
            chunk_ids = [f"doc_{doc_id}_chunk_{i}" for i in range(len(chunks))]
            vector_db.add_documents(documents=chunks, ids=chunk_ids)
            
            # Step D: Summarize (First 3 chunks for context)
            intro_text = "\n".join([c.page_content for c in chunks[:3]])
            
            prompt = f"""
            Tugas: Ringkas dokumen keterbukaan informasi perusahaan berikut dalam 1 kalimat pendek.
            Fokus: Kejadian inti (Dividen, Laba/Rugi, Pengunduran Diri, Akuisisi, dll).
            Bahasa: Harus menggunakan Bahasa Indonesia.
            Catatan: Jika dokumen hanya laporan rutin tanpa kejadian khusus, tulis 'Laporan Rutin'.
            
            Teks Dokumen:
            {intro_text}
            
            Ringkasan:
            """
            
            response = llm.invoke(prompt)
            summary = response.content.strip()
            
            # Step E: Update DB
            cursor.execute(
                "UPDATE idx_disclosures SET ai_summary = ?, processed_status = 'COMPLETED' WHERE id = ?", 
                (summary, doc_id)
            )
            conn.commit()
            
        except Exception as e:
            print(f"\n[!] Error processing ID {doc_id}: {e}")
            cursor.execute("UPDATE idx_disclosures SET processed_status = 'FAILED' WHERE id = ?", (doc_id,))
            conn.commit()

    print("\n[+] Processing finished.")
    conn.close()

if __name__ == "__main__":
    run_processor()
