# 🚀 Quick Start Guide - BN2 Unified System

## 🎯 Sistem yang Didukung
API ini mendukung **3 sistem dalam 1 Google Apps Script**:
- ✅ **Jimpitan** - Pengelolaan kas/jimpitan warga
- ✅ **Inventaris** - Pengelolaan barang inventaris
- ✅ **Peminjaman** - Pencatatan peminjaman barang

---

## ⚡ Setup Cepat (5 Menit)

### Step 1: Siapkan Google Sheets
1. Buat/buka Google Sheets
2. Pastikan ada kolom: **TANGGAL | TIPE | NOMINAL | KETERANGAN | PELAPOR**
3. Contoh format tanggal: `01-Jan-2026`, `15-Feb-2026`

### Step 2: Deploy Unified Apps Script
1. Di Google Sheets → **Extensions** → **Apps Script**
2. Copy semua kode dari file `google-apps-script.js` (V5 - Unified API)
3. Paste ke Apps Script editor
4. **Penting**: Ubah nama sheet jika berbeda:
   - `SHEET_JIMPITAN = "Jimpitan"` (untuk data jimpitan)
   - `SHEET_INVENTARIS = "Inventaris"` (untuk data inventaris)
   - `SHEET_PEMINJAMAN = "Peminjaman"` (untuk data peminjaman)
5. **Deploy** → **New deployment** → **Web app**
6. Set: Execute as **Me**, Who has access: **Anyone**
7. **Copy URL** yang muncul (URL ini digunakan untuk SEMUA sistem)

### Step 3: Publish Sheets sebagai CSV
**Untuk Jimpitan:**
1. **File** → **Share** → **Publish to web**
2. Pilih sheet **Jimpitan**, format: **CSV**
3. Klik **Publish** → **Copy URL CSV**

**Untuk Inventaris:**
1. Ulangi langkah di atas untuk sheet **Inventaris**
2. **Copy URL CSV** untuk inventaris

*Note: Setiap sistem butuh CSV URL sendiri*

### Step 4: Setup di Aplikasi

**Untuk Jimpitan:**
1. Buka `jimpitan/index.html` di browser
2. Klik 🔒 → Login dengan password: `adminbn2`
3. Klik ⚙️ → Paste URL:
   - CSV URL: URL dari sheet Jimpitan
   - Apps Script URL: URL unified API
4. Klik **Simpan Konfigurasi**

**Untuk Inventaris:**
1. Buka `inventaris/index.html` di browser
2. Setup serupa dengan URL masing-masing

✅ **Done!** Semua sistem menggunakan **1 Apps Script URL yang sama**

---

## 🎯 Unified Apps Script URL

**PENTING**: Satu Apps Script URL untuk SEMUA sistem!

**Apps Script URL (Unified V5):**
```
https://script.google.com/macros/s/AKfycbwx9SAlhLZnSM8V43sIJpf84B28-x6ErVQTOInKU1ZGoabTXZKWQOTftjViMuxuM62E/exec
```

**CSV URL berbeda untuk setiap sistem:**
- Jimpitan: `...pub?gid=289431951&output=csv`
- Inventaris: `...pub?gid=[gid_inventaris]&output=csv`
- Peminjaman: `...pub?gid=[gid_peminjaman]&output=csv`

**Jika URL ini sudah benar**, Anda bisa langsung pakai tanpa setup! ✨

---

## 🧪 Test Koneksi

### Test 1: Lihat Data
- Buka aplikasi → Klik 🔄 Refresh
- Data dari Google Sheets harus muncul

### Test 2: Tambah Data
- Login Admin (password: `adminbn2`)
- Klik ➕ → Isi form → Simpan
- Cek Google Sheets → Data baru harus ada

---

## 📱 Fitur Utama

### Jimpitan
| Fitur | Cara Pakai |
|-------|------------|
| **Lihat Data** | Filter bulan/tahun, navigasi minggu ← → |
| **Tambah Data** | Login Admin → Klik ➕ |
| **Edit Data** | Klik data → ✏️ Edit |
| **Hapus Data** | Klik data → 🗑️ Hapus |
| **Export CSV** | Klik 💾 |
| **Share WhatsApp** | Klik 📤 → Pilih minggu/bulan |
| **Refresh Data** | Klik 🔄 |

### Inventaris & Peminjaman
Lihat dokumentasi masing-masing aplikasi untuk fitur lengkap.

---

## ⚙️ Ganti Password Admin

Password admin **berlaku untuk SEMUA sistem** (Jimpitan, Inventaris, Peminjaman).

**Di file `google-apps-script.js` (Unified):**
```javascript
const ADMIN_PASSWORD = 'adminbn2'; // ← Ubah ini
```

**Di file `jimpitan/app.js`:**
```javascript
const ADMIN_PASS = 'adminbn2'; // ← Ubah ini (harus sama!)
```

**Di file `inventaris/app.js`:**
```javascript
const ADMIN_PASS = 'adminbn2'; // ← Ubah ini (harus sama!)
```

⚠️ **Password harus sama di semua file!**

---

## ❓ Troubleshooting

### "Gagal memuat data"
- ✅ Cek URL CSV sudah benar
- ✅ Google Sheets sudah di-publish

### "Gagal menyimpan"
- ✅ Sudah login Admin?
- ✅ Apps Script sudah di-deploy dengan akses "Anyone"?
- ✅ Password admin sama di **semua file** (google-apps-script.js, app.js)?
- ✅ Pastikan menggunakan **Unified API V5** (lihat versi di doGet response)

### Data tidak sync
- ✅ Tunggu 2-3 detik → Klik 🔄 Refresh

---

## 🔧 Struktur Google Sheets

Pastikan Google Sheets memiliki 3 sheet dengan struktur:

**Sheet: Jimpitan**
```
TANGGAL | TIPE | NOMINAL | KETERANGAN | PELAPOR
```

**Sheet: Inventaris**
```
NO_INVENTARIS | NAMA_BARANG | KATEGORI | JUMLAH | KONDISI | LOKASI | FOTO | KETERANGAN | TAHUN
```

**Sheet: Peminjaman**
```
ID_PINJAM | TGL_PINJAM | TGL_KEMBALI | BARANG | JUMLAH | PEMINJAM | STATUS | KETERANGAN
```

---

## 📚 Dokumentasi Lengkap

Lihat file `SETUP_GOOGLE_APPS_SCRIPT.md` untuk penjelasan detail.

---

**✨ Happy Managing! ✨**
