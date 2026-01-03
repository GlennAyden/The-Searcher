# Future Development Roadmap: Project Searcher

Dokumen ini menguraikan rencana pengembangan fitur masa depan untuk meningkatkan kapabilitas intelijen bisnis, efisiensi operasional, dan pengalaman pengguna di platform `project-searcher`.

---

## 🚀 Fitur Utama & Target

### 1. Multi-Document RAG (Global Search)
*   **Deskripsi**: Mengalihkan kapabilitas RAG dari pencarian per dokumen tunggal menjadi pencarian lintas kumpulan dokumen (Keterbukaan Informasi).
*   **Goal**: Memungkinkan pengguna melakukan pertanyaan analitis tingkat tinggi yang membutuhkan data dari berbagai sumber.
*   **Contoh Query**: *"Ringkas semua sentimen mengenai ekspansi sektor energi dari emiten BBCA, PGAS, dan ADRO dalam semester terakhir."*
*   **Teknis**: Optimasi ChromaDB dengan metadata filtering yang lebih luas dan teknik *Reranking* untuk meningkatkan relevansi konteks.

### 2. Knowledge Graph (Koneksi Emiten)
*   **Deskripsi**: Membangun graf hubungan antar emiten berdasarkan entitas yang muncul bersamaan dalam berita atau laporan keterbukaan informasi.
*   **Goal**: Memvisualisasikan ekosistem pasar saham dan ketergantungan antar perusahaan (misal: supplier-customer, kemitraan strategis, atau kompetisi).
*   **Visualisasi**: Graf interaktif menggunakan `react-force-graph` atau `D3.js` yang menunjukkan simpul (emiten) dan garis (tipe hubungan).

### 3. Automatic Market Summary (Newsletter)
*   **Deskripsi**: Sistem AI yang secara periodik (harian/mingguan) merangkum kejadian pasar paling signifikan.
*   **Goal**: Memberikan *insights* instan tanpa harus membaca ratusan berita satu per satu.
*   **Output**: Dashboard ringkasan khusus atau pengiriman otomatis via email/API yang berisi:
    *   Top 3 berita dengan dampak sentimen terbesar.
    *   Ringkasan keterbukaan informasi paling krusial.
    *   Prediksi narasi pasar untuk sesi berikutnya.

### 4. Scraper Scheduler
*   **Deskripsi**: Mengotomatiskan proses penarikan data dari CNBC Indonesia, EmitenNews, dan IDX tanpa intervensi manual.
*   **Goal**: Menjamin data pada dashboard selalu mutakhir (Up-to-Date) secara real-time.
*   **Teknis**: Implementasi `APScheduler` di FastAPI atau menggunakan cron jobs untuk menjalankan script scraping pada interval yang ditentukan (misal: setiap 30 menit selama jam bursa).

### 5. Sentiment-Heatmap Ticker Cloud
*   **Deskripsi**: Evolusi dari WordCloud saat ini, di mana warna setiap ticker merepresentasikan skor sentimen rata-rata.
*   **Goal**: Memberikan gambaran visual cepat mengenai emiten mana yang sedang "panas" secara positif atau negatif.
*   **Skema Warna**:
    *   🟢 **Bright Green**: Sentimen Bullish Kuat
    *   ⚪ **Grey/White**: Sentimen Netral
    *   🔴 **Bright Red**: Sentimen Bearish Kuat

### 6. My Watchlist
*   **Deskripsi**: Fitur personalisasi untuk menyimpan daftar emiten yang ingin dipantau secara khusus oleh pengguna.
*   **Goal**: Mempersempit kebisingan data (*data noise*) dengan memberikan filter cepat untuk hanya melihat berita, chart, dan RAG yang relevan dengan portofolio pengguna.
*   **Fitur**: Tab "Watchlist" khusus di dashboard dengan metrik ringkasan performa harian untuk emiten terpilih.

---

## 🛠️ Prioritas Pengembangan

| Urutan | Fitur | Kategori | Keuntungan Utama |
| :--- | :--- | :--- | :--- |
| **1** | **Scraper Scheduler** | Infrastruktur | Otomatisasi & Data Freshness |
| **2** | **My Watchlist** | Personalization | Fokus Pengguna & UX |
| **3** | **Sentiment-Heatmap Cloud** | Visualisasi | Analisis Visual Cepat |
| **4** | **Multi-Document RAG** | AI / Intelligence | Kedalaman Analisis |
| **5** | **Market Summary** | AI / Intelligence | Efisiensi Waktu |
| **6** | **Knowledge Graph** | Data Mining | Pemahaman Ekosistem |

---
*Terakhir diperbarui: 2025-12-20*
