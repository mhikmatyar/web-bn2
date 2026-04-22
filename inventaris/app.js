/* ========================================
   INVENTARIS PERUMAHAN - APP.JS
   Google Sheets Integration + Local Photo Storage
   ======================================== */

(function () {
    'use strict';

    const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQfPsk4L2qxshegLjX6zTdY4mPv0e4xYFqbzYFKgqwHJrMuSXAeDJuIFAhdyK2vi4SwyJ2HXZX4h0un/pubhtml?gid=0&single=true';

    // =================== STATE ===================
    const state = {
        items: [],
        filteredItems: [],
        currentPage: 1,
        perPage: 10,
        sortField: null,
        sortOrder: 'asc',
        sheetUrl: '',
        refreshInterval: 5,
        refreshTimer: null,
        charts: {},
        localPhotos: {},  // { noInventaris: base64String }
        currentPhotoItem: null,
    };

    // =================== DOM REFS ===================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // =================== INIT ===================
    function init() {
        loadSettings();
        loadLocalPhotos();
        bindNavigation();
        bindTheme();
        bindSettings();
        bindSearch();
        bindPagination();
        bindTableSort();
        bindModals();
        bindExport();
        bindAddItem();
        updateLocalStorageInfo();

        if (state.sheetUrl) {
            fetchData().then(() => {
                checkUrlParams(); // QR code deep linking
            });
        }
    }

    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const itemId = urlParams.get('id');
        if (itemId) {
            const item = state.items.find(i => i.noInventaris === itemId);
            if (item) {
                showDetailModal(item);
                // Clear the param without refreshing to keep URL clean
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            } else {
                showToast(`Barang dengan No Inventaris ${itemId} tidak ditemukan`, 'error');
            }
        }
    }

    // =================== NAVIGATION ===================
    function bindNavigation() {
        $$('.nav-item').forEach(item => {
            item.addEventListener('click', e => {
                e.preventDefault();
                const page = item.dataset.page;

                if (page === 'settings') {
                    const password = prompt("PENGAMANAN: Masukkan password Admin untuk mengakses pengaturan:");
                    if (password !== "adminbn2") {
                        if (password !== null) showToast("Password salah! Akses ditolak.", "error");
                        return;
                    }
                }

                navigateTo(page);
            });
        });

        $('#hamburgerBtn').addEventListener('click', () => {
            $('#sidebar').classList.add('open');
        });

        $('#sidebarClose').addEventListener('click', () => {
            $('#sidebar').classList.remove('open');
        });

        // Close sidebar on overlay click (mobile)
        document.addEventListener('click', e => {
            if (window.innerWidth <= 768 &&
                !e.target.closest('.sidebar') &&
                !e.target.closest('.hamburger')) {
                $('#sidebar').classList.remove('open');
            }
        });
    }

    function navigateTo(page) {
        $$('.page').forEach(p => p.classList.remove('active'));
        $$('.nav-item').forEach(n => n.classList.remove('active'));

        $(`#page-${page}`).classList.add('active');
        $(`[data-page="${page}"]`).classList.add('active');

        const titles = {
            dashboard: 'Dashboard',
            inventaris: 'Data Inventaris',
            settings: 'Pengaturan',
            panduan: 'Panduan Penggunaan'
        };
        $('#pageTitle').textContent = titles[page] || 'Dashboard';

        // Close mobile sidebar
        $('#sidebar').classList.remove('open');
    }

    // =================== THEME ===================
    function bindTheme() {
        const toggle = $('#themeToggle');
        const saved = localStorage.getItem('inv-theme');
        if (saved === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            toggle.innerHTML = '<i class="fas fa-sun"></i><span>Mode Terang</span>';
        }

        toggle.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.documentElement.setAttribute('data-theme', 'light');
                toggle.innerHTML = '<i class="fas fa-moon"></i><span>Mode Gelap</span>';
                localStorage.setItem('inv-theme', 'light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                toggle.innerHTML = '<i class="fas fa-sun"></i><span>Mode Terang</span>';
                localStorage.setItem('inv-theme', 'dark');
            }
            // Re-render charts for theme
            if (state.items.length > 0) {
                renderCharts();
            }
        });
    }

    function loadSettings() {
        state.sheetUrl = localStorage.getItem('inv-sheetUrl') || DEFAULT_SHEET_URL;
        state.scriptUrl = localStorage.getItem('inv-scriptUrl') || '';
        state.refreshInterval = parseInt(localStorage.getItem('inv-refreshInterval')) || 5;

        if (state.sheetUrl) {
            $('#sheetUrl').value = state.sheetUrl;
            $('#disconnectBtn').style.display = 'inline-flex';
            updateSyncStatus('connected', 'Terhubung');
        }
        if (state.scriptUrl) {
            $('#scriptUrl').value = state.scriptUrl;
        }
        $('#refreshInterval').value = state.refreshInterval;
    }

    function bindSettings() {
        $('#connectSheetBtn').addEventListener('click', connectSheet);
        $('#testConnectionBtn').addEventListener('click', testConnection);
        $('#disconnectBtn').addEventListener('click', disconnectSheet);
        $('#refreshBtn').addEventListener('click', () => {
            if (state.sheetUrl) fetchData();
            else showToast('Belum terhubung ke Google Sheet', 'error');
        });
        $('#refreshInterval').addEventListener('change', e => {
            state.refreshInterval = parseInt(e.target.value);
            localStorage.setItem('inv-refreshInterval', state.refreshInterval);
            setupAutoRefresh();
            showToast(`Auto refresh diatur ke ${state.refreshInterval} menit`, 'info');
        });
        $('#clearPhotosBtn').addEventListener('click', () => {
            if (confirm('Hapus semua foto lokal? Tindakan ini tidak bisa dibatalkan.')) {
                state.localPhotos = {};
                localStorage.removeItem('inv-photos');
                updateLocalStorageInfo();
                renderTable();
                showToast('Semua foto lokal telah dihapus', 'success');
            }
        });
    }

    async function connectSheet() {
        const url = $('#sheetUrl').value.trim();
        const scriptUrl = $('#scriptUrl').value.trim();
        const btn = $('#connectSheetBtn');

        if (!url) {
            showConnectionResult('URL Google Sheet tidak boleh kosong.', 'error');
            return;
        }

        if (!url.includes('/pub') || !url.includes('output=csv')) {
            showConnectionResult('Format URL Google Sheet (KOLOM PERTAMA) salah. Pastikan link di kolom pertama berakhiran "output=csv".', 'error');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner spinner"></i> Menghubungkan...';

        try {
            await fetchCSV(url);
            state.sheetUrl = url;
            localStorage.setItem('inv-sheetUrl', url);
            
            if (scriptUrl) {
                state.scriptUrl = scriptUrl;
                localStorage.setItem('inv-scriptUrl', scriptUrl);
            } else {
                state.scriptUrl = '';
                localStorage.removeItem('inv-scriptUrl');
            }

            $('#disconnectBtn').style.display = 'inline-flex';
            showConnectionResult('Berhasil terhubung ke Google Sheet!', 'success');
            showToast('Koneksi berhasil', 'success');
            updateSyncStatus('connected', 'Terhubung');
            setupAutoRefresh();
            renderAll();
        } catch (err) {
            showConnectionResult('Gagal terhubung. Pastikan URL benar.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Hubungkan';
        }
    }

    async function testConnection() {
        const url = $('#sheetUrl').value.trim();
        if (!url) {
            showConnectionResult('Masukkan URL terlebih dahulu', 'error');
            return;
        }
        showConnectionResult('Mengetes koneksi...', 'success');
        try {
            await fetchCSV(url);
            showConnectionResult(`Koneksi berhasil! ${state.items.length} barang ditemukan.`, 'success');
        } catch {
            showConnectionResult('Koneksi gagal. Periksa URL dan pastikan sheet sudah di-publish ke web. Coba refresh halaman.', 'error');
        }
    }

    function disconnectSheet() {
        if (confirm('Yakin ingin memutus koneksi? Data tabel akan dikosongkan.')) {
            state.sheetUrl = '';
            state.scriptUrl = '';
            localStorage.removeItem('inv-sheetUrl');
            localStorage.removeItem('inv-scriptUrl');
            state.items = [];
            state.filteredItems = [];
            $('#sheetUrl').value = '';
            $('#scriptUrl').value = '';
            $('#disconnectBtn').style.display = 'none';
            $('#connectionResult').style.display = 'none';
            updateSyncStatus('', 'Belum terhubung');
            if (state.refreshTimer) clearInterval(state.refreshTimer);
            renderAll();
            showToast('Koneksi diputus', 'info');
        }
    }

    function showConnectionResult(msg, type) {
        const el = $('#connectionResult');
        if (!msg) {
            el.style.display = 'none';
            return;
        }
        el.textContent = msg;
        el.className = 'connection-result ' + type;
    }

    function updateSyncStatus(status, text) {
        const dot = $('.sync-dot');
        const txt = $('.sync-text');
        dot.className = 'sync-dot ' + status;
        txt.textContent = text;
    }

    function setupAutoRefresh() {
        if (state.refreshTimer) clearInterval(state.refreshTimer);
        if (state.sheetUrl) {
            state.refreshTimer = setInterval(() => {
                fetchData();
            }, state.refreshInterval * 60 * 1000);
        }
    }

    // =================== DATA FETCHING ===================
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
        // Try multiple methods to handle CORS (especially for file:// protocol)
        const methods = [
            // Method 1: Direct fetch
            () => fetch(url).then(r => { if (!r.ok) throw new Error('Direct fetch failed'); return r.text(); }),
            // Method 2: CORS proxy via corsproxy.io
            () => fetch('https://corsproxy.io/?' + encodeURIComponent(url)).then(r => { if (!r.ok) throw new Error('Proxy 1 failed'); return r.text(); }),
            // Method 3: CORS proxy via allorigins
            () => fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url)).then(r => { if (!r.ok) throw new Error('Proxy 2 failed'); return r.text(); }),
        ];

        let lastError;
        for (const method of methods) {
            try {
                const csv = await method();
                // Basic check to ensure it's not HTML
                if (csv && csv.trim().length > 0 && !csv.trim().toLowerCase().startsWith('<!doctype html>')) {
                    parseCSVData(csv);
                    return;
                }
            } catch (err) {
                lastError = err;
                continue;
            }
        }
        throw lastError || new Error('Semua metode koneksi gagal atau URL bukan CSV');
    }

    async function fetchData() {
        if (!state.sheetUrl) return;

        const refreshBtn = $('#refreshBtn');
        refreshBtn.querySelector('i').classList.add('spinner');

        try {
            await fetchCSV(state.sheetUrl);
            updateSyncStatus('connected', `Terakhir: ${new Date().toLocaleTimeString('id-ID')}`);
            renderAll();
        } catch {
            updateSyncStatus('error', 'Gagal refresh');
            showToast('Gagal memuat data dari Google Sheet', 'error');
        }

        refreshBtn.querySelector('i').classList.remove('spinner');
    }

    function parseCSVData(csv) {
        const result = Papa.parse(csv, {
            header: true,
            skipEmptyLines: true,
            transformHeader: h => h.trim()
        });

        state.items = result.data.map((row, idx) => {
            // Normalize column names (handle various spellings)
            const get = (...keys) => {
                for (const k of keys) {
                    const val = row[k] || row[k.toUpperCase()] || row[k.toLowerCase()];
                    if (val !== undefined && val !== null) return val.toString().trim();
                }
                return '';
            };

            return {
                no: get('NO', 'No', 'no') || (idx + 1),
                namaBarang: get('NAMA BARANG', 'Nama Barang', 'nama barang'),
                noInventaris: cleanNoInventaris(get('NO INVENTARIS', 'No Inventaris', 'no inventaris')),
                kategori: get('KATEGORI', 'Kategori', 'kategori'),
                merkType: get('MERK/TYPE', 'Merk/Type', 'merk/type', 'MERK', 'Merk'),
                tahunPerolehan: get('TAHUN PEROLEHAN', 'Tahun Perolehan', 'tahun perolehan'),
                jumlah: parseJumlah(get('JUMLAH', 'Jumlah', 'jumlah')),
                hargaSatuan: parseHarga(get('HARGA SATUAN', 'Harga Satuan', 'harga satuan')),
                kondisi: get('KONDISI', 'Kondisi', 'kondisi'),
                lokasi: get('LOKASI', 'Lokasi', 'lokasi'),
                dokumentasi: get('DOKUMENTASI', 'Dokumentasi', 'dokumentasi'),
                keterangan: get('KETERANGAN', 'Keterangan', 'keterangan'),
            };
        }).filter(item => item.namaBarang); // Filter empty rows

        // Auto-generate No Inventaris for items that don't have one
        autoGenerateInventoryNumbers();
    }

    function autoGenerateInventoryNumbers() {
        // Build map of existing category counters
        const categoryCounters = {};

        // First pass: count existing items per category-year to avoid duplicates
        state.items.forEach(item => {
            if (item.noInventaris) {
                // Match format: INVBN2/PLK/26/001
                const match = item.noInventaris.match(/^INVBN2\/([A-Z]+)\/(\d{2})\/(\d+)$/);
                if (match) {
                    const key = `${match[1]}-${match[2]}`;
                    const num = parseInt(match[3]);
                    categoryCounters[key] = Math.max(categoryCounters[key] || 0, num);
                }
            }
        });

        // Second pass: generate numbers for items without one
        state.items.forEach(item => {
            if (!item.noInventaris) {
                const katCode = getCategoryCode(item.kategori);
                const yearFull = item.tahunPerolehan || new Date().getFullYear().toString();
                const yearShort = yearFull.slice(-2); // Last 2 digits
                const key = `${katCode}-${yearShort}`;
                categoryCounters[key] = (categoryCounters[key] || 0) + 1;
                const seq = String(categoryCounters[key]).padStart(3, '0');
                item.noInventaris = `INVBN2/${katCode}/${yearShort}/${seq}`;
                item.autoGenerated = true; // Mark as auto-generated
            }
        });
    }

    function getCategoryCode(kategori) {
        if (!kategori) return 'UMM';
        const map = {
            'elektronik': 'ELK', 'furniture': 'FRN', 'mebel': 'FRN', 'meubel': 'FRN',
            'peralatan': 'PRL', 'peralatan taman': 'PTM', 'peralatan kantor': 'PKT',
            'kendaraan': 'KDR', 'alat tulis': 'ATK', 'atk': 'ATK',
            'perlengkapan': 'PLK', 'instalasi': 'INS', 'jaringan': 'JRG',
            'mesin': 'MSN', 'gedung': 'GDG', 'tanah': 'TNH',
            'peralatan dapur': 'PDR', 'peralatan kebersihan': 'PKB',
            'alat keamanan': 'AKM', 'olahraga': 'OLR',
        };
        const lower = kategori.toLowerCase();
        // Try exact match first
        if (map[lower]) return map[lower];
        // Try partial match
        for (const [key, code] of Object.entries(map)) {
            if (lower.includes(key) || key.includes(lower)) return code;
        }
        // Generate from first 3 consonants/chars
        return kategori.replace(/[aeiou\s]/gi, '').substring(0, 3).toUpperCase() || kategori.substring(0, 3).toUpperCase();
    }

    function cleanNoInventaris(str) {
        // Treat "-", "_", empty, whitespace-only as empty (triggers auto-generate)
        if (!str || str.trim() === '' || str.trim() === '-' || str.trim() === '_') return '';
        return str.trim();
    }

    function parseJumlah(str) {
        if (!str) return 0;
        // Handle formats like: "2 krat (50 pcs)", "10 pcs", "208 pcs", "12", "37 pcs"
        const cleaned = str.toString().trim();
        // Extract the first number found
        const match = cleaned.match(/^\d+/);
        return match ? parseInt(match[0]) : 0;
    }

    function parseHarga(str) {
        if (!str || str.trim() === '-') return 0;
        // Remove Rp, dots, spaces, then parse
        const cleaned = str.replace(/[Rp.\s]/gi, '').replace(/,/g, '');
        return parseInt(cleaned) || 0;
    }

    // =================== RENDER ALL ===================
    function renderAll() {
        applyFilters();
        renderDashboard();
        renderCharts();
        renderTable();
        renderRecentItems();
        populateFilterOptions();
    }

    // =================== DASHBOARD ===================
    function renderDashboard() {
        const items = state.items;
        const totalBarang = items.reduce((sum, i) => sum + i.jumlah, 0);
        const totalNilai = items.reduce((sum, i) => sum + (i.jumlah * i.hargaSatuan), 0);
        const categories = new Set(items.map(i => i.kategori).filter(Boolean));
        const rusakBerat = items.filter(i => i.kondisi.toLowerCase().includes('rusak berat')).length;

        $('#statTotalBarang').textContent = totalBarang.toLocaleString('id-ID');
        $('#statTotalNilai').textContent = formatRupiah(totalNilai);
        $('#statTotalKategori').textContent = categories.size;
        $('#statRusakBerat').textContent = rusakBerat;
    }

    function formatRupiah(num) {
        if (num >= 1_000_000_000) {
            return 'Rp ' + (num / 1_000_000_000).toFixed(1).replace('.0', '') + ' M';
        }
        if (num >= 1_000_000) {
            return 'Rp ' + (num / 1_000_000).toFixed(1).replace('.0', '') + ' Jt';
        }
        return 'Rp ' + num.toLocaleString('id-ID');
    }

    // =================== CHARTS ===================
    function renderCharts() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)';

        Chart.defaults.color = textColor;
        Chart.defaults.borderColor = gridColor;

        renderKondisiChart(textColor);
        renderKategoriChart(textColor, gridColor);
        renderLokasiChart(textColor, gridColor);
        renderTahunChart(textColor, gridColor);
    }

    function renderKondisiChart(textColor) {
        const counts = {};
        state.items.forEach(i => {
            const k = i.kondisi || 'Tidak Diketahui';
            counts[k] = (counts[k] || 0) + 1;
        });

        const labels = Object.keys(counts);
        const data = Object.values(counts);
        const colors = labels.map(l => {
            const lower = l.toLowerCase();
            if (lower.includes('baik')) return '#10b981';
            if (lower.includes('rusak ringan') || lower.includes('cukup')) return '#f59e0b';
            if (lower.includes('rusak berat')) return '#ef4444';
            return '#8b5cf6';
        });

        if (state.charts.kondisi) state.charts.kondisi.destroy();
        const ctx = $('#chartKondisi').getContext('2d');
        state.charts.kondisi = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 8,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 16, usePointStyle: true, font: { size: 12 } }
                    }
                }
            }
        });
    }

    function renderKategoriChart(textColor, gridColor) {
        const counts = {};
        state.items.forEach(i => {
            const k = i.kategori || 'Lainnya';
            counts[k] = (counts[k] || 0) + i.jumlah;
        });

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const labels = sorted.map(s => s[0]);
        const data = sorted.map(s => s[1]);

        const gradientColors = [
            '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
            '#06b6d4', '#f43f5e', '#a855f7', '#14b8a6', '#eab308'
        ];

        if (state.charts.kategori) state.charts.kategori.destroy();
        const ctx = $('#chartKategori').getContext('2d');
        state.charts.kategori = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: gradientColors.slice(0, labels.length),
                    borderRadius: 6,
                    borderSkipped: false,
                    maxBarThickness: 40,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: { font: { size: 11 } }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });
    }

    function renderLokasiChart(textColor, gridColor) {
        const counts = {};
        state.items.forEach(i => {
            const k = i.lokasi || 'Tidak Diketahui';
            counts[k] = (counts[k] || 0) + i.jumlah;
        });

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const labels = sorted.map(s => s[0]);
        const data = sorted.map(s => s[1]);

        if (state.charts.lokasi) state.charts.lokasi.destroy();
        const ctx = $('#chartLokasi').getContext('2d');
        state.charts.lokasi = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderRadius: 6,
                    borderSkipped: false,
                    maxBarThickness: 40,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 }, maxRotation: 45 }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { font: { size: 11 } },
                        beginAtZero: true,
                    }
                }
            }
        });
    }

    function renderTahunChart(textColor, gridColor) {
        const counts = {};
        state.items.forEach(i => {
            const t = i.tahunPerolehan || 'N/A';
            counts[t] = (counts[t] || 0) + i.jumlah;
        });

        const sorted = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
        const labels = sorted.map(s => s[0]);
        const data = sorted.map(s => s[1]);

        if (state.charts.tahun) state.charts.tahun.destroy();
        const ctx = $('#chartTahun').getContext('2d');
        state.charts.tahun = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#8b5cf6',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { font: { size: 11 } },
                        beginAtZero: true,
                    }
                }
            }
        });
    }

    // =================== RECENT ITEMS ===================
    function renderRecentItems() {
        const container = $('#recentList');
        if (state.items.length === 0) {
            container.innerHTML = '<p class="empty-state">Belum ada data. Hubungkan Google Sheet Anda di halaman Pengaturan.</p>';
            return;
        }

        const recent = state.items.slice(-5).reverse();
        container.innerHTML = recent.map(item => {
            const kondisiClass = getKondisiClass(item.kondisi);
            return `
                <div class="recent-item" data-no-inv="${escapeHtml(item.noInventaris)}">
                    <div class="recent-item-icon"><i class="fas fa-box"></i></div>
                    <div class="recent-item-info">
                        <div class="recent-item-name">${escapeHtml(item.namaBarang)}</div>
                        <div class="recent-item-meta">${escapeHtml(item.noInventaris)} · ${escapeHtml(item.lokasi)}</div>
                    </div>
                    <span class="recent-item-badge ${kondisiClass}">${escapeHtml(item.kondisi)}</span>
                </div>
            `;
        }).join('');

        // Bind click
        container.querySelectorAll('.recent-item').forEach(el => {
            el.addEventListener('click', () => {
                const noInv = el.dataset.noInv;
                const item = state.items.find(i => i.noInventaris === noInv);
                if (item) showDetailModal(item);
            });
        });
    }

    function getKondisiClass(kondisi) {
        const lower = (kondisi || '').toLowerCase();
        if (lower.includes('baik')) return 'badge-baik';
        if (lower.includes('rusak ringan') || lower.includes('cukup')) return 'badge-rusak-ringan';
        if (lower.includes('rusak berat')) return 'badge-rusak-berat';
        return 'badge-baik';
    }

    // =================== FILTERS ===================
    function populateFilterOptions() {
        const categories = [...new Set(state.items.map(i => i.kategori).filter(Boolean))].sort();
        const locations = [...new Set(state.items.map(i => i.lokasi).filter(Boolean))].sort();

        const katSelect = $('#filterKategori');
        const currentKat = katSelect.value;
        katSelect.innerHTML = '<option value="">Semua Kategori</option>' +
            categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        katSelect.value = currentKat;

        const locSelect = $('#filterLokasi');
        const currentLoc = locSelect.value;
        locSelect.innerHTML = '<option value="">Semua Lokasi</option>' +
            locations.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
        locSelect.value = currentLoc;
    }

    function bindSearch() {
        let timeout;
        $('#searchInput').addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                state.currentPage = 1;
                applyFilters();
                renderTable();
            }, 300);
        });

        $('#filterKategori').addEventListener('change', () => {
            state.currentPage = 1;
            applyFilters();
            renderTable();
        });

        $('#filterKondisi').addEventListener('change', () => {
            state.currentPage = 1;
            applyFilters();
            renderTable();
        });

        $('#filterLokasi').addEventListener('change', () => {
            state.currentPage = 1;
            applyFilters();
            renderTable();
        });

        $('#resetFilterBtn').addEventListener('click', () => {
            $('#searchInput').value = '';
            $('#filterKategori').value = '';
            $('#filterKondisi').value = '';
            $('#filterLokasi').value = '';
            state.currentPage = 1;
            applyFilters();
            renderTable();
            showToast('Filter telah direset', 'info');
        });

        $('#printAllQRBtn').addEventListener('click', () => {
            if (state.filteredItems.length === 0) {
                showToast('Tidak ada data untuk dicetak', 'error');
                return;
            }
            
            const password = prompt("PENGAMANAN: Masukkan password Admin untuk cetak massal:");
            if (password !== "adminbn2") {
                if (password !== null) showToast("Password salah! Akses ditolak.", "error");
                return;
            }

            printLabels(state.filteredItems);
        });
    }

    function applyFilters() {
        const search = ($('#searchInput').value || '').toLowerCase().trim();
        const kategori = $('#filterKategori').value;
        const kondisi = $('#filterKondisi').value;
        const lokasi = $('#filterLokasi').value;

        state.filteredItems = state.items.filter(item => {
            if (search) {
                const match = item.namaBarang.toLowerCase().includes(search) ||
                    item.noInventaris.toLowerCase().includes(search) ||
                    item.merkType.toLowerCase().includes(search) ||
                    item.keterangan.toLowerCase().includes(search);
                if (!match) return false;
            }
            if (kategori && item.kategori !== kategori) return false;
            if (kondisi && item.kondisi !== kondisi) return false;
            if (lokasi && item.lokasi !== lokasi) return false;
            return true;
        });

        // Apply sort
        if (state.sortField) {
            sortItems(state.sortField, state.sortOrder);
        }
    }

    // =================== TABLE ===================
    function renderTable() {
        const tbody = $('#tableBody');
        const items = state.filteredItems;

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Tidak ada data yang ditemukan.</td></tr>';
            $('#pageInfo').textContent = 'Halaman 0 dari 0';
            return;
        }

        const totalPages = Math.ceil(items.length / state.perPage);
        if (state.currentPage > totalPages) state.currentPage = totalPages;

        const start = (state.currentPage - 1) * state.perPage;
        const pageItems = items.slice(start, start + state.perPage);

        tbody.innerHTML = pageItems.map(item => {
            const kondisiClass = getKondisiClass(item.kondisi);
            const hasPhoto = state.localPhotos[item.noInventaris] || item.dokumentasi;

            return `
                <tr>
                    <td data-label="No">${escapeHtml(item.no)}</td>
                    <td data-label="Nama Barang" title="${escapeHtml(item.namaBarang)}"><strong>${escapeHtml(item.namaBarang)}</strong></td>
                    <td data-label="No Inventaris">${escapeHtml(item.noInventaris)}${item.autoGenerated ? ' <span class="auto-badge" title="Nomor ini di-generate otomatis">auto</span>' : ''}</td>
                    <td data-label="Kategori">${escapeHtml(item.kategori)}</td>
                    <td data-label="Jumlah">${item.jumlah}</td>
                    <td data-label="Kondisi"><span class="kondisi-badge ${kondisiClass}">${escapeHtml(item.kondisi)}</span></td>
                    <td data-label="Lokasi">${escapeHtml(item.lokasi)}</td>
                    <td data-label="Aksi">
                        <div class="action-btns">
                            <button title="Lihat Detail" class="detail-action" data-no-inv="${escapeHtml(item.noInventaris)}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button title="Edit Barang" class="edit-action" data-no-inv="${escapeHtml(item.noInventaris)}" style="color: var(--blue); background: rgba(59, 130, 246, 0.1);">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button title="Upload/Lihat Foto" class="photo-action" data-no-inv="${escapeHtml(item.noInventaris)}">
                                <i class="fas fa-camera${hasPhoto ? '' : '-retro'}"></i>
                            </button>
                            <button title="Hapus Barang" class="delete-action" data-no-inv="${escapeHtml(item.noInventaris)}" style="color: #ef4444; background: rgba(239, 68, 68, 0.1);">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Pagination info
        $('#pageInfo').textContent = `Halaman ${state.currentPage} dari ${totalPages} (${items.length} barang)`;

        // Bind actions
        tbody.querySelectorAll('.detail-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = state.items.find(i => i.noInventaris === btn.dataset.noInv);
                if (item) showDetailModal(item);
            });
        });

        tbody.querySelectorAll('.edit-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = state.items.find(i => i.noInventaris === btn.dataset.noInv);
                if (item) handleEditItem(item);
            });
        });

        tbody.querySelectorAll('.photo-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = state.items.find(i => i.noInventaris === btn.dataset.noInv);
                if (item) showPhotoModal(item);
            });
        });

        tbody.querySelectorAll('.delete-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = state.items.find(i => i.noInventaris === btn.dataset.noInv);
                if (item) handleDeleteItem(item);
            });
        });
    }

    // =================== SORTING ===================
    function bindTableSort() {
        $$('.data-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                if (state.sortField === field) {
                    state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sortField = field;
                    state.sortOrder = 'asc';
                }

                // Update UI
                $$('.data-table th').forEach(t => t.classList.remove('sorted-asc', 'sorted-desc'));
                th.classList.add(state.sortOrder === 'asc' ? 'sorted-asc' : 'sorted-desc');

                sortItems(field, state.sortOrder);
                renderTable();
            });
        });
    }

    function sortItems(field, order) {
        const fieldMap = {
            no: 'no', nama: 'namaBarang', noInv: 'noInventaris',
            kategori: 'kategori', merk: 'merkType', tahun: 'tahunPerolehan',
            jumlah: 'jumlah', harga: 'hargaSatuan', kondisi: 'kondisi', lokasi: 'lokasi'
        };
        const key = fieldMap[field] || field;
        const numericFields = ['jumlah', 'hargaSatuan', 'no'];

        state.filteredItems.sort((a, b) => {
            let va = a[key], vb = b[key];

            if (numericFields.includes(key)) {
                va = parseFloat(va) || 0;
                vb = parseFloat(vb) || 0;
                return order === 'asc' ? va - vb : vb - va;
            }

            va = (va || '').toString().toLowerCase();
            vb = (vb || '').toString().toLowerCase();
            return order === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        });
    }

    // =================== PAGINATION ===================
    function bindPagination() {
        $('#prevPage').addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                renderTable();
            }
        });

        $('#nextPage').addEventListener('click', () => {
            const totalPages = Math.ceil(state.filteredItems.length / state.perPage);
            if (state.currentPage < totalPages) {
                state.currentPage++;
                renderTable();
            }
        });

        $('#perPage').addEventListener('change', e => {
            state.perPage = parseInt(e.target.value);
            state.currentPage = 1;
            renderTable();
        });
    }

    // =================== MODALS ===================
    function bindModals() {
        // Detail modal
        $('#modalClose').addEventListener('click', () => closeModal('detailModal'));
        $('#modalCloseBtn').addEventListener('click', () => closeModal('detailModal'));

        // Photo modal
        $('#photoModalClose').addEventListener('click', () => closeModal('photoModal'));
        $('#photoModalCloseBtn').addEventListener('click', () => closeModal('photoModal'));

        // Item modal close (Add/Edit)
        $('#itemModalClose').addEventListener('click', () => closeModal('itemModal'));
        $('#itemModalCancel').addEventListener('click', () => closeModal('itemModal'));

        // Close on overlay click
        $$('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', e => {
                if (e.target === overlay) closeModal(overlay.id);
            });
        });

        // Photo inputs
        $('#cameraInput').addEventListener('change', handlePhotoUpload);
        $('#galleryInput').addEventListener('change', handlePhotoUpload);

        // Delete photo
        $('#deletePhotoBtn').addEventListener('click', () => {
            const password = prompt("PENGAMANAN: Masukkan password Admin untuk menghapus foto:");
            if (password !== "adminbn2") {
                if (password !== null) showToast("Password salah! Akses ditolak.", "error");
                return;
            }

            if (state.currentPhotoItem) {
                delete state.localPhotos[state.currentPhotoItem.noInventaris];
                saveLocalPhotos();
                updateLocalStorageInfo();
                showPhotoPreview(state.currentPhotoItem);
                renderTable();
                showToast('Foto lokal telah dihapus', 'success');
            }
        });

        // ESC to close
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                $$('.modal-overlay.active').forEach(m => closeModal(m.id));
            }
        });
    }

    function showDetailModal(item) {
        const body = $('#modalBody');
        const photoUrl = getPhotoUrl(item);

        body.innerHTML = `
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">No</span>
                    <span class="detail-value">${escapeHtml(item.no)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">No Inventaris</span>
                    <span class="detail-value">${escapeHtml(item.noInventaris)}</span>
                </div>
                <div class="detail-item full">
                    <span class="detail-label">Nama Barang</span>
                    <span class="detail-value">${escapeHtml(item.namaBarang)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Kategori</span>
                    <span class="detail-value">${escapeHtml(item.kategori)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Merk/Type</span>
                    <span class="detail-value">${escapeHtml(item.merkType)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Tahun Perolehan</span>
                    <span class="detail-value">${escapeHtml(item.tahunPerolehan)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Jumlah</span>
                    <span class="detail-value">${item.jumlah}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Harga Satuan</span>
                    <span class="detail-value">${item.hargaSatuan > 0 ? 'Rp ' + item.hargaSatuan.toLocaleString('id-ID') : '-'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Total Nilai</span>
                    <span class="detail-value" style="font-weight:700;color:var(--blue);">
                        ${item.hargaSatuan > 0 ? 'Rp ' + (item.jumlah * item.hargaSatuan).toLocaleString('id-ID') : '-'}
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Kondisi</span>
                    <span class="detail-value">
                        <span class="kondisi-badge ${getKondisiClass(item.kondisi)}">${escapeHtml(item.kondisi)}</span>
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Lokasi</span>
                    <span class="detail-value">${escapeHtml(item.lokasi)}</span>
                </div>
                <div class="detail-item full">
                    <span class="detail-label">Keterangan</span>
                    <span class="detail-value">${escapeHtml(item.keterangan) || '-'}</span>
                </div>
                ${photoUrl ? `
                    <div class="detail-photo">
                        <span class="detail-label">Dokumentasi</span>
                        <img src="${photoUrl}" alt="Foto ${escapeHtml(item.namaBarang)}" onerror="this.style.display='none'">
                    </div>
                ` : ''}
            </div>
        `;

        $('#modalTitle').textContent = item.namaBarang;
        
        // Update footer to include Delete button
        const footer = $('#detailModalFooter');
        footer.innerHTML = `
            <button class="btn btn-outline" id="modalCloseBtnDetail">Tutup</button>
            <button class="btn btn-danger-outline" id="modalDeleteBtn">
                <i class="fas fa-trash"></i> Hapus Barang
            </button>
        `;
        
        $('#modalCloseBtnDetail').onclick = () => closeModal('detailModal');
        $('#modalDeleteBtn').onclick = () => {
            closeModal('detailModal');
            handleDeleteItem(item);
        };
        
        // Add Print QR button
        const printBtn = document.createElement('button');
        printBtn.className = 'btn btn-outline';
        printBtn.innerHTML = '<i class="fas fa-print"></i> Cetak Label QR';
        printBtn.onclick = () => printLabels([item]);
        footer.insertBefore(printBtn, $('#modalCloseBtnDetail').nextSibling);

        openModal('detailModal');
    }

    function showPhotoModal(item) {
        state.currentPhotoItem = item;
        $('#photoItemName').textContent = `${item.namaBarang} (${item.noInventaris})`;
        showPhotoPreview(item);
        openModal('photoModal');
    }

    function showPhotoPreview(item) {
        const preview = $('#photoPreview');
        const deleteBtn = $('#deletePhotoBtn');
        const photoUrl = getPhotoUrl(item);

        if (photoUrl) {
            preview.innerHTML = `<img src="${photoUrl}" alt="Foto" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-exclamation-triangle\\'></i><span>Gagal memuat foto</span>'">`;
            preview.classList.add('has-photo');
            deleteBtn.style.display = state.localPhotos[item.noInventaris] ? 'inline-flex' : 'none';
        } else {
            preview.innerHTML = '<i class="fas fa-image"></i><span>Belum ada foto</span>';
            preview.classList.remove('has-photo');
            deleteBtn.style.display = 'none';
        }
    }

    function getPhotoUrl(item) {
        // Priority: local photo > Google Drive URL
        if (state.localPhotos[item.noInventaris]) {
            return state.localPhotos[item.noInventaris];
        }
        if (item.dokumentasi) {
            return convertDriveUrl(item.dokumentasi);
        }
        return null;
    }

    function convertDriveUrl(url) {
        if (!url) return null;
        // Convert Google Drive share link to direct image link
        // Format: https://drive.google.com/file/d/FILE_ID/view
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) {
            return `https://lh3.googleusercontent.com/d/${match[1]}=w800`;
        }
        // Format: https://drive.google.com/open?id=FILE_ID
        const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match2) {
            return `https://lh3.googleusercontent.com/d/${match2[1]}=w800`;
        }
        // Already a direct URL
        return url;
    }

    function openModal(id) {
        $(`#${id}`).classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(id) {
        $(`#${id}`).classList.remove('active');
        document.body.style.overflow = '';
    }

    // =================== PHOTO UPLOAD ===================
    function handlePhotoUpload(e) {
        const password = prompt("PENGAMANAN: Masukkan password Admin untuk mengunggah foto:");
        if (password !== "adminbn2") {
            if (password !== null) showToast("Password salah! Akses ditolak.", "error");
            e.target.value = '';
            return;
        }

        const file = e.target.files[0];
        if (!file || !state.currentPhotoItem) return;

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast('Ukuran foto maksimal 2MB. Coba foto lain yang lebih kecil.', 'error');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (ev) {
            // Resize to save storage
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                const maxW = 800;
                const maxH = 600;
                let w = img.width, h = img.height;

                if (w > maxW) { h = (h * maxW) / w; w = maxW; }
                if (h > maxH) { w = (w * maxH) / h; h = maxH; }

                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);

                const compressed = canvas.toDataURL('image/jpeg', 0.7);

                if (state.scriptUrl) {
                    uploadPhotoToAPI(compressed, state.currentPhotoItem);
                } else {
                    state.localPhotos[state.currentPhotoItem.noInventaris] = compressed;
                    saveLocalPhotos();
                    updateLocalStorageInfo();
                    showPhotoPreview(state.currentPhotoItem);
                    renderTable();
                    showToast('Foto berhasil disimpan secara lokal!', 'success');
                }
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    async function uploadPhotoToAPI(base64Data, item) {
        const btnCamera = $('#cameraBtnLabel');
        const btnGallery = $('#galleryBtnLabel');
        const originalHtml = btnCamera.innerHTML;
        
        btnCamera.style.pointerEvents = 'none';
        btnGallery.style.pointerEvents = 'none';
        btnCamera.innerHTML = '<i class="fas fa-spinner spinner"></i> Mengunggah...';

        try {
            // Remove the data:image/jpeg;base64, prefix
            const base64String = base64Data.split(',')[1];
            
            const payload = {
                action: 'uploadPhoto',
                no: item.no,
                noInventaris: item.noInventaris,
                namaBarang: item.namaBarang,
                mimeType: 'image/jpeg',
                filename: `${item.noInventaris.replace(/[\/\\]/g, '_')}_${Date.now()}.jpg`,
                base64: base64String
            };

            const response = await fetch(state.scriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                showToast('Foto berhasil diunggah dan disimpan ke Sheet!', 'success');
                // Store local as cache so UI updates instantly
                state.localPhotos[item.noInventaris] = base64Data;
                saveLocalPhotos();
                showPhotoPreview(item);
                renderTable();
                
                // Fetch new data to ensure link is mapped
                if (state.sheetUrl) fetchData();
            } else {
                throw new Error(result.error || 'Gagal mengunggah foto');
            }
        } catch (err) {
            console.error('Upload Error:', err);
            showToast('Gagal mengunggah foto ke server: ' + err.message, 'error');
            // Fallback to local
            state.localPhotos[item.noInventaris] = base64Data;
            saveLocalPhotos();
            showPhotoPreview(item);
            renderTable();
            showToast('Foto hanya tersimpan secara lokal di perangkat ini.', 'info');
        } finally {
            btnCamera.style.pointerEvents = 'auto';
            btnGallery.style.pointerEvents = 'auto';
            btnCamera.innerHTML = originalHtml;
        }
    }
    function bindAddItem() {
        $('#addBtn').addEventListener('click', () => {
            if (!state.sheetUrl || !state.scriptUrl) {
                showToast('Hubungkan Google Sheet & Apps Script di Pengaturan terlebih dahulu', 'error');
                return;
            }
            
            // Reset form for ADD mode
            $('#itemForm').reset();
            $('#itemFormMode').value = 'add';
            $('#itemFormNo').value = '';
            $('#itemFormNoInv').value = '';
            $('#itemModalTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Tambah Barang Baru';
            $('#submitItemBtn').innerHTML = '<i class="fas fa-save"></i> Simpan';
            
            openModal('itemModal');
        });

        $('#itemForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const mode = $('#itemFormMode').value;
            if (mode === 'edit') {
                const password = prompt("PENGAMANAN: Masukkan password Admin untuk menyimpan perubahan:");
                if (password !== "adminbn2") {
                    if (password !== null) showToast("Password salah! Akses ditolak.", "error");
                    return;
                }
            }
            
            await submitItemForm();
        });
    }

    function handleEditItem(item) {
        if (!state.sheetUrl || !state.scriptUrl) {
            showToast('Hubungkan Google Sheet & Apps Script di Pengaturan terlebih dahulu', 'error');
            return;
        }

        // Fill form for EDIT mode
        $('#itemFormMode').value = 'edit';
        $('#itemFormNo').value = item.no;
        $('#itemFormNoInv').value = item.noInventaris;
        
        $('#addNamaBarang').value = item.namaBarang;
        $('#addKategori').value = item.kategori;
        $('#addMerkType').value = item.merkType;
        $('#addTahun').value = item.tahunPerolehan;
        $('#addJumlah').value = item.jumlah;
        $('#addHarga').value = item.hargaSatuan;
        $('#addKondisi').value = item.kondisi;
        $('#addLokasi').value = item.lokasi;
        $('#addKeterangan').value = item.keterangan;

        $('#itemModalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Barang';
        $('#submitItemBtn').innerHTML = '<i class="fas fa-save"></i> Update Data';

        openModal('itemModal');
    }

    async function submitItemForm() {
        const mode = $('#itemFormMode').value;
        const btn = $('#submitItemBtn');
        const originalHtml = btn.innerHTML;
        
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner spinner"></i> Menyimpan...';

        try {
            const formData = {
                namaBarang: $('#addNamaBarang').value.trim(),
                kategori: $('#addKategori').value,
                merkType: $('#addMerkType').value.trim(),
                tahun: $('#addTahun').value || new Date().getFullYear(),
                jumlah: $('#addJumlah').value || 1,
                harga: $('#addHarga').value || 0,
                kondisi: $('#addKondisi').value,
                lokasi: $('#addLokasi').value,
                keterangan: $('#addKeterangan').value.trim()
            };

            let payload = {
                action: mode === 'edit' ? 'editItem' : 'addItem',
                namaBarang: formData.namaBarang,
                kategori: formData.kategori,
                merkType: formData.merkType,
                tahun: formData.tahun,
                jumlah: formData.jumlah,
                harga: formData.harga,
                kondisi: formData.kondisi,
                lokasi: formData.lokasi,
                keterangan: formData.keterangan,
                password: "adminbn2" // Password server
            };

            if (mode === 'edit') {
                payload.no = $('#itemFormNo').value;
                payload.noInventaris = $('#itemFormNoInv').value;
            } else {
                // ADD logic
                const nextNo = state.items.length > 0 ? Math.max(...state.items.map(i => parseInt(i.no) || 0)) + 1 : 1;
                const katCode = getCategoryCode(formData.kategori);
                const yearShort = formData.tahun.toString().slice(-2);
                
                let maxSeq = 0;
                state.items.forEach(item => {
                    if (item.noInventaris) {
                        const match = item.noInventaris.match(new RegExp(`^INVBN2\\/${katCode}\\/${yearShort}\\/(\\d+)$`));
                        if (match) maxSeq = Math.max(maxSeq, parseInt(match[1]));
                    }
                });
                const seq = String(maxSeq + 1).padStart(3, '0');
                const noInv = `INVBN2/${katCode}/${yearShort}/${seq}`;
                
                payload.no = nextNo;
                payload.noInventaris = noInv;
            }

            const response = await fetch(state.scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                showToast(mode === 'edit' ? 'Data berhasil di-update!' : 'Barang berhasil ditambahkan!', 'success');
                
                if (mode === 'edit') {
                    // Update lokal segera
                    const idx = state.items.findIndex(i => i.noInventaris === payload.noInventaris);
                    if (idx !== -1) {
                        state.items[idx] = { 
                            ...state.items[idx], 
                            ...formData, 
                            tahunPerolehan: formData.tahun,
                            hargaSatuan: formData.harga
                        };
                    }
                } else {
                    const newItem = {
                        no: payload.no,
                        ...formData,
                        tahunPerolehan: formData.tahun,
                        hargaSatuan: formData.harga,
                        noInventaris: payload.noInventaris,
                        dokumentasi: ""
                    };
                    state.items.push(newItem);
                }
                
                renderAll();
                closeModal('itemModal');
                
                // Refresh data final
                setTimeout(() => fetchData(), 3000);
            } else {
                throw new Error(result.error || 'Gagal menyimpan data');
            }
        } catch (err) {
            console.error('Submit Error:', err);
            showToast('Gagal menyimpan data: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    function printLabels(items) {
        if (items.length === 0) return;

        const printWindow = window.open('', '_blank');
        const labelsHtml = items.map(item => {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + window.location.pathname + '?id=' + item.noInventaris)}`;
            
            return `
                <div class="label-card">
                    <div class="label-header">INVENTARIS PERUMAHAN BN2</div>
                    <div class="label-body">
                        <div class="qr-code">
                            <img src="${qrUrl}" alt="QR">
                        </div>
                        <div class="item-info">
                            <div class="item-name">${item.namaBarang}</div>
                            <div class="item-no">${item.noInventaris}</div>
                            <div class="item-loc">Lokasi: ${item.lokasi}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        printWindow.document.write(`
            <html>
            <head>
                <title>Cetak Label Inventaris BN2</title>
                <style>
                    body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; background: #f0f0f0; }
                    .print-grid { 
                        display: grid; 
                        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
                        gap: 15px; 
                    }
                    .label-card {
                        background: white;
                        border: 2px solid #000;
                        border-radius: 8px;
                        padding: 12px;
                        width: 300px;
                        box-sizing: border-box;
                        display: flex;
                        flex-direction: column;
                        page-break-inside: avoid;
                    }
                    .label-header {
                        font-size: 10px;
                        font-weight: 800;
                        text-align: center;
                        border-bottom: 1px solid #000;
                        padding-bottom: 5px;
                        margin-bottom: 8px;
                        letter-spacing: 1px;
                    }
                    .label-body {
                        display: flex;
                        gap: 10px;
                        align-items: center;
                    }
                    .qr-code img {
                        width: 80px;
                        height: 80px;
                    }
                    .item-info {
                        flex: 1;
                    }
                    .item-name {
                        font-size: 14px;
                        font-weight: 700;
                        margin-bottom: 4px;
                        color: #000;
                        text-transform: uppercase;
                    }
                    .item-no {
                        font-size: 11px;
                        font-family: monospace;
                        margin-bottom: 4px;
                        color: #444;
                    }
                    .item-loc {
                        font-size: 10px;
                        color: #666;
                        font-style: italic;
                    }
                    @media print {
                        body { background: white; padding: 0; }
                        .print-grid { gap: 10px; }
                        .label-card { border: 1px solid #ddd; } /* Thinner border for print */
                    }
                </style>
            </head>
            <body>
                <div class="print-grid">
                    ${labelsHtml}
                </div>
                <script>
                    window.onload = () => {
                        setTimeout(() => {
                            window.print();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    async function handleDeleteItem(item) {
        if (!state.scriptUrl) {
            showToast('Fitur hapus membutuhkan koneksi Google Apps Script', 'error');
            return;
        }

        const password = prompt("PENGAMANAN: Masukkan password Admin untuk menghapus barang:");
        if (password !== "adminbn2") {
            if (password !== null) showToast("Password salah! Akses ditolak.", "error");
            return;
        }

        if (!confirm(`Yakin ingin menghapus barang "${item.namaBarang}"? Tindakan ini akan menghapus data dari Google Sheet secara permanen.`)) {
            return;
        }

        const btn = document.querySelector(`.delete-action[data-no-inv="${item.noInventaris}"]`);
        if (btn) btn.innerHTML = '<i class="fas fa-spinner spinner"></i>';

        try {
            const payload = {
                action: 'deleteItem',
                noInventaris: item.noInventaris,
                password: password // Mengirim password ke server untuk keamanan ekstra (jika diterapkan di Apps Script)
            };

            const response = await fetch(state.scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                showToast('Barang berhasil dihapus!', 'success');
                
                // Hapus dari state lokal
                state.items = state.items.filter(i => i.noInventaris !== item.noInventaris);
                
                // Hapus foto lokal jika ada
                if (state.localPhotos[item.noInventaris]) {
                    delete state.localPhotos[item.noInventaris];
                    saveLocalPhotos();
                    updateLocalStorageInfo();
                }

                renderAll();
            } else {
                throw new Error(result.error || 'Gagal menghapus barang');
            }
        } catch (err) {
            console.error('Delete Item Error:', err);
            showToast('Gagal menghapus barang: ' + err.message, 'error');
            if (btn) btn.innerHTML = '<i class="fas fa-trash"></i>';
        }
    }

    function loadLocalPhotos() {
        try {
            const data = localStorage.getItem('inv-photos');
            if (data) state.localPhotos = JSON.parse(data);
        } catch { /* ignore */ }
    }

    function saveLocalPhotos() {
        try {
            localStorage.setItem('inv-photos', JSON.stringify(state.localPhotos));
        } catch (err) {
            showToast('Penyimpanan penuh. Hapus beberapa foto atau bersihkan data browser.', 'error');
        }
    }

    function updateLocalStorageInfo() {
        const photoCount = Object.keys(state.localPhotos).length;
        let storageUsed = 0;
        try {
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    storageUsed += localStorage[key].length * 2; // UTF-16
                }
            }
        } catch { /* ignore */ }

        const usedMB = (storageUsed / (1024 * 1024)).toFixed(2);
        $('#localStorageInfo').textContent = `${photoCount} foto tersimpan · Penyimpanan terpakai: ${usedMB} MB`;
    }

    // =================== EXPORT CSV ===================
    function bindExport() {
        $('#exportCsvBtn').addEventListener('click', exportCSV);
    }

    function exportCSV() {
        const password = prompt("PENGAMANAN: Masukkan password Admin untuk export data:");
        if (password !== "adminbn2") {
            if (password !== null) showToast("Password salah! Akses ditolak.", "error");
            return;
        }

        if (state.filteredItems.length === 0) {
            showToast('Tidak ada data untuk di-export', 'error');
            return;
        }

        const headers = ['NO', 'NAMA BARANG', 'NO INVENTARIS', 'KATEGORI', 'MERK/TYPE', 'TAHUN PEROLEHAN', 'JUMLAH', 'HARGA SATUAN', 'KONDISI', 'LOKASI', 'DOKUMENTASI', 'KETERANGAN'];
        const rows = state.filteredItems.map(item => [
            item.no, item.namaBarang, item.noInventaris, item.kategori,
            item.merkType, item.tahunPerolehan, item.jumlah, item.hargaSatuan,
            item.kondisi, item.lokasi, item.dokumentasi, item.keterangan
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => {
                const val = (cell || '').toString();
                return val.includes(',') || val.includes('"') || val.includes('\n')
                    ? '"' + val.replace(/"/g, '""') + '"'
                    : val;
            }).join(',') + '\n';
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `inventaris_perumahan_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);

        showToast(`${state.filteredItems.length} barang berhasil di-export`, 'success');
    }

    // =================== TOAST ===================
    function showToast(message, type = 'info') {
        const container = $('#toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            ${message}
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // =================== UTILITIES ===================
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str.toString();
        return div.innerHTML;
    }

    // =================== START ===================
    document.addEventListener('DOMContentLoaded', init);
})();
