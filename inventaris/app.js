/* ========================================
   INVENTARIS PERUMAHAN BN2 - APP.JS (Senior Friendly)
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
        syncQueue: [],
        isSyncing: false,
    };

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // =================== INIT ===================
    async function init() {
        loadSettings();
        bindEvents();
        
        if (localStorage.getItem('inv-isAdmin') === 'true') {
            state.isAdmin = true;
            updateAdminUI();
        }

        if (state.sheetUrl) {
            await fetchData();
        }
        
        setInterval(processSyncQueue, 10000);
        if (window.lucide) lucide.createIcons();
    }

    function loadSettings() {
        state.sheetUrl = localStorage.getItem('inv-sheetUrl') || DEFAULT_SHEET_URL;
        state.scriptUrl = localStorage.getItem('inv-scriptUrl') || DEFAULT_SCRIPT_URL;
        
        const savedQueue = localStorage.getItem('inv-syncQueue');
        if (savedQueue) state.syncQueue = JSON.parse(savedQueue);
    }

    function bindEvents() {
        $('#refreshBtn').onclick = fetchData;
        $('#adminBtn').onclick = () => $('#authModal').classList.remove('hidden');
        $('#authClose').onclick = () => $('#authModal').classList.add('hidden');
        $('#authSubmit').onclick = performLogin;
        
        $('#searchInput').oninput = (e) => {
            state.searchQuery = e.target.value.toLowerCase();
            renderAll();
        };

        $$('.filter-tab').forEach(tab => {
            tab.onclick = () => {
                $$('.filter-tab').forEach(t => t.classList.remove('active-tab'));
                tab.classList.add('active-tab');
                state.activeFilter = tab.dataset.filter;
                renderAll();
            };
        });

        $('#addBtn').onclick = () => {
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
            updateAdminUI();
            showToast('Login Berhasil!', 'success');
        } else {
            showToast('Password Salah!', 'error');
        }
    }

    function updateAdminUI() {
        if (state.isAdmin) {
            $('#adminBadge').classList.remove('hidden');
            $('#adminActions').classList.remove('hidden');
            $('#adminBtn').innerHTML = '<i data-lucide="unlock" class="w-5 h-5"></i>';
        } else {
            $('#adminBadge').classList.add('hidden');
            $('#adminActions').classList.add('hidden');
            $('#adminBtn').innerHTML = '<i data-lucide="lock" class="w-5 h-5"></i>';
        }
        if (window.lucide) lucide.createIcons();
        renderAll();
    }

    // =================== DATA FETCH ===================
    async function fetchData() {
        const icon = $('#refreshBtn i');
        icon?.classList.add('animate-spin');

        try {
            const response = await fetch(state.sheetUrl);
            const csv = await response.text();
            
            Papa.parse(csv, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    state.items = results.data.map((row, idx) => ({
                        no: row.NO || (idx + 1),
                        namaBarang: row['NAMA BARANG'] || '',
                        noInventaris: row['NO INVENTARIS'] || '',
                        kategori: row.KATEGORI || '',
                        merkType: row['MERK/TYPE'] || '',
                        tahunPerolehan: row['TAHUN PEROLEHAN'] || '',
                        jumlah: parseInt(row.JUMLAH) || 0,
                        hargaSatuan: parseInt(row['HARGA SATUAN']?.replace(/\D/g, '')) || 0,
                        kondisi: row.KONDISI || 'Baik',
                        lokasi: row.LOKASI || '',
                        dokumentasi: row.DOKUMENTASI || '',
                        keterangan: row.KETERANGAN || ''
                    })).filter(i => i.namaBarang);
                    renderAll();
                }
            });
        } catch (err) {
            showToast('Gagal memuat data!', 'error');
        } finally {
            icon?.classList.remove('animate-spin');
        }
    }

    // =================== RENDERING ===================
    function renderAll() {
        const container = $('#inventoryContainer');
        
        // Stats
        $('#statTotalBarang').textContent = state.items.reduce((s, i) => s + i.jumlah, 0);
        $('#statKondisiBaik').textContent = state.items.filter(i => i.kondisi === 'Baik').length + ' Item';
        const totalNilai = state.items.reduce((s, i) => s + (i.jumlah * i.hargaSatuan), 0);
        $('#statTotalNilai').textContent = 'Rp ' + totalNilai.toLocaleString('id-ID');

        // Filter
        state.filteredItems = state.items.filter(i => {
            const matchesSearch = !state.searchQuery || i.namaBarang.toLowerCase().includes(state.searchQuery);
            const matchesFilter = state.activeFilter === 'all' || i.kategori === state.activeFilter;
            return matchesSearch && matchesFilter;
        });

        if (state.filteredItems.length === 0) {
            container.innerHTML = `<div class="text-center py-20 text-slate-400 font-bold">Data tidak ditemukan</div>`;
            return;
        }

        container.innerHTML = state.filteredItems.map(item => `
            <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 relative overflow-hidden group active:scale-[0.98] transition-all">
                ${item.isPending ? `
                    <div class="absolute top-0 right-0 left-0 h-1 bg-amber-400 animate-pulse"></div>
                    <div class="absolute top-3 right-3 flex items-center gap-1 bg-amber-100 text-amber-600 px-2 py-1 rounded-full text-[8px] font-black uppercase">
                        <i data-lucide="refresh-cw" class="w-2 h-2 animate-spin"></i> Pending
                    </div>
                ` : ''}
                
                <div class="flex justify-between items-start mb-3">
                    <div class="flex-1">
                        <h3 class="text-xl font-extrabold text-slate-800 leading-tight">${item.namaBarang}</h3>
                        <p class="text-[10px] font-black text-slate-400 tracking-widest uppercase">${item.noInventaris}</p>
                    </div>
                    <span class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase ${getKondisiStyle(item.kondisi)}">
                        ${item.kondisi}
                    </span>
                </div>

                <div class="grid grid-cols-2 gap-3 mb-4">
                    <div class="bg-slate-50 p-3 rounded-2xl">
                        <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Lokasi</p>
                        <p class="text-xs font-bold text-slate-700">${item.lokasi || '-'}</p>
                    </div>
                    <div class="bg-slate-50 p-3 rounded-2xl">
                        <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Jumlah</p>
                        <p class="text-xs font-bold text-slate-700">${item.jumlah} Unit</p>
                    </div>
                </div>

                ${state.isAdmin ? `
                    <div class="flex gap-2 border-t border-slate-50 pt-4 mt-2">
                        <button onclick="window.editItem('${item.noInventaris}')" class="flex-1 bg-blue-50 text-blue-600 py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase transition-all active:bg-blue-100">
                            <i data-lucide="edit-3" class="w-4 h-4"></i> Edit
                        </button>
                        <button onclick="window.deleteItem('${item.noInventaris}')" class="flex-1 bg-rose-50 text-rose-600 py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase transition-all active:bg-rose-100">
                            <i data-lucide="trash-2" class="w-4 h-4"></i> Hapus
                        </button>
                    </div>
                ` : `
                     <button onclick="window.showDetail('${item.noInventaris}')" class="w-full bg-slate-50 text-slate-600 py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase transition-all active:bg-slate-100">
                        <i data-lucide="eye" class="w-4 h-4"></i> Lihat Detail
                    </button>
                `}
            </div>
        `).join('');

        if (window.lucide) lucide.createIcons();
    }

    function getKondisiStyle(k) {
        if (k === 'Baik') return 'bg-emerald-100 text-emerald-600';
        if (k.includes('Rusak Ringan')) return 'bg-amber-100 text-amber-600';
        return 'bg-rose-100 text-rose-600';
    }

    // =================== ACTIONS ===================
    window.editItem = (noInv) => {
        const item = state.items.find(i => i.noInventaris === noInv);
        if (!item) return;
        
        $('#modalTitle').textContent = 'Edit Barang';
        $('#formMode').value = 'edit';
        $('#formNo').value = item.no;
        $('#formNoInv').value = item.noInventaris;
        
        $('#addNama').value = item.namaBarang;
        $('#addKategori').value = item.kategori;
        $('#addJumlah').value = item.jumlah;
        $('#addKondisi').value = item.kondisi;
        $('#addLokasi').value = item.lokasi;
        $('#addHarga').value = item.hargaSatuan;
        $('#addKeterangan').value = item.keterangan;
        
        $('#itemModal').classList.remove('hidden');
    };

    window.deleteItem = async (noInv) => {
        if (!confirm('Yakin ingin menghapus barang ini?')) return;
        
        const item = state.items.find(i => i.noInventaris === noInv);
        state.items = state.items.filter(i => i.noInventaris !== noInv);
        renderAll();

        addToQueue('deleteItem', { action: 'deleteItem', noInventaris: noInv, password: 'adminbn2' });
        showToast('Menghapus data di latar belakang...', 'info');
    };

    async function submitForm() {
        const mode = $('#formMode').value;
        const data = {
            namaBarang: $('#addNama').value,
            kategori: $('#addKategori').value,
            jumlah: parseInt($('#addJumlah').value),
            kondisi: $('#addKondisi').value,
            lokasi: $('#addLokasi').value,
            harga: parseInt($('#addHarga').value) || 0,
            keterangan: $('#addKeterangan').value
        };

        const noInv = mode === 'edit' ? $('#formNoInv').value : 'NEW-' + Date.now();
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
        showToast('Menyimpan data di latar belakang...', 'info');
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
                
                // Clear isPending in local state
                if (item.payload.noInventaris) {
                    const localItem = state.items.find(i => i.noInventaris === item.payload.noInventaris);
                    if (localItem) delete localItem.isPending;
                }
                
                if (state.syncQueue.length === 0) {
                    showToast('Semua data sinkron!', 'success');
                }
            }
        } catch (err) {
            console.error('Sync Error', err);
        } finally {
            state.isSyncing = false;
            renderAll();
            if (state.syncQueue.length > 0) setTimeout(processSyncQueue, 1000);
        }
    }

    // =================== UTILS ===================
    function showToast(msg, type) {
        const t = document.createElement('div');
        t.className = `fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl font-black text-white text-xs z-[200] shadow-2xl transition-all ${type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-rose-500' : 'bg-blue-500'}`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }

    window.onload = init;
})();
