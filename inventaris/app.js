const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR6nN2T377t118P6X7uXk8U8Y7X_f8T3u10E1v7M1W1r3v4P_f8T3u10E1v7M1W1r3v4P_f8T3u10E1v7M1W1r3v4P_f8T3u10E1v/pub?output=csv';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz_7X-N7u5e3_8_v7v9e0e-4r7v9e0e-4r7v9e0e-4r7v9e0e-4r/exec';
const ADMIN_PIN = 'adminbn2';

let state = {
    items: [],
    filteredItems: [],
    isAdmin: false,
    currentFilter: 'all',
    searchQuery: '',
    pinInput: ''
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    bindEvents();
    renderNumpad();
});

function fetchData() {
    Papa.parse(CSV_URL, {
        download: true,
        header: true,
        complete: (results) => {
            state.items = results.data.filter(i => i.namaBarang).map(i => ({...i, id: i.noInventaris}));
            applyFilter();
        }
    });
}

function bindEvents() {
    // SEARCH & FILTER
    $('#searchInput').oninput = (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        applyFilter();
    };

    $$('.filter-tab').forEach(btn => {
        btn.onclick = () => {
            $$('.filter-tab').forEach(b => b.classList.replace('bg-accent', 'bg-slate-100'));
            $$('.filter-tab').forEach(b => b.classList.replace('text-white', 'text-slate-600'));
            btn.classList.replace('bg-slate-100', 'bg-accent');
            btn.classList.replace('text-slate-600', 'text-white');
            state.currentFilter = btn.dataset.filter;
            applyFilter();
        };
    });

    // NAVIGATION
    $$('.nav-item, .mobile-nav-item').forEach(btn => {
        btn.onclick = () => {
            const page = btn.dataset.page;
            if (page === 'inventaris') {
                $('#inventoryGrid').scrollIntoView({ behavior: 'smooth' });
            }
            if (page === 'dashboard') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };
    });

    // ADMIN ACTIONS
    $('#mobileAddBtn').onclick = () => showItemForm();
    $('#refreshBtn').onclick = () => fetchData();
    $('#authSubmit').onclick = () => validatePIN();

    // CLOSE MODALS
    $('#modalBackdrop').onclick = () => {
        hideAuth();
        hideItemForm();
        hideDetail();
    };
}

function applyFilter() {
    state.filteredItems = state.items.filter(item => {
        const matchesSearch = item.namaBarang.toLowerCase().includes(state.searchQuery) || 
                             item.noInventaris.toLowerCase().includes(state.searchQuery);
        const matchesFilter = state.currentFilter === 'all' || item.kategori === state.currentFilter;
        return matchesSearch && matchesFilter;
    });
    renderAll();
}

function renderAll() {
    updateStats();
    const container = $('#inventoryGrid');
    
    if (state.filteredItems.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 font-bold">Tidak ada barang ditemukan.</div>`;
        return;
    }

    container.innerHTML = state.filteredItems.map(item => `
        <div onclick="showDetail('${item.id}')" class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]">
            <div class="flex flex-col gap-4">
                <div>
                    <span class="inline-block px-3 py-1 rounded-full bg-slate-100 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">${item.kategori}</span>
                    <h3 class="text-[18px] font-black text-slate-800 leading-tight">${item.namaBarang}</h3>
                    <p class="text-[13px] font-bold text-slate-400 mt-1">${item.noInventaris}</p>
                </div>
                
                <div class="flex items-center justify-between border-t border-slate-50 pt-4">
                    <div class="flex items-center gap-2">
                        <i data-lucide="map-pin" class="w-4 h-4 text-slate-300"></i>
                        <span class="text-[14px] font-bold text-slate-600">${item.lokasi || '-'}</span>
                    </div>
                    <span class="px-4 py-1.5 rounded-full text-[12px] font-black uppercase tracking-wider ${getBadgeStyle(item.kondisi)}">
                        ${item.kondisi}
                    </span>
                </div>

                ${state.isAdmin ? `
                    <div class="flex gap-2 pt-2">
                        <button onclick="event.stopPropagation(); showItemForm('${item.id}')" class="flex-1 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2">
                            <i data-lucide="edit-3" class="w-4 h-4"></i> EDIT
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');

    lucide.createIcons();
}

function updateStats() {
    const total = state.items.length;
    const baik = state.items.filter(i => i.kondisi === 'Baik').length;
    const rusak = state.items.filter(i => i.kondisi === 'Rusak').length;
    const kats = new Set(state.items.map(i => i.kategori)).size;

    $('#statTotal').innerText = total;
    $('#statKat').innerText = kats;
    $('#statBaik').innerText = total ? Math.round((baik/total)*100) + '%' : '0%';
    $('#statRusak').innerText = total ? Math.round((rusak/total)*100) + '%' : '0%';
}

function getBadgeStyle(kondisi) {
    if (kondisi === 'Baik') return 'bg-emerald-50 text-emerald-600';
    if (kondisi === 'Rusak Ringan') return 'bg-amber-50 text-amber-600';
    return 'bg-rose-50 text-rose-600';
}

// DETAIL PANEL (BOTTOM SHEET)
function showDetail(id) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;

    const content = `
        <div class="space-y-6">
            <div class="flex items-center gap-4 border-b border-slate-100 pb-6">
                <div class="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-100">
                    <i data-lucide="package-search" class="w-7 h-7"></i>
                </div>
                <div>
                    <h4 class="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-1">Nama Barang</h4>
                    <p class="text-xl font-black text-slate-800 leading-tight">${item.namaBarang}</p>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="p-5 bg-slate-50 rounded-2xl">
                    <p class="text-[12px] font-bold text-slate-400 uppercase mb-2">Kategori</p>
                    <p class="text-[16px] font-black text-slate-800">${item.kategori}</p>
                </div>
                <div class="p-5 bg-slate-50 rounded-2xl">
                    <p class="text-[12px] font-bold text-slate-400 uppercase mb-2">Jumlah</p>
                    <p class="text-[16px] font-black text-slate-800">${item.jumlah} Unit</p>
                </div>
            </div>

            <div class="p-5 bg-slate-50 rounded-2xl">
                <p class="text-[12px] font-bold text-slate-400 uppercase mb-2">Lokasi Penyimpanan</p>
                <div class="flex items-center gap-2">
                    <i data-lucide="map-pin" class="w-5 h-5 text-accent"></i>
                    <p class="text-[16px] font-black text-slate-800">${item.lokasi || '-'}</p>
                </div>
            </div>

            <div class="p-6 bg-navy rounded-2xl text-white relative overflow-hidden">
                <div class="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                <p class="text-[12px] font-black text-slate-500 uppercase tracking-widest mb-2 relative z-10">No. Inventaris</p>
                <p class="text-[18px] font-black tracking-widest relative z-10">${item.noInventaris}</p>
            </div>

            <div class="pt-2">
                <button onclick="hideDetail()" class="w-full py-5 bg-slate-100 rounded-2xl font-black text-slate-500 uppercase tracking-widest text-xs touch-target">Tutup Panel</button>
            </div>
        </div>
    `;

    if (window.innerWidth < 768) {
        $('#sheetContent').innerHTML = content;
        $('#detailSheet').classList.add('sheet-active');
        $('#modalBackdrop').classList.remove('hidden');
    } else {
        $('#modalContent').innerHTML = content;
        $('#detailModal').classList.remove('hidden');
        $('#modalBackdrop').classList.remove('hidden');
    }
    lucide.createIcons();
}

function hideDetail() {
    $('#detailSheet').classList.remove('sheet-active');
    $('#detailModal').classList.add('hidden');
    $('#modalBackdrop').classList.add('hidden');
}

// AUTH LOGIC (NUMPAD)
function renderNumpad() {
    const container = $('#authModal .grid');
    if (!container) return;
    
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];
    container.innerHTML = keys.map(k => `
        <button onclick="handlePin('${k}')" class="h-16 bg-slate-800 text-white rounded-2xl text-2xl font-black active:bg-accent transition-all touch-target">
            ${k}
        </button>
    `).join('');
}

function handlePin(key) {
    if (key === 'C') state.pinInput = '';
    else if (key === '⌫') state.pinInput = state.pinInput.slice(0, -1);
    else if (state.pinInput.length < 4) state.pinInput += key;
    
    updatePinDots();
}

function updatePinDots() {
    const dots = $$('.pin-dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i < state.pinInput.length);
    });
}

function validatePIN() {
    if (state.pinInput === '1234' || state.pinInput === ADMIN_PIN) { // Example PIN
        state.isAdmin = true;
        hideAuth();
        renderAll();
        alert('Mode Admin Aktif');
    } else {
        state.pinInput = '';
        updatePinDots();
        alert('PIN Salah!');
    }
}

function showAuth() {
    $('#authModal').classList.remove('hidden');
    state.pinInput = '';
    updatePinDots();
}

function hideAuth() {
    $('#authModal').classList.add('hidden');
}

// FORM LOGIC
function showItemForm(id = null) {
    // Basic implementation for now
    $('#itemModal').classList.remove('hidden');
    $('#modalBackdrop').classList.remove('hidden');
    if (id) {
        const item = state.items.find(i => i.id === id);
        $('#formTitle').innerText = 'Edit Barang';
        $('#formId').value = item.id;
        $('#inputNama').value = item.namaBarang;
        // fill other fields...
    } else {
        $('#formTitle').innerText = 'Tambah Barang Baru';
        $('#itemForm').reset();
        $('#formId').value = '';
    }
}

function hideItemForm() {
    $('#itemModal').classList.add('hidden');
    $('#modalBackdrop').classList.add('hidden');
}
