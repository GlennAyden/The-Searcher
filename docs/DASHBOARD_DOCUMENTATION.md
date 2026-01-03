# Dashboard Market Intelligence Documentation

Dokumentasi ini menjelaskan fitur, alur kerja, cara kerja, dan arsitektur dari halaman **Market Intelligence Dashboard**.

---

## 1. Fitur Utama

- **Real-time Metrics Card**: Menampilkan metrik kunci dengan tren visual (sparkline).
    - **Latest Price**: Harga terakhir emiten atau indeks (perubahan harga & grafik tren 7 hari).
    - **Market Mood**: Indeks sentimen pasar (Bullish, Bearish, atau Netral).
    - **Correlation (Pearson)**: Mengukur hubungan linier antara pergerakan harga dan sentimen berita.
    - **News Volume**: Total volume berita yang dianalisis dalam periode tertentu.
- **Sentiment & Price Correlation Chart**: Grafik interaktif yang menggabungkan pergerakan harga (Candlestick) dengan rata-rata sentimen harian (Bar Chart) dan Moving Average-nya.
- **Trending Ticker Cloud**: Visualisasi emiten yang paling banyak dibicarakan berdasarkan volume berita terbaru.
- **Intelligent Refresh System**:
    - **Refresh Intelligence**: Tombol manual untuk memicu scraping berita terbaru.
    - **Auto-Gathering**: Secara otomatis memicu background scraping jika data hari ini belum tersedia.

```mermaid
mindmap
  root((Dashboard Features))
    Price tracking
      Latest Price
      Delta vs Prev
      7-day Sparkline
    Sentiment Analysis
      Market Mood Index
      Bullish/Bearish Label
      Sentiment Sparkline
    Analytics
      Pearson Correlation
      Correlation Strength
      News Volume Stats
    Visualizations
      Candlestick + Sentiment Chart
      Ticker Word Cloud
    Intelligence
      Manual Scraping
      Auto-Gathering logic
```

---

## 2. Alur Kerja (Flow)

Alur dimulai dari interaksi pengguna di frontend hingga pemrosesan data di backend.

1.  **Inisialisasi**: Pengguna membuka dashboard atau mengubah filter (Ticker/Date Range).
2.  **Request**: Frontend mengirimkan permintaan ke API Endpoint `/api/dashboard-stats`.
3.  **Data Fetching**: 
    - Backend mengambil data harga dari Yahoo Finance (`yfinance`).
    - Backend mengambil data berita dari Database (SQLite/PostgreSQL).
4.  **Processing**: `DataProvider` menyelaraskan timestamp harga dan sentimen, lalu menghitung korelasi dan statistik lainnya.
5.  **Intelligence Check**: Jika volume berita hari ini = 0, sistem memicu scraping otomatis ke CNBC Indonesia dan EmitenNews.
6.  **Rendering**: Frontend menerima data JSON dan merender metrik serta grafik menggunakan Recharts.

```mermaid
graph TD
    A[User Opens Dashboard] --> B{Filter Changed?}
    B -- Yes --> C[Call /api/dashboard-stats]
    B -- No --> C
    C --> D[Backend: Fetch Stock Data - yfinance]
    C --> E[Backend: Fetch News Data - DB]
    D --> F[DataProvider: Align & Calc Stats]
    E --> F
    F --> G{Is Data Empty for Today?}
    G -- Yes --> H[Trigger Background Scrapers]
    H --> I[Update DB & Refetch]
    I --> J[Return JSON to Frontend]
    G -- No --> J
    J --> K[Render Metric Cards & Charts]
```

---

## 3. Cara Kerja (Mechanics)

### Analisis Sentimen
Setiap berita yang di-scrape diproses oleh `SentimentEngine` (AI Model). Model memberikan label:
- **Bullish**: Dampak positif (skor 0-1).
- **Bearish**: Dampak negatif (skor 0 to -1).
- **Netral**: Tidak ada dampak signifikan (skor 0).

### Perhitungan Korelasi
Sistem menggunakan **Koefisien Korelasi Pearson**:
- Nilai dekat **1.0**: Harga cenderung naik saat sentimen positif (Strong Positive).
- Nilai dekat **-1.0**: Harga cenderung turun saat sentimen positif (Strong Negative/Inverse).
- Nilai dekat **0**: Tidak ada hubungan linier antara harga dan berita.

### Ticker Extraction
Menggunakan logika NER (Named Entity Recognition) untuk mendeteksi kode emiten (misal: BBCA, ASII) dari judul berita, sehingga berita dapat dikategorikan secara otomatis meskipun tidak disebutkan secara eksplisit oleh sumber berita.

```mermaid
mindmap
  root((Mechanics))
    Sentiment Engine
      AI Labeling
      Confidence Scoring
      Normalization
    Statistical Correlation
      Pearson Calculation
      Time-Series Alignment
      Rolling Windows
    Data Integration
      yfinance API
      Database News Aggregation
      Metadata Extraction
    Ticker Mapping
      Regex Patterns
      Fuzzy Matching
      IDX Ticker Registry
```

---

## 4. Arsitektur

Sistem ini didasarkan pada arsitektur **Modern Web Application** dengan pemisahan tugas yang jelas.

- **Frontend (Next.js)**: 
    - State management menggunakan Context API (`FilterContext`).
    - Visualisasi menggunakan `Recharts` dan `Lucide Icons`.
- **Backend (FastAPI)**:
    - `main.py`: Entry point API.
    - `data_provider.py`: Core logic untuk agregasi data dan perhitungan statistik.
    - `modules/database.py`: layer komunikasi database.
- **External Services**:
    - **yfinance**: Sumber data market history.
    - **Web Scrapers**: Modul untuk mengambil berita dari CNBC & EmitenNews.

```mermaid
graph LR
    subgraph "Frontend (Next.js)"
    UI[Dashboard UI]
    FC[Filter Context]
    API[API Client]
    end

    subgraph "Backend (FastAPI)"
    M[main.py]
    DP[DataProvider]
    DBM[Database Manager]
    end

    subgraph "Data Sources"
    YF[yfinance API]
    CNBC[CNBC Scraper]
    EN[EmitenNews Scraper]
    end

    UI --> FC
    FC --> API
    API --> M
    M --> DP
    DP --> YF
    DP --> DBM
    M --> CNBC
    M --> EN
    CNBC --> DBM
    EN --> DBM
```

---

## 5. Keseluruhan Alur (End-to-End Flow)

Berikut adalah visualisasi menyeluruh dari siklus hidup data di dalam dashboard:

```mermaid
flowchart TB
    Start((Start)) --> User[User Selects Ticker]
    User --> Request[Fetch Stats & News]
    
    subgraph Processing[Data Processing Loop]
    direction TB
    FetchMarket[Fetch yfinance OHLC]
    FetchNews[Fetch Sentiment Records from DB]
    Align[Align Time-Series Data]
    Calc[Calculate Pearson Correlation]
    end
    
    Request --> Processing
    Processing --> Check{Is Today Missing?}
    
    Check -- Yes --> Scrape[Execute Background Scrapers]
    Scrape --> Update[Analyze & Store in DB]
    Update --> Processing
    
    Check -- No --> Output[Generate Visualization Data]
    Output --> Display[Render Cards & Charts]
    Display --> End((Display Done))
```
