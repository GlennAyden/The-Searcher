
import os
import sqlite3
import asyncio
import logging
from typing import List, Dict, Optional

# LangChain / Ollama integration
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

# Configuration (matching idx_processor.py)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "market_sentinel.db")
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")
COLLECTION_NAME = "idx_rag"
LLM_MODEL = "llama3.2:latest"
EMBED_MODEL = "nomic-embed-text:latest"

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RAGClient:
    def __init__(self):
        self.db_path = DB_PATH
        self.chroma_path = CHROMA_PATH
        
        # Initialize Models (lazy loading could be better, but we'll do eager for now)
        try:
            self.embeddings = OllamaEmbeddings(model=EMBED_MODEL)
            self.llm = ChatOllama(model=LLM_MODEL, temperature=0.3)
            
            # Connect to existing vector store
            self.vector_store = Chroma(
                collection_name=COLLECTION_NAME,
                embedding_function=self.embeddings,
                persist_directory=self.chroma_path
            )
            self.retriever = self.vector_store.as_retriever(
                search_type="similarity",
                search_kwargs={"k": 5}
            )
            logger.info("RAG Client initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize RAG Client: {e}")
            self.vector_store = None

    def get_sources(self) -> List[Dict]:
        """
        Fetches list of available processed disclosures from SQLite.
        Returns a list of dicts: {'id', 'ticker', 'title', 'date', 'summary'}
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Fetch only COMPLETED items that have summaries
            query = """
                SELECT id, ticker, title, published_date, ai_summary 
                FROM idx_disclosures 
                WHERE processed_status = 'COMPLETED'
                ORDER BY published_date DESC
            """
            cursor.execute(query)
            rows = cursor.fetchall()
            conn.close()
            
            return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Database error: {e}")
            return []

    async def aquery(self, doc_id: int, doc_title: str, question: str) -> str:
        """
        Async RAG query specific to a document ID with context window expansion (Recursive Retrieval).
        """
        if not self.vector_store:
            return "Error: Vector store not initialized."

        # 1. Similarity Search (Top-K)
        filter_dict = {"source_id": doc_id}
        docs = self.vector_store.similarity_search(
            question,
            k=5,
            filter=filter_dict
        )

        if not docs:
            return "Maaf, saya tidak menemukan informasi relevan dalam dokumen ini."

        # 2. Context Window Expansion (Recursive Retrieval)
        context_text = self._expand_context(doc_id, docs)

        # 3. Prompting & Execution
        template = """Anda adalah asisten analis pasar saham yang cerdas.
        Tugas Anda adalah menjawab pertanyaan berdasarkan konteks dari dokumen laporan keterbukaan informasi.
        
        Judul Dokumen: {title}
        
        Konteks:
        {context}
        
        Pertanyaan: {question}
        
        Jawaban (Bahasa Indonesia):"""
        
        prompt = ChatPromptTemplate.from_template(template)
        
        rag_chain = (
            prompt
            | self.llm
            | StrOutputParser()
        )

        try:
            response = await rag_chain.ainvoke({
                "title": doc_title,
                "context": context_text,
                "question": question
            })
            return response
        except Exception as e:
            logger.error(f"RAG Query Error: {e}")
            return f"Terjadi kesalahan saat memproses pertanyaan: {str(e)}"

    def _expand_context(self, doc_id: int, initial_docs: List) -> str:
        """
        Fetches neighbor chunks for the initial retrieved documents to provide broader context.
        """
        expanded_indices = set()
        for doc in initial_docs:
            idx = doc.metadata.get('chunk_index')
            if idx is not None:
                expanded_indices.add(idx)
                expanded_indices.add(max(0, idx - 1))
                expanded_indices.add(idx + 1)
        
        if not expanded_indices:
            # Fallback for old documents without chunk_index
            return "\n\n".join(d.page_content for d in initial_docs)

        # Fetch all chunks in the expanded range
        filter_obj = {
            "$and": [
                {"source_id": doc_id},
                {"chunk_index": {"$in": list(expanded_indices)}}
            ]
        }
        
        # Accessing underlying chroma collection for efficient batch fetch
        results = self.vector_store.get(where=filter_obj)
        
        if not results or not results.get('documents'):
            return "\n\n".join(d.page_content for d in initial_docs)

        # Sort and merge
        combined = []
        for i in range(len(results['documents'])):
            combined.append({
                'text': results['documents'][i],
                'index': results['metadatas'][i]['chunk_index']
            })
        
        combined.sort(key=lambda x: x['index'])
        
        # Dedup and join
        seen_indices = set()
        final_texts = []
        for c in combined:
            if c['index'] not in seen_indices:
                final_texts.append(c['text'])
                seen_indices.add(c['index'])
        
        return "\n\n".join(final_texts)

    def delete_documents(self, doc_ids: List[int]):
        """
        Deletes vector store entries associated with the given document IDs.
        """
        if not self.vector_store or not doc_ids:
            return
        
        try:
            # Chroma delete by filter
            filter_dict = {"source_id": {"$in": doc_ids}}
            self.vector_store.delete(where=filter_dict)
            logger.info(f"Deleted {len(doc_ids)} documents from Vector Store.")
        except Exception as e:
            logger.error(f"Error deleting from Vector Store: {e}")

# Singleton instance for easy import
rag_client = RAGClient()
