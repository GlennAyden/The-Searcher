# News Library & Disclosure Documentation

Dokumentasi ini menjelaskan fitur, alur kerja, cara kerja, dan arsitektur dari modul **News & Disclosures Library**.

---

## 1. Fitur Utama

- **Unified News Feed**: Menggabungkan berita dari berbagai sumber (CNBC, EmitenNews) dan keterbukaan informasi (IDX) dalam satu tabel terintegrasi.
- **Sentiment Labeling**: Setiap artikel diberi label **Bullish**, **Bearish**, atau **Netral** beserta skor numerik presisi.
- **AI Insight Drawer (The "Gist")**:
    - Fitur ekspansi baris menggunakan `Sparkles` icon.
    - Menghasilkan rangkuman 1 paragraf (4 kalimat) yang mencakup inti kejadian, latar belakang, dampak, dan prospek investor secara *on-demand*.
- **Critical Insight Highlighter**: Menandai artikel dengan skor sentimen ekstrim (di atas 0.8 atau di bawah -0.8) sebagai "Critical Insight".
- **Dynamic Filtering**:
    - Filter berdasarkan Ticker (terintegrasi dengan Global Filter).
    - Filter lokal berdasarkan Sumber (Source) dan kategori Sentimen.

```mermaid
mindmap
  root((News Library Features))
    Data Aggregation
      CNBC Indonesia
      EmitenNews
      IDX Disclosures
    Sentiment Intelligence
      Automated Labeling
      Scoring (-1 to 1)
      Critical Flags
    AI Interactions
      On-demand Summary
      Insight Drawer
      Contextual Analysis
    User Controls
      Ticker Filtering
      Date Range Support
      Source & Label Filters
```

---

## 2. Alur Kerja (Flow)

Alur kerja modul ini berfokus pada penyajian data historis dan analisis AI instan.

1.  **Request Service**: Frontend memanggil `/api/news` dengan parameter filter (ticker, date, sentiment, source).
2.  **DB Query**: Backend (`DatabaseManager`) melakukan query ke tabel `news` dan `disclosures` dengan filter SQL yang dioptimasi.
3.  **Data Rendering**: Frontend merender data ke dalam `NewsFeed` component.
4.  **Insight Generation**: 
    - Pengguna mengklik ikon `Sparkles` atau baris tabel.
    - Frontend memanggil `/api/brief-single` dengan judul berita sebagai konteks.
    - LLM (llama3.2) memproses judul dan ticker untuk menghasilkan insight strategis.
5.  **Direct Link**: Pengguna dapat mengklik "VIEW" untuk langsung menuju URL sumber berita asli.

```mermaid
graph TD
    A[User Opens News Library] --> B[Fetch News Data via API]
    B --> C[Backend: SQL Filtered Query]
    C --> D[Render News Table]
    D --> E{User Clicks Row?}
    E -- Yes --> F[Trigger /api/brief-single]
    F --> G[LLM: Generate 4-Sentence Summary]
    G --> H[Open Insight Drawer]
    E -- No --> I[Wait for Interaction]
```

---

## 3. Cara Kerja (Mechanics)

### On-Demand Summarization
Berbeda dengan dashboard yang menyajikan data agregat, News Library menggunakan **Lazy Loading** untuk insight AI. Insight hanya dibuat saat baris diklik untuk menghemat latensi dan sumber daya komputasi LLM.

### Scoring Logic
- **Score > 0.5**: Bullish (Sentimen positif kuat).
- **Score < -0.5**: Bearish (Sentimen negatif kuat).
- **Score 0**: Netral.
- **Score >= 0.8**: Ditandai sebagai **Critical Insight** dengan border biru khusus pada UI.

### Crawler Sync
Data perpustakaan ini diperbarui secara berkala melalui background task atau manual refresh dari Dashboard, yang kemudian disimpan secara permanen di SQLite untuk akses cepat.

```mermaid
mindmap
  root((Mechanics))
    LLM Integration
      llama3.2 Engine
      System Prompt: Senior Analyst
      4-Sentence Constraint
    Data Persistence
      SQLite News Table
      Sentiment Metadata
      Ticker Mapping
    UI Logic
      Row Expansion State
      Loading Skeletons
      Conditional Styling
```

---

## 4. Arsitektur

Modul ini menggunakan pola **Master-Detail** dalam penyajian datanya.

- **Component Hierarchy**: `NewsLibraryPage` (Container) -> `NewsFeed` (Table) -> `InsightDrawer` (Sub-row).
- **Backend Services**:
    - `modules/scraper_*.py`: Bertanggung jawab mengisi database.
    - `modules/database.py`: Menangani filter kompleks (ticker, date, sentiment).
    - `main.py`: Mengekspos endpoint `/api/news` dan `/api/brief-single`.

```mermaid
graph LR
    subgraph "Frontend Components"
    NLP[NewsLibraryPage]
    NF[NewsFeed Component]
    ID[Insight Drawer]
    end

    subgraph "Backend API"
    API_N[/api/news/]
    API_B[/api/brief-single/]
    end

    subgraph "Processing & AI"
    SENT[Sentiment Engine]
    LLM[Ollama / llama3.2]
    DB[(SQLite DB)]
    end

    NLP --> NF
    NF --> ID
    NF --> API_N
    ID --> API_B
    API_N --> DB
    API_B --> LLM
    SENT --> DB
```

---

## 5. Keseluruhan Alur (End-to-End Flow)

Berikut adalah visualisasi bagaimana sebuah berita masuk ke perpustakaan hingga dianalisa oleh pengguna:

```mermaid
flowchart LR
    Source[(Web Sources)] --> Scraper[Scraper Module]
    Scraper --> AI_Label[AI Sentiment Engine]
    AI_Label --> Storage[(Local DB)]
    
    Storage --> FE[News Library UI]
    FE --> Filter{User Filters}
    Filter --> Display[News List]
    
    Display --> Click[Click for Insight]
    Click --> LLM_Task[LLM Analyst Process]
    LLM_Task --> Result[Display 4-Sentence Gist]
```
