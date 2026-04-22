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
            container.innerHTML = '<div class="empty-state" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">Belum ada transaksi</div>';
            return;
        }

        container.innerHTML = recent.map(item => createTrxElement(item)).join('');
    }

    function renderTableList(targetId, type) {
        const container = $(`#${targetId}`);
        const data = state.filteredData.filter(d => d.tipe === type);
        
        // If it's the combined history view, we might want to show all
        const isHistoryView = targetId === 'jimpitanTbody';
        const displayData = isHistoryView ? state.filteredData : data;

        if (displayData.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">Tidak ada data untuk periode ini</div>';
            return;
        }

        container.innerHTML = displayData.map(item => createTrxElement(item)).join('');
    }

    function createTrxElement(item) {
        const isIncome = item.tipe === 'JIMPITAN';
        return `
            <div class="trx-item" data-idx="${item.idx}">
                <div class="trx-icon ${isIncome ? 'plus' : 'minus'}">
                    <i class="fas ${isIncome ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i>
                </div>
                <div class="trx-info">
                    <span class="name">${item.keterangan !== '-' ? item.keterangan : (isIncome ? 'Jimpitan Warga' : 'Pengeluaran')}</span>
                    <span class="date">${item.tanggal}</span>
                </div>
                <div class="trx-val ${isIncome ? 'plus' : 'minus'}">
                    ${isIncome ? '+' : '-'}${formatRp(item.nominal)}
                </div>
            </div>
        `;
    }

    function renderChart() {
        const ctx = $('#jimpitanChart').getContext('2d');
        if (state.chart) state.chart.destroy();

        const daily = {};
        state.filteredData.forEach(d => {
            const tgl = d.dateObj.getDate();
            if (!daily[tgl]) daily[tgl] = { j: 0, p: 0 };
            if (d.tipe === 'JIMPITAN') daily[tgl].j += d.nominal;
            else daily[tgl].p += d.nominal;
        });

        const daysInMonth = new Date(state.selectedYear, state.selectedMonth, 0).getDate();
        let labels = Array.from({length: daysInMonth}, (_, i) => i + 1);

        if ($('#weekFilter').value !== 'all') {
            const w = parseInt($('#weekFilter').value);
            labels = labels.filter(l => {
                const d = new Date(state.selectedYear, state.selectedMonth - 1, l);
                const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
                const week = Math.ceil((d.getDate() + firstDay) / 7);
                return week === w;
            });
        }

        const dataJ = labels.map(l => daily[l] ? daily[l].j : 0);
        const dataP = labels.map(l => daily[l] ? daily[l].p : 0);

        state.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Masuk',
                        data: dataJ,
                        backgroundColor: 'rgba(79, 70, 229, 0.7)',
                        borderRadius: 4
                    },
                    {
                        label: 'Keluar',
                        data: dataP,
                        backgroundColor: 'rgba(236, 72, 153, 0.7)',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                    y: { beginAtZero: true, ticks: { font: { size: 10 } } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // Update renderAll to include chart
    const originalRenderAll = renderAll;
    renderAll = function() {
        originalRenderAll();
        renderChart();
    };
    
    // Add event listener for weekFilter
    $('#weekFilter').addEventListener('change', renderChart);

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
