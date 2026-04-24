/* ========================================
   JIMPITAN BUMI NEIKARTA 2 - CLEAN VERSION 
   Simple, Robust, and Direct-Sync
   ======================================== */

(function () {
    'use strict';

    const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQfPsk4L2qxshegLjX6zTdY4mPv0e4xYFqbzYFKgqwHJrMuSXAeDJuIFAhdyK2vi4SwyJ2HXZX4h0un/pub?gid=289431951&single=true&output=csv';
    const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxERxzV2XnDry3FJZZuNngfCsjGWjn63R-mz4CuPjj-YLnvlrqIvBKqb9Yld0wCC6WP/exec';

    const state = {
        data: [],
        filteredData: [],
        sheetUrl: '',
        scriptUrl: '',
        activeTab: 'jimpitan',
        selectedMonth: new Date().getMonth() + 1,
        selectedYear: new Date().getFullYear(),
        isAdmin: false,
        editingIdx: null,
        monthsNames: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    };

    // Helper functions
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    // =================== INITIALIZATION ===================
    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        loadSettings();
        bindNavigation();
        bindEntryForm();
        bindFilters();
        bindSettings();
        
        if (state.sheetUrl) fetchData();
        
        // Check admin session
        if (localStorage.getItem('bn2-isAdmin') === 'true') {
            state.isAdmin = true;
            updateAdminUI();
        }
        
        setTimeout(() => {
            $('#splashScreen').classList.add('fade-out');
        }, 1500);
    }

    function loadSettings() {
        state.sheetUrl = localStorage.getItem('bn2-jimpitanUrl') || DEFAULT_SHEET_URL;
        state.scriptUrl = localStorage.getItem('bn2-scriptUrl') || DEFAULT_SCRIPT_URL;
        
        $('#sheetUrl').value = state.sheetUrl;
        $('#scriptUrl').value = state.scriptUrl;
    }

    // =================== DATA FETCHING ===================
    async function fetchData() {
        showLoading();
        try {
            const url = `${state.sheetUrl}&t=${Date.now()}`;
            const response = await fetch(url);
            const csvText = await response.text();
            parseCSVData(csvText);
            localStorage.setItem('bn2-jimpitanCache', csvText);
        } catch (error) {
            console.error('Fetch error:', error);
            const cached = localStorage.getItem('bn2-jimpitanCache');
            if (cached) parseCSVData(cached);
            showToast('Mode offline aktif', 'offline');
        } finally {
            hideLoading();
        }
    }

    function parseCSVData(csv) {
        const results = Papa.parse(csv, { header: true, skipEmptyLines: true });
        
        state.data = results.data.map((row, index) => {
            const get = (key) => {
                const foundKey = Object.keys(row).find(k => k.trim().toUpperCase() === key.toUpperCase());
                return foundKey ? row[foundKey].toString().trim() : '';
            };

            const tgl = get('TANGGAL');
            const nominal = parseRp(get('NOMINAL'));
            const tipe = (get('TIPE') || '').toLowerCase().includes('keluar') ? 'Pengeluaran' : 'Pemasukan';

            // Parse date
            let dateObj = new Date();
            if (tgl) {
                const p = tgl.split(/[-/ ]/);
                if (p.length === 3) {
                    const mName = p[1].toLowerCase();
                    const monthMap = { 'jan':0,'feb':1,'mar':2,'apr':3,'mei':4,'jun':5,'jul':6,'agu':7,'sep':8,'okt':9,'nov':10,'des':11 };
                    let m = parseInt(p[1]) - 1;
                    if (isNaN(m)) m = monthMap[mName.substring(0,3)] || 0;
                    dateObj = new Date(parseInt(p[2]), m, parseInt(p[0]));
                }
            }

            return {
                idx: index,
                tanggal: tgl,
                tipe: tipe,
                nominal: nominal,
                keterangan: get('KETERANGAN') || '-',
                pelapor: get('PELAPOR') || 'Admin',
                dateObj: dateObj
            };
        });

        renderAll();
    }

    // =================== CRUD (DIRECT SYNC) ===================
    async function syncToGoogle(payload) {
        if (!state.scriptUrl) return showToast('Script URL belum diatur', 'error');
        
        showSyncStatus(true);
        try {
            const response = await fetch(state.scriptUrl, {
                method: 'POST',
                mode: 'cors',
                cache: 'no-cache',
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.success) {
                showToast('Berhasil disimpan ke Google Sheets', 'success');
                return true;
            } else {
                throw new Error(result.error || 'Server gagal merespon');
            }
        } catch (err) {
            showToast(`Gagal: ${err.message}`, 'error');
            return false;
        } finally {
            showSyncStatus(false);
        }
    }

    async function handleSave(e) {
        e.preventDefault();
        const isEdit = state.editingIdx !== null;
        
        const typeRaw = $('#entryType').value;
        const tipe = typeRaw === 'JIMPITAN' ? 'Pemasukan' : 'Pengeluaran';
        const dRaw = new Date($('#entryDate').value);
        const mShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const tglStr = `${dRaw.getDate()}-${mShort[dRaw.getMonth()]}-${dRaw.getFullYear()}`;
        
        const nominal = parseInt($('#entryNominal').value);
        const keterangan = $('#entryKeterangan').value.trim() || '-';

        // 1. Duplicate check (for add)
        if (!isEdit) {
            const isDup = state.data.some(d => d.tanggal === tglStr && d.tipe === tipe);
            if (isDup) return showToast('Data di tanggal tersebut sudah ada!', 'error');
        }

        const payload = {
            action: isEdit ? 'editItem' : 'addItem',
            tanggal: tglStr,
            tipe: tipe,
            nominal: nominal,
            keterangan: keterangan,
            password: 'adminbn2',
            source: 'jimpitan'
        };

        const success = await syncToGoogle(payload);
        if (success) {
            if (isEdit) {
                const item = state.data.find(d => d.idx === state.editingIdx);
                if (item) {
                    item.tanggal = tglStr;
                    item.tipe = tipe;
                    item.nominal = nominal;
                    item.keterangan = keterangan;
                    item.dateObj = dRaw;
                }
            } else {
                // Tambah ke layar secara instan (Optimistic)
                const newItem = {
                    idx: Date.now(),
                    tanggal: tglStr,
                    tipe: tipe,
                    nominal: nominal,
                    keterangan: keterangan,
                    pelapor: 'Admin',
                    dateObj: dRaw
                };
                state.data.unshift(newItem);
            }

            $('#entryModal').classList.add('hidden');
            $('#entryForm').reset();
            state.editingIdx = null;
            renderAll(); // Langsung muncul di layar
            
            // Tetap lakukan fetch di latar belakang (opsional)
            setTimeout(() => fetchData(), 5000);
        }
    }

    async function deleteEntry(idx) {
        const item = state.data.find(d => d.idx === idx);
        if (!item) return;

        if (!confirm(`Hapus data ${item.tipe} Rp ${formatRp(item.nominal)}?`)) return;

        const payload = {
            action: 'deleteItem',
            tanggal: item.tanggal,
            tipe: item.tipe,
            nominal: item.nominal,
            password: 'adminbn2',
            source: 'jimpitan'
        };

        const success = await syncToGoogle(payload);
        if (success) {
            if ($('#detailModal')) $('#detailModal').classList.add('hidden');
            fetchData();
        }
    }

    // =================== UI RENDERING ===================
    function renderAll() {
        const typeFilter = state.activeTab === 'jimpitan' ? 'Pemasukan' : 'Pengeluaran';
        
        // Filter by month/year
        state.filteredData = state.data.filter(d => 
            d.dateObj.getMonth() + 1 === state.selectedMonth && 
            d.dateObj.getFullYear() === state.selectedYear
        );

        const currentTabItems = state.filteredData.filter(d => d.tipe === typeFilter);
        
        // Header stats
        const totalMasuk = state.filteredData.filter(d => d.tipe === 'Pemasukan').reduce((s, i) => s + i.nominal, 0);
        const totalKeluar = state.filteredData.filter(d => d.tipe === 'Pengeluaran').reduce((s, i) => s + i.nominal, 0);
        
        $('#totalSaldo').textContent = formatRp(totalMasuk - totalKeluar);
        $('#statMasuk').textContent = formatRp(totalMasuk);
        $('#statKeluar').textContent = formatRp(totalKeluar);
        $('#entriDataCount').textContent = `${currentTabItems.length} Hari`;

        renderList(currentTabItems);
        updateCharts();
        if (window.lucide) lucide.createIcons();
    }

    function renderList(items) {
        const container = $('#rekapContainer');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = '<div class="py-10 text-center text-slate-400 text-xs italic">Tidak ada data untuk periode ini</div>';
            return;
        }

        // Group by week
        const weeks = {};
        items.forEach(item => {
            const weekNum = getWeekOfMonth(item.dateObj);
            if (!weeks[weekNum]) weeks[weekNum] = [];
            weeks[weekNum].push(item);
        });

        let html = '<div class="space-y-6 pb-20">';
        Object.keys(weeks).sort((a, b) => b - a).forEach(w => {
            const weekItems = weeks[w];
            const weekTotal = weekItems.reduce((s, i) => s + i.nominal, 0);
            
            html += `
                <div class="space-y-3">
                    <div class="flex items-center justify-between px-1">
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Minggu ${w}</span>
                        <span class="text-[10px] font-bold text-emerald-600">${formatRp(weekTotal)}</span>
                    </div>
                    <div class="space-y-2">
                        ${weekItems.map(item => `
                            <div class="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4 shadow-sm active:scale-95 transition-all" onclick="window.showDetail(${item.idx})">
                                <div class="w-10 h-10 rounded-lg flex items-center justify-center ${item.tipe === 'Pemasukan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}">
                                    <i data-lucide="${item.tipe === 'Pemasukan' ? 'trending-up' : 'trending-down'}" class="w-5 h-5"></i>
                                </div>
                                <div class="flex-1">
                                    <div class="text-xs font-bold text-slate-800">${item.keterangan !== '-' ? item.keterangan : (item.tipe === 'Pemasukan' ? 'Jimpitan Warga' : 'Pengeluaran')}</div>
                                    <div class="text-[10px] text-slate-400 font-medium">${item.tanggal}</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-sm font-black ${item.tipe === 'Pemasukan' ? 'text-emerald-600' : 'text-rose-600'}">${formatRp(item.nominal)}</div>
                                    ${state.isAdmin ? `
                                        <div class="flex gap-2 mt-1 justify-end">
                                            <button onclick="event.stopPropagation(); window.handleEdit(${item.idx})" class="text-slate-400 hover:text-emerald-600"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
                                            <button onclick="event.stopPropagation(); window.handleDelete(${item.idx})" class="text-slate-400 hover:text-rose-600"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // =================== INTERACTIVE ===================
    window.showDetail = (idx) => {
        const item = state.data.find(d => d.idx === idx);
        if (!item) return;
        
        const modal = $('#detailModal');
        const content = $('#detailContent');
        
        content.innerHTML = `
            <div class="space-y-4">
                <div class="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
                        <i data-lucide="${item.tipe === 'Pemasukan' ? 'wallet' : 'receipt'}" class="w-6 h-6 text-emerald-600"></i>
                    </div>
                    <div>
                        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${item.tipe}</div>
                        <div class="text-lg font-black text-slate-800">${formatRp(item.nominal)}</div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="p-3 bg-white border border-slate-100 rounded-lg">
                        <div class="text-[9px] font-bold text-slate-400 uppercase">Tanggal</div>
                        <div class="text-xs font-bold text-slate-700">${item.tanggal}</div>
                    </div>
                    <div class="p-3 bg-white border border-slate-100 rounded-lg">
                        <div class="text-[9px] font-bold text-slate-400 uppercase">Input Oleh</div>
                        <div class="text-xs font-bold text-slate-700">${item.pelapor}</div>
                    </div>
                </div>
                <div class="p-4 bg-white border border-slate-100 rounded-lg">
                    <div class="text-[9px] font-bold text-slate-400 uppercase mb-1">Keterangan</div>
                    <div class="text-xs text-slate-600 font-medium leading-relaxed">${item.keterangan}</div>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    };

    window.handleEdit = (idx) => {
        const item = state.data.find(d => d.idx === idx);
        if (!item) return;
        
        state.editingIdx = idx;
        $('#entryTitle').textContent = 'Edit Data';
        $('#entryType').value = item.tipe === 'Pemasukan' ? 'JIMPITAN' : 'PENGELUARAN';
        $('#entryNominal').value = item.nominal;
        $('#entryKeterangan').value = item.keterangan !== '-' ? item.keterangan : '';
        
        // Format date to YYYY-MM-DD
        const d = item.dateObj;
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        $('#entryDate').value = dateStr;
        
        $('#entryModal').classList.remove('hidden');
    };

    window.handleDelete = deleteEntry;

    // =================== HELPERS ===================
    function parseRp(str) {
        if (!str) return 0;
        return parseInt(str.replace(/[^0-9]/g, '')) || 0;
    }

    function formatRp(num) {
        return 'Rp ' + num.toLocaleString('id-ID');
    }

    function getWeekOfMonth(date) {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const day = firstDay.getDay();
        return Math.ceil((date.getDate() + day) / 7);
    }

    function showLoading() { $('#splashScreen').classList.remove('fade-out'); }
    function hideLoading() { $('#splashScreen').classList.add('fade-out'); }
    
    function showSyncStatus(show) {
        const overlay = $('#syncOverlay');
        if (show) {
            overlay.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-[-20px]');
        } else {
            overlay.classList.add('opacity-0', 'pointer-events-none', 'translate-y-[-20px]');
        }
    }

    function showToast(msg, type = 'info') {
        const container = $('#toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast bg-white border-l-4 ${type === 'success' ? 'border-emerald-500' : (type === 'error' ? 'border-rose-500' : 'border-blue-500')} p-4 shadow-xl flex items-center gap-3`;
        toast.innerHTML = `
            <div class="${type === 'success' ? 'text-emerald-500' : (type === 'error' ? 'text-rose-500' : 'text-blue-500')}">
                <i data-lucide="${type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info')}" class="w-5 h-5"></i>
            </div>
            <span class="text-xs font-bold text-slate-700">${msg}</span>
        `;
        container.appendChild(toast);
        if (window.lucide) lucide.createIcons();
        setTimeout(() => toast.remove(), 3000);
    }

    // =================== BINDERS ===================
    function bindNavigation() {
        $$('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.tab-btn').forEach(b => b.classList.remove('active', 'bg-emerald-700', 'text-white'));
                $$('.tab-btn').forEach(b => b.classList.add('text-slate-500'));
                
                btn.classList.add('active', 'bg-emerald-700', 'text-white');
                btn.classList.remove('text-slate-500');
                
                state.activeTab = btn.dataset.tab;
                renderAll();
            });
        });

        $('#refreshBtn').addEventListener('click', fetchData);
        $('#addDataBtn').addEventListener('click', () => {
            state.editingIdx = null;
            $('#entryTitle').textContent = 'Tambah Data Baru';
            $('#entryForm').reset();
            $('#entryDate').value = new Date().toISOString().split('T')[0];
            $('#entryModal').classList.remove('hidden');
        });
        
        $('#closeEntryModal').addEventListener('click', () => $('#entryModal').classList.add('hidden'));
        $('#closeDetailModal').addEventListener('click', () => $('#detailModal').classList.add('hidden'));
    }

    function bindEntryForm() {
        $('#entryForm').addEventListener('submit', handleSave);
    }

    function bindFilters() {
        const mSelect = $('#monthSelect');
        const ySelect = $('#yearSelect');
        
        state.monthsNames.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = i + 1;
            opt.textContent = m;
            if (i + 1 === state.selectedMonth) opt.selected = true;
            mSelect.appendChild(opt);
        });

        for (let y = 2024; y <= 2030; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === state.selectedYear) opt.selected = true;
            ySelect.appendChild(opt);
        }

        mSelect.addEventListener('change', (e) => {
            state.selectedMonth = parseInt(e.target.value);
            renderAll();
        });
        ySelect.addEventListener('change', (e) => {
            state.selectedYear = parseInt(e.target.value);
            renderAll();
        });
    }

    function bindSettings() {
        $('#adminBtn').addEventListener('click', () => {
            if (state.isAdmin) {
                $('#settingsModal').classList.remove('hidden');
            } else {
                const pass = prompt('Masukkan Password Admin:');
                if (pass === 'adminbn2') {
                    state.isAdmin = true;
                    localStorage.setItem('bn2-isAdmin', 'true');
                    updateAdminUI();
                    showToast('Admin Terverifikasi', 'success');
                } else {
                    showToast('Password Salah', 'error');
                }
            }
        });

        $('#closeSettingsModal').addEventListener('click', () => $('#settingsModal').classList.add('hidden'));
        
        $('#saveConfigBtn').addEventListener('click', () => {
            localStorage.setItem('bn2-jimpitanUrl', $('#sheetUrl').value);
            localStorage.setItem('bn2-scriptUrl', $('#scriptUrl').value);
            state.sheetUrl = $('#sheetUrl').value;
            state.scriptUrl = $('#scriptUrl').value;
            showToast('Konfigurasi disimpan', 'success');
            fetchData();
        });
    }

    function updateAdminUI() {
        if (state.isAdmin) {
            $('#adminBadge').classList.remove('hidden');
            $('#addDataBtn').classList.remove('hidden');
            renderAll();
        }
    }

    function updateCharts() {
        // Chart logic here (if needed)
    }

})();
