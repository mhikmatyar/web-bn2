/* ========================================
   JIMPITAN BUMI NEIKARTA 2 - APP.JS (MOBILE VERSION)
   ======================================== */

(function () {
    'use strict';

    const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQfPsk4L2qxshegLjX6zTdY4mPv0e4xYFqbzYFKgqwHJrMuSXAeDJuIFAhdyK2vi4SwyJ2HXZX4h0un/pub?gid=289431951&single=true&output=csv';

    // State
    const state = {
        data: [], 
        filteredData: [],
        sheetUrl: '',
        currentTab: 'jimpitan',
        selectedMonth: new Date().getMonth() + 1,
        selectedYear: new Date().getFullYear(),
        isAdmin: false
    };

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    function init() {
        bindNavigation();
        bindSettings();
        initDateSelectors();
        loadSettings();
        bindModals();
        bindRefresh();

        if (state.sheetUrl) {
            fetchData();
        }
    }

    function loadSettings() {
        state.sheetUrl = localStorage.getItem('bn2-jimpitanUrl') || DEFAULT_SHEET_URL;
        if (state.sheetUrl) {
            $('#sheetUrl').value = state.sheetUrl;
        }
    }

    // =================== NAVIGATION ===================
    function bindNavigation() {
        // Bottom Nav & Action Buttons
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-tab]');
            if (btn) {
                const targetTab = btn.dataset.tab;
                
                if (targetTab === 'settings-auth') {
                    if (state.isAdmin) {
                        switchTab('view-settings');
                    } else {
                        $('#authModal').classList.remove('hidden');
                        $('#adminPass').focus();
                    }
                } else {
                    switchTab(`view-${targetTab}`);
                }
            }
        });

        // Back buttons
        $$('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab('view-jimpitan'));
        });
    }

    function switchTab(viewId) {
        // Remove all active views
        $$('.tab-content').forEach(c => c.classList.remove('active'));
        // Hide modal just in case
        $('#authModal').classList.add('hidden');
        
        const target = $(`#${viewId}`);
        if (target) {
            target.classList.add('active');
            
            // Sync bottom nav
            const tabName = viewId.replace('view-', '');
            $$('.nav-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.tab === tabName);
            });
        }
    }

    // =================== AUTHENTICATION ===================
    function bindSettings() {
        $('#confirmAuthBtn').addEventListener('click', () => {
            const pass = $('#adminPass').value;
            if (pass === 'adminbn2') {
                state.isAdmin = true;
                $('#adminPass').value = '';
                switchTab('view-settings');
            } else {
                alert('Password salah!');
            }
        });

        $('#closeAuthBtn').addEventListener('click', () => {
            $('#authModal').classList.add('hidden');
        });

        $('#connectBtn').addEventListener('click', async () => {
            const url = $('#sheetUrl').value.trim();
            if (!url) return;
            
            localStorage.setItem('bn2-jimpitanUrl', url);
            state.sheetUrl = url;
            showToast('Konfigurasi disimpan!', 'success');
            fetchData();
        });

        $('#disconnectBtn').addEventListener('click', () => {
            if(confirm('Putuskan koneksi data?')) {
                localStorage.removeItem('bn2-jimpitanUrl');
                state.sheetUrl = '';
                state.data = [];
                location.reload();
            }
        });
    }

    // =================== FETCH DATA ===================
    async function fetchData() {
        if (!state.sheetUrl) return;
        updateSyncStatus('Memuat...');
        
        try {
            const url = normalizeSheetUrl(state.sheetUrl);
            const response = await fetch(url);
            const csv = await response.text();
            
            parseCSVData(csv);
            updateSyncStatus('Terhubung');
        } catch (err) {
            updateSyncStatus('Gagal');
            console.error(err);
        }
    }

    function normalizeSheetUrl(url) {
        if (url.includes('/pubhtml')) return url.replace(/\/pubhtml([?#]?)/, '/pub$1') + (url.includes('?') ? '&output=csv' : '?output=csv');
        return url;
    }

    function parseCSVData(csv) {
        const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
        state.data = result.data.map((row, idx) => {
            const get = (...keys) => {
                for (const k of keys) {
                    const cleanK = k.toUpperCase();
                    const foundKey = Object.keys(row).find(rk => rk.toUpperCase() === cleanK);
                    if (foundKey) return row[foundKey].toString().trim();
                }
                return '';
            };

            const typeRaw = (get('TIPE', 'JENIS', 'KATEGORI') || '').toLowerCase();
            const isPengeluaran = typeRaw.includes('keluar') || typeRaw.includes('pengeluaran');
            
            let dateObj = new Date();
            const tglStr = get('TANGGAL', 'DATE', 'WAKTU');
            if (tglStr) {
                const parts = tglStr.split(/[-/]/);
                if (parts.length === 3) dateObj = new Date(parts[2], parts[1]-1, parts[0]);
            }

            return {
                idx,
                tanggal: tglStr || '-',
                dateObj: dateObj,
                tipe: isPengeluaran ? 'PENGELUARAN' : 'JIMPITAN',
                nominal: parseUang(get('NOMINAL', 'JUMLAH', 'UANG')),
                keterangan: get('KETERANGAN', 'CATATAN', 'DESKRIPSI') || '-',
                pelapor: get('PELAPOR', 'NAMA', 'PENGINPUT') || '-'
            };
        }).filter(d => d.nominal > 0);

        state.data.sort((a, b) => b.dateObj - a.dateObj);
        renderAll();
    }

    function parseUang(str) {
        if (!str) return 0;
        return parseInt(str.replace(/[Rp.\s,]/g, '')) || 0;
    }

    function formatRp(num) {
        return 'Rp ' + num.toLocaleString('id-ID');
    }

    // =================== RENDER ===================
    function renderAll() {
        const monthName = $('#monthSelect').options[$('#monthSelect').selectedIndex].text;
        $('#chartMonthLabel').textContent = `Periode ${monthName} ${state.selectedYear}`;

        state.filteredData = state.data.filter(d => 
            d.dateObj.getMonth() + 1 === state.selectedMonth && 
            d.dateObj.getFullYear() === state.selectedYear
        );

        const totalJimpitan = state.filteredData.filter(d => d.tipe === 'JIMPITAN').reduce((s, i) => s + i.nominal, 0);
        const totalPenge = state.filteredData.filter(d => d.tipe === 'PENGELUARAN').reduce((s, i) => s + i.nominal, 0);
        
        $('#saldoTotalMonth').textContent = formatRp(totalJimpitan - totalPenge);
        $('#jimpitanMonth').textContent = formatRp(totalJimpitan);
        $('#pengeluaranMonth').textContent = formatRp(totalPenge);

        renderRecentList();
        renderTableList('jimpitanTbody', 'JIMPITAN');
        renderTableList('pengeluaranTbody', 'PENGELUARAN');
    }

    function renderRecentList() {
        const container = $('#recentList');
        const recent = state.data.slice(0, 5);
        
        if (recent.length === 0) {
            container.innerHTML = '<div class="empty-state">Tidak ada transaksi</div>';
            return;
        }

        container.innerHTML = recent.map(item => createTrxElement(item)).join('');
    }

    function renderTableList(targetId, type) {
        const container = $(`#${targetId}`);
        const data = state.filteredData.filter(d => d.tipe === type);
        
        if (data.length === 0) {
            container.innerHTML = '<div class="empty-state">Tidak ada data</div>';
            return;
        }

        container.innerHTML = data.map(item => createTrxElement(item)).join('');
    }

    function createTrxElement(item) {
        const isIncome = item.tipe === 'JIMPITAN';
        return `
            <div class="trx-item" data-idx="${item.idx}">
                <div class="trx-icon ${isIncome ? 'income' : 'expense'}">
                    <i class="fas ${isIncome ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i>
                </div>
                <div class="trx-info">
                    <span class="trx-name">${item.keterangan !== '-' ? item.keterangan : (isIncome ? 'Jimpitan Warga' : 'Pengeluaran')}</span>
                    <span class="trx-date">${item.tanggal}</span>
                </div>
                <div class="trx-amount ${isIncome ? 'plus' : 'minus'}">
                    ${isIncome ? '+' : '-'}${formatRp(item.nominal)}
                </div>
            </div>
        `;
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
        ySel.innerHTML = `<option value="${state.selectedYear}">${state.selectedYear}</option>`;
    }

    // =================== MODALS & UTILS ===================
    function bindModals() {
        document.addEventListener('click', (e) => {
            const trx = e.target.closest('.trx-item');
            if (trx) {
                const idx = parseInt(trx.dataset.idx);
                const item = state.data.find(d => d.idx === idx);
                if (item) showDetail(item);
            }
        });

        $('#closeDetailBtn').addEventListener('click', () => $('#detailModal').classList.add('hidden'));
    }

    function showDetail(item) {
        $('#detailTipe').textContent = item.tipe;
        $('#detailTanggal').textContent = item.tanggal;
        $('#detailPelapor').textContent = item.pelapor;
        $('#detailKeterangan').textContent = item.keterangan;
        $('#detailNominal').textContent = formatRp(item.nominal);
        $('#detailNominal').className = item.tipe === 'JIMPITAN' ? 'green' : 'red';
        $('#detailModal').classList.remove('hidden');
    }

    function bindRefresh() {
        $('#refreshBtn').addEventListener('click', () => {
            showToast('Memperbarui data...', 'info');
            fetchData();
        });
    }

    function updateSyncStatus(msg) {
        // Just for console or hidden status in this version
        console.log('Status:', msg);
    }

    function showToast(msg, type) {
        const toast = document.createElement('div');
        toast.className = `toast show ${type}`;
        toast.innerHTML = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
