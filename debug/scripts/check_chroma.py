import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings

embeddings = OllamaEmbeddings(model='nomic-embed-text:latest')
vector_store = Chroma(
    collection_name='idx_rag', 
    embedding_function=embeddings, 
    persist_directory='./backend/chroma_db'
)

# Check for ID 410
results = vector_store.get(where={'source_id': 410})
print(f"Chunks for ID 410: {len(results['ids'])}")

# Check for ID 406 (Old)
results_old = vector_store.get(where={'source_id': 406})
print(f"Chunks for ID 406: {len(results_old['ids'])}")

# Check what IDs are actually in there
all_results = vector_store.get(limit=100)
source_ids = set()
for m in all_results['metadatas']:
    source_ids.add(m.get('source_id'))
print(f"Source IDs found in vector store: {source_ids}")
