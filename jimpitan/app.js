/* ========================================
   JIMPITAN BUMI NEIKARTA 2 - APP.JS
   Exact Duplicate Version
   ======================================== */

(function () {
    'use strict';

    const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQfPsk4L2qxshegLjX6zTdY4mPv0e4xYFqbzYFKgqwHJrMuSXAeDJuIFAhdyK2vi4SwyJ2HXZX4h0un/pub?gid=289431951&single=true&output=csv';
    const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbu_k4AGvwsi_DIz1w1oGY51Omw5Yfml7j6HQILG1InKVtNa6fWcBEJkkmezXpzbwCsA/exec';

    // State
    const state = {
        data: [], 
        filteredData: [],
        sheetUrl: '',
        scriptUrl: '',
        activeTab: 'jimpitan',
        selectedMonth: new Date().getMonth() + 1,
        selectedYear: new Date().getFullYear(),
        chartRange: 'harian',
        currentWeekPage: 0, // 0 is latest week
        isAdmin: false,
        chart: null,
        editingIdx: null,
        monthsNames: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
        dayNames: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    };

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    function showLoading() {
        const loader = $('#loadingOverlay');
        if (loader) {
            loader.classList.remove('opacity-0', 'pointer-events-none');
            loader.classList.add('opacity-100');
        }
    }

    function hideLoading() {
        const loader = $('#loadingOverlay');
        if (loader) {
            loader.classList.add('opacity-0', 'pointer-events-none');
            loader.classList.remove('opacity-100');
            // Remove from DOM after transition
            setTimeout(() => { if (loader) loader.classList.add('hidden'); }, 500);
        }
    }

    function init() {
        try {
            console.log("Jimpitan App: Initializing components...");

            // --- Splash Screen ---
            const splash = document.getElementById('splashScreen');
            if (splash) {
                setTimeout(() => {
                    splash.classList.add('fade-out');
                    setTimeout(() => splash.remove(), 700);
                }, 1800);
            }

            bindNavigation();
            bindSettings();
            initDateSelectors();
            loadSettings();
            bindModals();
            bindChartFilters();
            bindExport();
            bindShare();
            bindPwaInstall();
            initPullToRefresh();
            bindEntryForm();
            
            switchTab(state.activeTab);
            
            if (window.lucide) lucide.createIcons();
            
            // Register Service Worker
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('sw.js').then(reg => {
                        console.log('SW Registered', reg.scope);
                    }).catch(err => console.log('SW Registration failed', err));
                });
            }

            // Dark Mode Init
            if (localStorage.getItem('bn2-darkMode') === 'true') {
                document.body.classList.add('dark');
                if ($('#darkModeToggle i')) $('#darkModeToggle i').setAttribute('data-lucide', 'sun');
            }

            $('#darkModeToggle').addEventListener('click', () => {
                const isDark = document.body.classList.toggle('dark');
                localStorage.setItem('bn2-darkMode', isDark);
                $('#darkModeToggle i').setAttribute('data-lucide', isDark ? 'sun' : 'moon');
                if (window.lucide) lucide.createIcons();
            });

            // Admin session check
            if (sessionStorage.getItem('bn2-isAdmin') === 'true') {
                state.isAdmin = true;
                $('#addDataBtn').classList.remove('hidden');
            }
            
            updateAdminUI();

            if (state.sheetUrl) {
                console.log("Jimpitan App: Fetching data from", state.sheetUrl);
                fetchData();
            }
        } catch (e) {
            console.error("Jimpitan App: Initialization failed", e);
        }
    }

    function loadSettings() {
        state.sheetUrl = localStorage.getItem('bn2-jimpitanUrl') || DEFAULT_SHEET_URL;
        state.scriptUrl = localStorage.getItem('bn2-scriptUrl') || DEFAULT_SCRIPT_URL;
        
        if (state.sheetUrl) {
            $('#sheetUrl').value = state.sheetUrl;
        }
        if (state.scriptUrl) {
            $('#scriptUrl').value = state.scriptUrl;
        }
    }

    // =================== NAVIGATION ===================
    function bindNavigation() {
        $$('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                switchTab(btn.dataset.tab);
            });
        });

        $('#adminBtn').addEventListener('click', () => {
            if (state.isAdmin) {
                switchTab('settings');
            } else {
                $('#authModal').classList.remove('hidden');
                $('#adminPass').focus();
            }
        });

        $('#backFromSettings').addEventListener('click', () => {
            switchTab('jimpitan');
        });
    }

    function switchTab(tabName) {
        state.activeTab = tabName;
        
        if (tabName === 'settings') {
            $('#view-settings').classList.remove('hidden');
        } else {
            $('#view-settings').classList.add('hidden');
            renderAll();
        }
    }

    function bindChartFilters() {
        $$('.chart-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.chartRange = btn.dataset.range;
                
                $$('.chart-filter-btn').forEach(b => {
                    const isActive = b.dataset.range === state.chartRange;
                    if (isActive) {
                        b.classList.add('bg-emerald-700', 'text-white', 'shadow-sm');
                        b.classList.remove('bg-emerald-50', 'text-emerald-700');
                    } else {
                        b.classList.remove('bg-emerald-700', 'text-white', 'shadow-sm');
                        b.classList.add('bg-emerald-50', 'text-emerald-700');
                    }
                });
                
                renderAll();
            });
        });
    }

    function bindExport() {
        $('#exportBtn').addEventListener('click', () => {
            if (state.filteredData.length === 0) return showToast('Tidak ada data untuk diekspor', 'info');
            
            const csvContent = Papa.unparse(state.filteredData);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `Rekap_Jimpitan_${state.selectedMonth}_${state.selectedYear}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // =================== SHARE TO WHATSAPP ===================
    function bindShare() {
        const openBtn  = $('#shareBtn');
        const modal    = $('#shareModal');
        const closeBtn = $('#closeShareModal');
        const weekBtn  = $('#shareWeekBtn');
        const monthBtn = $('#shareMonthBtn');

        if (!openBtn || !modal) return;

        // Open bottom sheet
        openBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        });

        // Close bottom sheet (backdrop or X button)
        closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });

        // ---- Share Mingguan ----
        weekBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            const text = generateWeeklyShareText();
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        });

        // ---- Share Bulanan ----
        monthBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            const text = generateMonthlyShareText();
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        });
    }

    // Builds week groups for a given month (Sunday-start, same as rekap list)
    function buildWeeksForMonth(monthIdx, year, tipeFilter) {
        const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
        const allDates = [];
        for (let d = 1; d <= daysInMonth; d++) allDates.push(new Date(year, monthIdx, d));

        // Group into Sun-Sat weeks
        const weeks = [];
        let cur = [];
        allDates.forEach((date, i) => {
            cur.push(date);
            if (date.getDay() === 6 || i === allDates.length - 1) {
                weeks.push(cur);
                cur = [];
            }
        });

        // Map transactions per date
        const filtered = state.filteredData.filter(d => tipeFilter ? d.tipe === tipeFilter : true);
        const dataMap  = {};
        filtered.forEach(item => {
            const k = item.dateObj.toDateString();
            if (!dataMap[k]) dataMap[k] = [];
            dataMap[k].push(item);
        });

        return weeks.map((week, idx) => {
            const items = week.flatMap(d => dataMap[d.toDateString()] || []);
            const total = items.reduce((s, i) => s + i.nominal, 0);
            return { weekNum: idx + 1, week, items, total };
        });
    }

    function generateWeeklyShareText() {
        const monthIdx  = state.selectedMonth - 1;
        const year      = state.selectedYear;
        const monthName = state.monthsNames[monthIdx];
        const monthShort= monthName.substring(0, 3);
        const isJimpitan= state.activeTab === 'jimpitan';
        const tipeLabel = isJimpitan ? 'Jimpitan' : 'Pengeluaran';
        const tipeFilter= isJimpitan ? 'JIMPITAN' : 'PENGELUARAN';

        const weeks = buildWeeksForMonth(monthIdx, year, tipeFilter);
        const totalWeeks = weeks.length;

        // currentWeekPage 0 = latest week displayed
        const reversedIdx = state.currentWeekPage;
        const weekData = [...weeks].reverse()[reversedIdx] || weeks[weeks.length - 1];

        const { weekNum, week, items, total } = weekData;
        const startDate = week[0].getDate();
        const endDate   = week[week.length - 1].getDate();
        const rangeStr  = `${startDate}–${endDate} ${monthShort} ${year}`;

        // Build transaction lines
        const lines = items.length > 0
            ? items.map(d => {
                const dayName = state.dayNames[d.dateObj.getDay()];
                const ket = d.keterangan !== '-' ? ` (${d.keterangan})` : '';
                return `  • ${dayName}, ${d.dateObj.getDate()} ${monthShort} — ${formatRp(d.nominal)}${ket}`;
              }).join('\n')
            : '  (Tidak ada transaksi minggu ini)';

        const emoji = isJimpitan ? '💰' : '💸';

        return `${emoji} *Rekap ${tipeLabel} Minggu Ke-${weekNum}*
🏡 Jimpitan Bumi Neikarta 2
📅 ${rangeStr}
${'─'.repeat(32)}
${lines}
${'─'.repeat(32)}
*Total Minggu Ke-${weekNum}: ${formatRp(total)}*

_Dikirim via Jimpitan BN2 App 🚀_`;
    }

    function generateMonthlyShareText() {
        const monthIdx  = state.selectedMonth - 1;
        const year      = state.selectedYear;
        const monthName = state.monthsNames[monthIdx];
        const isJimpitan= state.activeTab === 'jimpitan';
        const tipeLabel = isJimpitan ? 'Jimpitan' : 'Pengeluaran';
        const tipeFilter= isJimpitan ? 'JIMPITAN' : 'PENGELUARAN';

        const monthIn  = state.filteredData.filter(d => d.tipe === 'JIMPITAN').reduce((s, i) => s + i.nominal, 0);
        const monthOut = state.filteredData.filter(d => d.tipe === 'PENGELUARAN').reduce((s, i) => s + i.nominal, 0);
        const saldo    = monthIn - monthOut;
        const entries  = new Set(state.filteredData.map(d => d.dateObj.toDateString())).size;

        // Per-week breakdown
        const weeks      = buildWeeksForMonth(monthIdx, year, tipeFilter);
        const monthShort = monthName.substring(0, 3);

        const weekLines = weeks.map(({ weekNum, week, total }) => {
            const s = week[0].getDate();
            const e = week[week.length - 1].getDate();
            return `  *Minggu ${weekNum}* (${s}–${e} ${monthShort}): ${formatRp(total)}`;
        }).join('\n');

        return `📊 *Rekap ${tipeLabel} — ${monthName} ${year}*
🏡 Jimpitan Bumi Neikarta 2
${'─'.repeat(32)}
💰 *Total Jimpitan*   : ${formatRp(monthIn)}
💸 *Total Pengeluaran*: ${formatRp(monthOut)}
📈 *Saldo Bulan Ini*  : ${formatRp(saldo)}
📅 *Entri Data*       : ${entries} hari aktif
${'─'.repeat(32)}
📆 *Breakdown Per Minggu (${tipeLabel}):*
${weekLines}
${'─'.repeat(32)}
*Total ${tipeLabel}: ${formatRp(isJimpitan ? monthIn : monthOut)}*

_Dikirim via Jimpitan BN2 App 🚀_`;
    }

    // =================== TOAST NOTIFICATION ===================
    function showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const icons = {
            success: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
            error:   '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info:    '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
            offline: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>'
        };
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.innerHTML = `${icons[type] || ''}<span style="flex:1">${message}</span>`;
        container.appendChild(el);
        const dismiss = () => { el.classList.add('hide'); setTimeout(() => el.remove(), 300); };
        el.addEventListener('click', dismiss);
        setTimeout(dismiss, duration);
    }

    // =================== PWA INSTALL BANNER ===================
    function bindPwaInstall() {
        let deferredPrompt = null;
        const banner     = document.getElementById('pwaBanner');
        const installBtn = document.getElementById('pwaInstall');
        const dismissBtn = document.getElementById('pwaDismiss');
        if (!banner || localStorage.getItem('bn2-pwaDismissed')) return;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            banner.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        });

        installBtn && installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') showToast('Aplikasi berhasil diinstall! 🎉', 'success');
            deferredPrompt = null;
            banner.classList.add('hidden');
        });

        dismissBtn && dismissBtn.addEventListener('click', () => {
            banner.classList.add('hidden');
            localStorage.setItem('bn2-pwaDismissed', '1');
        });

        window.addEventListener('appinstalled', () => {
            banner.classList.add('hidden');
            showToast('Jimpitan BN2 sudah terpasang!', 'success');
        });
    }

    // =================== DATA ENTRY FORM ===================
    function bindEntryForm() {
        const addBtn   = $('#addDataBtn');
        const modal    = $('#entryModal');
        const closeBtn = $('#closeEntryModal');
        const form     = $('#entryForm');

        if (!addBtn || !modal) return;

        addBtn.addEventListener('click', () => {
            if (!state.scriptUrl) {
                showToast('Apps Script URL belum diatur di Pengaturan', 'error');
                switchTab('settings');
                return;
            }
            state.editingIdx = null;
            // Set default date to today (local time)
            const today = new Date().toISOString().split('T')[0];
            $('#entryDate').value = today;
            $('#entryType').value = state.activeTab.toUpperCase();
            $('#entryKeterangan').value = '';
            $('#entryNominal').value = '';
            
            $('#submitEntryBtn').innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Simpan Data';
            $('#entryModal h3').textContent = 'Tambah Data Baru';
            
            modal.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        });

        closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = $('#submitEntryBtn');
            const originalHtml = btn.innerHTML;
            const isEdit = state.editingIdx !== null;
            
            const typeRaw = $('#entryType').value;
            const entryDate = new Date($('#entryDate').value);
            const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            const formattedDate = `${entryDate.getDate()}-${monthShort[entryDate.getMonth()]}-${entryDate.getFullYear()}`;

            const payload = {
                action: isEdit ? 'editItem' : 'addItem',
                tanggal: formattedDate,
                tipe: typeRaw === 'JIMPITAN' ? 'Pemasukan' : (typeRaw === 'PENGELUARAN' ? 'Pengeluaran' : typeRaw),
                nominal: parseInt($('#entryNominal').value),
                keterangan: $('#entryKeterangan').value.trim() || '-',
                password: 'adminbn2'
            };

            if (isEdit) {
                payload.row = state.editingIdx + 2; // Google Sheets row (1-indexed + header)
            }

            if (isNaN(payload.nominal)) return showToast('Nominal tidak valid', 'error');

            btn.disabled = true;
            btn.innerHTML = '<i class="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full"></i> Menyimpan...';

            try {
                const response = await fetch(state.scriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (result.success) {
                    showToast(isEdit ? 'Data berhasil diperbarui!' : 'Data berhasil disimpan!', 'success');
                    modal.classList.add('hidden');
                    form.reset();
                    state.editingIdx = null;
                    // Refresh data
                    fetchData();
                } else {
                    throw new Error(result.error || 'Gagal menyimpan data');
                }
            } catch (err) {
                console.error('Entry Error:', err);
                showToast('Gagal: ' + err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = isEdit ? '<i data-lucide="save" class="w-4 h-4"></i> Update Data' : '<i data-lucide="save" class="w-4 h-4"></i> Simpan Data';
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    async function deleteEntry(idx) {
        if (!confirm('Yakin ingin menghapus data ini?')) return;
        if (!state.scriptUrl) return showToast('Script URL belum diatur', 'error');

        const btn = $('#deleteEntryBtn');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="w-3 h-3 animate-spin border-2 border-rose-600 border-t-transparent rounded-full"></i>';

        try {
            const response = await fetch(state.scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'deleteItem',
                    row: idx + 2,
                    password: 'adminbn2'
                })
            });

            const result = await response.json();
            if (result.success) {
                showToast('Data berhasil dihapus!', 'success');
                $('#detailModal').classList.add('hidden');
                fetchData();
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            showToast('Gagal menghapus: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    // =================== PULL TO REFRESH ===================
    function initPullToRefresh() {
        const appEl    = document.querySelector('.max-w-md');
        const indicator = document.getElementById('pullIndicator');
        const pullText  = document.getElementById('pullText');
        const pullIcon  = document.getElementById('pullIcon');
        if (!appEl || !indicator) return;

        let startY = 0, currentY = 0, pulling = false;
        const THRESHOLD = 80;

        appEl.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) { startY = e.touches[0].clientY; pulling = true; }
        }, { passive: true });

        appEl.addEventListener('touchmove', (e) => {
            if (!pulling) return;
            currentY = e.touches[0].clientY;
            const delta = currentY - startY;
            if (delta > 20) {
                indicator.classList.add('visible');
                if (pullText) pullText.textContent = delta > THRESHOLD ? 'Lepaskan untuk refresh' : 'Tarik untuk refresh';
                if (pullIcon) pullIcon.style.transform = `rotate(${Math.min(delta * 2, 360)}deg)`;
            }
        }, { passive: true });

        appEl.addEventListener('touchend', () => {
            if (!pulling) return;
            pulling = false;
            const delta = currentY - startY;
            if (delta > THRESHOLD && state.sheetUrl) {
                if (pullText) pullText.textContent = 'Memperbarui...';
                if (pullIcon) pullIcon.classList.add('pull-spin');
                fetchData().finally(() => {
                    setTimeout(() => {
                        indicator.classList.remove('visible');
                        if (pullIcon) { pullIcon.classList.remove('pull-spin'); pullIcon.style.transform = ''; }
                    }, 800);
                });
            } else {
                indicator.classList.remove('visible');
                if (pullIcon) pullIcon.style.transform = '';
            }
            startY = 0; currentY = 0;
        }, { passive: true });
    }

    // =================== AUTHENTICATION ===================
    function updateAdminUI() {
        const addBtn = $('#addDataBtn');
        const adminActions = $('#adminDetailActions');
        const badge = $('#adminBadge');
        
        if (state.isAdmin) {
            if (addBtn) addBtn.style.setProperty('display', 'block', 'important');
            if (adminActions) adminActions.style.setProperty('display', 'grid', 'important');
            if (badge) badge.style.setProperty('display', 'inline-block', 'important');
        } else {
            if (addBtn) addBtn.style.display = 'none';
            if (adminActions) adminActions.style.display = 'none';
            if (badge) badge.style.display = 'none';
        }
        if (window.lucide) lucide.createIcons();
    }

    function bindSettings() {
        $('#confirmAuthBtn').addEventListener('click', () => {
            const pass = $('#adminPass').value.trim();
            // Obfuscated password check (adminbn2)
            if (btoa(pass) === 'YWRtaW5ibjI=') {
                state.isAdmin = true;
                sessionStorage.setItem('bn2-isAdmin', 'true');
                $('#adminPass').value = '';
                $('#authModal').classList.add('hidden');
                
                showToast('Mode Admin Aktif', 'success');
                updateAdminUI();
                
                // Refresh current view to show buttons
                if (state.activeTab === 'settings') switchTab('jimpitan');
                else renderAll();
            } else {
                showToast('Password salah! Coba lagi.', 'error');
            }
        });

        $('#closeAuthBtn').addEventListener('click', () => {
            $('#authModal').classList.add('hidden');
        });

        $('#connectBtn').addEventListener('click', async () => {
            const url = $('#sheetUrl').value.trim();
            const scriptUrl = $('#scriptUrl').value.trim();
            if (!url) return;
            
            localStorage.setItem('bn2-jimpitanUrl', url);
            localStorage.setItem('bn2-scriptUrl', scriptUrl);
            state.sheetUrl = url;
            state.scriptUrl = scriptUrl;
            
            $('#connectionStatus').textContent = 'Menghubungkan...';
            try {
                await fetchData();
                $('#connectionStatus').textContent = 'Konfigurasi disimpan & Data diperbarui!';
                setTimeout(() => $('#connectionStatus').textContent = '', 3000);
            } catch (err) {
                $('#connectionStatus').textContent = 'Gagal memuat data!';
            }
        });

        $('#disconnectBtn').addEventListener('click', () => {
            if(confirm('Putuskan koneksi data?')) {
                localStorage.removeItem('bn2-jimpitanUrl');
                localStorage.removeItem('bn2-scriptUrl');
                state.sheetUrl = '';
                state.scriptUrl = '';
                state.data = [];
                location.reload();
            }
        });
    }

    // =================== FETCH DATA ===================
    function normalizeSheetUrl(url) {
        // Handle "Publish to the web" links (both /pub and /pubhtml)
        if (url.includes('/pubhtml') || url.includes('/pub')) {
            let baseUrl = url.split(/[?#]/)[0].replace('/pubhtml', '/pub');
            const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
            const gid = gidMatch ? gidMatch[1] : '0';
            return `${baseUrl}?gid=${gid}&single=true&output=csv`;
        }
        
        // Handle regular editing links (NOT published /e/ links)
        const match = url.match(/\/d\/([a-zA-Z0-9-_]{20,})/); // Regular IDs are usually long
        if (match && !url.includes('/d/e/')) {
            const sheetId = match[1];
            let csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
            const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
            if (gidMatch) {
                csvUrl += `&gid=${gidMatch[1]}`;
            }
            return csvUrl;
        }
        
        // If it's a published link in /d/e/ format but not yet using /pub
        if (url.includes('/d/e/')) {
            const matchPub = url.match(/\/d\/e\/([a-zA-Z0-9-_]+)/);
            if (matchPub) {
                const pubId = matchPub[1];
                const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
                const gid = gidMatch ? gidMatch[1] : '0';
                return `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?gid=${gid}&single=true&output=csv`;
            }
        }

        return url;
    }

    async function fetchCSV(url) {
        url = normalizeSheetUrl(url);
        // Try multiple methods to handle CORS
        const methods = [
            // Method 1: Direct fetch
            () => fetch(url).then(r => { if (!r.ok) throw new Error('Direct fetch failed'); return r.text(); }),
            // Method 2: CORS proxy via corsproxy.io
            () => fetch('https://corsproxy.io/?' + encodeURIComponent(url)).then(r => { if (!r.ok) throw new Error('Proxy 1 failed'); return r.text(); }),
            // Method 3: CORS proxy via codetabs
            () => fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url)).then(r => { if (!r.ok) throw new Error('Proxy 2 failed'); return r.text(); }),
            // Method 4: AllOrigins (JSON wrapper)
            () => fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(url)).then(r => r.json()).then(data => { if (!data.contents) throw new Error('Proxy 3 failed'); return data.contents; }),
        ];

        let lastError;
        for (const method of methods) {
            try {
                const csv = await method();
                if (csv && csv.trim().length > 0 && !csv.trim().toLowerCase().startsWith('<!doctype html>')) {
                    return csv;
                }
            } catch (err) {
                lastError = err;
                continue;
            }
        }
        throw lastError || new Error('Gagal memuat data CSV');
    }

    async function fetchData() {
        if (!state.sheetUrl) {
            hideLoading();
            return;
        }
        
        showLoading();
        try {
            const csv = await fetchCSV(state.sheetUrl);
            localStorage.setItem('bn2-jimpitanData', csv);
            parseCSVData(csv);
        } catch (err) {
            console.error('Fetch error:', err);
            
            // Try loading from LocalStorage
            const cachedData = localStorage.getItem('bn2-jimpitanData');
            if (cachedData) {
                console.log('Loading from cache due to fetch error');
                parseCSVData(cachedData);
                hideLoading();
                showToast('Mode offline — menampilkan data terakhir', 'offline');
            } else {
                hideLoading();
                showToast('Gagal memuat data. Cek URL atau koneksi internet.', 'error');
            }
        }
    }

    function parseCSVData(csv) {
        const result = Papa.parse(csv, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() });
        const monthNamesMap = {
            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mei': 4, 'jun': 5,
            'jul': 6, 'agu': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'des': 11,
            'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
            'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
        };

        state.data = result.data.map((row, idx) => {
            const get = (...keys) => {
                for (const k of keys) {
                    const cleanK = k.toUpperCase();
                    const foundKey = Object.keys(row).find(rk => rk.trim().toUpperCase() === cleanK);
                    if (foundKey) return row[foundKey].toString().trim();
                }
                return '';
            };

            const typeRaw = (get('TIPE', 'JENIS', 'KATEGORI', 'KATEGORY') || '').toLowerCase();
            const isPengeluaran = typeRaw.includes('keluar') || typeRaw.includes('pengeluaran');
            
            let dateObj = new Date();
            const tglStr = get('TANGGAL', 'DATE', 'WAKTU');
            if (tglStr) {
                const parts = tglStr.split(/[-/ ]/);
                if (parts.length === 3) {
                    let d, m, y;
                    // Check if first part is Year (YYYY-MM-DD)
                    if (parts[0].length === 4) {
                        y = parseInt(parts[0]);
                        m = parseInt(parts[1]) - 1;
                        d = parseInt(parts[2]);
                    } else {
                        // Assume DD-MM-YYYY
                        d = parseInt(parts[0]);
                        m = parseInt(parts[1]) - 1;
                        y = parseInt(parts[2]);
                    }

                    // Handle string months (Jan, Feb, Apr, etc)
                    if (isNaN(m) || m < 0 || m > 11) {
                        const mLower = (parts[1] || parts[0]).toLowerCase();
                        if (monthNamesMap[mLower] !== undefined) {
                            m = monthNamesMap[mLower];
                        } else {
                            for (let key in monthNamesMap) {
                                if (mLower.startsWith(key)) {
                                    m = monthNamesMap[key];
                                    break;
                                }
                            }
                        }
                    }

                    if (y < 100) y += 2000;
                    dateObj = new Date(y, m, d);
                } else {
                    dateObj = new Date(tglStr);
                }
            }

            if (isNaN(dateObj.getTime())) dateObj = new Date();

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
        if (!str || str.trim() === '-' || str.trim() === '') return 0;
        const cleaned = str.replace(/[Rp.\s,]/g, '');
        return parseInt(cleaned) || 0;
    }

    function formatRp(num) {
        return 'Rp ' + Math.abs(num).toLocaleString('id-ID');
    }

    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay(); // 0 is Sunday
        d.setDate(d.getDate() - day);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function getWeekOfMonth(date) {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const firstSunday = new Date(firstDay);
        firstSunday.setDate(firstDay.getDate() - firstDay.getDay());
        
        const diff = date.getTime() - firstSunday.getTime();
        return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
    }

    // =================== RENDER ===================
    function renderAll() {
        try {
            console.log("Jimpitan App: Rendering view...");
            const periodText = `${state.monthsNames[state.selectedMonth - 1]} ${state.selectedYear}`;
            
            const rangeText = state.chartRange.charAt(0).toUpperCase() + state.chartRange.slice(1);
            const chartTitle = $('#chartRangeTitle');
            if (chartTitle) chartTitle.textContent = `Tren ${rangeText} — ${periodText}`;
            
            const rekapLbl = $('#rekapPeriodLabel');
            if (rekapLbl) rekapLbl.textContent = periodText;

            // Filter data
            state.filteredData = state.data.filter(d => 
                d.dateObj.getMonth() + 1 === state.selectedMonth && 
                d.dateObj.getFullYear() === state.selectedYear
            );

            const currentViewData = state.filteredData.filter(d => d.tipe === state.activeTab.toUpperCase());

            // Calculations
            const monthIn = state.filteredData.filter(d => d.tipe === 'JIMPITAN').reduce((s, i) => s + i.nominal, 0);
            const monthOut = state.filteredData.filter(d => d.tipe === 'PENGELUARAN').reduce((s, i) => s + i.nominal, 0);
            
            const yearData = state.data.filter(d => d.dateObj.getFullYear() === state.selectedYear);
            const yearIn = yearData.filter(d => d.tipe === 'JIMPITAN').reduce((s, i) => s + i.nominal, 0);
            const yearOut = yearData.filter(d => d.tipe === 'PENGELUARAN').reduce((s, i) => s + i.nominal, 0);

            const daysWithData = new Set(state.filteredData.map(d => d.dateObj.toDateString())).size;

            // Update UI
            if ($('#summaryJimpitan')) $('#summaryJimpitan').textContent = formatRp(monthIn);
            if ($('#summaryPengeluaran')) $('#summaryPengeluaran').textContent = `-${formatRp(monthOut)}`;
            if ($('#saldoBulanIni')) $('#saldoBulanIni').textContent = formatRp(monthIn - monthOut);

            // --- Month Comparison Delta (F) ---
            const deltaEl = $('#saldoDelta');
            if (deltaEl) {
                const prevM    = state.selectedMonth === 1 ? 12 : state.selectedMonth - 1;
                const prevY    = state.selectedMonth === 1 ? state.selectedYear - 1 : state.selectedYear;
                const prevData = state.data.filter(d => d.dateObj.getMonth() + 1 === prevM && d.dateObj.getFullYear() === prevY);
                const prevIn   = prevData.filter(d => d.tipe === 'JIMPITAN').reduce((s, i) => s + i.nominal, 0);
                const prevOut  = prevData.filter(d => d.tipe === 'PENGELUARAN').reduce((s, i) => s + i.nominal, 0);
                const prevSaldo = prevIn - prevOut;
                const currSaldo = monthIn - monthOut;
                if (prevData.length > 0) {
                    const delta = currSaldo - prevSaldo;
                    const sign  = delta >= 0 ? '↑' : '↓';
                    const prevMonthName = state.monthsNames[prevM - 1].substring(0, 3);
                    deltaEl.textContent = `${sign} ${delta >= 0 ? '+' : ''}${formatRp(Math.abs(delta))} vs ${prevMonthName} ${prevY}`;
                    deltaEl.style.opacity = '0.85';
                } else {
                    deltaEl.textContent = '';
                    deltaEl.style.opacity = '0';
                }
            }

            if ($('#totalTahunIni')) $('#totalTahunIni').textContent = formatRp(state.activeTab === 'jimpitan' ? yearIn : yearOut);
            if ($('#entriDataCount')) $('#entriDataCount').textContent = `${daysWithData} hari`;

            renderRekapList(currentViewData);
            renderChart();
            
            const isJimpitan = state.activeTab === 'jimpitan';
            const themeColor = isJimpitan ? 'emerald' : 'rose';
            const themeBg = isJimpitan ? 'bg-emerald-700' : 'bg-rose-700';
            const themeBgLight = isJimpitan ? 'bg-emerald-50' : 'bg-rose-50';
            const themeText = isJimpitan ? 'text-emerald-700' : 'text-rose-700';

            // Update UI Colors
            const header = $('header');
            if (header) {
                header.classList.remove('bg-emerald-700', 'bg-rose-700');
                header.classList.add(themeBg);
            }
            
            const statusCard = $('#statusCard'); 
            if (statusCard) {
                statusCard.classList.remove('bg-emerald-700', 'bg-rose-700');
                statusCard.classList.add(themeBg);
                statusCard.classList.remove('shadow-emerald-700/20', 'shadow-rose-700/20');
                statusCard.classList.add(`shadow-${themeColor}-700/20`);
            }

            // Update Tab Buttons theme
            $$('.tab-btn').forEach(b => {
                const isActive = b.dataset.tab === state.activeTab;
                b.classList.remove('active', 'bg-emerald-700', 'bg-rose-700', 'text-white', 'shadow-sm', 'text-slate-500', 'bg-white', 'text-emerald-700', 'text-rose-700');
                
                if (isActive) {
                    b.classList.add(themeBg, 'text-white', 'shadow-sm');
                } else {
                    b.classList.add('bg-white', themeText);
                }
            });

            // Update Chart Filter Buttons
            $$('.chart-filter-btn').forEach(b => {
                const isActive = b.dataset.range === state.chartRange;
                b.classList.remove('bg-emerald-700', 'text-white', 'shadow-sm', 'bg-emerald-50', 'text-emerald-600', 'text-emerald-700', 'bg-rose-700', 'bg-rose-50', 'text-rose-600', 'text-rose-700');
                
                if (isActive) {
                    b.classList.add(themeBg, 'text-white', 'shadow-sm');
                } else {
                    b.classList.add(themeBgLight, themeText);
                }
            });

            // Update Section Icons
            $$('[data-lucide="history"], [data-lucide="line-chart"], [data-lucide="trending-up"]').forEach(icon => {
                icon.classList.remove('text-emerald-600', 'text-rose-600');
                icon.classList.add(isJimpitan ? 'text-emerald-600' : 'text-rose-600');
            });

            // Update Export Button
            const exportBtn = $('#exportBtn');
            if (exportBtn) {
                exportBtn.classList.remove('bg-emerald-50', 'text-emerald-600', 'text-emerald-700', 'bg-rose-50', 'text-rose-600', 'text-rose-700');
                exportBtn.classList.add(themeBgLight, themeText);
            }

            if (window.lucide) lucide.createIcons();
            
            // Hide loading overlay
            hideLoading();
        } catch (e) {
            console.error("Jimpitan App: Render failed", e);
            hideLoading();
        }
    }

    function renderRekapList(items) {
        try {
            const container = $('#rekapList');
            if (!container) return;

            // Trigger fade animation
            container.classList.remove('tab-content-animate');
            void container.offsetWidth; // force reflow
            container.classList.add('tab-content-animate');
            const monthIdx = state.selectedMonth - 1;
            const year = state.selectedYear;
            
            // Get all days in month
            const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
            const allDates = [];
            for (let d = 1; d <= daysInMonth; d++) {
                allDates.push(new Date(year, monthIdx, d));
            }

            // Map data items to dates
            const dataMap = {};
            items.forEach(item => {
                const dStr = item.dateObj.toDateString();
                if (!dataMap[dStr]) dataMap[dStr] = [];
                dataMap[dStr].push(item);
            });

            // Group dates by week (Sunday start)
            const weeks = [];
            let currentWeek = [];
            
            allDates.forEach((date, i) => {
                currentWeek.push(date);
                // If it's Saturday or the last day of the month, end the week
                if (date.getDay() === 6 || i === allDates.length - 1) {
                    weeks.push(currentWeek);
                    currentWeek = [];
                }
            });

            let html = '';
            const totalWeeks = weeks.length;
            
            // Reset page if out of bounds
            if (state.currentWeekPage >= totalWeeks) state.currentWeekPage = 0;
            if (state.currentWeekPage < 0) state.currentWeekPage = 0;
            
            // Render current week (from latest)
            const reversedWeeks = [...weeks].reverse();
            const week = reversedWeeks[state.currentWeekPage];
            
            if (week) {
                const start = week[0];
                const end = week[week.length - 1];
                const weekNum = getWeekOfMonth(start);
                
                let weekTotal = 0;
                let weekHtml = '';

                week.forEach(date => {
                    const dStr = date.toDateString();
                    const dayItems = dataMap[dStr] || [];
                    const dayName = state.dayNames[date.getDay()];
                    const monthNameShort = (state.monthsNames[monthIdx] || '').substring(0,3);
                    const dateDisplay = `${date.getDate()} ${monthNameShort}`;
                    const isJimpitan = state.activeTab === 'jimpitan';

                    if (dayItems.length > 0) {
                        dayItems.forEach(item => {
                            const isPengeluaranItem = item.tipe === 'PENGELUARAN' || item.tipe === 'Pengeluaran';
                            weekTotal += item.nominal;
                            weekHtml += `
                                <div class="bg-white border border-slate-50 p-4 rounded-lg flex items-center gap-4 hover:border-emerald-100 transition-all active:scale-[0.99] cursor-pointer shadow-sm shadow-slate-200/20" onclick="window.showDetailById(${item.idx})">
                                    <div class="w-10 h-10 rounded-lg flex items-center justify-center ${!isPengeluaranItem ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}">
                                        <i data-lucide="${!isPengeluaranItem ? 'trending-up' : 'receipt'}" class="w-5 h-5"></i>
                                    </div>
                                    <div class="flex-1">
                                        <div class="text-xs font-bold text-slate-800 line-clamp-1">${item.keterangan !== '-' ? item.keterangan : (!isPengeluaranItem ? 'Jimpitan Warga' : 'Pengeluaran')}</div>
                                        <div class="text-[10px] text-slate-400 font-medium">${dayName}, ${dateDisplay}</div>
                                    </div>
                                    <div class="flex flex-col items-end gap-1">
                                        <span class="${isPengeluaranItem ? 'text-rose-600' : 'text-emerald-600'} font-bold text-sm">
                                            ${isPengeluaranItem ? '-' : '+'}${formatRp(item.nominal)}
                                        </span>
                                        ${state.isAdmin ? `
                                        <div class="flex gap-1 mt-1">
                                            <button onclick="event.stopPropagation(); window.handleEditByIdx(${item.idx})" class="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-lg text-slate-500 active:bg-slate-200" title="Edit">
                                                <i data-lucide="edit-3" class="w-4 h-4" style="pointer-events: none;"></i>
                                            </button>
                                            <button onclick="event.stopPropagation(); window.deleteEntry(${item.idx})" class="w-10 h-10 flex items-center justify-center bg-rose-50 rounded-lg text-rose-500 active:bg-rose-100" title="Hapus">
                                                <i data-lucide="trash-2" class="w-4 h-4" style="pointer-events: none;"></i>
                                            </button>
                                        </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `;
                        });
                    } else {
                        weekHtml += `
                            <div class="bg-slate-50/50 border border-dashed border-slate-100 p-3 rounded-lg flex items-center gap-4 opacity-60">
                                <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-300">
                                    <i data-lucide="minus" class="w-4 h-4"></i>
                                </div>
                                <div class="flex-1">
                                    <div class="text-[10px] font-bold text-slate-400">Tidak ada data</div>
                                    <div class="text-[9px] text-slate-300 font-medium">${dayName}, ${dateDisplay}</div>
                                </div>
                                <div class="text-[10px] font-bold text-slate-300">Rp 0</div>
                            </div>
                        `;
                    }
                });

                const isJimpitan = state.activeTab === 'jimpitan';
                html = `
                    <div class="space-y-3 pb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div class="flex items-center justify-between gap-3">
                            <div class="flex items-center gap-2">
                                 <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Minggu ${weekNum}</span>
                                 <span class="text-[9px] font-medium text-slate-300">(${start.getDate()} - ${end.getDate()} ${(state.monthsNames[monthIdx] || '').substring(0,3)})</span>
                            </div>
                            <div class="flex gap-1">
                                <button class="p-1.5 rounded-lg bg-slate-100 text-slate-400 disabled:opacity-30 hover:bg-slate-200 transition-colors" id="prevWeekBtn" ${state.currentWeekPage >= totalWeeks - 1 ? 'disabled' : ''}>
                                    <i data-lucide="chevron-left" class="w-3 h-3"></i>
                                </button>
                                <button class="p-1.5 rounded-lg bg-slate-100 text-slate-400 disabled:opacity-30 hover:bg-slate-200 transition-colors" id="nextWeekBtn" ${state.currentWeekPage === 0 ? 'disabled' : ''}>
                                    <i data-lucide="chevron-right" class="w-3 h-3"></i>
                                </button>
                            </div>
                        </div>
                        
                        <!-- WEEKLY SUMMARY -->
                        <div class="${isJimpitan ? 'bg-emerald-700' : 'bg-rose-700'} text-white p-4 rounded-lg flex justify-between items-center shadow-lg ${isJimpitan ? 'shadow-emerald-700/20' : 'shadow-rose-700/20'}">
                            <div class="flex items-center gap-3">
                                <div class="bg-white/20 p-2 rounded-lg">
                                    <i data-lucide="${isJimpitan ? 'wallet' : 'receipt'}" class="w-4 h-4 text-white"></i>
                                </div>
                                <span class="text-[10px] font-bold uppercase tracking-wider">Total Minggu Ini</span>
                            </div>
                            <span class="text-sm font-extrabold">${formatRp(weekTotal)}</span>
                        </div>

                        <div class="space-y-2">
                            ${weekHtml}
                        </div>
                    </div>
                `;
            } else {
                html = `<div class="py-12 text-center text-slate-400 text-xs italic">Tidak ada data untuk periode ini</div>`;
            }

            container.innerHTML = html;
            
            // Bind pagination
            if ($('#prevWeekBtn')) {
                $('#prevWeekBtn').addEventListener('click', () => {
                    state.currentWeekPage++;
                    renderRekapList(items);
                });
            }
            if ($('#nextWeekBtn')) {
                $('#nextWeekBtn').addEventListener('click', () => {
                    state.currentWeekPage--;
                    renderRekapList(items);
                });
            }

            // --- Swipe Gesture (H) ---
            const rekapEl = container;
            let swipeStartX = 0;
            rekapEl.addEventListener('touchstart', (e) => { swipeStartX = e.touches[0].clientX; }, { passive: true });
            rekapEl.addEventListener('touchend', (e) => {
                const dx = e.changedTouches[0].clientX - swipeStartX;
                if (Math.abs(dx) < 50) return;
                if (dx < 0 && state.currentWeekPage > 0) {
                    // Swipe left = newer week
                    state.currentWeekPage--;
                    renderRekapList(items);
                } else if (dx > 0 && state.currentWeekPage < totalWeeks - 1) {
                    // Swipe right = older week
                    state.currentWeekPage++;
                    renderRekapList(items);
                }
            }, { passive: true });

            lucide.createIcons();
        } catch (e) {
            console.error("Rekap List Error:", e);
            const container = $('#rekapList');
            if (container) container.innerHTML = `<div class="py-12 text-center text-rose-500 text-xs font-bold">Terjadi kesalahan saat memuat data</div>`;
        }
    }

    function renderChart() {
        try {
            const canvas = $('#jimpitanChart');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (state.chart) state.chart.destroy();

            let labels = [];
            let values = [];
            const type = state.activeTab.toUpperCase();

            if (state.chartRange === 'harian') {
                const daysInMonth = new Date(state.selectedYear, state.selectedMonth, 0).getDate();
                labels = Array.from({length: daysInMonth}, (_, i) => i + 1);
                const daily = {};
                state.filteredData.filter(d => d.tipe === type).forEach(d => {
                    const day = d.dateObj.getDate();
                    daily[day] = (daily[day] || 0) + d.nominal;
                });
                values = labels.map(day => daily[day] || 0);
            } 
            else if (state.chartRange === 'mingguan') {
                labels = ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4', 'Minggu 5'];
                const weekly = {};
                state.filteredData.filter(d => d.tipe === type).forEach(d => {
                    const w = getWeekOfMonth(d.dateObj);
                    weekly[w] = (weekly[w] || 0) + d.nominal;
                });
                values = [1, 2, 3, 4, 5].map(w => weekly[w] || 0);
            }
            else if (state.chartRange === 'bulanan') {
                labels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                const monthly = {};
                state.data.filter(d => d.tipe === type && d.dateObj.getFullYear() === state.selectedYear).forEach(d => {
                    const m = d.dateObj.getMonth();
                    monthly[m] = (monthly[m] || 0) + d.nominal;
                });
                values = Array.from({length: 12}, (_, i) => monthly[i] || 0);
            }
            else if (state.chartRange === 'tahunan') {
                const years = [...new Set(state.data.map(d => d.dateObj.getFullYear()))].sort();
                labels = years;
                const yearly = {};
                state.data.filter(d => d.tipe === type).forEach(d => {
                    const y = d.dateObj.getFullYear();
                    yearly[y] = (yearly[y] || 0) + d.nominal;
                });
                values = years.map(y => yearly[y] || 0);
            }

            if (values.every(v => v === 0)) {
                $('#chartEmptyMessage').classList.remove('hidden');
                $('#jimpitanChart').classList.add('hidden');
                return;
            }

            $('#chartEmptyMessage').classList.add('hidden');
            $('#jimpitanChart').classList.remove('hidden');

            const isJimpitan = state.activeTab === 'jimpitan';
            const themeColor = isJimpitan ? '#059669' : '#e11d48';
            const isDark     = document.body.classList.contains('dark');
            const tickColor  = isDark ? '#64748b' : '#94a3b8';
            const tooltipBg  = isDark ? '#1e293b' : '#0f172a';

            state.chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: isJimpitan ? 'Pemasukan' : 'Pengeluaran',
                        data: values,
                        backgroundColor: themeColor,
                        borderRadius: 8,
                        borderSkipped: false,
                        barThickness: 8,
                        barPercentage: 0.5,
                        categoryPercentage: 0.5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { 
                            display: true, 
                            grid: { display: false },
                            title: {
                                display: true,
                                text: state.chartRange === 'harian' ? 'Tanggal' : 'Periode',
                                font: { size: 10, weight: '600', family: 'Plus Jakarta Sans' },
                                color: tickColor
                            },
                            ticks: {
                                font: { size: 9, family: 'Plus Jakarta Sans' },
                                color: tickColor,
                                maxRotation: 0
                            }
                        },
                        y: { 
                            display: true, 
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Nominal (Rp)',
                                font: { size: 10, weight: '600', family: 'Plus Jakarta Sans' },
                                color: tickColor
                            },
                            ticks: {
                                font: { size: 9, family: 'Plus Jakarta Sans' },
                                color: tickColor,
                                callback: function(value) {
                                    if (value >= 1000000) return (value / 1000000) + 'jt';
                                    if (value >= 1000) return (value / 1000) + 'rb';
                                    return value;
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: tooltipBg,
                            titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' },
                            bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
                            padding: 12,
                            cornerRadius: 8,
                            displayColors: false,
                            callbacks: {
                                title: (items) => {
                                    const i = items[0];
                                    if (state.chartRange === 'harian') {
                                        const d = new Date(state.selectedYear, state.selectedMonth - 1, i.label);
                                        return `${state.dayNames[d.getDay()]}, ${i.label} ${state.monthsNames[state.selectedMonth-1]} ${state.selectedYear}`;
                                    }
                                    if (state.chartRange === 'mingguan') {
                                        return i.label;
                                    }
                                    if (state.chartRange === 'bulanan') {
                                        return `${state.monthsNames[i.dataIndex]} ${state.selectedYear}`;
                                    }
                                    return i.label;
                                },
                                label: (context) => {
                                    return ` Total: ${formatRp(context.raw)}`;
                                }
                            }
                        }
                    }
                }
            });
        } catch (e) {
            console.error("Chart Render Error:", e);
        }
    }

    // =================== DATE SELECTORS ===================
    function initDateSelectors() {
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const mSel = $('#monthSelect');
        const ySel = $('#yearSelect');

        mSel.innerHTML = months.map((m, i) => `<option value="${i+1}">${m}</option>`).join('');
        mSel.value = state.selectedMonth;

        ySel.innerHTML = [2024, 2025, 2026].map(y => `<option value="${y}">${y}</option>`).join('');
        ySel.value = state.selectedYear;

        const onDateChange = () => {
            state.selectedMonth = parseInt(mSel.value);
            state.selectedYear = parseInt(ySel.value);
            renderAll();
        };

        mSel.addEventListener('change', onDateChange);
        ySel.addEventListener('change', onDateChange);
    }

    // =================== MODALS & UTILS ===================
    function bindModals() {
        $('#closeDetailBtn').addEventListener('click', () => {
            $('#detailModal').classList.add('hidden');
            $('#detailModal').classList.remove('flex');
        });
        
        window.showDetailById = (idx) => {
            const item = state.data.find(d => d.idx === idx);
            if (item) {
                const isJimpitan = item.tipe === 'JIMPITAN';
                const header = $('#detailHeaderColor');
                const icon = $('#detailIcon');
                const badge = $('#detailTipe');

                header.className = `h-32 flex items-end justify-center pb-6 ${isJimpitan ? 'bg-emerald-600' : 'bg-rose-600'}`;
                icon.setAttribute('data-lucide', isJimpitan ? 'trending-up' : 'receipt');
                icon.className = `w-8 h-8 ${isJimpitan ? 'text-emerald-600' : 'text-rose-600'}`;
                badge.className = `inline-block px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest mb-4 ${isJimpitan ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`;
                badge.textContent = isJimpitan ? 'Pemasukan' : 'Pengeluaran';

                $('#detailTanggal').textContent = `${state.dayNames[item.dateObj.getDay()]}, ${item.tanggal}`;
                $('#detailPelapor').textContent = item.pelapor;
                $('#detailKeterangan').textContent = item.keterangan;
                $('#detailNominal').textContent = formatRp(item.nominal);
                
                // Admin Actions
                const adminActions = $('#adminDetailActions');
                if (adminActions) {
                    if (state.isAdmin) {
                        adminActions.style.setProperty('display', 'grid', 'important');
                        adminActions.classList.remove('hidden');
                        
                        // CARA MUDAH & PASTI: Pasang fungsi langsung ke tombolnya
                        const editBtn = $('#editEntryBtn');
                        const deleteBtn = $('#deleteEntryBtn');
                        
                        if (editBtn) editBtn.onclick = () => window.handleEdit(item);
                        if (deleteBtn) deleteBtn.onclick = () => window.deleteEntry(item.idx);
                        
                    } else {
                        adminActions.style.display = 'none';
                        adminActions.classList.add('hidden');
                    }
                }
                
                if (window.lucide) lucide.createIcons();

                $('#detailModal').classList.remove('hidden');
                $('#detailModal').classList.add('flex');
            }
        };

        // Fungsi Global Edit agar bisa dipanggil dari mana saja
        window.handleEdit = (item) => {
            $('#detailModal').classList.add('hidden');
            const modal = $('#entryModal');
            
            // Konversi tanggal
            const t = item.tanggal;
            if (t.includes('-') && t.split('-')[0].length !== 4) { 
                const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                const p = t.split('-');
                const mIdx = monthShort.indexOf(p[1]);
                if (mIdx !== -1) {
                    $('#entryDate').value = `${p[2]}-${(mIdx+1).toString().padStart(2,'0')}-${p[0].padStart(2,'0')}`;
                }
            } else {
                $('#entryDate').value = t;
            }

            $('#entryType').value = item.tipe === 'Pemasukan' ? 'JIMPITAN' : 'PENGELUARAN';
            $('#entryNominal').value = item.nominal;
            $('#entryKeterangan').value = item.keterangan === '-' ? '' : item.keterangan;
            
            state.editingIdx = item.idx; // Set ID yang sedang diedit
            $('#submitEntryBtn').innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Update Data';
            $('#entryModal h3').textContent = 'Edit Data';
            
            modal.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        };

        // Fungsi Global Delete
        window.deleteEntry = (idx) => {
            if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
                deleteEntry(idx);
            }
        };

        // Helper untuk mencari data berdasarkan ID (untuk tombol di kartu)
        window.handleEditByIdx = (itemIdx) => {
            const item = state.data.find(d => d.idx === itemIdx);
            if (item) window.handleEdit(item);
        };
    }

    // Start the app
    init();
    console.log("Jimpitan App: Initialized");
})();
