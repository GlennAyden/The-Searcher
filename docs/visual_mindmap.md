# Visual Mindmap & Data Flow

Dokumen ini menjelaskan alur kerja data di dalam aplikasi `project-searcher`, mulai dari pengambilan data (scraping) hingga ditampilkan kepada pengguna.

## 1. High-Level Mindmap
Mindmap ini menunjukkan struktur utama aplikasi dan bagaimana fitur-fiturnya terhubung.

```mermaid
mindmap
  root((Project Searcher))
    Frontend (Next.js)
      Dashboard
        Market Stats
        News Feed
        Sentiment SMA Chart
        WordCloud (Tickers)
      News Library
        Infinite Feed
        Global Filters
      RAG Chat
        Source Sidepanel
        Chat Workspace
        Document Context
    Backend (FastAPI)
      Scraper Engine
        CNBC Indonesia
        EmitenNews
        IDX Disclosures
      AI Pipeline
        Sentiment Analysis (Ollama)
        PDF Processing (PyPDF)
        RAG (ChromaDB + Llama 3.2)
      Storage
        SQLite (Metadata)
        ChromaDB (Vectors)
```

---

## 2. Detailed Data Flow
Alur kerja data dari scraping hingga muncul di halaman aplikasi.

```mermaid
flowchart TD
    subgraph DataSources [1. Data Sources]
        CNBC[CNBC Indonesia]
        EN[EmitenNews]
        IDX[IDX Keterbukaan Informasi]
    end

    subgraph ScrapingLayer [2. Scraping & Raw Processing]
        Scraper[Scraper Engine]
        DB_Save[(SQLite: market_sentinel.db)]
    end

    subgraph AIPipeline [3. AI Intelligence Pipeline]
        Sentiment[Sentiment Engine - Ollama Llama 3.2]
        RAGProc[RAG Processor - PDF to ChromaDB]
    end

    subgraph BackendAPI [4. Backend API - FastAPI]
        Routes["/api/news\n/api/disclosures\n/api/sentiment-data\n/api/chat"]
    end

    subgraph FrontendPages [5. Frontend Pages]
        Dash[Dashboard Page]
        News[News Library Page]
        Chat[RAG Chat Page]
    end

    %% Data Flow Connections
    CNBC --> Scraper
    EN --> Scraper
    IDX --> Scraper
    
    Scraper --> Sentiment
    Sentiment --> DB_Save
    
    IDX -- Download PDF --> RAGProc
    RAGProc -->|Store Vectors| VectorDB[(ChromaDB)]
    RAGProc -->|Update Status| DB_Save

    DB_Save <--> BackendAPI
    VectorDB <--> BackendAPI
    
    BackendAPI --> Dash
    BackendAPI --> News
    BackendAPI --> Chat

    %% Styling with better contrast (Background & Font)
    classDef source fill:#FFB3BA,stroke:#333,stroke-width:2px,color:#000
    classDef scraping fill:#BAE1FF,stroke:#333,stroke-width:2px,color:#000
    classDef ai fill:#BFFCC6,stroke:#333,stroke-width:2px,color:#000
    classDef api fill:#FFDFBA,stroke:#333,stroke-width:2px,color:#000
    classDef web fill:#FFFFBA,stroke:#333,stroke-width:2px,color:#000
    classDef storage fill:#E0BBE4,stroke:#333,stroke-width:2px,color:#000

    class CNBC,EN,IDX source
    class Scraper scraping
    class Sentiment,RAGProc ai
    class Routes,BackendAPI api
    class Dash,News,Chat web
    class DB_Save,VectorDB storage
```

---

## 3. Penjelasan Alur Tiap Fitur

### A. Dashboard & News Feed
1.  **Scraping**: User memicu scraping via `ScraperControl.tsx` -> API `/api/scrape`.
2.  **Analysis**: Backend menjalankan `modules/scraper_cnbc.py` atau `modules/scraper_emiten.py`. Data dianalisis sentimennya secara real-time menggunakan Ollama.
3.  **Storage**: Berita + Label Sentimen disimpan di SQLite.
4.  **Display**: Halaman Dashboard & News Library memanggil `/api/news` atau `/api/sentiment-data` untuk menampilkan chart dan daftar berita terbaru.

### B. Keterbukaan Informasi (RAG)
1.  **Scraping**: User memicu scraping IDX -> PDF diunduh ke folder `downloads/`.
2.  **Indexing**: `idx_processor.py` membaca PDF, memecahnya menjadi potongan kecil (chunks), dan menyimpannya di **ChromaDB** bersama embedding dari Ollama (Nomic).
3.  **Summary**: AI membuat ringkasan singkat 1 kalimat untuk tampilan tabel.
4.  **Chat**: Saat user bertanya di tab RAG Chat, API `/api/chat` mengambil konteks relevan dari ChromaDB (hanya untuk dokumen tersebut) dan menjawabnya menggunakan Llama 3.2.
