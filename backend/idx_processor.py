import os
import sqlite3
import logging
from tqdm import tqdm
from langchain_community.document_loaders import PyPDFLoader
from langchain_experimental.text_splitter import SemanticChunker
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "market_sentinel.db")
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")
COLLECTION_NAME = "idx_rag"
LLM_MODEL = "llama3.2:latest"
EMBED_MODEL = "nomic-embed-text:latest"

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class IDXProcessor:
    def __init__(self):
        self.base_dir = BASE_DIR
        self.db_path = DB_PATH
        self.chroma_path = CHROMA_PATH
        
        # Initialize Ollama Models
        self.embeddings = OllamaEmbeddings(model=EMBED_MODEL)
        self.llm = ChatOllama(model=LLM_MODEL, temperature=0)
        
        # Initialize Vector Store
        self.vector_store = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=self.embeddings,
            persist_directory=self.chroma_path
        )
        
        # Semantic Chunking
        self.text_splitter = SemanticChunker(
            self.embeddings, 
            breakpoint_threshold_type="percentile"
        )

    def get_pending_disclosures(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id, local_path, ticker FROM idx_disclosures WHERE processed_status IN ('PENDING', 'DOWNLOADED')")
        records = cursor.fetchall()
        conn.close()
        return records

    def update_status(self, doc_id, status, summary=None):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        if summary:
            cursor.execute(
                "UPDATE idx_disclosures SET processed_status = ?, ai_summary = ? WHERE id = ?",
                (status, summary, doc_id)
            )
        else:
            cursor.execute(
                "UPDATE idx_disclosures SET processed_status = ? WHERE id = ?",
                (status, doc_id)
            )
        conn.commit()
        conn.close()

    def summarize(self, chunks):
        # Take first 3 chunks (max)
        context_text = "\n\n".join([c.page_content for c in chunks[:3]])
        
        prompt = ChatPromptTemplate.from_template("""
        Anda adalah asisten AI yang ahli dalam menganalisis laporan keterbukaan informasi perusahaan.
        Tugas Anda adalah meringkas teks di bawah ini menjadi 1 kalimat singkat dalam Bahasa Indonesia.
        Fokus pada peristiwa inti (Dividen, Laba, Rugi, Pengunduran Diri, RUPS, dll).
        Jika ini hanya laporan rutin biasa, katakan 'Laporan Rutin'.

        Teks:
        {context}

        Ringkasan (Bahasa Indonesia):
        """)
        
        chain = prompt | self.llm | StrOutputParser()
        summary = chain.invoke({"context": context_text})
        return summary.strip()

    def process_document(self, doc_id, local_path, ticker):
        try:
            # If path is relative, try to resolve it relative to BASE_DIR if not found as-is
            if not os.path.isabs(local_path) and not os.path.exists(local_path):
                # Check relative to BASE_DIR (which is 'backend')
                alt_path = os.path.join(self.base_dir, local_path)
                if os.path.exists(alt_path):
                    local_path = alt_path
            
            # If still not found, check if it's just the filename in 'downloads'
            if not os.path.exists(local_path):
                filename = os.path.basename(local_path)
                alt_path = os.path.join(self.base_dir, "downloads", filename)
                if os.path.exists(alt_path):
                    local_path = alt_path

            if not os.path.exists(local_path):
                logger.error(f"File not found: {local_path}")
                self.update_status(doc_id, 'FAILED')
                return False

            # Load and Split
            loader = PyPDFLoader(local_path)
            pages = loader.load()
            chunks = self.text_splitter.split_documents(pages)
            
            if not chunks:
                logger.warning(f"No text extracted from {local_path}")
                self.update_status(doc_id, 'FAILED')
                return False

            # Add Metadata
            for i, chunk in enumerate(chunks):
                chunk.metadata['source_id'] = doc_id
                chunk.metadata['ticker'] = ticker
                chunk.metadata['chunk_index'] = i

            # Add to Vector Store
            doc_unique_id = f"doc_{doc_id}"
            # Chroma implementation for adding documents usually handles IDs per chunk
            # but we can provide chunk IDs if we want to manage them specifically.
            chunk_ids = [f"{doc_unique_id}_{i}" for i in range(len(chunks))]
            self.vector_store.add_documents(documents=chunks, ids=chunk_ids)

            # Summarize
            summary_id = self.summarize(chunks)
            
            # Update DB
            self.update_status(doc_id, 'COMPLETED', summary_id)
            return True

        except Exception as e:
            logger.exception(f"Error processing document {doc_id}: {str(e)}")
            self.update_status(doc_id, 'FAILED')
            return False

    def run_processor(self):
        records = self.get_pending_disclosures()
        if not records:
            logger.info("No pending disclosures found.")
            return

        logger.info(f"Found {len(records)} pending disclosures.")
        for record in tqdm(records, desc="Processing PDFs"):
            doc_id, local_path, ticker = record
            self.process_document(doc_id, local_path, ticker)

if __name__ == "__main__":
    processor = IDXProcessor()
    processor.run_processor()
