# 📊 Template Google Sheets - Jimpitan BN2

## 🎯 Struktur Kolom yang Diperlukan

Buat Google Sheets dengan **5 kolom** berikut (urutan penting):

| Kolom | Nama | Format | Contoh | Keterangan |
|-------|------|--------|--------|------------|
| **A** | TANGGAL | DD-MMM-YYYY | 01-Jan-2026 | Format bulan 3 huruf |
| **B** | TIPE | Text | Pemasukan / Pengeluaran | Harus persis salah satu |
| **C** | NOMINAL | Number | 50000 | Angka saja, tanpa Rp |
| **D** | KETERANGAN | Text | Jimpitan Warga | Deskripsi transaksi |
| **E** | PELAPOR | Text | Admin | Nama pelapor |

---

## 📋 Contoh Data

Copy template ini ke Google Sheets Anda:

```
TANGGAL       TIPE          NOMINAL   KETERANGAN              PELAPOR
01-Jan-2026   Pemasukan     50000     Jimpitan Warga          Admin
02-Jan-2026   Pemasukan     75000     Jimpitan Warga          Admin
03-Jan-2026   Pemasukan     0         Tidak Ada Jimpitan      Admin
05-Jan-2026   Pemasukan     100000    Jimpitan Warga          Admin
08-Jan-2026   Pengeluaran   150000    Beli Konsumsi RT        Admin
10-Jan-2026   Pemasukan     80000     Jimpitan Warga          Admin
15-Jan-2026   Pengeluaran   200000    Iuran Satpam            Admin
20-Jan-2026   Pemasukan     90000     Jimpitan Warga          Admin
25-Jan-2026   Pemasukan     85000     Jimpitan Warga          Admin
```

---

## ⚠️ Aturan Penting

### 1. Format Tanggal
- ✅ **Benar**: `01-Jan-2026`, `15-Feb-2026`, `31-Des-2025`
- ❌ **Salah**: `1/1/2026`, `01-01-2026`, `2026-01-01`
- Format bulan: Jan, Feb, Mar, Apr, Mei, Jun, Jul, Agu, Sep, Okt, Nov, Des

### 2. Format Tipe
- ✅ **Benar**: `Pemasukan` atau `Pengeluaran` (huruf besar di awal)
- ❌ **Salah**: `pemasukan`, `PEMASUKAN`, `masuk`, `keluar`

### 3. Format Nominal
- ✅ **Benar**: `50000`, `100000`, `0`
- ⚠️ **Juga OK**: `Rp 50.000` (akan diparse otomatis)
- Nominal 0 = Hari kosong/tidak ada jimpitan

### 4. Keterangan & Pelapor
- Boleh teks apa saja
- Jika kosong, aplikasi akan isi dengan "-" dan "Admin"

---

## 🎨 Tips Formatting di Google Sheets

### Header Row (Baris 1)
- Background: Hijau (#059669)
- Text: Putih, Bold
- Align: Center

### Data Rows
- TANGGAL: Align Left
- TIPE: Align Center
- NOMINAL: Align Right, Format: Number dengan separator ribuan
- KETERANGAN: Align Left
- PELAPOR: Align Center

### Conditional Formatting (Opsional)
**Untuk kolom TIPE:**
- Jika "Pemasukan" → Background hijau muda
- Jika "Pengeluaran" → Background merah muda

**Untuk kolom NOMINAL:**
- Jika = 0 → Text abu-abu

---

## 📥 Import dari CSV

Jika Anda punya data CSV existing:

1. **File** → **Import** → **Upload**
2. Upload file CSV Anda
3. Import location: **Replace current sheet**
4. Separator: **Comma**
5. Pastikan kolom sesuai urutan A-E di atas

---

## 🔄 Auto-Sort (Opsional)

Untuk otomatis sort data berdasarkan tanggal:

1. Select semua data (termasuk header)
2. **Data** → **Sort range**
3. Data has header row: **Checked**
4. Sort by: **TANGGAL** (A → Z)

---

## 🚀 Siap Deploy?

Setelah Google Sheets siap dengan struktur ini:

1. ✅ Pastikan kolom A-E sesuai
2. ✅ Header di baris 1
3. ✅ Data mulai dari baris 2
4. ✅ Format tanggal benar (DD-MMM-YYYY)
5. ✅ Lanjut ke setup Apps Script (lihat QUICK_START.md)

---

## 💡 Link Template Siap Pakai

**Cara tercepat:**
1. Buka Google Sheets
2. Copy struktur di atas
3. Paste ke sheet Anda
4. Isi dengan data real Anda

Atau buat dari blank sheet dengan struktur yang sama.

---

**✨ Template siap digunakan! ✨**
