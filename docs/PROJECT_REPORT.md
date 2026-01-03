# Project Report: Antigravity - Financial Sentiment & Market Intelligence

## Project Overview
**Antigravity** is a sophisticated financial analysis platform designed to correlate market performance (stock prices) with sentiment intelligence derived from news sources and corporate disclosures. It provides a real-time, interactive dashboard for investors and analysts to identify trends and correlations.

## Architecture
The project follows a modern decoupled architecture:

### 1. Frontend (Next.js Dashboard)
- **Path**: `/frontend`
- **Stack**: Next.js 15 (App Router), React 19, Recharts.
- **Styling**: Tailwind CSS v4 with custom glassmorphism components.
- **Key Components**:
  - **Correlation Engine**: Dual-pane chart syncing stock price and sentiment score.
  - **Interactive Charting**: Custom vertical drag-to-zoom feature on the Y-axis.
  - **Intelligent Tooltips**: Master tooltip handling both price and sentiment data, with fallback for market closure days.

### 2. Backend (FastAPI Intelligence Engine)
- **Path**: `/backend`
- **Stack**: Python 3.10+, FastAPI.
- **Core Services**:
  - `data_provider.py`: Aggregates stock prices from Yahoo Finance and sentiment from local DB.
  - `rag_client.py`: Interface for context-aware AI chat using local vector storage.
  - `idx_processor.py`: PDF processing engine for corporate disclosures.

### 3. Data & Storage
- **SQL Database**: SQLite (`backend/data/market_sentinel.db`) stores market data, analyzed sentiment, and scraping logs.
- **Vector Database**: ChromaDB (`backend/chroma_db`) stores embedded knowledge from news and PDFs for RAG.
- **Models**: Powered by local LLMs via Ollama (typically Llama 3.2 for analysis and Nomic for embeddings).

### 4. Scraper Engine
Located in `backend/modules/`, the scraping suite includes:
- **CNBC Scraper**: Advanced hybrid scraper extracting both index and detail page data.
- **IDX Scraper**: Reverse-engineered API scraper for corporate disclosure PDFs.
- **Emiten Scraper**: Specific scraper for ticker-related corporate information.

## Key Features & Innovations

### 📈 Sentiment-Price Correlation
Visualizes how news sentiment directly impacts stock price fluctuations. The "Correlation Engine" syncs interaction across two distinct charts.

### 🔍 Tactical Y-Axis Zoom
A unique "tactile" interaction allowing users to vertically drag the chart to adjust the price resolution. This prevents "flat line" visualizations for high-value indices.

### 🤖 RAG (Retrieval-Augmented Generation)
A built-in AI assistant that can answer complex financial questions based on the latest scraped news and IDX PDF disclosures.

### 🛡️ Robust Missing Data Handling
Implemented "Ghost Series" technology to ensure interactive tools (like tooltips) work consistently even on non-trading days (weekends/holidays) where only news sentiment is available.

## Deployment & Execution
- **Prerequisites**: Python environment, Node.js, Ollama.
- **Launch Commands**:
  - Backend: `cd backend && python main.py`
  - Frontend: `cd frontend && npm run dev`
- **Scripts**: Convenient PowerShell scripts (`start_project.ps1` and `stop_project.ps1`) are provided in the root for full project orchestration.

## Future Development
Potential areas for expansion:
- Portfolio tracking integration.
- Real-time notification system for sentiment shifts.
- Multi-ticker comparison overlay in the Correlation Engine.

---
*Report Generated: 2025-12-20*
