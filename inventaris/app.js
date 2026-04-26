const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQfPsk4L2qxshegLjX6zTdY4mPv0e4xYFqbzYFKgqwHJrMuSXAeDJuIFAhdyK2vi4SwyJ2HXZX4h0un/pub?gid=0&single=true&output=csv';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxSb3F1apIZ1TGxKC2v5BinPsWE2DTRA843kILk0NtQcwealsRHLaB3yfodJtTkVrhV/exec';
const ADMIN_PIN = '1122';

let state = {
    items: [],
    filteredItems: [],
    isAdmin: false,
    searchQuery: '',
    filters: {
        kategori: [],
        kondisi: [],
        lokasi: []
    },
    sortBy: 'newest', // newest, oldest, az, za, broken_first
    currentPage: 1,
    itemsPerPage: 6,
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

async function fetchData() {
    $('#inventoryGrid').innerHTML = '<div class="py-20 text-center"><i data-lucide="loader-2" class="w-10 h-10 animate-spin mx-auto mb-4 text-[#1DA874]"></i><p class="font-bold text-slate-400">Memuat data...</p></div>';
    lucide.createIcons();

    Papa.parse(CSV_URL, {
        download: true,
        header: true,
        complete: (results) => {
            state.items = results.data
                .filter(i => i.namaBarang || i['NAMA BARANG'])
                .map(i => ({
                    id: i.noInventaris || i['NO INVENTARIS'],
                    noInventaris: i.noInventaris || i['NO INVENTARIS'],
                    namaBarang: i.namaBarang || i['NAMA BARANG'],
                    kategori: i.kategori || i['KATEGORI'],
                    jumlah: i.jumlah || i['JUMLAH'],
                    kondisi: i.kondisi || i['KONDISI'],
                    lokasi: i.lokasi || i['LOKASI'],
                    keterangan: i.keterangan || i['KETERANGAN'],
                    createdAt: extractTimestamp(i.noInventaris || i['NO INVENTARIS'])
                }));
            populateFilterOptions();
            applyLogic();
        }
    });
}

function extractTimestamp(code) {
    if (!code) return 0;
    const match = code.match(/BN2-(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

function bindEvents() {
    // SEARCH
    $('#searchInput').oninput = (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        state.currentPage = 1;
        applyLogic();
    };

    // SHEET TOGGLES
    $('#filterBtn').onclick = () => openSheet('filterSheet');
    $('#sortBtn').onclick = () => openSheet('sortSheet');
    $('#sheetOverlay').onclick = closeAllSheets;

    // FILTER ACTIONS
    $('#applyFilterBtn').onclick = () => {
        closeAllSheets();
        applyLogic();
    };
    $('#resetFilterBtn').onclick = () => {
        state.filters = { kategori: [], kondisi: [], lokasi: [] };
        updateFilterChips();
        applyLogic();
    };
    $('#clearFiltersBtn').onclick = () => {
        state.filters = { kategori: [], kondisi: [], lokasi: [] };
        state.searchQuery = '';
        $('#searchInput').value = '';
        applyLogic();
    };

    // NAV
    $$('[data-page]').forEach(btn => {
        btn.onclick = () => {
            if (btn.dataset.page === 'inventaris') {
                $('#inventoryGrid').scrollIntoView({ behavior: 'smooth' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };
    });

    // ADMIN
    $('#mobileSettingsBtn').onclick = showAuth;
    $('#mobileAddBtn').onclick = () => showItemForm();
}

// LOGIC: FILTER & SORT
function applyLogic() {
    let results = [...state.items];

    // Search
    if (state.searchQuery) {
        results = results.filter(i => 
            i.namaBarang.toLowerCase().includes(state.searchQuery) || 
            i.noInventaris.toLowerCase().includes(state.searchQuery)
        );
    }

    // Filter
    if (state.filters.kategori.length) results = results.filter(i => state.filters.kategori.includes(i.kategori));
    if (state.filters.kondisi.length) results = results.filter(i => state.filters.kondisi.includes(i.kondisi));
    if (state.filters.lokasi.length) results = results.filter(i => state.filters.lokasi.includes(i.lokasi));

    // Sort
    if (state.sortBy === 'newest') results.sort((a, b) => b.createdAt - a.createdAt);
    else if (state.sortBy === 'oldest') results.sort((a, b) => a.createdAt - b.createdAt);
    else if (state.sortBy === 'az') results.sort((a, b) => a.namaBarang.localeCompare(b.namaBarang));
    else if (state.sortBy === 'za') results.sort((a, b) => b.namaBarang.localeCompare(a.namaBarang));
    else if (state.sortBy === 'broken_first') {
        const order = { 'Rusak': 0, 'Rusak Ringan': 1, 'Baik': 2 };
        results.sort((a, b) => (order[a.kondisi] ?? 9) - (order[b.kondisi] ?? 9));
    }

    state.filteredItems = results;
    updateActiveFilterBar();
    renderAll();
}

function renderAll() {
    updateStats();
    const container = $('#inventoryGrid');
    
    // Pagination
    const totalPages = Math.ceil(state.filteredItems.length / state.itemsPerPage);
    const start = (state.currentPage - 1) * state.itemsPerPage;
    const paginated = state.filteredItems.slice(start, start + state.itemsPerPage);

    if (paginated.length === 0) {
        container.innerHTML = '<div class="py-10 text-center text-slate-400 font-medium">Data tidak ditemukan</div>';
        $('#paginationContainer').innerHTML = '';
        return;
    }

    container.innerHTML = paginated.map(item => {
        const isNew = (Date.now() - item.createdAt) < (7 * 24 * 60 * 60 * 1000);
        const badge = getBadgeStyle(item.kondisi);
        const hasCode = item.noInventaris && item.noInventaris !== '-';

        return `
            <div class="bg-white rounded-[18px] p-5 border border-slate-100 shadow-sm space-y-4">
                <!-- TOP ROW -->
                <div class="flex justify-between items-start gap-4">
                    <div class="flex items-center gap-2 min-w-0">
                        <h3 class="text-[15px] font-bold text-slate-800 leading-tight truncate">${item.namaBarang}</h3>
                        ${isNew ? '<span class="bg-[#1DA874]/15 text-[#1DA874] text-[9px] font-bold px-2 py-0.5 rounded-full">Baru</span>' : ''}
                    </div>
                    <span class="px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${badge.bg} ${badge.text}">
                        ${item.kondisi}
                    </span>
                </div>

                <!-- MIDDLE ROW -->
                <div class="flex justify-between items-end gap-3">
                    <div class="flex-1 min-w-0">
                        <p class="text-[11px] font-medium text-slate-400 leading-none">
                            ${hasCode ? `${item.noInventaris} <span class="mx-1 text-slate-200">·</span>` : ''} 
                            <span class="text-slate-700 font-bold">${item.jumlah} unit</span>
                        </p>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <div class="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                        <span class="text-[11px] font-bold text-slate-400">${item.lokasi || '-'}</span>
                    </div>
                </div>

                <!-- BOTTOM ROW (ACTIONS) -->
                ${state.isAdmin ? `
                    <div class="flex justify-end gap-2.5 pt-1.5 border-t border-slate-50">
                        <button onclick="showItemForm('${item.id}')" class="w-10 h-10 rounded-xl bg-[#E1F5EE] text-[#0F6E56] flex items-center justify-center transition-all active:scale-90">
                            <i data-lucide="pencil" class="w-[18px] h-[18px]"></i>
                        </button>
                        <button onclick="deleteItem('${item.id}')" class="w-10 h-10 rounded-xl bg-[#FCEBEB] text-[#A32D2D] flex items-center justify-center transition-all active:scale-90">
                            <i data-lucide="trash-2" class="w-[18px] h-[18px]"></i>
                        </button>
                        <button onclick="alert('Cetak QR: ${item.id}')" class="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center transition-all active:scale-90">
                            <i data-lucide="qr-code" class="w-[18px] h-[18px]"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    renderPagination(totalPages);
    lucide.createIcons();
}

function getBadgeStyle(kondisi) {
    if (kondisi === 'Baik') return { bg: 'bg-[#E1F5EE]', text: 'text-[#0F6E56]' };
    if (kondisi === 'Rusak Ringan') return { bg: 'bg-[#FAEEDA]', text: 'text-[#854F0B]' };
    if (kondisi === 'Rusak') return { bg: 'bg-[#FCEBEB]', text: 'text-[#A32D2D]' };
    return { bg: 'bg-slate-100', text: 'text-slate-500' };
}

// FILTERS & SHEETS
function populateFilterOptions() {
    const kats = ['Semua', ...new Set(state.items.map(i => i.kategori))];
    const kondisis = ['Semua', 'Baik', 'Rusak Ringan', 'Rusak'];
    const lokasis = ['Semua', ...new Set(state.items.map(i => i.lokasi))];

    renderChips('filterKategoriChips', kats, 'kategori');
    renderChips('filterKondisiChips', kondisis, 'kondisi');
    renderChips('filterLokasiChips', lokasis, 'lokasi');
    renderSortOptions();
}

function renderChips(id, options, type) {
    $(`#${id}`).innerHTML = options.map(opt => {
        const isActive = opt === 'Semua' ? state.filters[type].length === 0 : state.filters[type].includes(opt);
        return `<button onclick="toggleChip('${type}', '${opt}')" class="filter-chip ${isActive ? 'active' : ''}">${opt}</button>`;
    }).join('');
}

function toggleChip(type, val) {
    if (val === 'Semua') {
        state.filters[type] = [];
    } else {
        const idx = state.filters[type].indexOf(val);
        if (idx > -1) state.filters[type].splice(idx, 1);
        else state.filters[type].push(val);
    }
    updateFilterChips();
}

function updateFilterChips() {
    populateFilterOptions();
}

function renderSortOptions() {
    const opts = [
        { id: 'newest', label: 'Terbaru ditambahkan' },
        { id: 'oldest', label: 'Terlama ditambahkan' },
        { id: 'az', label: 'Nama A–Z' },
        { id: 'za', label: 'Nama Z–A' },
        { id: 'broken_first', label: 'Kondisi rusak dulu' }
    ];
    $('#sortOptions').innerHTML = opts.map(opt => `
        <button onclick="setSort('${opt.id}')" class="w-full flex items-center justify-between py-4 group">
            <span class="text-[14px] font-medium ${state.sortBy === opt.id ? 'text-[#1DA874]' : 'text-slate-600'}">${opt.label}</span>
            <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center ${state.sortBy === opt.id ? 'border-[#1DA874]' : 'border-slate-200'}">
                ${state.sortBy === opt.id ? '<div class="w-2.5 h-2.5 bg-[#1DA874] rounded-full"></div>' : ''}
            </div>
        </button>
    `).join('');
}

function setSort(id) {
    state.sortBy = id;
    closeAllSheets();
    applyLogic();
}

function updateActiveFilterBar() {
    const active = [];
    if (state.filters.kategori.length) active.push(...state.filters.kategori);
    if (state.filters.kondisi.length) active.push(...state.filters.kondisi);
    if (state.filters.lokasi.length) active.push(...state.filters.lokasi);

    const bar = $('#filterActiveBar');
    const btn = $('#filterBtn');

    if (active.length) {
        bar.classList.remove('hidden');
        $('#activeFilterText').innerText = `Aktif: ${active.join(' · ')}`;
        btn.classList.add('bg-[#1DA874]', 'text-white');
    } else {
        bar.classList.add('hidden');
        btn.classList.remove('bg-[#1DA874]', 'text-white');
    }
}

// UI HELPERS
function openSheet(id) {
    $(`#${id}`).classList.add('active');
    $('#sheetOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAllSheets() {
    $$('.bottom-sheet').forEach(s => s.classList.remove('active'));
    $('#sheetOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function updateStats() {
    const total = state.items.length;
    const baik = state.items.filter(i => i.kondisi === 'Baik').length;
    const rusak = state.items.filter(i => i.kondisi === 'Rusak' || i.kondisi === 'Rusak Ringan').length;
    $('#statTotal').innerText = total;
    $('#statKat').innerText = new Set(state.items.map(i => i.kategori)).size;
    $('#statBaik').innerText = total ? Math.round((baik/total)*100) + '%' : '0%';
    $('#statRusak').innerText = total ? Math.round((rusak/total)*100) + '%' : '0%';
}

function renderPagination(totalPages) {
    const container = $('#paginationContainer');
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    container.innerHTML = `
        <button onclick="changePage(-1)" ${state.currentPage === 1 ? 'disabled' : ''} class="pagination-btn flex items-center gap-2 text-[11px] font-bold text-slate-400 disabled:opacity-20">
            <i data-lucide="chevron-left" class="w-4 h-4"></i> Sebelumnya
        </button>
        <span class="text-[11px] font-bold text-slate-800">Halaman ${state.currentPage} / ${totalPages}</span>
        <button onclick="changePage(1)" ${state.currentPage === totalPages ? 'disabled' : ''} class="pagination-btn flex items-center gap-2 text-[11px] font-bold text-[#1DA874] disabled:opacity-20">
            Selanjutnya <i data-lucide="chevron-right" class="w-4 h-4"></i>
        </button>
    `;
}

function changePage(delta) {
    state.currentPage += delta;
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ADMIN AUTH (NUMPAD)
function showAuth() {
    $('#authModal').classList.remove('hidden');
    state.pinInput = '';
    updatePinDots();
}

function hideAuth() { $('#authModal').classList.add('hidden'); }

function renderNumpad() {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];
    $('#numpad').innerHTML = keys.map(k => `
        <button onclick="handlePin('${k}')" class="h-16 bg-slate-800 text-white rounded-2xl text-2xl font-bold active:bg-[#1DA874] transition-colors">${k}</button>
    `).join('');
}

function handlePin(key) {
    if (key === 'C') state.pinInput = '';
    else if (key === '⌫') state.pinInput = state.pinInput.slice(0, -1);
    else if (state.pinInput.length < 4) state.pinInput += key;
    updatePinDots();
    if (state.pinInput.length === 4) validatePIN();
}

function updatePinDots() {
    $$('#pinDots div').forEach((dot, i) => {
        dot.className = `w-5 h-5 rounded-full border-2 transition-all duration-200 ${i < state.pinInput.length ? 'bg-[#1DA874] border-[#1DA874]' : 'border-slate-700'}`;
    });
}

function validatePIN() {
    if (state.pinInput === ADMIN_PIN) {
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

// CRUD STUBS (Keep existing IDs)
function showItemForm(id = null) { alert('Formulir Barang (Tambah/Edit) akan muncul di sini'); }
function deleteItem(id) { if (confirm('Hapus barang ini?')) alert('Barang dihapus'); }
