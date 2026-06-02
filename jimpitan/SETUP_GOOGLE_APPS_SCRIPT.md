# 📋 Setup Google Apps Script untuk Jimpitan BN2

## 🎯 Tujuan
Menghubungkan aplikasi Jimpitan BN2 dengan Google Sheets agar dapat:
- ✅ Mengambil data dari Google Sheets secara real-time
- ✅ Menambah data baru dari aplikasi
- ✅ Mengedit data yang sudah ada
- ✅ Menghapus data

---

## 📝 Langkah-Langkah Setup

### 1️⃣ Persiapkan Google Sheets

1. Buka Google Sheets Anda
2. Pastikan memiliki sheet dengan struktur kolom:
   - **TANGGAL** (format: DD-MMM-YYYY, contoh: 01-Jan-2025)
   - **TIPE** (Pemasukan atau Pengeluaran)
   - **NOMINAL** (angka, bisa dengan Rp atau tanpa)
   - **KETERANGAN** (deskripsi)
   - **PELAPOR** (nama pelapor)

3. Contoh data:
   ```
   TANGGAL       | TIPE        | NOMINAL | KETERANGAN      | PELAPOR
   01-Jan-2025   | Pemasukan   | 50000   | Jimpitan Warga  | Admin
   02-Jan-2025   | Pemasukan   | 75000   | Jimpitan Warga  | Admin
   05-Jan-2025   | Pengeluaran | 100000  | Beli Konsumsi   | Admin
   ```

### 2️⃣ Buat Google Apps Script

1. Di Google Sheets, klik **Extensions** → **Apps Script**
2. Hapus kode default yang ada
3. Copy-paste kode dari file `google-apps-script.js` (ada di folder ini)
4. **Penting**: Ubah nama sheet di baris pertama jika nama sheet Anda bukan "Sheet1":
   ```javascript
   const SHEET_NAME = 'Sheet1'; // ⚠️ Ubah sesuai nama sheet Anda
   ```
5. Klik **Save** (💾)

### 3️⃣ Deploy Google Apps Script

1. Klik **Deploy** → **New deployment**
2. Klik ⚙️ (gear icon) → Pilih **Web app**
3. Setting deployment:
   - **Description**: `Jimpitan BN2 API`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone` ⚠️ (Penting!)
4. Klik **Deploy**
5. **Copy URL** yang muncul (akan seperti: `https://script.google.com/macros/s/ABC123.../exec`)
6. Klik **Done**

### 4️⃣ Setup Publish Google Sheets sebagai CSV

1. Klik **File** → **Share** → **Publish to web**
2. Di dropdown pertama, pilih sheet yang ingin dipublish
3. Di dropdown kedua, pilih **Comma-separated values (.csv)**
4. Klik **Publish**
5. **Copy URL CSV** yang muncul

### 5️⃣ Konfigurasi di Aplikasi Jimpitan

1. Buka aplikasi Jimpitan BN2 di browser
2. Login sebagai Admin:
   - Klik tombol 🔒 di menu bawah
   - Password default: `adminbn2`
3. Klik tombol ⚙️ Settings
4. Masukkan kedua URL:
   - **Google Sheets CSV URL**: Paste URL dari langkah 4
   - **Google Apps Script URL**: Paste URL dari langkah 3
5. Klik **Simpan Konfigurasi**
6. Aplikasi akan otomatis refresh dan mengambil data

---

## 🔐 Keamanan

### Password Admin
Default password admin adalah: `adminbn2`

**Cara mengganti password:**
1. Buka file `jimpitan/app.js`
2. Cari baris: `const ADMIN_PASS = 'adminbn2';`
3. Ubah menjadi password yang Anda inginkan
4. Simpan file

⚠️ **Jangan lupa update password di Google Apps Script juga!**

---

## 🧪 Testing Koneksi

### Test 1: Baca Data
1. Refresh aplikasi dengan tombol 🔄
2. Data dari Google Sheets harus muncul

### Test 2: Tambah Data (Login Admin required)
1. Login sebagai Admin
2. Klik tombol ➕
3. Isi form dan simpan
4. Cek Google Sheets → data baru harus muncul

### Test 3: Edit Data
1. Klik item data yang ingin diedit
2. Klik tombol Edit (✏️)
3. Ubah data dan simpan
4. Cek Google Sheets → data harus terupdate

### Test 4: Hapus Data
1. Klik item data yang ingin dihapus
2. Klik tombol Hapus (🗑️)
3. Konfirmasi
4. Cek Google Sheets → data harus terhapus

---

## ❗ Troubleshooting

### Problem: "Gagal memuat data"
- ✅ Pastikan URL CSV sudah benar
- ✅ Pastikan Google Sheets sudah di-publish
- ✅ Cek koneksi internet

### Problem: "Gagal menyimpan data"
- ✅ Pastikan sudah login sebagai Admin
- ✅ Pastikan URL Apps Script sudah benar
- ✅ Pastikan deployment Apps Script set "Anyone can access"
- ✅ Cek password admin di kode dan di Apps Script sama

### Problem: Data tidak muncul setelah save
- ✅ Wait 2-3 detik lalu klik refresh (🔄)
- ✅ Pastikan format tanggal di Google Sheets sesuai (DD-MMM-YYYY)

### Problem: "Authorization required" di Apps Script
1. Klik **Run** di Apps Script editor
2. Pilih fungsi `doPost`
3. Klik **Review permissions**
4. Login dengan Google Account Anda
5. Klik **Advanced** → **Go to [project name] (unsafe)**
6. Klik **Allow**

---

## 📱 Mode Offline

Aplikasi mendukung mode offline:
- Data terakhir disimpan di browser (localStorage)
- Jika koneksi gagal, data cache akan ditampilkan
- Notifikasi "Mode offline aktif" akan muncul

---

## 🚀 Tips & Trik

1. **Auto Refresh**: Data tidak perlu manual refresh, kecuali ingin memastikan data terbaru
2. **Export CSV**: Tombol 💾 untuk download data dalam format CSV
3. **Share WhatsApp**: Tombol 📤 untuk share laporan ke WhatsApp
4. **Filter Cepat**: Gunakan dropdown bulan & tahun untuk filter data
5. **Navigasi Minggu**: Tombol ← → untuk lihat data per minggu

---

## 📞 Support

Jika ada masalah atau pertanyaan, hubungi developer atau cek file `README.md` untuk informasi lebih lanjut.

---

**✨ Selamat menggunakan Jimpitan BN2! ✨**
