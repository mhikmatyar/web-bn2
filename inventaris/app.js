/* ========================================
   INVENTARIS BN2 - APP.JS (Sidebar + Senior Friendly)
   ======================================== */

(function () {
    'use strict';

    const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQfPsk4L2qxshegLjX6zTdY4mPv0e4xYFqbzYFKgqwHJrMuSXAeDJuIFAhdyK2vi4SwyJ2HXZX4h0un/pub?gid=0&single=true&output=csv';
    const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxSb3F1apIZ1TGxKC2v5BinPsWE2DTRA843kILk0NtQcwealsRHLaB3yfodJtTkVrhV/exec';

    const state = {
        items: [],
        filteredItems: [],
        sheetUrl: '',
        scriptUrl: '',
        isAdmin: false,
        activeFilter: 'all',
        searchQuery: '',
        syncQueue: [],
        isSyncing: false,
    };

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // =================== INIT ===================
    async function init() {
        loadSettings();
        bindEvents();
        updateAdminUI();

        if (state.sheetUrl) {
            await fetchData();
        }
        
        setInterval(processSyncQueue, 15000);
        if (window.lucide) lucide.createIcons();
    }

    function loadSettings() {
        state.sheetUrl = localStorage.getItem('inv-sheetUrl') || DEFAULT_SHEET_URL;
        state.scriptUrl = localStorage.getItem('inv-scriptUrl') || DEFAULT_SCRIPT_URL;
        state.isAdmin = localStorage.getItem('inv-isAdmin') === 'true';
        
        const savedQueue = localStorage.getItem('inv-syncQueue');
        if (savedQueue) state.syncQueue = JSON.parse(savedQueue);
    }

    function bindEvents() {
        // Sidebar Toggle
        $('#openSidebar').onclick = () => {
            $('#sidebar').classList.remove('sidebar-closed');
            $('#sidebarBackdrop').classList.add('backdrop-active');
        };
        $('#closeSidebar').onclick = () => {
            $('#sidebar').classList.add('sidebar-closed');
            $('#sidebarBackdrop').classList.remove('backdrop-active');
        };
        $('#sidebarBackdrop').onclick = () => {
            $('#sidebar').classList.add('sidebar-closed');
            $('#sidebarBackdrop').classList.remove('backdrop-active');
        };
        
        $('#minimizeSidebar').onclick = (e) => {
            e.stopPropagation();
            const sidebar = $('#sidebar');
            const isMin = sidebar.classList.toggle('sidebar-minimized');
            
            // Toggle icon with Lucide
            const icon = $('#minimizeIcon');
            if (icon) {
                icon.setAttribute('data-lucide', isMin ? 'chevron-right' : 'chevron-left');
                if (window.lucide) lucide.createIcons();
            }
        };
        
        // Navigation clicks
        $$('.nav-item').forEach(item => {
            item.onclick = (e) => {
                e.preventDefault();
                $$('.nav-item').forEach(nav => {
                    nav.classList.remove('sidebar-active', 'bg-emerald-600', 'text-white');
                    nav.classList.add('hover:bg-slate-800');
                });
                
                item.classList.add('sidebar-active');
                item.classList.remove('hover:bg-slate-800');
                
                const page = item.dataset.page;
                if (page === 'inventaris') {
                    $('#inventoryContainer').scrollIntoView({ behavior: 'smooth' });
                }
                
                $('#sidebar').classList.add('sidebar-closed');
                renderAll();
            };
        });

        // Refresh & Auth
        $('#refreshBtn').onclick = fetchData;
        $('#adminLoginBtn').onclick = () => {
            $('#authModal').classList.remove('hidden');
            $('#sidebar').classList.add('sidebar-closed');
        };
        $('#adminLogoutBtn').onclick = () => {
            if(confirm('Logout dari Mode Admin?')) {
                state.isAdmin = false;
                localStorage.removeItem('inv-isAdmin');
                updateAdminUI();
                showToast('Logout Berhasil', 'info');
            }
        };
        $('#authSubmit').onclick = performLogin;
        
        // Search & Filter
        $('#searchInput').oninput = (e) => {
            state.searchQuery = e.target.value.toLowerCase();
            renderAll();
        };

        $$('.filter-btn').forEach(btn => {
            btn.onclick = () => {
                $$('.filter-btn').forEach(b => {
                    b.classList.remove('active', 'bg-emerald-600', 'text-white');
                    b.classList.add('bg-slate-100', 'text-slate-500');
                });
                btn.classList.add('active', 'bg-emerald-600', 'text-white');
                btn.classList.remove('bg-slate-100', 'text-slate-500');
                state.activeFilter = btn.dataset.filter;
                renderAll();
            };
        });

        // Add Item
        $('#addBtn').onclick = () => {
            if (!state.isAdmin) return;
            $('#modalTitle').textContent = 'Tambah Barang Baru';
            $('#formMode').value = 'add';
            $('#itemModal').classList.remove('hidden');
        };

        $('#submitBtn').onclick = submitForm;
    }

    // =================== AUTH ===================
    function performLogin() {
        const pass = $('#adminPass').value;
        if (btoa(pass) === 'YWRtaW5ibjI=') {
            state.isAdmin = true;
            localStorage.setItem('inv-isAdmin', 'true');
            $('#authModal').classList.add('hidden');
            $('#adminPass').value = '';
            updateAdminUI();
            showToast('Login Admin Berhasil!', 'success');
        } else {
            showToast('PIN Salah!', 'error');
        }
    }

    function updateAdminUI() {
        if (state.isAdmin) {
            $('#adminLogoutBtn').classList.remove('hidden');
            $('#adminLoginBtn').classList.add('hidden');
            $('#adminActions').classList.remove('hidden');
        } else {
            $('#adminLogoutBtn').classList.add('hidden');
            $('#adminLoginBtn').classList.remove('hidden');
            $('#adminActions').classList.add('hidden');
        }
        renderAll();
    }

    // =================== DATA FETCH ===================
    async function fetchData() {
        const btn = $('#refreshBtn');
        btn.classList.add('opacity-50', 'pointer-events-none');
        $('#syncText').textContent = 'Memperbarui...';
        $('#syncDot').className = 'w-2 h-2 rounded-full bg-blue-500 animate-pulse';

        try {
            const response = await fetch(state.sheetUrl);
            const csv = await response.text();
            
            Papa.parse(csv, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    state.items = results.data.map((row, idx) => ({
                        no: row.NO || (idx + 1),
                        namaBarang: row['NAMA BARANG'] || row['Nama Barang'] || '',
                        noInventaris: row['NO INVENTARIS'] || row['No Inventaris'] || '',
                        kategori: row.KATEGORI || row['Kategori'] || '',
                        jumlah: parseInt(row.JUMLAH || row['Jumlah']) || 0,
                        hargaSatuan: parseInt((row['HARGA SATUAN'] || row['Harga Satuan'] || '0').toString().replace(/\D/g, '')) || 0,
                        kondisi: row.KONDISI || row['Kondisi'] || 'Baik',
                        lokasi: row.LOKASI || row['Lokasi'] || '',
                        keterangan: row.KETERANGAN || row['Keterangan'] || ''
                    })).filter(i => i.namaBarang);
                    
                    $('#syncText').textContent = 'Terhubung';
                    $('#syncDot').className = 'w-2 h-2 rounded-full bg-emerald-500';
                    renderAll();
                }
            });
        } catch (err) {
            $('#syncText').textContent = 'Koneksi Gagal';
            $('#syncDot').className = 'w-2 h-2 rounded-full bg-rose-500';
            showToast('Gagal memuat data!', 'error');
        } finally {
            btn.classList.remove('opacity-50', 'pointer-events-none');
        }
    }

    // =================== RENDERING ===================
    function renderAll() {
        const container = $('#inventoryContainer');
        
        // Stats Calculation
        const totalItems = state.items.reduce((s, i) => s + i.jumlah, 0);
        const categories = new Set(state.items.map(i => i.kategori).filter(Boolean));
        
        const baikCount = state.items.filter(i => i.kondisi.toLowerCase() === 'baik').reduce((s, i) => s + i.jumlah, 0);
        const rusakCount = state.items.filter(i => i.kondisi.toLowerCase().includes('rusak')).reduce((s, i) => s + i.jumlah, 0);

        const baikPersen = totalItems > 0 ? Math.round((baikCount / totalItems) * 100) : 0;
        const rusakPersen = totalItems > 0 ? Math.round((rusakCount / totalItems) * 100) : 0;

        $('#statTotal').textContent = totalItems;
        $('#statKat').textContent = categories.size;
        $('#statBaikPersen').textContent = baikPersen + '%';
        $('#statRusakPersen').textContent = rusakPersen + '%';

        // Filter Logic
        state.filteredItems = state.items.filter(i => {
            const matchesSearch = !state.searchQuery || i.namaBarang.toLowerCase().includes(state.searchQuery) || i.noInventaris.toLowerCase().includes(state.searchQuery);
            const matchesFilter = state.activeFilter === 'all' || i.kategori === state.activeFilter;
            return matchesSearch && matchesFilter;
        });

        $('#itemCount').textContent = `${state.filteredItems.length} Data`;

        if (state.filteredItems.length === 0) {
            container.innerHTML = `<div class="col-span-full py-20 flex flex-col items-center justify-center text-slate-300">
                <i data-lucide="search-x" class="w-12 h-12 mb-4"></i>
                <p class="font-black uppercase tracking-widest text-xs">Data tidak ditemukan</p>
            </div>`;
            if (window.lucide) lucide.createIcons();
            return;
        }

        container.innerHTML = state.filteredItems.map(item => `
            <div class="bg-white rounded-[1.25rem] sm:rounded-[2.5rem] p-3.5 sm:p-6 shadow-sm border border-slate-100 relative group transition-all hover:shadow-xl hover:-translate-y-1 card-compact">
                ${item.isPending ? `
                    <div class="absolute inset-x-8 top-0 h-1 bg-amber-400 rounded-b-full animate-pulse"></div>
                ` : ''}
                
                <div class="mb-2.5 sm:mb-5">
                    <span class="inline-block px-2 py-0.5 rounded-lg bg-slate-100 text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">${item.kategori}</span>
                    <h3 class="text-sm sm:text-xl font-black text-slate-800 leading-tight mb-0.5 text-mobile-title">${item.namaBarang}</h3>
                    <p class="text-[7px] sm:text-[10px] font-bold text-slate-400 tracking-wider text-mobile-meta">${item.noInventaris}</p>
                </div>

                <div class="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-6">
                    <div class="bg-slate-50 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100/50">
                        <p class="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Kondisi</p>
                        <p class="text-[10px] sm:text-xs font-black ${getKondisiColor(item.kondisi)}">${item.kondisi}</p>
                    </div>
                    <div class="bg-slate-50 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100/50">
                        <p class="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Lokasi</p>
                        <p class="text-[10px] sm:text-xs font-black text-slate-700 truncate">${item.lokasi || '-'}</p>
                    </div>
                </div>

                <div class="flex items-center justify-between gap-2.5 sm:gap-4">
                    ${state.isAdmin ? `
                        <button onclick="window.editItem('${item.noInventaris}')" class="flex-1 bg-emerald-50 text-emerald-600 py-3.5 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95">
                            <i data-lucide="edit-3" class="w-4 h-4"></i> Edit
                        </button>
                        <button onclick="window.deleteItem('${item.noInventaris}')" class="bg-rose-50 text-rose-600 p-3.5 rounded-2xl flex items-center justify-center transition-all active:scale-90 hover:bg-rose-100">
                            <i data-lucide="trash-2" class="w-5 h-5"></i>
                        </button>
                    ` : `
                        <button onclick="window.showDetail('${item.noInventaris}')" class="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95">
                            <i data-lucide="info" class="w-4 h-4"></i> Detail
                        </button>
                    `}
                </div>
            </div>
        `).join('');

        if (window.lucide) lucide.createIcons();
    }

    function getKondisiColor(k) {
        const lower = k.toLowerCase();
        if (lower.includes('baik')) return 'text-emerald-600';
        if (lower.includes('rusak ringan')) return 'text-amber-500';
        return 'text-rose-600';
    }

    function formatRp(num) {
        if (num >= 1000000) return 'Rp ' + (num / 1000000).toFixed(1).replace('.0', '') + ' Jt';
        return 'Rp ' + num.toLocaleString('id-ID');
    }

    // =================== ACTIONS ===================
    window.editItem = (noInv) => {
        const item = state.items.find(i => i.noInventaris === noInv);
        if (!item) return;
        
        $('#modalTitle').textContent = 'Perbarui Data';
        $('#formMode').value = 'edit';
        $('#formNo').value = item.no;
        $('#formNoInv').value = item.noInventaris;
        
        $('#addNama').value = item.namaBarang;
        $('#addKategori').value = item.kategori;
        $('#addJumlah').value = item.jumlah;
        $('#addKondisi').value = item.kondisi;
        $('#addLokasi').value = item.lokasi;
        $('#addKeterangan').value = item.keterangan;
        
        $('#itemModal').classList.remove('hidden');
    };

    window.showDetail = (noInv) => {
        const item = state.items.find(i => i.noInventaris === noInv);
        if (!item) return;

        const content = $('#detailContent');
        content.innerHTML = `
            <div class="space-y-6">
                <div class="flex items-center gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <div class="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-emerald-600 shrink-0">
                        <i data-lucide="package-search" class="w-8 h-8"></i>
                    </div>
                    <div>
                        <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Nama Barang</h4>
                        <p class="text-xl font-black text-slate-800">${item.namaBarang}</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="p-5 rounded-[2rem] bg-slate-50 border border-slate-100">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Kategori</p>
                        <p class="text-sm font-black text-slate-700">${item.kategori}</p>
                    </div>
                    <div class="p-5 rounded-[2rem] bg-slate-50 border border-slate-100">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Lokasi</p>
                        <p class="text-sm font-black text-slate-700">${item.lokasi || '-'}</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="p-5 rounded-[2rem] bg-slate-50 border border-slate-100">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Kondisi</p>
                        <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase ${getKondisiColor(item.kondisi)} bg-white shadow-sm border border-slate-100 inline-block">
                            ${item.kondisi}
                        </span>
                    </div>
                    <div class="p-5 rounded-[2rem] bg-slate-50 border border-slate-100">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Jumlah</p>
                        <p class="text-sm font-black text-slate-700">${item.jumlah} Unit</p>
                    </div>
                </div>

                <div class="p-6 rounded-[2rem] bg-slate-900 text-white shadow-xl relative overflow-hidden">
                    <div class="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Nomor Inventaris</p>
                    <p class="text-lg font-black tracking-widest relative z-10">${item.noInventaris}</p>
                </div>

                ${item.keterangan ? `
                    <div class="p-6 rounded-[2rem] bg-emerald-50 border border-emerald-100">
                        <p class="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">Keterangan Tambahan</p>
                        <p class="text-sm font-bold text-slate-600 leading-relaxed">${item.keterangan}</p>
                    </div>
                ` : ''}
            </div>
        `;

        $('#detailModal').classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    };

    window.deleteItem = (noInv) => {
        const item = state.items.find(i => i.noInventaris === noInv);
        if (!confirm(`Hapus barang "${item.namaBarang}"?`)) return;
        
        state.items = state.items.filter(i => i.noInventaris !== noInv);
        renderAll();

        addToQueue('deleteItem', { action: 'deleteItem', noInventaris: noInv, password: 'adminbn2' });
        showToast('Menghapus data...', 'info');
    };

    async function submitForm() {
        const mode = $('#formMode').value;
        const data = {
            namaBarang: $('#addNama').value,
            kategori: $('#addKategori').value,
            jumlah: parseInt($('#addJumlah').value) || 1,
            kondisi: $('#addKondisi').value,
            lokasi: $('#addLokasi').value,
            keterangan: $('#addKeterangan').value
        };

        const noInv = mode === 'edit' ? $('#formNoInv').value : 'INV-' + Date.now();
        const payload = {
            action: mode === 'edit' ? 'editItem' : 'addItem',
            ...data,
            no: mode === 'edit' ? $('#formNo').value : (state.items.length + 1),
            noInventaris: noInv,
            password: 'adminbn2'
        };

        // Optimistic Update
        if (mode === 'edit') {
            const idx = state.items.findIndex(i => i.noInventaris === noInv);
            state.items[idx] = { ...state.items[idx], ...data, isPending: true };
        } else {
            state.items.push({ ...data, noInventaris: noInv, isPending: true });
        }

        renderAll();
        $('#itemModal').classList.add('hidden');
        
        addToQueue(payload.action, payload);
        showToast('Menyimpan perubahan...', 'info');
    }

    // =================== SYNC QUEUE ===================
    function addToQueue(action, payload) {
        state.syncQueue.push({ action, payload, timestamp: Date.now() });
        localStorage.setItem('inv-syncQueue', JSON.stringify(state.syncQueue));
        processSyncQueue();
    }

    async function processSyncQueue() {
        if (state.isSyncing || state.syncQueue.length === 0) return;
        state.isSyncing = true;

        const item = state.syncQueue[0];
        try {
            const res = await fetch(state.scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(item.payload)
            });
            const result = await res.json();
            
            if (result.success) {
                state.syncQueue.shift();
                localStorage.setItem('inv-syncQueue', JSON.stringify(state.syncQueue));
                
                // Clear isPending flag locally
                if (item.payload.noInventaris) {
                    const localItem = state.items.find(i => i.noInventaris === item.payload.noInventaris);
                    if (localItem) delete localItem.isPending;
                }
                
                if (state.syncQueue.length === 0) {
                    showToast('Semua data sinkron!', 'success');
                }
            }
        } catch (err) {
            console.error('Sync error', err);
        } finally {
            state.isSyncing = false;
            renderAll();
            if (state.syncQueue.length > 0) setTimeout(processSyncQueue, 1000);
        }
    }

    // =================== UTILS ===================
    function showToast(msg, type) {
        const t = document.createElement('div');
        t.className = `fixed bottom-10 left-1/2 -translate-x-1/2 px-8 py-4 rounded-3xl font-black text-white text-sm z-[200] shadow-2xl transition-all scale-0 animate-bounce-in ${type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-slate-800'}`;
        t.style.animation = 'popIn 0.3s forwards';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => {
            t.style.animation = 'popOut 0.3s forwards';
            setTimeout(() => t.remove(), 300);
        }, 3000);
    }

    // CSS for toast animation
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes popIn { from { transform: translate(-50%, 100%) scale(0.5); opacity: 0; } to { transform: translate(-50%, 0) scale(1); opacity: 1; } }
        @keyframes popOut { from { transform: translate(-50%, 0) scale(1); opacity: 1; } to { transform: translate(-50%, 100%) scale(0.5); opacity: 0; } }
    `;
    document.head.appendChild(style);

    window.onload = init;
})();
