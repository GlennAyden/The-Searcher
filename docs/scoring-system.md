# 🚀 NeoBDM Flow Tracker: Dokumentasi Scoring System Terpadu

Panduan ini mendefinisikan standar logika penilaian (*scoring logic*) untuk menyaring aliran dana bandar (*fund flow*) menjadi sinyal perdagangan yang objektif, terukur, dan memiliki probabilitas tinggi.

---

## 📋 Filosofi Dasar
Sistem ini dibangun di atas prinsip **"Context Beats Numbers"**. Sebuah angka akumulasi besar tidak berarti apa-apa tanpa konteks trajectori (momentum), pola historis (pattern), dan keselarasan rentang waktu (alignment).

Sistem menggunakan 3 dimensi data:
- **D (Daily)**: d-0 (Today) s/d d-4. Fokus pada antusiasme harian.
- **W (Weekly)**: w-1 (Minggu ini) s/d w-4. Fokus pada tren mingguan.
- **C (Cumulative)**: c-3 s/d c-20. Fokus pada restu jangka panjang (*Sustained Build-up*).

---

## ⚙️ 4-Phase Scoring Engine (-200 s/d +300 Poin)

### 1. Phase 1: Timeframe Alignment (Confluence)
Sinyal terkuat terjadi saat semua *tide* (pasang surut) berada di arah yang sama.
- **Perfect Alignment (+30 Poin)**: D, W, dan C semuanya positif. Menandakan konsensus mutlak di semua level trader.
- **Partial Alignment (+15 Poin)**: 2 dari 3 timeframe selaras (misal: D dan W positif, C masih mengejar).
- **Divergence (Penalty -20 Poin)**: D positif tapi W/C negatif. Seringkali merupakan *fake-out* atau retail chasing.

### 2. Phase 2: Momentum Analysis (Velocity & Acceleration)
Menghitung kecepatan dan akselerasi aliran dana untuk mendeteksi *early stage* vs *late stage*.
- **🚀 Accelerating (+30 Poin)**: `d-0 > d-2` dan gap-nya membesar. Bandar sedang agresif "tambah gas".
- **↗️ Increasing (+20 Poin)**: Akumulasi stabil namun tidak secepat fase akselerasi.
- **➡️ Stable (+10 Poin)**: Akumulasi berjalan konstan.
- **↘️ Weakening (-10 Poin)**: Masih akumulasi tapi jumlahnya mengecil (*decelerating*).
- **🔻 Declining (-20 Poin)**: Arus kas mulai keluar secara konsisten.

### 3. Phase 3: Pattern Recognition (Flow Signature)
Mengidentifikasi "sidik jari" pergerakan bandar.
- **✅ Consistent Accumulation (+40 Poin)**: 4+ hari berturut-turut d-0 s/d d-4 positif. Menandakan *institutional buying* yang rapi.
- **🔄 Trend Reversal (+25 Poin)**: `w-2` negatif berubah menjadi `w-1` positif kuat. Indikasi *bottom fishing*.
- **📈 Sustained Build-up (+20 Poin)**: `c-20 > c-10 > c-3`. Akumulasi jangka panjang yang sehat.
- **⚠️ Fresh Spike (-15 Poin)**: `d-0` sangat besar tapi tidak punya histori `c-10/c-20`. Risiko *pump & dump* tinggi.
- **❌ Distribution (-40 Poin)**: Pola jualan masif yang konsisten.

### 4. Phase 4: Early Warning System (Risk Mitigation)
Mendeteksi pelemahan sebelum harga berbalik arah.
- **🟢 No Risk**: Aliran dana dan harga selaras.
- **🟡 Yellow Flag**: `d-0` positif tapi `< d-2`. Momentum mulai melambat.
- **🟠 Orange Flag**: `w-1 < w-2`. Tren mingguan mulai patah.
- **🔴 Red Flag**: `c-3` negatif meski `d-0` positif. Indikasi *dead cat bounce*.

---

## 📊 Klasifikasi Sinyal & Rencana Aksi

| Skor | Kekuatan | Warna | Interpretasi & Aksi |
| :--- | :--- | :--- | :--- |
| **≥ 150** | **VERY STRONG** | 💎 Emerald | **High Conviction**. Bandar agresif + All Timeframes Align. Siap untuk *position sizing* maksimal. |
| **90 - 149** | **STRONG** | 🔵 Blue | **Healthy Trend**. Akumulasi solid dan stabil. Area ideal untuk *entry* atau *add position*. |
| **45 - 89** | **MODERATE** | 🟡 Amber | **Watchlist**. Ada akumulasi tapi momentum belum maksimal atau ada sedikit divergensi. |
| **0 - 44** | **WEAK** | ⚪ Gray | **Risky**. Akumulasi kecil atau spekulatif. Hindari kecuali ada katalis lain. |
| **< 0** | **AVOID** | 🔴 Red | **Distribution**. Bandar sedang keluar. Jangan terpancing volume harian. |

---

## 🎯 Strategi Optimal Entry & Exit

### Sweet Spot Entry
1. **Flow**: `c-10 > 200B` (ada basis sejarah) dan `d-0` antara 50B - 150B.
2. **Timing**: Saat pattern **Consistent Accumulation** terdeteksi.
3. **Price Confirmation**: Kenaikan harga harian belum melebihi +3% (mencegah *late entry*).

### Exit Strategy
- **Partial Exit**: Saat sistem mengeluarkan **Orange Flag** atau skor turun dari >150 ke <100 secara mendadak.
- **Full Exit**: Saat skor menjadi negatif atau terdeteksi pola **Distribution** yang konsisten selama 3 hari.

---

## 💡 Ringkasan Indikator Visual
- **🚀 (Rocket)**: Acceleration Stage. High explosive potential.
- **📈 (Chart Up)**: Consistent accumulation. Low risk, steady growth.
- **⚠️ (Warning)**: High Flow but High Risk (No history/Spike).
- **🔄 (Cycle)**: Potential Change of Trend.

---
*Dokumen ini merupakan standar audit baku untuk sistem Flow Tracker Antigravity.*