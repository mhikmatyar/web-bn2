/**
 * ================================================
 * GOOGLE APPS SCRIPT - UNIFIED API V5
 * (INVENTARIS, JIMPITAN, & PEMINJAMAN)
 * ================================================
 * 
 * Cara Deploy:
 * 1. Buka Google Sheets
 * 2. Extensions → Apps Script
 * 3. Copy-paste kode ini
 * 4. Ubah SHEET_NAME jika perlu
 * 5. Deploy → New deployment → Web app
 * 6. Execute as: Me
 * 7. Who has access: Anyone
 */

// ===== KONFIGURASI =====
const ADMIN_PASSWORD = "adminbn2"; // ⚠️ UBAH PASSWORD JIKA PERLU
const SHEET_INVENTARIS = "Inventaris"; // ⚠️ Nama sheet untuk Inventaris
const SHEET_JIMPITAN = "Jimpitan"; // ⚠️ Nama sheet untuk Jimpitan
const SHEET_PEMINJAMAN = "Peminjaman"; // ⚠️ Nama sheet untuk Peminjaman

// ===== FUNGSI UTAMA =====
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Validasi password admin
    if (data.password !== ADMIN_PASSWORD) {
      return response({ success: false, error: "Password Salah" });
    }

    // ==========================================
    // 1. LOGIKA JIMPITAN
    // ==========================================
    if (data.source === 'jimpitan') {
      const sheetJimpitan = ss.getSheetByName(SHEET_JIMPITAN) || ss.getSheets()[1];
      
      if (action === 'addItem') {
        // Normalize tanggal ke format Indonesia (force Mei, Agu, Okt, Des)
        const normalizedDate = normalizeDateToIndonesian(data.tanggal);
        
        sheetJimpitan.appendRow([
          normalizedDate, 
          data.tipe, 
          data.nominal, 
          data.keterangan, 
          "Admin"
        ]);
        return response({ success: true });
      }
      
      // Cari baris untuk Edit/Delete
      const searchData = { 
        tanggal: data.oldTanggal || data.tanggal, 
        nominal: data.oldNominal || data.nominal 
      };
      const range = sheetJimpitan.getDataRange();
      const values = range.getValues();
      let rowIndex = -1;

      for (let i = 1; i < values.length; i++) {
        const rowDate = values[i][0] instanceof Date 
          ? Utilities.formatDate(values[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd") 
          : values[i][0];
        
        if (rowDate === searchData.tanggal && 
            values[i][2].toString() === searchData.nominal.toString()) {
          rowIndex = i + 1; 
          break;
        }
      }

      if (action === 'deleteItem') {
        if (rowIndex > -1) {
          sheetJimpitan.deleteRow(rowIndex);
        } else {
          return response({ success: false, error: "Data tidak ditemukan (Coba refresh aplikasi)" });
        }
        return response({ success: true });
      }

      if (action === 'editItem') {
        if (rowIndex > -1) {
          // Normalize tanggal ke format Indonesia
          const normalizedDate = normalizeDateToIndonesian(data.tanggal);
          
          sheetJimpitan.getRange(rowIndex, 1, 1, 5).setValues([[
            normalizedDate, 
            data.tipe, 
            data.nominal, 
            data.keterangan, 
            "Admin"
          ]]);
        } else {
          return response({ success: false, error: "Data lama tidak ditemukan. Silakan hapus & buat baru." });
        }
        return response({ success: true });
      }
    }

    // ==========================================
    // 2. LOGIKA PEMINJAMAN
    // ==========================================
    if (data.source === 'peminjaman') {
      const sheetPinjam = ss.getSheetByName(SHEET_PEMINJAMAN);
      if (!sheetPinjam) {
        return response({ success: false, error: "Sheet Peminjaman tidak ditemukan!" });
      }

      if (action === 'addPinjam') {
        // Kolom: ID Pinjam, Tgl Pinjam, Tgl Kembali, Barang, Jumlah, Peminjam, Status, Keterangan
        sheetPinjam.appendRow([
          data.idPinjam, 
          data.tglPinjam, 
          "", // tgl kembali kosong saat peminjaman
          data.barang, 
          data.jumlah, 
          data.peminjam, 
          "Dipinjam", 
          data.keterangan
        ]);
        return response({ success: true });
      }

      if (action === 'returnPinjam') {
        const values = sheetPinjam.getDataRange().getValues();
        let rowIndex = -1;
        
        for (let i = 1; i < values.length; i++) {
          if (values[i][0] === data.idPinjam) { 
            rowIndex = i + 1; 
            break; 
          }
        }

        if (rowIndex > -1) {
          // Update tgl kembali dan status
          sheetPinjam.getRange(rowIndex, 3).setValue(data.tglKembali);
          sheetPinjam.getRange(rowIndex, 7).setValue("Dikembalikan");
          return response({ success: true });
        } else {
          return response({ success: false, error: "Data peminjaman tidak ditemukan!" });
        }
      }
    }

    // ==========================================
    // 3. LOGIKA INVENTARIS
    // ==========================================
    const sheetInv = ss.getSheetByName(SHEET_INVENTARIS) || ss.getSheets()[0];
    
    if (action === 'addItem' && data.source !== 'jimpitan' && data.source !== 'peminjaman') {
      sheetInv.appendRow([
        data.noInventaris, 
        data.namaBarang, 
        data.kategori, 
        data.jumlah, 
        data.kondisi, 
        data.lokasi, 
        data.foto, 
        data.keterangan, 
        data.tahun
      ]);
      return response({ success: true });
    }

    // Logika Edit & Delete Inventaris (Membutuhkan Pencarian Baris)
    const searchNo = data.oldNoInventaris || data.noInventaris;
    const searchNama = data.oldNamaBarang || data.namaBarang;
    const range = sheetInv.getDataRange();
    const values = range.getValues();
    let rowIndex = -1;

    // Cari berdasarkan No Inventaris DAN Nama Barang
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] == searchNo && values[i][1] == searchNama) { 
        rowIndex = i + 1; 
        break; 
      }
    }
    
    // Fallback: Cari hanya berdasarkan nama jika ID tidak cocok (untuk data lama tanpa ID)
    if (rowIndex === -1) {
      for (let i = 1; i < values.length; i++) {
        if (values[i][1] == searchNama) { 
          rowIndex = i + 1; 
          break; 
        }
      }
    }

    if (action === 'deleteItem' && data.source !== 'jimpitan' && data.source !== 'peminjaman') {
      if (rowIndex > -1) {
        sheetInv.deleteRow(rowIndex);
      } else {
        return response({ success: false, error: "Data Inventaris tidak ditemukan!" });
      }
      return response({ success: true });
    }

    if (action === 'editItem' && data.source !== 'jimpitan' && data.source !== 'peminjaman') {
      if (rowIndex > -1) {
        sheetInv.getRange(rowIndex, 1, 1, 9).setValues([[
          data.noInventaris, 
          data.namaBarang, 
          data.kategori, 
          data.jumlah, 
          data.kondisi, 
          data.lokasi, 
          data.foto, 
          data.keterangan, 
          data.tahun
        ]]);
      } else {
        return response({ success: false, error: "Data lama tidak ditemukan. Silakan hapus & buat baru." });
      }
      return response({ success: true });
    }

    return response({ success: false, error: "Aksi tidak dikenal" });

  } catch (e) {
    return response({ success: false, error: e.toString() });
  }
}

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: 'ok',
      message: 'Jimpitan BN2 Unified API is running',
      version: 'v5',
      supported: ['inventaris', 'jimpitan', 'peminjaman'],
      timestamp: new Date().toISOString()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function response(res) {
  return ContentService
    .createTextOutput(JSON.stringify(res))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== HELPER: NORMALIZE DATE TO INDONESIAN =====
/**
 * Convert any date format to Indonesian format
 * e.g., "15-May-2026" → "15-Mei-2026"
 */
function normalizeDateToIndonesian(dateStr) {
  if (!dateStr) return dateStr;
  
  // Map English month names to Indonesian
  const monthMap = {
    'jan': 'Jan', 'january': 'Jan',
    'feb': 'Feb', 'february': 'Feb',
    'mar': 'Mar', 'march': 'Mar',
    'apr': 'Apr', 'april': 'Apr',
    'may': 'Mei', // English → Indonesian
    'jun': 'Jun', 'june': 'Jun',
    'jul': 'Jul', 'july': 'Jul',
    'aug': 'Agu', 'august': 'Agu', // English → Indonesian
    'sep': 'Sep', 'september': 'Sep',
    'oct': 'Okt', 'october': 'Okt', // English → Indonesian
    'nov': 'Nov', 'november': 'Nov',
    'dec': 'Des', 'december': 'Des' // English → Indonesian
  };
  
  // Parse date string (format: DD-MMM-YYYY or DD/MMM/YYYY)
  const parts = dateStr.split(/[-\/\s]/);
  if (parts.length !== 3) return dateStr;
  
  const day = parts[0];
  const month = parts[1].toLowerCase();
  const year = parts[2];
  
  // Convert month to Indonesian if it's English
  const indonesianMonth = monthMap[month] || parts[1];
  
  return `${day}-${indonesianMonth}-${year}`;
}

// ===== TESTING FUNCTIONS (Optional) =====

/**
 * Test function untuk cek koneksi
 */
function testConnection() {
  Logger.log('Testing connection...');
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    
    Logger.log('✅ Koneksi berhasil!');
    Logger.log('Total sheets: ' + sheets.length);
    
    sheets.forEach(sheet => {
      Logger.log('- ' + sheet.getName() + ' (' + (sheet.getLastRow() - 1) + ' data rows)');
    });
    
    return true;
  } catch (error) {
    Logger.log('❌ Koneksi gagal: ' + error.message);
    return false;
  }
}

/**
 * Test function untuk Jimpitan
 */
function testJimpitan() {
  const testData = {
    source: 'jimpitan',
    action: 'addItem',
    tanggal: '15-Jun-2026',
    tipe: 'Pemasukan',
    nominal: 100000,
    keterangan: 'Test dari Apps Script',
    password: ADMIN_PASSWORD
  };
  
  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(mockEvent);
  Logger.log('Result: ' + result.getContent());
}

/**
 * Test function untuk Inventaris
 */
function testInventaris() {
  const testData = {
    action: 'addItem',
    noInventaris: 'INV-TEST-001',
    namaBarang: 'Test Item',
    kategori: 'Elektronik',
    jumlah: 1,
    kondisi: 'Baik',
    lokasi: 'Gudang',
    foto: '',
    keterangan: 'Test dari Apps Script',
    tahun: 2026,
    password: ADMIN_PASSWORD
  };
  
  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(mockEvent);
  Logger.log('Result: ' + result.getContent());
}

/**
 * Test function untuk Peminjaman
 */
function testPeminjaman() {
  const testData = {
    source: 'peminjaman',
    action: 'addPinjam',
    idPinjam: 'PINJAM-TEST-001',
    tglPinjam: '2026-06-02',
    barang: 'Laptop',
    jumlah: 1,
    peminjam: 'Test User',
    keterangan: 'Test peminjaman',
    password: ADMIN_PASSWORD
  };
  
  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(mockEvent);
  Logger.log('Result: ' + result.getContent());
}
