/* ========================================
   JIMPITAN BUMI NEIKARTA 2 - APP.JS
   ======================================== */

(function () {
    'use strict';

    // State
    const state = {
        data: [], // all raw data
        filteredData: [],
        sheetUrl: '',
        currentTab: 'jimpitan',
        selectedMonth: new Date().getMonth() + 1, // 1-12
        selectedYear: new Date().getFullYear(),
        selectedWeek: 'all',
        chart: null,
        refreshInterval: 5,
        refreshTimer: null
    };

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    function init() {
        bindTabs();
        bindSettings();
        bindExport();
        initDateSelectors();
        loadSettings();
        bindModals();

        if (state.sheetUrl) {
            fetchData();
        }
    }

    // =================== SETTINGS ===================
    function loadSettings() {
        state.sheetUrl = localStorage.getItem('bn2-jimpitanUrl') || '';
        if (state.sheetUrl) {
            $('#sheetUrl').value = state.sheetUrl;
            $('#disconnectBtn').style.display = 'inline-block';
            updateSyncStatus('Terhubung');
        } else {
            updateSyncStatus('Belum Terhubung');
        }
    }

    function bindSettings() {
        $('#settingsBtn').addEventListener('click', () => {
            const panel = $('#settingsPanel');
            if (panel.classList.contains('hidden')) {
                const password = prompt("PENGAMANAN: Masukkan password Admin untuk mengakses pengaturan:");
                // Anda bisa mengubah password ini sesuai keinginan
                if (password === "adminbn2") { 
                    panel.classList.remove('hidden');
                } else if (password !== null) {
                    alert("Password salah! Akses ditolak.");
                }
            } else {
                panel.classList.add('hidden');
            }
        });

        $('#connectBtn').addEventListener('click', async () => {
            const url = $('#sheetUrl').value.trim();
            if (!url) {
                showSettingsMsg('Masukkan URL Google Sheet', 'error');
                return;
            }
            showSettingsMsg('Menghubungkan...', 'success');
            try {
                await fetchCSV(url);
                state.sheetUrl = url;
                localStorage.setItem('bn2-jimpitanUrl', url);
                $('#disconnectBtn').style.display = 'inline-block';
                updateSyncStatus('Terhubung');
                showSettingsMsg('Berhasil terhubung!', 'success');
                setTimeout(() => $('#settingsPanel').classList.add('hidden'), 1500);
            } catch (err) {
                showSettingsMsg('Gagal terhubung. Pastikan URL publik.', 'error');
            }
        });

        $('#disconnectBtn').addEventListener('click', () => {
            state.sheetUrl = '';
            state.data = [];
            localStorage.removeItem('bn2-jimpitanUrl');
            $('#sheetUrl').value = '';
            $('#disconnectBtn').style.display = 'none';
            updateSyncStatus('Belum Terhubung');
            renderAll();
        });
    }

    function showSettingsMsg(msg, status) {
        const el = $('#connectionStatus');
        el.textContent = msg;
        el.className = `status-msg ${status}`;
    }

    function updateSyncStatus(msg) {
        $('#lastSyncTxt').textContent = msg;
    }

    // =================== FETCH DATA ===================
    function normalizeSheetUrl(url) {
        // Handle "Publish to the web" links
        if (url.includes('/pubhtml')) {
            return url.replace(/\/pubhtml([?#]?)/, '/pub$1') + (url.includes('?') ? '&output=csv' : '?output=csv');
        }
        
        // Handle regular editing links
        const match = url.match(/\/d\/(?!e\/)([a-zA-Z0-9-_]+)/);
        if (match) {
            let csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
            const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
            if (gidMatch) {
                csvUrl += `&gid=${gidMatch[1]}`;
            }
            return csvUrl;
        }
        return url;
    }

    async function fetchCSV(url) {
        url = normalizeSheetUrl(url);
        const methods = [
            () => fetch(url).then(r => { if (!r.ok) throw new Error(); return r.text(); }),
            () => fetch('https://corsproxy.io/?' + encodeURIComponent(url)).then(r => { if (!r.ok) throw new Error(); return r.text(); }),
        ];

        let lastError;
        for (const method of methods) {
            try {
                const csv = await method();
                // Basic check to ensure it's not HTML
                if (csv && csv.trim().length > 0 && !csv.trim().toLowerCase().startsWith('<!doctype html>')) {
                    parseCSVData(csv);
                    setupAutoRefresh();
                    return;
                }
            } catch (err) {
                lastError = err;
            }
        }
        throw lastError || new Error('Gagal fetch atau URL bukan CSV');
    }

    async function fetchData() {
        if (!state.sheetUrl) return;
        try {
            await fetchCSV(state.sheetUrl);
            updateSyncStatus(`Update terakhir: ${new Date().toLocaleTimeString('id-ID')}`);
        } catch {
            updateSyncStatus('Gagal update data');
        }
    }

    function setupAutoRefresh() {
        if (state.refreshTimer) clearInterval(state.refreshTimer);
        if (state.sheetUrl) {
            state.refreshTimer = setInterval(fetchData, state.refreshInterval * 60 * 1000);
        }
    }

    function parseCSVData(csv) {
        state.data = []; // reset
        
        // Cek struktur keseluruhan tanpa header
        const rawResult = Papa.parse(csv, { header: false, skipEmptyLines: true });
        const rawRows = rawResult.data;
        if (rawRows.length === 0) return;

        // Deteksi apakah ini format grid (Laporan Harian dengan TGL dan Rupiah)
        let isLaporanGrid = false;
        let headerRowIndex = -1;
        let monthObj = new Date(); // Fallback date

        for (let i = 0; i < Math.min(10, rawRows.length); i++) {
            const firstCell = String(rawRows[i][0] || '').toUpperCase().trim();
            const secondCell = String(rawRows[i][1] || '').toUpperCase().trim();
            
            if (firstCell === 'TGL' || (firstCell === 'TANGGAL' && secondCell === 'RUPIAH')) {
                isLaporanGrid = true;
                headerRowIndex = i;
                
                // Coba ambil bulan-tahun dari baris persis di atas header (misal "Apr-26")
                if (i > 0) {
                    const potentialDateStr = String(rawRows[i-1][0] || '').trim();
                    if (potentialDateStr.includes('-')) {
                        const parts = potentialDateStr.split('-');
                        if (parts.length === 2 && !isNaN(parts[1])) {
                           const cln = potentialDateStr.replace(/-/g, ' '); 
                           const d = new Date(cln);
                           if (!isNaN(d.getTime())) monthObj = d;
                        }
                    } else if (potentialDateStr.length >= 3) {
                        const d = new Date(potentialDateStr);
                        if (!isNaN(d.getTime())) monthObj = d;
                    }
                }
                break;
            }
        }

        if (isLaporanGrid) {
            // Parsing format Grid Laporan Harian
            for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
                const dayStr = String(rawRows[i][0] || '').trim();
                const dayNum = parseInt(dayStr);
                
                // Kalau sudah bukan angka hari (1-31), skip (mungkin totalan dsb)
                if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) continue;

                const nominalStr = String(rawRows[i][1] || '').trim();
                const nominal = parseUang(nominalStr);
                
                if (nominal > 0) {
                    const rowDate = new Date(monthObj.getFullYear(), monthObj.getMonth(), dayNum);
                    state.data.push({
                        tanggal: `${dayNum} ${rowDate.toLocaleString('id-ID', { month: 'long' })} ${rowDate.getFullYear()}`,
                        dateObj: rowDate,
                        tipe: 'JIMPITAN', // Asumsi kolom Rupiah adalah pemasukan Jimpitan
                        nominal: nominal,
                        keterangan: '',
                        pelapor: '-'
                    });
                }
            }
        } else {
            // Parsing format standar
            const result = Papa.parse(csv, {
                header: true,
                skipEmptyLines: true,
                transformHeader: h => h.trim().toUpperCase()
            });

            state.data = result.data.map(row => {
                const get = (...keys) => {
                    for (const k of keys) {
                        if (row[k]) return row[k].toString().trim();
                    }
                    return '';
                };

                const typeRaw = get('TIPE', 'JENIS', 'KATEGORI').toLowerCase();
                const isPengeluaran = typeRaw.includes('keluar') || typeRaw.includes('pengeluaran');

                let dateObj = null;
                const tglStr = get('TANGGAL', 'DATE', 'WAKTU');
                if (tglStr) {
                    const parts = tglStr.split(/[-/]/);
                    if (parts.length === 3 && !isNaN(parts[1])) {
                        if (parts[2].length === 4) dateObj = new Date(parts[2], parts[1]-1, parts[0]);
                        else dateObj = new Date(parts[0], parts[1]-1, parts[2]);
                    } else {
                        const cleanStr = tglStr.replace(/-/g, ' '); 
                        dateObj = new Date(cleanStr);
                    }
                    if (isNaN(dateObj.getTime())) dateObj = new Date();
                } else {
                    dateObj = new Date();
                }

                return {
                    tanggal: tglStr || 'Tidak ada tanggal',
                    dateObj: dateObj,
                    tipe: isPengeluaran ? 'PENGELUARAN' : 'JIMPITAN',
                    nominal: parseUang(get('NOMINAL', 'JUMLAH', 'UANG')),
                    keterangan: get('KETERANGAN', 'CATATAN', 'DESKRIPSI'),
                    pelapor: get('PELAPOR', 'NAMA', 'PENGINPUT')
                };
            }).filter(item => item.nominal > 0 || item.keterangan);
        }

        state.data.sort((a, b) => a.dateObj - b.dateObj);
        updateDateSelectorsOptions();
        renderAll();
    }

    function parseUang(str) {
        if (!str) return 0;
        const cleaned = str.replace(/[Rp.\s]/gi, '').replace(/,/g, '');
        return parseInt(cleaned) || 0;
    }

    // =================== DATE CONTROLS ===================
    function initDateSelectors() {
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const mSel = $('#monthSelect');
        mSel.innerHTML = months.map((m, i) => `<option value="${i+1}">${m}</option>`).join('');
        mSel.value = state.selectedMonth;

        mSel.addEventListener('change', (e) => {
            state.selectedMonth = parseInt(e.target.value);
            renderAll();
        });

        const ySel = $('#yearSelect');
        const cy = state.selectedYear;
        ySel.innerHTML = `<option value="${cy}">${cy}</option>`;
        ySel.addEventListener('change', (e) => {
            state.selectedYear = parseInt(e.target.value);
            renderAll();
        });

        // WEEK CHART FILTER
        $('#weekFilter').addEventListener('change', (e) => {
            state.selectedWeek = e.target.value;
            renderChart();
        });
    }

    function updateDateSelectorsOptions() {
        if (state.data.length === 0) return;
        const years = [...new Set(state.data.map(d => d.dateObj.getFullYear() || new Date().getFullYear()))].sort().reverse();
        const ySel = $('#yearSelect');
        const curr = state.selectedYear;
        ySel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
        if (years.includes(curr)) {
            ySel.value = curr;
        } else {
            state.selectedYear = years[0];
            ySel.value = years[0];
        }
    }

    // =================== TABS ===================
    function bindTabs() {
        $$('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.tab-btn').forEach(b => b.classList.remove('active'));
                $$('.tab-content').forEach(c => c.classList.remove('active'));
                
                btn.classList.add('active');
                state.currentTab = btn.dataset.tab;
                $(`#view-${state.currentTab}`).classList.add('active');
            });
        });
    }

    // =================== RENDER ===================
    function renderAll() {
        const monthName = $('#monthSelect').options[$('#monthSelect').selectedIndex].text;
        const year = state.selectedYear;
        const label = `${monthName} ${year}`;
        
        $('#chartMonthLabel').textContent = label;
        $('#tableMonthLabel').textContent = label;
        $('#tablePengeMonthLabel').textContent = label;
        $('#pengeluaranMonthLabelInfo').textContent = label;

        // Filter data by selected month and year
        state.filteredData = state.data.filter(d => 
            d.dateObj.getMonth() + 1 === state.selectedMonth && 
            d.dateObj.getFullYear() === state.selectedYear
        );

        const jimpitanBulan = sumData(state.filteredData, 'JIMPITAN');
        const pengeluaranBulan = sumData(state.filteredData, 'PENGELUARAN');
        const saldoBulan = jimpitanBulan - pengeluaranBulan;

        // Calculate total year
        const dataYear = state.data.filter(d => d.dateObj.getFullYear() === state.selectedYear);
        const jimpitanTahun = sumData(dataYear, 'JIMPITAN');
        const pengeluaranTahun = sumData(dataYear, 'PENGELUARAN');
        const totalTahun = jimpitanTahun - pengeluaranTahun;

        // Count Entry Days (unique dates handling jimpitan)
        const days = new Set(state.filteredData.map(d => d.dateObj.toISOString().split('T')[0]));

        // Update DOM
        $('#saldoTotalMonth').textContent = formatRp(saldoBulan);
        $('#jimpitanMonth').textContent = formatRp(jimpitanBulan);
        $('#pengeluaranMonth').textContent = '-' + formatRp(pengeluaranBulan);
        $('#saldoTotalYear').textContent = formatRp(totalTahun);
        $('#entriDays').textContent = days.size;
        
        $('#pengeluaranTotalMonthRp').textContent = formatRp(pengeluaranBulan);
        $('#pengeluaranTransaksi').textContent = state.filteredData.filter(d => d.tipe === 'PENGELUARAN').length;

        renderTables();
        renderChart();
    }

    function sumData(dataArray, type) {
        return dataArray.filter(d => d.tipe === type).reduce((sum, item) => sum + item.nominal, 0);
    }

    function formatRp(num) {
        return 'Rp ' + num.toLocaleString('id-ID');
    }

    function renderTables() {
        const tJimpitan = $('#jimpitanTbody');
        const tPenge = $('#pengeluaranTbody');

        const dataJimpitan = state.filteredData.filter(d => d.tipe === 'JIMPITAN');
        const dataPenge = state.filteredData.filter(d => d.tipe === 'PENGELUARAN');

        if (dataJimpitan.length === 0) {
            tJimpitan.innerHTML = '<tr><td colspan="4" class="empty-state">Belum ada data jimpitan untuk periode ini</td></tr>';
        } else {
            tJimpitan.innerHTML = dataJimpitan.map(d => `
                <tr>
                    <td>${d.tanggal}</td>
                    <td class="text-right val-jimpitan">${formatRp(d.nominal)}</td>
                    <td class="text-center"><button class="btn-icon view-btn" data-idx="${state.data.indexOf(d)}" title="Lihat Detail"><i class="fas fa-eye"></i></button></td>
                </tr>
            `).join('');
        }

        if (dataPenge.length === 0) {
            tPenge.innerHTML = '<tr><td colspan="4" class="empty-state">Belum ada pengeluaran untuk periode ini</td></tr>';
        } else {
            tPenge.innerHTML = dataPenge.map(d => `
                <tr>
                    <td>${d.tanggal}</td>
                    <td class="text-right val-pengeluaran">-${formatRp(d.nominal)}</td>
                    <td class="text-center"><button class="btn-icon view-btn" data-idx="${state.data.indexOf(d)}" title="Lihat Detail"><i class="fas fa-eye"></i></button></td>
                </tr>
            `).join('');
        }
    }

    function renderChart() {
        const ctx = $('#jimpitanChart').getContext('2d');
        if (state.chart) state.chart.destroy();

        if (state.filteredData.length === 0) {
            ctx.canvas.style.display = 'none';
            ctx.canvas.parentElement.insertAdjacentHTML('beforeend', '<div class="empty-state" id="chartEmpty">Belum ada data untuk ditampilkan</div>');
            return;
        }

        ctx.canvas.style.display = 'block';
        const emptyMsg = $('#chartEmpty');
        if(emptyMsg) emptyMsg.remove();

        // Agregasi per hari
        const daily = {};
        state.filteredData.forEach(d => {
            const tgl = d.dateObj.getDate();
            if (!daily[tgl]) daily[tgl] = { j: 0, p: 0 };
            if (d.tipe === 'JIMPITAN') daily[tgl].j += d.nominal;
            else daily[tgl].p += d.nominal;
        });

        // 1 to 31
        const daysInMonth = new Date(state.selectedYear, state.selectedMonth, 0).getDate();
        let labels = Array.from({length: daysInMonth}, (_, i) => i + 1);

        // Filter label by Selection
        if (state.selectedWeek !== 'all') {
            const w = parseInt(state.selectedWeek);
            const startDay = (w - 1) * 7 + 1;
            const endDay = Math.min(w * 7, daysInMonth);
            labels = labels.filter(l => l >= startDay && l <= endDay);
        }

        const dataJ = labels.map(l => daily[l] ? daily[l].j : 0);
        const dataP = labels.map(l => daily[l] ? daily[l].p : 0);

        state.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Jimpitan',
                        data: dataJ,
                        backgroundColor: '#10b981',
                        borderRadius: 4
                    },
                    {
                        label: 'Pengeluaran',
                        data: dataP,
                        backgroundColor: '#ef4444',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
    }

    // =================== EXPORT ===================
    function bindExport() {
        $('#exportJimpitanBtn').addEventListener('click', () => exportCSV('JIMPITAN'));
        $('#exportPengeluaranBtn').addEventListener('click', () => exportCSV('PENGELUARAN'));
    }

    function exportCSV(tipe) {
        if (state.filteredData.length === 0) return;
        const targetData = state.filteredData.filter(d => d.tipe === tipe);
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "TANGGAL,PELAPOR,KETERANGAN,NOMINAL\n";
        
        targetData.forEach(row => {
            const safeKet = `"${(row.keterangan || '').replace(/"/g, '""')}"`;
            const safeNam = `"${(row.pelapor || '').replace(/"/g, '""')}"`;
            csvContent += `${row.tanggal},${safeNam},${safeKet},${row.nominal}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        const mo = $('#monthSelect').options[$('#monthSelect').selectedIndex].text;
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Rekap_${tipe}_${mo}_${state.selectedYear}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // =================== MODAL ===================
    function bindModals() {
        // Event delegation untuk tombol view di tabel
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.view-btn');
            if (btn) {
                const idx = parseInt(btn.dataset.idx);
                const item = state.data[idx];
                if (item) showDetailModal(item);
            }
        });

        // Close modal event
        const closeBtn = $('#closeDetailBtn');
        if(closeBtn) {
            closeBtn.addEventListener('click', () => {
                $('#detailModal').classList.add('hidden');
            });
        }
        
        // Klik di luar modal wrapper nutup
        const modal = $('#detailModal');
        if(modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        }
    }

    function showDetailModal(item) {
        $('#detailTanggal').textContent = item.tanggal;
        $('#detailTipe').textContent = item.tipe;
        $('#detailPelapor').textContent = item.pelapor || '-';
        $('#detailKeterangan').textContent = item.keterangan || '-';
        
        const nomEl = $('#detailNominal');
        nomEl.textContent = formatRp(item.nominal);
        nomEl.className = item.tipe === 'PENGELUARAN' ? 'val-pengeluaran' : 'val-jimpitan';
        
        $('#detailModal').classList.remove('hidden');
    }

    // Run
    document.addEventListener('DOMContentLoaded', init);
})();
