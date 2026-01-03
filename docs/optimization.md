# Optimization & Enhancement Roadmap: Project Searcher

Dokumen ini merinci rencana teknis untuk mengoptimalkan fitur yang sudah ada guna meningkatkan kecepatan, efisiensi AI, dan kualitas pengalaman pengguna (UX).

---

## 🛠️ Bidang Optimasi

### 1. Performa Data & Backend
*   [x] **SQL-Level Filtering**: Memindahkan logika filter `ticker` dan `date` dari Pandas (di memori) ke Query SQL (di database).
    *   *Goal*: Mengurangi beban RAM dan mempercepat respon API saat database membengkak.
*   [x] **API Pagination**: Menambahkan parameter `limit` dan `page` pada endpoint berita.
    *   *Goal*: Mempercepat loading awal halaman Dashbord dan News Library.
*   [ ] **Asynchronous Scraping**: Implementasi `asyncio` pada Scraper Engine.
    *   *Goal*: Memungkinkan pengambilan data dari berbagai halaman berita secara paralel (mengurangi waktu tunggu hingga 70%).

### 2. Efisiensi RAG & AI Pipeline
*   [x] **Semantic Chunking**: Menggunakan metode pemecahan teks yang lebih cerdas (tidak hanya karakter) untuk mempertahankan konteks paragraf.
    *   *Goal*: Meningkatkan akurasi jawaban LLM dalam sesi chat.
*   [x] **Embedding Caching**: Menyimpan hasil vektor embedding untuk dokumen yang sama.
    *   *Goal*: Menghindari pemrosesan ulang dokumen yang sudah ada di ChromaDB, sehingga menghemat daya CPU/GPU.
*   [x] **Recursive Retrieval**: Mengoptimalkan cara pencarian konteks di VectorDB agar tidak hanya mengambil chunk terdekat, tapi juga context di sekitarnya.

### 3. Visualisasi & UX (Frontend)
*   [ ] **Skeleton Loading**: Menambahkan animasi loading transisi sebelum data muncul.
    *   *Goal*: Memberikan persepsi aplikasi yang lebih cepat dan modern.
*   [ ] **Synced Charts**: Sinkronisasi interaksi antara chart harga saham dan chart sentimen.
    *   *Goal*: Memudahkan analisis korelasi visual secara real-time.
*   [ ] **Optimasi Re-render**: Mengurangi render yang tidak perlu pada komponen React menggunakan `useMemo` dan `useCallback`.

### 4. Database & Storage Management
*   [x] **Database Indexing**: Memastikan index yang tepat pada kolom `timestamp`, `url`, dan `ticker`.
    *   *Goal*: Query pencarian data masif di bawah 10ms.
*   [x] **Incremental Scraping (Early Exit)**: Berhenti melakukan scraping jika ditemukan 10 artikel berurutan yang sudah ada di database. (Optimasi Efisiensi)
*   [ ] **File Clean-up Utility**: Skrip pembersihan otomatis untuk folder `downloads/` setelah dokumen berhasil di-ingest ke VectorDB.

---

## 📊 Prioritas Pelaksanaan

| Prioritas | Fitur / Optimasi | Kategori | Alasan Utama |
| :--- | :--- | :--- | :--- |
| **P1** | **SQL-Level Filtering** | Backend | [DONE] |
| **P1** | **Database Indexing** | Database | [DONE] |
| **P2** | **Skeleton Loading** | Frontend | [PENDING] |
| **P2** | **Semantic Chunking** | AI Core | [DONE] |
| **P2** | **Recursive Retrieval** | AI Core | [DONE] |
| **P3** | **API Pagination** | Backend | [DONE] |
| **P3** | **Asynchronous Scraper** | Backend | [PENDING] |
| **P4** | **Synced Charts** | Frontend | [PENDING] |

---
*Terakhir diperbarui: 2025-12-20*
