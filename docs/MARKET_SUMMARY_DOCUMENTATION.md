# NeoBDM - Market Summary Documentation

Dokumentasi ini menjelaskan fitur, alur kerja, cara kerja, dan arsitektur dari modul **Market Summary (NeoBDM Analysis)**.

---

## 1. Fitur Utama

- **Multi-Method Analysis**: Mendukung tiga metode analisa aliran dana:
    - **Market Maker Analysis**: Melacak aktivitas bandar/market maker.
    - **Non-Retail Flow**: Melacak pergerakan modal dari institusi/non-retail.
    - **Foreign Flow Analysis**: Melacak arus modal asing.
- **Dual Period Views**:
    - **Daily**: Data pergerakan harian terbaru.
    - **Cumulative**: Data akumulasi dalam rentang waktu tertentu.
- **Advanced Data Table**:
    - Ultra-compact view dengan font mono untuk densitas data maksimum.
    - Sorting cerdas (numerik & string) pada setiap kolom.
    - Filter per-kolom untuk pencarian emiten atau kriteria teknikal secara instan.
- **Marker Highlighting**: Deteksi otomatis sinyal khusus seperti **Crossing**, **Unusual**, dan **Pinky** (indikasi akumulasi intens).
- **Batch Sync & Live Scrape**: Kemampuan untuk mengambil data terbaru secara langsung atau melakukan sinkronisasi penuh untuk semua metode dan periode.

```mermaid
mindmap
  root((Market Summary Features))
    Analysis Methods
      Market Maker
      Non-Retail
      Foreign Flow
    Reporting Periods
      Daily Metrics
      Cumulative Accumulation
    Data Grid
      Column Filtering
      Smart Sorting
      Compact Mono View
    Special Markers
      Pinky (Intensity)
      Crossing (Big Trades)
      Unusual (Volume Spike)
    Sync Engine
      Live Scrape
      Full Sequential Sync
```

---

## 2. Alur Kerja (Flow)

Alur dimulai dari pemilihan metode analisa hingga penyajian data mendalam.

1.  **Configuration**: User memilih Metode (m/nr/f) dan Periode (d/c).
2.  **Date Selection**: User memilih tanggal data dari histori yang tersedia di database.
3.  **Data Fetching**: 
    - Frontend memanggil `/api/neobdm-summary`.
    - Jika `scrape=true`, backend akan menjalankan *headless browser* untuk mengambil data langsung dari sumber eksternal (NeoBDM).
    - Jika `scrape=false`, backend mengambil record terbaru dari SQLite.
4.  **Processing & UI Mapping**: Backend memetakan kolom dinamis berdasarkan periode (misal: kolom `w-1` di daily vs `c-5` di cumulative).
5.  **Rendering**: Data disajikan dalam tabel dengan pewarnaan kondisional (hijau untuk akumulasi, merah untuk distribusi).

```mermaid
graph TD
    A[User Selects Method/Period] --> B{Found in DB?}
    B -- Yes --> C[Load Historical Data]
    B -- No / Manual --> D[Trigger Live Scrape]
    D --> E[Headless Browser: Login & Scrape]
    E --> F[Analyze & Save to DB]
    F --> C
    C --> G[Process Columns & Pagination]
    G --> H[Render Interactive Grid]
```

---

## 3. Cara Kerja (Mechanics)

### Headless Scraper
Sistem menggunakan modul `scraper_neobdm.py` yang mensimulasikan sesi browser pengguna untuk melewati autentikasi dan mengekstrak tabel data kompleks dari penyedia informasi pasar.

### Dynamic Column Ordering
Tabel secara otomatis menyesuaikan kolom yang ditampilkan berdasarkan periode yang dipilih:
- **Daily Mode**: Fokus pada `w-4` s/d `d-0` (perubahan harian).
- **Cumulative Mode**: Fokus pada `c-20` s/d `c-3` (akumulasi jangka menengah).
- **Technical Metrics**: Selalu menyertakan perbandingan harga terhadap MA5 s/d MA100.

### Conditional Formatting Logic
- **`v` markers**: Dikonversi menjadi badge berwarna (Pink/Orange) pada kolom Pinky/Crossing.
- **Negative Values**: Otomatis berwarna merah (Distribusi).
- **Positive Values**: Otomatis berwarna hijau (Akumulasi).

```mermaid
mindmap
  root((Mechanics))
    Collection Engine
      Playwright/Headless Browser
      Session Management
      Sequential Batch Tasking
    Data Schema
      Method-based Tables
      Snapshot Archiving
      Ticker Registry
    UI Intelligence
    Dynamic Widths
    Conditional Colors
    Client-side Pagination
```

---

## 4. Arsitektur

Modul ini berfungsi sebagai komponen *data-heavy* yang berinteraksi intens dengan database.

- **Component**: `NeoBDMSummaryPage`.
- **Backend API**: 
    - `/api/neobdm-summary`: Endpoint utama data.
    - `/api/neobdm-dates`: Mengambil daftar histori tanggal.
    - `/api/neobdm-batch-scrape`: Memicu sinkronisasi masif.
- **Database**: Tabel `neobdm_records` menyimpan snapshot data mentah per tanggal dan metode.

```mermaid
graph LR
    subgraph "Frontend"
    UI[NeoBDM Summary UI]
    State[Filter & Sort State]
    end

    subgraph "Backend API"
    API[/api/neobdm-summary/]
    SYNC[/api/neobdm-batch-scrape/]
    end

    subgraph "Engines"
    SCRAPE[NeoBDM Scraper Module]
    DB[(SQLite Storage)]
    end

    UI --> API
    UI --> SYNC
    API --> DB
    SYNC --> SCRAPE
    SCRAPE --> DB
    API -- If Scrape=True --> SCRAPE
```

---

## 5. Keseluruhan Alur (End-to-End Flow)

```mermaid
flowchart TB
    Start((User Request)) --> Config[Select Method & Period]
    Config --> CheckDB{Data Available?}
    
    CheckDB -- No --> Scrape[Run NeoBDM Scraper]
    Scrape --> Parse[Parse HTML Table to DF]
    Parse --> Save[Save to neobdm_records]
    Save --> Logic[Load to Memory]
    
    CheckDB -- Yes --> Logic
    
    Logic --> Filter[Apply Client-side Filters]
    Filter --> Sort[Apply Column Sort]
    Sort --> Map[Map Dynamic Columns]
    Map --> View[Display Grid with Color Codes]
```
