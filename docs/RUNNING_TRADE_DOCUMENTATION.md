# Running Trade - Live Tape & RT History Documentation

Dokumentasi ini menjelaskan fitur, alur kerja, cara kerja, dan arsitektur dari modul **Running Trade Monitoring System**.

---

## 1. Fitur Utama

### A. Live Tape
- **Streaming Trade Feed**: Menampilkan setiap transaksi yang terjadi di bursa secara real-time.
- **Power Meter**: Visualisasi kekuatan beli (Buy Power) vs kekuatan jual (Sell Power) dalam format *gauge*.
- **Net Volume Chart**: Grafik area real-time yang menunjukkan akumulasi volume (Net Lots) detik demi detik.
- **Multi-Ticker Matrix**: Mendukung pemantauan hingga 3 emiten sekaligus dalam satu layar.

### B. RT History (Interval Snapshots)
- **Snapshot Generation**: Penyimpanan otomatis rangkuman aktivitas perdagangan setiap interval waktu tertentu (misal: per 1-5 menit).
- **Big Order Detection**: Menghitung jumlah pesanan berkapasitas besar yang masuk dalam satu snapshot.
- **AI-Driven Conclusion**: Memberikan kesimpulan otomatis (Bullish/Bearish/Netral) berdasarkan dinamika bid-ask dan volume di setiap interval.

```mermaid
mindmap
  root((Running Trade Features))
    Live Monitoring
      Real-time Tape Feed
      Multi-Ticker (Up to 3)
      Buy/Sell Power Meter
      Net Volume Flow Area
    Data Analysis
      Big Order Counter
      Interval Snapshots
      AI Conclusion Gist
    System Control
      Remote Cloud Browser
      Session Management
      Reset & Sync
```

---

## 2. Alur Kerja (Flow)

Alur kerja Running Trade melibatkan intersepsi data trafik secara langsung.

1.  **System Start**: User menekan "Start Live", backend meluncurkan *cloud browser* dengan Playwright.
2.  **Traffic Interception**: Backend mencegat websocket/API data dari Stockbit/Ajaib tanpa menggunakan OCR.
3.  **Real-time Stream**: Data yang dicegat dikirim ke frontend via endpoint `/api/rt/stream` setiap detik.
4.  **Aggregation**: Backend (`accum_dist.py`) menghitung agregat volume dan harga secara terus menerus di memori.
5.  **Snapshotting**: Setiap interval berakhir, backend menyimpan kondisi terakhir ke database sebagai "History Snapshot".

```mermaid
graph TD
    A[Frontend: Start Stream] --> B[Backend: Launch Headless Browser]
    B --> C[Traffic Interceptor: Capture Payload]
    C --> D[Trade Analyzer: Calculate Buy/Sell Power]
    D --> E[/api/rt/stream: Push Data to UI]
    D --> F{Interval Ended?}
    F -- Yes --> G[Save Snapshot to DB]
    G --> H[Update RT History Section]
    E --> I[Render Live Tape & Gauge]
```

---

## 3. Cara Kerja (Mechanics)

### Traffic Ingestion
Tidak menggunakan Computer Vision. Backend mengintersepsi request jaringan dan memproses payload JSON/Protobuf asli untuk mendapatkan akurasi 100% dan latensi minimum.

### Power Meter Calculation
`Buy Power % = (Buy Volume / Total Volume) * 100`
Memberikan indikasi psikologi pasar: apakah pembeli lebih agresif (*Hajar Kanan*) atau penjual lebih dominan (*Hajar Kiri*).

### History Snapshots
Menyimpan metrik kunci pada titik waktu tertentu:
- `Interval Start/End`
- `Net Volume`
- `Avg Price`
- `Big Order Count`
- `Automated Conclusion`

```mermaid
mindmap
  root((Mechanics))
    Ingestion
      Network Interception
      JSON Payload Parsing
      Async Stream Handling
    Analytics
      In-memory Aggregation
      Rolling 50-point Chart
      Trade Categorization
    History
      Interval Summarization
      SQLite Persistence
      Status Labeling
```

---

## 4. Arsitektur

Modul ini adalah yang paling kompleks karena melibatkan pemrosesan data bursa secara langsung.

- **Component**: `RunningTradePage`, `LiveTape`, `PowerMeter`.
- **Backend Core**: 
    - `stockbit_client.py`: Menangani browser dan traffic capture.
    - `accum_dist.py`: Logika perhitungan akumulasi-distribusi.
- **Data Flow**: Frontend (Polling 1s) <-> FastAPI <-> Stockbit Engine (Headless).

```mermaid
graph LR
    subgraph "Frontend Matrix"
    UI[Running Trade UI]
    LT[Live Tape Feed]
    PM[Power Meter]
    end

    subgraph "Backend API"
    STR[/api/rt/stream/]
    HIST[/api/rt/history/]
    end

    subgraph "Market Ingestion"
    ENG[Stockbit Engine]
    ANA[Trade Analyzer]
    DB[(Snapshots DB)]
    end

    UI --> STR
    UI --> HIST
    STR --> ANA
    ANA --> ENG
    ANA --> DB
    HIST --> DB
```

---

## 5. Keseluruhan Alur (End-to-End Flow)

```mermaid
flowchart TB
    Start((User Start)) --> Connect[Browser Connection]
    Connect --> Capture[Intercept Network Traffic]
    
    subgraph Stream[Live Processing]
    Capture --> Parse[Parse JSON Trade]
    Parse --> UpdateUI[Update Tape & Flow Area]
    end
    
    subgraph Archive[Historical Archiving]
    Parse --> Accum[Accumulate Interval Data]
    Accum --> Snapshot[Create Interval Snapshot]
    Snapshot --> Conclusion[AI Labeling]
    Conclusion --> DBStore[Store in neobdm_records]
    end
    
    Stream --> ViewLive[Real-time Display]
    Archive --> ViewHistory[History List Display]
```
