/* ========================================
   JIMPITAN BUMI NEIKARTA 2 - CLEAN VERSION 
   Simple, Robust, and Direct-Sync
   ======================================== */

(function () {
    'use strict';

    const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQfPsk4L2qxshegLjX6zTdY4mPv0e4xYFqbzYFKgqwHJrMuSXAeDJuIFAhdyK2vi4SwyJ2HXZX4h0un/pub?gid=289431951&single=true&output=csv';
    const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw_r_BRp48akKLSOp4-IEXsy9hueej3xQiwiEXXZfxGjEwSrchj_PyPQ49XDn_36fPq/exec';

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
        currentWeek: null,
        chart: null,
        chartScale: 'week',
        monthsNames: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    };

    // Helper functions
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);
    const ADMIN_PASS = 'adminbn2';

    let renderTimeout;
    const debouncedRender = (delay = 150) => {
        clearTimeout(renderTimeout);
        renderTimeout = setTimeout(() => renderAll(), delay);
    };

    // =================== INITIALIZATION ===================
    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        try {
            loadSettings();
            bindNavigation();
            bindEntryForm();
            bindFilters();
            bindReports();
            bindAdminAuth();
            bindConfig();
            
            if (state.sheetUrl) fetchData();
            
            // Check admin session
            if (localStorage.getItem('bn2-isAdmin') === 'true') {
                state.isAdmin = true;
                updateAdminUI();
            }

            // Service Worker disabled for localhost development
            // Uncomment for production:
            // if ('serviceWorker' in navigator) {
            //     navigator.serviceWorker.register('sw.js').catch(err => console.error('SW registration failed:', err));
            // }
        } catch (e) {
            console.error('Init Error:', e);
        }
    }

    function loadSettings() {
        state.sheetUrl = localStorage.getItem('bn2-jimpitanUrl') || DEFAULT_SHEET_URL;
        state.scriptUrl = localStorage.getItem('bn2-scriptUrl') || DEFAULT_SCRIPT_URL;
        
        $('#sheetUrl').value = state.sheetUrl;
        $('#scriptUrl').value = state.scriptUrl;
    }

    function updateAdminUI() {
        const badge = $('#adminBadge');
        const addBtn = $('#addDataBtn');
        const adminBtn = $('#adminBtn');
        const setBtn = $('#settingsBtn');
        const refBtn = $('#refreshBtn');

        if (state.isAdmin) {
            badge.classList.remove('hidden');
            addBtn.classList.remove('hidden');
            if (setBtn) setBtn.classList.remove('hidden');
            if (refBtn) refBtn.classList.remove('hidden');
            adminBtn.classList.add('bg-emerald-500/20', 'text-emerald-400');
            adminBtn.innerHTML = '<i data-lucide="log-out" class="w-5 h-5"></i>';
            adminBtn.title = 'Logout Admin';
        } else {
            badge.classList.add('hidden');
            addBtn.classList.add('hidden');
            if (setBtn) setBtn.classList.add('hidden');
            if (refBtn) refBtn.classList.add('hidden');
            adminBtn.classList.remove('bg-emerald-500/20', 'text-emerald-400');
            adminBtn.innerHTML = '<i data-lucide="lock" class="w-5 h-5"></i>';
            adminBtn.title = 'Login Admin';
        }
        if (window.lucide) lucide.createIcons({ nodes: [adminBtn] });
    }

    function updateSyncLabel(text) {
        const el = $('#lastSyncTime');
        if (el) { el.textContent = text; el.classList.remove('hidden'); }
    }

    // =================== DATA FETCHING ===================
    async function fetchData() {
        showLoading();
        try {
            const url = `${state.sheetUrl}&t=${Date.now()}`;
            const response = await fetch(url);
            const csvText = await response.text();
            updateSyncLabel(`| ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`);
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
        
        console.log('Parsing CSV data, rows:', results.data.length);
        
        state.data = results.data.map((row, index) => {
            const get = (key) => {
                const foundKey = Object.keys(row).find(k => k.trim().toUpperCase() === key.toUpperCase());
                return foundKey ? row[foundKey].toString().trim() : '';
            };

            const tgl = get('TANGGAL');
            const nominal = parseRp(get('NOMINAL'));
            const tipe = (get('TIPE') || '').toLowerCase().includes('keluar') ? 'Pengeluaran' : 'Pemasukan';

            // Parse date (support multiple formats: Mei/May, Agu/Aug, Okt/Oct, Des/Dec)
            let dateObj = new Date();
            if (tgl) {
                const p = tgl.split(/[-/ ]/);
                if (p.length === 3) {
                    const mName = p[1].toLowerCase();
                    // Support both Indonesian and English month names
                    const monthMap = { 
                        'jan':0, 'feb':1, 'mar':2, 'apr':3, 
                        'mei':4, 'may':4, // Mei (ID) dan May (EN)
                        'jun':5, 'jul':6, 
                        'agu':7, 'aug':7, // Agustus (ID) dan August (EN)
                        'sep':8, 
                        'okt':9, 'oct':9, // Oktober (ID) dan October (EN)
                        'nov':10, 
                        'des':11, 'dec':11 // Desember (ID) dan December (EN)
                    };
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

        console.log('Data parsed, total:', state.data.length);
        renderAll();
        console.log('RenderAll completed, hiding splash...');
        
        // Force hide splash after render
        setTimeout(() => {
            console.log('Force hiding splash screen');
            hideLoading();
        }, 500);
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
            password: ADMIN_PASS,
            source: 'jimpitan'
        };

        if (isEdit) {
            const oldItem = state.data.find(d => d.idx === state.editingIdx);
            if (oldItem) {
                payload.oldTanggal = oldItem.tanggal;
                payload.oldTipe = oldItem.tipe;
                payload.oldNominal = oldItem.nominal;
            }
        }

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

            updateSyncLabel('| Terupdate');
            hideModal('#entryModal');
            $('#entryForm').reset();
            state.editingIdx = null;
            renderAll(); // Langsung muncul di layar
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
            password: ADMIN_PASS,
            source: 'jimpitan'
        };

        const success = await syncToGoogle(payload);
        if (success) {
            state.data = state.data.filter(d => d.idx !== idx);
            hideModal('#detailModal');

            updateSyncLabel('| Terupdate');
            renderAll();
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
        
        // Header stats (Monthly)
        const totalMasukBulan = state.filteredData.filter(d => d.tipe === 'Pemasukan').reduce((s, i) => s + i.nominal, 0);
        const totalKeluarBulan = state.filteredData.filter(d => d.tipe === 'Pengeluaran').reduce((s, i) => s + i.nominal, 0);
        
        // Yearly stats
        const totalMasukTahun = state.data.filter(d => d.dateObj.getFullYear() === state.selectedYear && d.tipe === 'Pemasukan').reduce((s, i) => s + i.nominal, 0);

        // Isi & Kosong (Monthly)
        const hariIsi = state.filteredData.filter(d => d.tipe === 'Pemasukan' && d.nominal > 0).length;
        const hariKosong = state.filteredData.filter(d => d.tipe === 'Pemasukan' && d.nominal === 0).length;

        // DOM Updates safely
        const elSaldo = $('#totalSaldo');
        if (elSaldo) elSaldo.textContent = formatRp(totalMasukBulan - totalKeluarBulan);
        
        const elMasukTahun = $('#statMasukTahun');
        if (elMasukTahun) elMasukTahun.textContent = formatRp(totalMasukTahun);
        
        const elIsi = $('#statIsi');
        if (elIsi) elIsi.textContent = `${hariIsi} Hari`;
        
        const elKosong = $('#statKosong');
        if (elKosong) elKosong.textContent = `${hariKosong} Hari`;

        // Trend calculation (Compare with previous month)
        const prevMonth = state.selectedMonth === 1 ? 12 : state.selectedMonth - 1;
        const prevYear = state.selectedMonth === 1 ? state.selectedYear - 1 : state.selectedYear;
        const prevData = state.data.filter(it => it.dateObj.getMonth() + 1 === prevMonth && it.dateObj.getFullYear() === prevYear);
        const prevMasuk = prevData.filter(it => it.tipe === 'Pemasukan').reduce((s, i) => s + i.nominal, 0);
        
        const trendDiv = $('#balanceTrend');
        if (prevMasuk > 0 && trendDiv) {
            const diff = ((totalMasukBulan - prevMasuk) / prevMasuk) * 100;
            trendDiv.classList.remove('hidden');
            if (diff >= 0) {
                trendDiv.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-white/20 text-white';
                const trendIcon = $('#trendIcon');
                if (trendIcon) trendIcon.setAttribute('data-lucide', 'trending-up');
                const trendVal = $('#trendValue');
                if (trendVal) trendVal.textContent = `+${diff.toFixed(1)}%`;
            } else {
                trendDiv.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-rose-500/50 text-white';
                const trendIcon = $('#trendIcon');
                if (trendIcon) trendIcon.setAttribute('data-lucide', 'trending-down');
                const trendVal = $('#trendValue');
                if (trendVal) trendVal.textContent = `${diff.toFixed(1)}%`;
            }
        } else if (trendDiv) {
            trendDiv.classList.add('hidden');
        }

        renderList(currentTabItems);
        updateCharts();
        const nodesToUpdate = [];
        const rekapContainer = $('#rekapContainer');
        if (rekapContainer) nodesToUpdate.push(rekapContainer);
        const balanceTrend = $('#balanceTrend');
        if (balanceTrend) nodesToUpdate.push(balanceTrend);
        if (window.lucide && nodesToUpdate.length > 0) lucide.createIcons({ nodes: nodesToUpdate });
    }

    function groupByWeek(items) {
        const weeks = {};
        items.forEach(item => {
            const w = getWeekOfMonth(item.dateObj);
            if (!weeks[w]) weeks[w] = [];
            weeks[w].push(item);
        });
        return weeks;
    }

    function renderList(items) {
        const container = $('#rekapContainer');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = '<div class="py-10 text-center text-slate-400 text-xs italic">Tidak ada data untuk periode ini</div>';
            return;
        }

        // Sort ALL items descending first
        items.sort((a, b) => b.dateObj - a.dateObj);

        const weeks = groupByWeek(items);

        const sortedWeeks = Object.keys(weeks).map(Number).sort((a, b) => b - a);
        
        // Auto-select latest week if none selected or if month changed
        if (!state.currentWeek || !weeks[state.currentWeek]) {
            state.currentWeek = sortedWeeks[0];
        }

        const activeWeekItems = weeks[state.currentWeek];
        const weekTotal = activeWeekItems.reduce((s, i) => s + i.nominal, 0);

        let html = '<div style="padding-bottom: 100px;">';
        
        // PAGINATION NAVIGATION
        html += `
            <div class="week-nav">
                <button onclick="window.changeWeek(-1)" ${sortedWeeks.indexOf(state.currentWeek) === sortedWeeks.length - 1 ? 'disabled' : ''} title="Minggu Sebelumnya">
                    <i data-lucide="chevron-left" style="width: 20px; height: 20px;"></i>
                </button>
                <div class="week-info">
                    <div class="week-label">Minggu ${state.currentWeek}</div>
                    <div class="week-total">${formatRp(weekTotal)}</div>
                </div>
                <button onclick="window.changeWeek(1)" ${sortedWeeks.indexOf(state.currentWeek) === 0 ? 'disabled' : ''} title="Minggu Selanjutnya">
                    <i data-lucide="chevron-right" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
        `;

        html += `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${activeWeekItems.map(item => `
                    <div class="data-card" onclick="window.showDetail(${item.idx})">
                        <div class="data-icon ${item.tipe === 'Pemasukan' ? 'income' : 'expense'}">
                            <i data-lucide="${item.tipe === 'Pemasukan' ? 'trending-up' : 'trending-down'}" style="width: 20px; height: 20px;"></i>
                        </div>
                        <div class="data-info">
                            <div class="data-title">${item.keterangan !== '-' ? item.keterangan : (item.tipe === 'Pemasukan' ? 'Jimpitan Warga' : 'Pengeluaran')}</div>
                            <div class="data-date">${getDayName(item.dateObj)}, ${item.tanggal}</div>
                        </div>
                        <div class="data-amount">
                            <div class="data-amount-value ${item.tipe === 'Pemasukan' ? 'income' : 'expense'}">${formatRp(item.nominal)}</div>
                            ${state.isAdmin ? `
                                <div class="data-actions">
                                    <button onclick="event.stopPropagation(); window.handleEdit(${item.idx})" title="Edit">
                                        <i data-lucide="edit-3" style="width: 16px; height: 16px;"></i>
                                    </button>
                                    <button onclick="event.stopPropagation(); window.handleDelete(${item.idx})" title="Hapus">
                                        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        html += '</div>';
        container.innerHTML = html;
    }

    window.changeWeek = (direction) => {
        const typeFilter = state.activeTab === 'jimpitan' ? 'Pemasukan' : 'Pengeluaran';
        const currentTabItems = state.filteredData.filter(d => d.tipe === typeFilter);

        const weeks = groupByWeek(currentTabItems);

        const sortedWeeks = Object.keys(weeks).map(Number).sort((a, b) => b - a);
        const currentIndex = sortedWeeks.indexOf(state.currentWeek);
        
        // direction -1 (prev) means go to higher index in sortedWeeks (e.g. index 1 is Week 3 if index 0 is Week 4)
        // Wait, the logic for 'Next/Prev' depends on how we view it.
        // User said: "Next/Prev untuk melihat minggu2 lain, yang ditampilkan adalah minggu terbaru".
        // So 'Prev' means older week? Let's say Prev = older.
        
        const nextIndex = currentIndex - direction; // direction 1 is 'Next' (newer), direction -1 is 'Prev' (older)
        if (nextIndex >= 0 && nextIndex < sortedWeeks.length) {
            state.currentWeek = sortedWeeks[nextIndex];
            renderAll();
        }
    };

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
        if (window.lucide) lucide.createIcons({ nodes: [modal] });
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
        
        showModal('#entryModal');
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

    function getDayName(date) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return days[date.getDay()];
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

    function showModal(modalId) {
        const modal = $(modalId);
        if (modal) modal.classList.add('show');
    }

    function hideModal(modalId) {
        const modal = $(modalId);
        if (modal) modal.classList.remove('show');
    }

    function showToast(msg, type = 'info') {
        const container = $('#toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i data-lucide="${type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info')}" style="width: 20px; height: 20px;"></i>
            </div>
            <span class="toast-text">${msg}</span>
        `;
        container.appendChild(toast);
        if (window.lucide) lucide.createIcons({ nodes: [toast] });
        setTimeout(() => toast.remove(), 3000);
    }

    // =================== BINDERS ===================
    function bindReports() {
        $('#shareBtn').addEventListener('click', () => showModal('#shareModal'));
        $('#closeShareModal').addEventListener('click', () => hideModal('#shareModal'));
        
        $('#shareWeekBtn').addEventListener('click', () => handleShareWA('week'));
        $('#shareMonthBtn').addEventListener('click', () => handleShareWA('month'));
        $('#exportBtn').addEventListener('click', handleExportCSV);
    }

    function handleShareWA(type) {
        const monthName = state.monthsNames[state.selectedMonth - 1];
        const year = state.selectedYear;
        let text = `*LAPORAN JIMPITAN BN2*\n📅 *${monthName} ${year}*\n\n`;

        if (type === 'week') {
            const currentTabItems = state.filteredData.filter(d => d.tipe === (state.activeTab === 'jimpitan' ? 'Pemasukan' : 'Pengeluaran'));
            const weeks = groupByWeek(currentTabItems);
            
            const items = (weeks[state.currentWeek] || []).sort((a, b) => a.dateObj - b.dateObj);
            const total = items.reduce((s, i) => s + i.nominal, 0);
            
            text += `📍 *RINGKASAN MINGGU ${state.currentWeek}*\n`;
            text += `--------------------------\n`;
            items.forEach(it => {
                const d = it.tanggal.split('-');
                text += `• ${getDayName(it.dateObj)}, ${d[0]} ${d[1]} : *${formatRp(it.nominal)}*\n`;
            });
            text += `--------------------------\n`;
            text += `💰 *TOTAL: ${formatRp(total)}*`;
        } else {
            const masuk = state.filteredData.filter(d => d.tipe === 'Pemasukan');
            const keluar = state.filteredData.filter(d => d.tipe === 'Pengeluaran');
            const totalMasuk = masuk.reduce((s, i) => s + i.nominal, 0);
            const totalKeluar = keluar.reduce((s, i) => s + i.nominal, 0);

            text += `📊 *REKAP BULANAN*\n`;
            text += `--------------------------\n`;
            text += `✅ Total Masuk: *${formatRp(totalMasuk)}*\n`;
            text += `❌ Total Keluar: *${formatRp(totalKeluar)}*\n`;
            text += `--------------------------\n\n`;
            
            text += `📍 *PENDAPATAN PER MINGGU:*\n`;
            const weeklyMasuk = {};
            masuk.forEach(it => {
                const w = getWeekOfMonth(it.dateObj);
                weeklyMasuk[w] = (weeklyMasuk[w] || 0) + it.nominal;
            });
            Object.keys(weeklyMasuk).sort().forEach(w => {
                text += `• Minggu ${w} : *${formatRp(weeklyMasuk[w])}*\n`;
            });
            text += `\n--------------------------\n`;
            text += `💰 *SALDO AKHIR: ${formatRp(totalMasuk - totalKeluar)}*`;
        }

        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        $('#shareModal').classList.add('hidden');
    }

    function handleExportCSV() {
        if (state.data.length === 0) return showToast('Tidak ada data untuk diexport', 'error');
        
        let csv = 'Tanggal,Tipe,Nominal,Keterangan,Pelapor\n';
        state.data.sort((a, b) => a.dateObj - b.dateObj).forEach(it => {
            csv += `"${it.tanggal}","${it.tipe}","${it.nominal}","${it.keterangan}","${it.pelapor}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Rekap_Jimpitan_BN2_${state.selectedMonth}_${state.selectedYear}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('CSV Berhasil diunduh', 'success');
    }

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
            showModal('#entryModal');
        });
        
        $('#closeEntryModal').addEventListener('click', () => hideModal('#entryModal'));
        $('#closeDetailModal').addEventListener('click', () => hideModal('#detailModal'));
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
            debouncedRender();
        });
        ySelect.addEventListener('change', (e) => {
            state.selectedYear = parseInt(e.target.value);
            debouncedRender();
        });
    }

    function bindAdminAuth() {
        $('#adminBtn').addEventListener('click', () => {
            if (state.isAdmin) {
                showModal('#logoutModal');
            } else {
                showModal('#authModal');
                $('#adminPass').value = '';
                $('#adminPass').focus();
            }
        });

        $('#closeAuthBtn').addEventListener('click', () => hideModal('#authModal'));
        
        $('#confirmAuthBtn').addEventListener('click', () => {
            const pass = $('#adminPass').value;
            if (pass === ADMIN_PASS) {
                state.isAdmin = true;
                localStorage.setItem('bn2-isAdmin', 'true');
                hideModal('#authModal');
                updateAdminUI();
                renderAll();
                showToast('Login Admin Berhasil', 'success');
            } else {
                showToast('Password Salah!', 'error');
                $('#adminPass').value = '';
            }
        });

        // Logout jika klik badge admin
        $('#adminBadge').addEventListener('click', () => {
            if (state.isAdmin) showModal('#logoutModal');
        });

        $('#closeLogoutModal').addEventListener('click', () => hideModal('#logoutModal'));
        
        $('#confirmLogoutBtn').addEventListener('click', () => {
            state.isAdmin = false;
            localStorage.removeItem('bn2-isAdmin');
            hideModal('#logoutModal');
            updateAdminUI();
            renderAll();
            showToast('Mode Admin dimatikan');
        });
    }

    function bindConfig() {
        const sBtn = $('#settingsBtn');
        const closeBtn = $('#closeSettingsModal');
        const saveBtn = $('#saveConfigBtn');

        if (sBtn) sBtn.addEventListener('click', () => showModal('#settingsModal'));
        if (closeBtn) closeBtn.addEventListener('click', () => hideModal('#settingsModal'));
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const sUrl = $('#sheetUrl').value;
                const scUrl = $('#scriptUrl').value;
                
                localStorage.setItem('bn2-jimpitanUrl', sUrl);
                localStorage.setItem('bn2-scriptUrl', scUrl);
                
                state.sheetUrl = sUrl;
                state.scriptUrl = scUrl;
                
                showToast('Konfigurasi disimpan', 'success');
                hideModal('#settingsModal');
                fetchData();
            });
        }
    }

    window.setChartScale = (scale) => {
        state.chartScale = scale;
        
        // Update UI buttons
        $$('.chart-scale-btn').forEach(btn => {
            if (btn.dataset.scale === scale) {
                btn.classList.add('bg-emerald-500', 'text-white');
                btn.classList.remove('text-white/50');
            } else {
                btn.classList.remove('bg-emerald-500', 'text-white');
                btn.classList.add('text-white/50');
            }
        });
        
        updateCharts();
    };

    function updateCharts() {
        const ctx = $('#jimpitanChart');
        if (!ctx || !window.Chart) return;

        let labels = [];
        let dataValues = [];
        const scale = state.chartScale || 'week';
        const filteredPemasukan = state.data.filter(d => d.tipe === 'Pemasukan');

        let fullLabels = [];

        if (scale === 'day') {
            const daysData = {};
            const dayMeta = {};
            state.filteredData.filter(d => d.tipe === 'Pemasukan').forEach(it => {
                const d = it.dateObj.getDate();
                daysData[d] = (daysData[d] || 0) + it.nominal;
                if (!dayMeta[d]) dayMeta[d] = `${getDayName(it.dateObj)}, ${it.tanggal}`;
            });
            labels = Object.keys(daysData).sort((a, b) => a - b);
            dataValues = labels.map(d => daysData[d]);
            fullLabels = labels.map(d => dayMeta[d]);
        } else if (scale === 'week') {
            const weeksData = {};
            const weekMeta = {};
            state.filteredData.filter(d => d.tipe === 'Pemasukan').sort((a,b) => a.dateObj - b.dateObj).forEach(it => {
                const w = getWeekOfMonth(it.dateObj);
                weeksData[w] = (weeksData[w] || 0) + it.nominal;
                if (!weekMeta[w]) weekMeta[w] = { start: it.tanggal, end: it.tanggal };
                else weekMeta[w].end = it.tanggal;
            });
            labels = Object.keys(weeksData).sort().map(w => `W${w}`);
            dataValues = Object.keys(weeksData).sort().map(w => weeksData[w]);
            fullLabels = Object.keys(weeksData).sort().map(w => {
                const m = weekMeta[w];
                const s = m.start.split('-').slice(0, 2).join(' ');
                const e = m.end.split('-').slice(0, 2).join(' ');
                return `Minggu ${w} (${s} - ${e})`;
            });
        } else if (scale === 'month') {
            const monthsData = {};
            filteredPemasukan.filter(it => it.dateObj.getFullYear() === state.selectedYear).forEach(it => {
                const m = it.dateObj.getMonth() + 1;
                monthsData[m] = (monthsData[m] || 0) + it.nominal;
            });
            labels = Object.keys(monthsData).sort((a, b) => a - b).map(m => state.monthsNames[m - 1].substring(0, 3));
            dataValues = Object.keys(monthsData).sort((a, b) => a - b).map(m => monthsData[m]);
            fullLabels = Object.keys(monthsData).sort((a, b) => a - b).map(m => state.monthsNames[m-1] + ' ' + state.selectedYear);
        } else if (scale === 'year') {
            const yearsData = {};
            filteredPemasukan.forEach(it => {
                const y = it.dateObj.getFullYear();
                yearsData[y] = (yearsData[y] || 0) + it.nominal;
            });
            labels = Object.keys(yearsData).sort();
            dataValues = labels.map(y => yearsData[y]);
            fullLabels = labels.map(y => `Tahun ${y}`);
        }

        if (state.chart) {
            state.chart.data.labels = labels;
            state.chart.data.datasets[0].data = dataValues;
            state.chart.update('none');
        } else {
            state.chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Jimpitan',
                        data: dataValues,
                        backgroundColor: 'rgba(255, 255, 255, 0.4)',
                        borderColor: 'rgba(255, 255, 255, 0.8)',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                title: (items) => fullLabels[items[0].dataIndex],
                                label: (context) => `Total: ${formatRp(context.raw)}`
                            }
                        }
                    },
                    scales: {
                        y: { display: false },
                        x: {
                            ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 10, weight: 'bold' } },
                            grid: { display: false }
                        }
                    }
                }
            });
        }
        state.chart.options.plugins.tooltip.callbacks.title = (items) => fullLabels[items[0].dataIndex];
    }

})();
