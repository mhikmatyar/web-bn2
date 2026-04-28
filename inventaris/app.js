const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQfPsk4L2qxshegLjX6zTdY4mPv0e4xYFqbzYFKgqwHJrMuSXAeDJuIFAhdyK2vi4SwyJ2HXZX4h0un/pub?gid=0&single=true&output=csv';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwx9SAlhLZnSM8V43sIJpf84B28-x6ErVQTOInKU1ZGoabTXZKWQOTftjViMuxuM62E/exec';
const ADMIN_PASS = 'adminbn2';

let state = {
    items: [],
    filteredItems: [],
    isAdmin: false,
    searchQuery: '',
    filters: { kategori: [], kondisi: [], lokasi: [] },
    sortBy: 'newest',
    currentPage: 1,
    itemsPerPage: 6,
    pinInput: ''
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    console.log('App started. Admin status:', localStorage.getItem('bn2-isAdmin'));
    if (localStorage.getItem('bn2-isAdmin') === 'true') {
        state.isAdmin = true;
    }
    fetchData();
    bindEvents();
    updateAdminUI();
});

// Globalize for HTML onclicks
window.showAuth = showAuth;
window.handleLogin = handleLogin;
window.hideAuth = hideAuth;
window.handleLogout = handleLogout;
window.closeLogoutModal = closeLogoutModal;
window.printQR = printQR;
window.printAllQR = printAllQR;

async function fetchData() {
    $('#inventoryGrid').innerHTML = '<div class="py-20 text-center"><i data-lucide="loader-2" class="w-10 h-10 animate-spin mx-auto mb-4 text-[#1DA874]"></i><p class="font-bold text-slate-400">Memuat data...</p></div>';
    lucide.createIcons();

    Papa.parse(CSV_URL, {
        download: true,
        header: true,
        complete: (results) => {
            state.items = results.data
                .filter(i => i.namaBarang || i['NAMA BARANG'])
                .map((i, idx) => ({
                    id: i.noInventaris || i['NO INVENTARIS'],
                    noInventaris: i.noInventaris || i['NO INVENTARIS'],
                    namaBarang: i.namaBarang || i['NAMA BARANG'],
                    kategori: i.kategori || i['KATEGORI'],
                    jumlah: i.jumlah || i['JUMLAH'],
                    kondisi: i.kondisi || i['KONDISI'],
                    lokasi: i.lokasi || i['LOKASI'],
                    keterangan: i.keterangan || i['KETERANGAN'],
                    foto: i.dokumentasi || i['DOKUMENTASI'] || i.foto || i['FOTO'], // Read from DOKUMENTASI
                    rowIdx: idx, // Keep track of original order
                    createdAt: extractTimestamp(i.noInventaris || i['NO INVENTARIS']) || idx
                }));
            populateFilterOptions();
            applyLogic();

            const urlParams = new URLSearchParams(window.location.search);
            const itemId = urlParams.get('id');
            if (itemId) {
                setTimeout(() => showDetail(itemId), 500);
            }
        }
    });
}

function extractTimestamp(code) {
    if (!code) return 0;
    const match = code.match(/BN2-(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

function bindEvents() {
    $('#searchInput').oninput = (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        state.currentPage = 1;
        applyLogic();
    };

    $('#filterBtn').onclick = () => openSheet('filterSheet');
    $('#sortBtn').onclick = () => openSheet('sortSheet');
    $('#sheetOverlay').onclick = closeAllSheets;
    $('#applyFilterBtn').onclick = () => { closeAllSheets(); applyLogic(); };
    $('#resetFilterBtn').onclick = () => { state.filters = { kategori: [], kondisi: [], lokasi: [] }; updateFilterChips(); applyLogic(); };
    $('#clearFiltersBtn').onclick = () => { state.filters = { kategori: [], kondisi: [], lokasi: [] }; state.searchQuery = ''; $('#searchInput').value = ''; applyLogic(); };

    $$('[data-page]').forEach(btn => {
        btn.onclick = () => {
            if (btn.dataset.page === 'inventaris') $('#inventoryGrid').scrollIntoView({ behavior: 'smooth' });
            else window.scrollTo({ top: 0, behavior: 'smooth' });
        };
    });

    const addBtn = $('#mobileAddBtn');
    if (addBtn) addBtn.onclick = () => showItemForm();
    
    const form = $('#itemForm');
    if (form) form.onsubmit = (e) => { e.preventDefault(); saveItem(); };
    
    const fileInput = $('#inputFileFoto');
    if (fileInput) fileInput.onchange = handleFotoUpload;

    // Auth Modal Events
    const confirmAuthBtn = $('#confirmAuthBtn');
    if (confirmAuthBtn) confirmAuthBtn.onclick = handleLogin;
    
    const closeAuthBtn = $('#closeAuthBtn');
    if (closeAuthBtn) closeAuthBtn.onclick = hideAuth;
}

function handleFotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    $('#fotoFileName').innerText = 'Memproses...';
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxSize = 1024; // Increased size since it now goes to Drive, not direct to Sheets

            if (width > height) {
                if (width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.85); // Increased quality
            
            const inputFotoBase64 = $('#inputFotoBase64');
            if (inputFotoBase64) inputFotoBase64.value = dataUrl;
            
            const fotoPreview = $('#fotoPreview');
            if (fotoPreview) fotoPreview.src = dataUrl;
            
            const fotoPreviewContainer = $('#fotoPreviewContainer');
            if (fotoPreviewContainer) fotoPreviewContainer.classList.remove('hidden');
            
            const fotoFileName = $('#fotoFileName');
            if (fotoFileName) fotoFileName.innerText = 'Foto Siap (' + Math.round(dataUrl.length/1024) + 'kb)';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// LOGIC
function applyLogic() {
    let results = [...state.items];
    if (state.searchQuery) {
        results = results.filter(i => i.namaBarang.toLowerCase().includes(state.searchQuery) || i.noInventaris.toLowerCase().includes(state.searchQuery));
    }
    if (state.filters.kategori.length) results = results.filter(i => state.filters.kategori.includes(i.kategori));
    if (state.filters.kondisi.length) results = results.filter(i => state.filters.kondisi.includes(i.kondisi));
    if (state.filters.lokasi.length) results = results.filter(i => state.filters.lokasi.includes(i.lokasi));

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
            <div onclick="showDetail('${item.id}')" class="bg-white rounded-[18px] p-5 border border-slate-100 shadow-sm space-y-4 active:scale-95 transition-all">
                <div class="flex justify-between items-start gap-4">
                    <div class="flex items-center gap-2 min-w-0">
                        <h3 class="text-[15px] font-bold text-slate-800 leading-tight truncate">${item.namaBarang}</h3>
                        ${isNew ? '<span class="bg-[#1DA874]/15 text-[#1DA874] text-[9px] font-bold px-2 py-0.5 rounded-full">Baru</span>' : ''}
                    </div>
                    <span class="px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${badge.bg} ${badge.text}">
                        ${item.kondisi}
                    </span>
                </div>
                <div class="flex justify-between items-end gap-3">
                    <div class="flex-1 min-w-0">
                        <p class="text-[11px] font-medium text-slate-400 leading-none">
                            ${hasCode ? `${item.noInventaris} <span class="mx-1 text-slate-200">·</span>` : ''} 
                            <span class="text-slate-700 font-bold">${item.jumlah}${isNaN(item.jumlah.toString().replace(',', '.')) ? '' : ' Unit'}</span>
                        </p>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <div class="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                        <span class="text-[11px] font-bold text-slate-400">${item.lokasi || '-'}</span>
                    </div>
                </div>
                ${state.isAdmin ? `
                    <div class="flex justify-end gap-2.5 pt-1.5 border-t border-slate-50">
                        <button onclick="event.stopPropagation(); showItemForm('${item.id}')" class="w-10 h-10 rounded-xl bg-[#E1F5EE] text-[#0F6E56] flex items-center justify-center"><i data-lucide="pencil" class="w-[18px] h-[18px]"></i></button>
                        <button onclick="event.stopPropagation(); deleteItem('${item.id}')" class="w-10 h-10 rounded-xl bg-[#FCEBEB] text-[#A32D2D] flex items-center justify-center"><i data-lucide="trash-2" class="w-[18px] h-[18px]"></i></button>
                        <button onclick="event.stopPropagation(); printQR('${item.noInventaris}', '${item.namaBarang}')" class="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center"><i data-lucide="qr-code" class="w-[18px] h-[18px]"></i></button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    renderPagination(totalPages);
    updateAdminUI();
    lucide.createIcons();
}

function updateAdminUI() {
    const mobileAddBtn = $('#mobileAddBtn');
    const navSettingsBtn = $('#navSettingsBtn');

    if (state.isAdmin) {
        if (mobileAddBtn) mobileAddBtn.classList.remove('hidden');
        if (navSettingsBtn) {
            navSettingsBtn.innerHTML = '<i data-lucide="log-out" class="w-5 h-5"></i>';
            navSettingsBtn.classList.add('text-rose-500');
            navSettingsBtn.classList.remove('text-slate-400');
            navSettingsBtn.title = 'Logout Admin';
            navSettingsBtn.onclick = showAuth; // Re-bind
        }
    } else {
        if (mobileAddBtn) mobileAddBtn.classList.add('hidden');
        if (navSettingsBtn) {
            navSettingsBtn.innerHTML = '<i data-lucide="settings" class="w-5 h-5"></i>';
            navSettingsBtn.classList.add('text-slate-400');
            navSettingsBtn.classList.remove('text-rose-500');
            navSettingsBtn.title = 'Login Admin';
            navSettingsBtn.onclick = showAuth; // Re-bind
        }
    }
    if (window.lucide) lucide.createIcons();
}

function getBadgeStyle(kondisi) {
    if (kondisi === 'Baik') return { bg: 'bg-[#E1F5EE]', text: 'text-[#0F6E56]' };
    if (kondisi === 'Rusak Ringan') return { bg: 'bg-[#FAEEDA]', text: 'text-[#854F0B]' };
    if (kondisi === 'Rusak') return { bg: 'bg-[#FCEBEB]', text: 'text-[#A32D2D]' };
    return { bg: 'bg-slate-100', text: 'text-slate-500' };
}

// UI HELPERS
function openSheet(id) {
    $(`#${id}`).classList.add('active');
    $('#sheetOverlay').classList.add('active');
}

function closeAllSheets() {
    $$('.bottom-sheet').forEach(s => s.classList.remove('active'));
    $('#sheetOverlay').classList.remove('active');
}

function getDirectImageUrl(url) {
    if (!url) return '';
    // Return direct links as-is
    if (url.includes('lh3.googleusercontent.com') || url.startsWith('data:image') || url.match(/\.(jpeg|jpg|gif|png)$/i)) {
        return url;
    }
    // Convert Google Drive links to direct image links
    let fileId = null;
    const fileDMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    
    if (fileDMatch) fileId = fileDMatch[1];
    else if (idMatch) fileId = idMatch[1];
    
    if (fileId) return `https://drive.google.com/uc?export=view&id=${fileId}`;
    return url;
}

function showDetail(id) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;
    $('#sheetContent').innerHTML = `
        <div class="space-y-6">
            ${item.foto ? `<div class="w-full h-48 rounded-3xl overflow-hidden bg-slate-100 border border-slate-100"><img src="${getDirectImageUrl(item.foto)}" class="w-full h-full object-cover"></div>` : ''}
            <div class="flex items-center gap-4 border-b border-slate-50 pb-6">
                <div class="w-14 h-14 bg-[#1DA874]/10 rounded-2xl flex items-center justify-center text-[#1DA874] shrink-0"><i data-lucide="package" class="w-8 h-8"></i></div>
                <div class="min-w-0"><h4 class="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nama Barang</h4><p class="text-lg font-black text-slate-800 truncate">${item.namaBarang}</p></div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div class="p-4 bg-slate-50 rounded-2xl"><p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Kategori</p><p class="text-[14px] font-bold text-slate-800">${item.kategori}</p></div>
                <div class="p-4 bg-slate-50 rounded-2xl"><p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Jumlah</p><p class="text-[14px] font-bold text-slate-800">${item.jumlah} Unit</p></div>
            </div>
            <div class="p-4 bg-slate-50 rounded-2xl"><p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Lokasi</p><p class="text-[14px] font-bold text-slate-800">${item.lokasi || '-'}</p></div>
            <div class="p-4 bg-[#0D1B2A] rounded-2xl text-white"><p class="text-[10px] font-bold text-slate-500 uppercase mb-1">No. Inventaris</p><p class="text-[16px] font-black tracking-widest">${item.noInventaris}</p></div>
            ${item.keterangan ? `<div class="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100"><p class="text-[10px] font-bold text-emerald-600 uppercase mb-1">Keterangan</p><p class="text-[13px] text-slate-600 font-medium">${item.keterangan}</p></div>` : ''}
            <button onclick="closeAllSheets()" class="w-full py-4 bg-slate-100 rounded-2xl font-bold text-slate-500 uppercase text-xs">Tutup</button>
        </div>
    `;
    openSheet('detailSheet');
    lucide.createIcons();
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

// CRUD
function autoGenNo() {
    const kat = $('#inputKategori').value;
    const generated = generateNoInventaris(kat);
    $('#inputNoInventaris').value = generated;
}
window.autoGenNo = autoGenNo;

function generateNoInventaris(category) {
    const code = getCategoryCode(category);
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `INVBN2/${code}/${year}/`;
    
    // Find highest sequence
    const samePrefixItems = state.items.filter(i => i.noInventaris && i.noInventaris.startsWith(prefix));
    let maxSeq = 0;
    samePrefixItems.forEach(i => {
        const parts = i.noInventaris.split('/');
        const seq = parseInt(parts[parts.length - 1]);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    });
    
    const newSeq = (maxSeq + 1).toString().padStart(3, '0');
    return `${prefix}${newSeq}`;
}

function getCategoryCode(kat) {
    const map = {
        'Perlengkapan': 'PLK',
        'Peralatan': 'PRL',
        'Elektronik': 'ELK',
        'Aset': 'AST'
    };
    return map[kat] || 'BRG';
}

function showItemForm(id = null) {
    $('#itemModal').classList.remove('hidden');
    if (id) {
        const item = state.items.find(i => i.id === id);
        $('#formTitle').innerText = 'Edit Barang';
        $('#formId').value = item.id;
        $('#formOldNama').value = item.namaBarang; // Hidden field to track old name
        $('#inputNoInventaris').value = item.noInventaris || '';
        $('#inputNama').value = item.namaBarang;
        $('#inputKategori').value = item.kategori;
        $('#inputJumlah').value = item.jumlah;
        $('#inputKondisi').value = item.kondisi;
        $('#inputLokasi').value = item.lokasi;
        
        
        const inputFotoBase64 = $('#inputFotoBase64');
        if (inputFotoBase64) inputFotoBase64.value = item.foto || '';
        
        const fotoPreview = $('#fotoPreview');
        const fotoPreviewContainer = $('#fotoPreviewContainer');
        const fotoFileName = $('#fotoFileName');
        
        if (item.foto && fotoPreview && fotoPreviewContainer) {
            fotoPreview.src = item.foto;
            fotoPreviewContainer.classList.remove('hidden');
            if (fotoFileName) fotoFileName.innerText = 'Foto Tersimpan';
        } else if (fotoPreview && fotoPreviewContainer) {
            fotoPreview.src = '';
            fotoPreviewContainer.classList.add('hidden');
            if (fotoFileName) fotoFileName.innerText = 'Pilih atau Ambil Foto...';
        }

        $('#inputKeterangan').value = item.keterangan || '';
    } else {
        $('#formTitle').innerText = 'Tambah Barang';
        $('#itemForm').reset();
        $('#formId').value = '';
        $('#formOldNama').value = '';
        
        const inputFotoBase64 = $('#inputFotoBase64');
        if (inputFotoBase64) inputFotoBase64.value = '';
        
        const fotoPreview = $('#fotoPreview');
        if (fotoPreview) fotoPreview.src = '';
        
        const fotoPreviewContainer = $('#fotoPreviewContainer');
        if (fotoPreviewContainer) fotoPreviewContainer.classList.add('hidden');
        
        const fotoFileName = $('#fotoFileName');
        if (fotoFileName) fotoFileName.innerText = 'Pilih atau Ambil Foto...';
    }
}

function hideItemForm() { $('#itemModal').classList.add('hidden'); }

async function saveItem() {
    const btn = $('#itemForm button[type="submit"]');
    btn.innerText = 'Menyimpan...'; btn.disabled = true;
    
    const newNo = $('#inputNoInventaris').value.trim();
    const oldNo = $('#formId').value;
    
    const formData = {
        action: oldNo ? 'editItem' : 'addItem',
        source: 'inventaris', // Added source for routing
        noInventaris: newNo || `BN2-${Date.now()}`,
        oldNoInventaris: oldNo || '',
        oldNamaBarang: $('#formOldNama').value || '', // Extra anchor
        namaBarang: toTitleCase($('#inputNama').value.trim()), 
        kategori: $('#inputKategori').value,
        jumlah: $('#inputJumlah').value, 
        kondisi: $('#inputKondisi').value,
        lokasi: $('#inputLokasi').value, 
        foto: $('#inputFotoBase64') ? $('#inputFotoBase64').value : '',
        keterangan: $('#inputKeterangan').value,
        password: "adminbn2"
    };
    try {
        await fetch(GAS_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(formData) });
        hideItemForm(); alert('Berhasil! Silakan refresh dalam 1 menit.'); fetchData();
    } catch (e) { alert('Gagal!'); }
    finally { btn.innerText = 'Simpan Barang'; btn.disabled = false; }
}

async function deleteItem(id) {
    if (!confirm('Hapus barang?')) return;
    try {
        await fetch(GAS_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'deleteItem', source: 'inventaris', noInventaris: id, password: "adminbn2" }) });
        alert('Berhasil dihapus!'); fetchData();
    } catch (e) { alert('Gagal!'); }
}

// REST OF UI (Pagin, Stats, Chips, etc - see previous working)
function updateStats() {
    const total = state.items.length;
    const baik = state.items.filter(i => i.kondisi === 'Baik').length;
    const rusak = state.items.filter(i => i.kondisi === 'Rusak' || i.kondisi === 'Rusak Ringan').length;
    $('#statTotal').innerText = total;
    $('#statKat').innerText = new Set(state.items.map(i => i.kategori)).size;
    $('#statBaik').innerText = total ? Math.round((baik/total)*100) + '%' : '0%';
    $('#statRusak').innerText = total ? Math.round((rusak/total)*100) + '%' : '0%';
}
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
    if (val === 'Semua') state.filters[type] = [];
    else { const idx = state.filters[type].indexOf(val); if (idx > -1) state.filters[type].splice(idx, 1); else state.filters[type].push(val); }
    populateFilterOptions();
}
function renderSortOptions() {
    const opts = [{ id: 'newest', label: 'Terbaru ditambahkan' }, { id: 'oldest', label: 'Terlama ditambahkan' }, { id: 'az', label: 'Nama A–Z' }, { id: 'za', label: 'Nama Z–A' }, { id: 'broken_first', label: 'Kondisi rusak dulu' }];
    $('#sortOptions').innerHTML = opts.map(opt => `<button onclick="setSort('${opt.id}')" class="w-full flex items-center justify-between py-4 px-6 group"><span class="text-[14px] font-medium ${state.sortBy === opt.id ? 'text-[#1DA874]' : 'text-slate-600'}">${opt.label}</span><div class="w-5 h-5 rounded-full border-2 flex items-center justify-center ${state.sortBy === opt.id ? 'border-[#1DA874]' : 'border-slate-200'}">${state.sortBy === opt.id ? '<div class="w-2.5 h-2.5 bg-[#1DA874] rounded-full"></div>' : ''}</div></button>`).join('');
}
function setSort(id) { state.sortBy = id; closeAllSheets(); applyLogic(); }
function updateActiveFilterBar() {
    const active = []; if (state.filters.kategori.length) active.push(...state.filters.kategori); if (state.filters.kondisi.length) active.push(...state.filters.kondisi); if (state.filters.lokasi.length) active.push(...state.filters.lokasi);
    const bar = $('#filterActiveBar'); if (active.length) { bar.classList.remove('hidden'); $('#activeFilterText').innerText = `Aktif: ${active.join(' · ')}`; $('#filterBtn').classList.add('bg-[#1DA874]', 'text-white'); } else { bar.classList.add('hidden'); $('#filterBtn').classList.remove('bg-[#1DA874]', 'text-white'); }
}
function renderPagination(totalPages) {
    const container = $('#paginationContainer'); if (totalPages <= 1) { container.innerHTML = ''; return; }
    container.innerHTML = `<button onclick="changePage(-1)" ${state.currentPage === 1 ? 'disabled' : ''} class="pagination-btn flex items-center gap-2 text-[11px] font-bold text-slate-400 disabled:opacity-20"><i data-lucide="chevron-left" class="w-4 h-4"></i> Sebelumnya</button><span class="text-[11px] font-bold text-slate-800">Halaman ${state.currentPage} / ${totalPages}</span><button onclick="changePage(1)" ${state.currentPage === totalPages ? 'disabled' : ''} class="pagination-btn flex items-center gap-2 text-[11px] font-bold text-[#1DA874] disabled:opacity-20">Selanjutnya <i data-lucide="chevron-right" class="w-4 h-4"></i></button>`;
}
function changePage(delta) { state.currentPage += delta; applyLogic(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function showAuth() { 
    if (state.isAdmin) {
        $('#logoutModal').classList.remove('hidden');
    } else {
        $('#authModal').classList.remove('hidden'); 
        $('#adminPass').value = '';
        $('#adminPass').focus();
    }
}
function hideAuth() { $('#authModal').classList.add('hidden'); }
function closeLogoutModal() { $('#logoutModal').classList.add('hidden'); }

function handleLogout() {
    state.isAdmin = false;
    localStorage.removeItem('bn2-isAdmin');
    closeLogoutModal();
    updateAdminUI();
    renderAll();
}

function handleLogin() { 
    if ($('#adminPass').value === ADMIN_PASS) { 
        state.isAdmin = true; 
        localStorage.setItem('bn2-isAdmin', 'true');
        hideAuth(); 
        renderAll(); 
    } else { 
        alert('Password Salah!'); 
        $('#adminPass').value = '';
    } 
}

function printQR(id, name) {
    const baseUrl = window.location.origin + window.location.pathname;
    const itemUrl = baseUrl + '?id=' + encodeURIComponent(id);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(itemUrl)}`;
    
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>Cetak Label 103 - ${id}</title>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;800&display=swap" rel="stylesheet">
            <style>
                @page {
                    size: 64mm 32mm; /* Label 103 Standard Size */
                    margin: 0;
                }
                body { 
                    font-family: 'Plus Jakarta Sans', sans-serif; 
                    margin: 0;
                    padding: 0;
                    width: 64mm;
                    height: 32mm;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: white;
                    box-sizing: border-box;
                }
                .label-container {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    padding: 3mm 4mm;
                    box-sizing: border-box;
                    gap: 3mm;
                }
                .qr-section {
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .qr-img {
                    width: 24mm;
                    height: 24mm;
                }
                .info-section {
                    flex: 1;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    min-width: 0; /* for text truncation */
                }
                .header {
                    font-size: 6pt;
                    font-weight: 800;
                    color: #000;
                    margin-bottom: 2px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .name {
                    font-size: 8pt;
                    font-weight: 800;
                    line-height: 1.1;
                    margin-bottom: 2px;
                    color: #000;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .code {
                    font-size: 6pt;
                    font-weight: 600;
                    color: #444;
                }
            </style>
        </head>
        <body>
            <div class="label-container">
                <div class="qr-section">
                    <img src="${qrUrl}" class="qr-img" onload="window.print(); window.close();">
                </div>
                <div class="info-section">
                    <div class="header">Bumi Neikarta 2</div>
                    <div class="name">${name}</div>
                    <div class="code">${id}</div>
                </div>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function printAllQR() {
    const itemsToPrint = state.items.filter(item => item.noInventaris && item.noInventaris !== '-');
    if (itemsToPrint.length === 0) {
        alert("Tidak ada data barang yang memiliki nomor inventaris untuk dicetak.");
        return;
    }

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    let html = `
        <html>
        <head>
            <title>Cetak Semua Label 103</title>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;800&display=swap" rel="stylesheet">
            <style>
                @page {
                    size: 200mm 130mm;
                    margin: 5mm;
                }
                body { 
                    font-family: 'Plus Jakarta Sans', sans-serif; 
                    margin: 0;
                    padding: 0;
                    background: white;
                }
                .print-wrapper {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 3mm;
                    justify-content: center;
                }
                .label-page {
                    width: 64mm;
                    height: 32mm;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-sizing: border-box;
                    border: 1px dashed #cbd5e1; /* Garis tipis putus-putus untuk panduan potong/tempel */
                    page-break-inside: avoid;
                }
                .label-container {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    padding: 3mm 4mm;
                    box-sizing: border-box;
                    gap: 3mm;
                }
                .qr-section {
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .qr-img {
                    width: 24mm;
                    height: 24mm;
                }
                .info-section {
                    flex: 1;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    min-width: 0; /* for text truncation */
                }
                .header {
                    font-size: 6pt;
                    font-weight: 800;
                    color: #000;
                    margin-bottom: 2px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .name {
                    font-size: 8pt;
                    font-weight: 800;
                    line-height: 1.1;
                    margin-bottom: 2px;
                    color: #000;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .code {
                    font-size: 6pt;
                    font-weight: 600;
                    color: #444;
                }
            </style>
        </head>
        <body>
            <div class="print-wrapper">
    `;

    itemsToPrint.forEach(item => {
        const baseUrl = window.location.origin + window.location.pathname;
        const itemUrl = baseUrl + '?id=' + encodeURIComponent(item.noInventaris);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(itemUrl)}`;
        html += `
            <div class="label-page">
                <div class="label-container">
                    <div class="qr-section">
                        <img src="${qrUrl}" class="qr-img">
                    </div>
                    <div class="info-section">
                        <div class="header">Bumi Neikarta 2</div>
                        <div class="name">${item.namaBarang}</div>
                        <div class="code">${item.noInventaris}</div>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        <script>
            window.onload = () => {
                setTimeout(() => {
                    window.print();
                    window.close();
                }, 500); // Give a little time for QRs to render
            };
        </script>
        </body>
        </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
}

