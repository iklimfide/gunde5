/**
 * gunde5 — Kamikaze yönetim paneli
 */
(function (global) {
    'use strict';

    var SESSION_KEY = 'gunde5_kmz_session';
    var panelData = null;

    function cfg(key, fallback) {
        var v = global[key];
        return v != null && v !== '' ? v : fallback;
    }

    function getConfig() {
        return {
            user: cfg('KAMIKAZE_USER', ''),
            pass: cfg('KAMIKAZE_PASS', ''),
            token: cfg('KAMIKAZE_API_TOKEN', ''),
            url: cfg('KAMIKAZE_SUPABASE_URL', cfg('GUNDE5_SUPABASE_URL', '')),
            anonKey: cfg('KAMIKAZE_SUPABASE_ANON_KEY', cfg('GUNDE5_SUPABASE_ANON_KEY', ''))
        };
    }

    function isLoggedIn() {
        try {
            return sessionStorage.getItem(SESSION_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function setLoggedIn(ok) {
        try {
            if (ok) sessionStorage.setItem(SESSION_KEY, '1');
            else sessionStorage.removeItem(SESSION_KEY);
        } catch (e) { /* ignore */ }
    }

    function $(id) {
        return document.getElementById(id);
    }

    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function fmtSayi(n) {
        var x = Number(n);
        if (!isFinite(x)) return '0';
        if (x >= 1000000) return (x / 1000000).toFixed(1) + 'M';
        if (x >= 10000) return (x / 1000).toFixed(1) + 'K';
        return String(Math.round(x));
    }

    function fmtTarih(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return String(iso);
        }
    }

    function fmtGun(gun) {
        if (!gun) return '';
        var p = String(gun).split('-');
        if (p.length === 3) return p[2] + '/' + p[1];
        return gun;
    }

    function statusBadge(status, silindi) {
        if (silindi) return '<span class="kmz-badge kmz-badge--silindi">silindi</span>';
        if (status === 'podyum') return '<span class="kmz-badge kmz-badge--podyum">podyum</span>';
        return '<span class="kmz-badge kmz-badge--kulis">kulis</span>';
    }

    function showLogin() {
        $('kmzLoginWrap').classList.remove('kmz-hidden');
        $('kmzApp').classList.add('kmz-hidden');
    }

    function showApp() {
        $('kmzLoginWrap').classList.add('kmz-hidden');
        $('kmzApp').classList.remove('kmz-hidden');
    }

    function showErr(el, msg) {
        var node = typeof el === 'string' ? $(el) : el;
        if (!node) return;
        if (!msg) {
            node.classList.add('kmz-hidden');
            node.textContent = '';
            return;
        }
        node.textContent = msg;
        node.classList.remove('kmz-hidden');
    }

    function getSupabase() {
        var c = getConfig();
        if (!c.url || !c.anonKey || !global.supabase) return null;
        return global.supabase.createClient(c.url, c.anonKey);
    }

    async function fetchPanel() {
        var c = getConfig();
        if (!c.token) throw new Error('KAMIKAZE_API_TOKEN tanımlı değil.');
        var sb = getSupabase();
        if (!sb) throw new Error('Supabase URL / anon key eksik.');

        var res = await sb.rpc('kamikaze_panel', { p_token: c.token });
        if (res.error) throw res.error;
        var data = res.data;
        if (!data || !data.ok) {
            var hata = (data && data.hata) || 'yetkisiz';
            throw new Error('API: ' + hata + ' — site_ayar.kamikaze_token ile config eşleşmeli.');
        }
        return data;
    }

    function renderKpi(ozet) {
        var grid = $('kmzKpiGrid');
        if (!grid || !ozet) return;
        var items = [
            { label: 'Üye', val: ozet.uye, cls: 'kmz-kpi--accent' },
            { label: 'Aktif hikaye', val: ozet.itiraf_aktif, cls: '' },
            { label: 'Kulis', val: ozet.kulis, cls: 'kmz-kpi--warn' },
            { label: 'Podyum', val: ozet.podyum, cls: 'kmz-kpi--ok' },
            { label: 'Silinen', val: ozet.silindi, cls: '' },
            { label: 'Gizli', val: ozet.gizli, cls: '' },
            { label: 'Oy', val: ozet.oy, cls: 'kmz-kpi--blue' },
            { label: 'Yorum', val: ozet.cevap, cls: 'kmz-kpi--blue' },
            { label: 'Şikayet', val: ozet.sikayet, cls: '' },
            { label: 'Sayfa gör.', val: ozet.sayfa_goruntulenme, cls: '' },
            { label: 'Tekil gör.', val: ozet.tekil_goruntulenme, cls: '' },
            { label: '↑ oy', val: ozet.up_toplam, cls: 'kmz-kpi--ok' },
            { label: '↓ oy', val: ozet.down_toplam, cls: '' }
        ];
        grid.innerHTML = items.map(function (it) {
            return (
                '<div class="kmz-kpi ' + esc(it.cls) + '">' +
                '<div class="kmz-kpi-label">' + esc(it.label) + '</div>' +
                '<div class="kmz-kpi-val">' + esc(fmtSayi(it.val)) + '</div></div>'
            );
        }).join('');
    }

    function renderBarChart(containerId, rows, colorClass) {
        var el = $(containerId);
        if (!el) return;
        if (!rows || !rows.length) {
            el.innerHTML = '<div class="kmz-empty">Veri yok</div>';
            return;
        }
        var max = 1;
        var i;
        for (i = 0; i < rows.length; i++) {
            if (rows[i].adet > max) max = rows[i].adet;
        }
        el.innerHTML =
            '<div class="kmz-bars">' +
            rows.map(function (r) {
                var h = Math.max(8, Math.round((r.adet / max) * 100));
                return (
                    '<div class="kmz-bar-col">' +
                    '<div class="kmz-bar" style="height:' + h + 'px;background:' +
                    (colorClass || '') + '" title="' + esc(r.adet) + '"></div>' +
                    '<span>' + esc(fmtGun(r.gun)) + '</span></div>'
                );
            }).join('') +
            '</div>';
    }

    function renderSiteAyar(rows) {
        var tb = $('kmzSiteAyarBody');
        if (!tb) return;
        if (!rows || !rows.length) {
            tb.innerHTML = '<tr><td colspan="3" class="kmz-empty">Kayıt yok</td></tr>';
            return;
        }
        tb.innerHTML = rows.map(function (r) {
            var deger = r.anahtar === 'kamikaze_token' ? '••••••••' : esc(r.deger);
            return (
                '<tr><td><code>' + esc(r.anahtar) + '</code></td>' +
                '<td class="kmz-wrap">' + deger + '</td>' +
                '<td>' + esc(fmtTarih(r.updated_at)) + '</td></tr>'
            );
        }).join('');
    }

    function renderPodyumDonem(rows) {
        var tb = $('kmzPodyumBody');
        if (!tb) return;
        if (!rows || !rows.length) {
            tb.innerHTML = '<tr><td colspan="3" class="kmz-empty">Dönem yok</td></tr>';
            return;
        }
        tb.innerHTML = rows.map(function (r) {
            return (
                '<tr><td><strong>' + esc(r.donem) + '</strong></td>' +
                '<td>' + esc(r.adet) + '</td>' +
                '<td>' + esc(r.max_sira || '—') + '</td></tr>'
            );
        }).join('');
    }

    function renderKulisLider(rows) {
        var tb = $('kmzKulisBody');
        if (!tb) return;
        if (!rows || !rows.length) {
            tb.innerHTML = '<tr><td colspan="7" class="kmz-empty">Kulis boş</td></tr>';
            return;
        }
        tb.innerHTML = rows.map(function (r) {
            return (
                '<tr>' +
                '<td>#' + esc(r.id) + '</td>' +
                '<td>' + esc(r.username) + (r.is_gizli ? ' 🔒' : '') + '</td>' +
                '<td><strong>' + esc(r.r) + '</strong></td>' +
                '<td>' + esc(r.up_votes) + '/' + esc(r.down_votes) + '</td>' +
                '<td>' + esc(r.tekil_goruntulenme) + '</td>' +
                '<td class="kmz-wrap">' + esc(r.onizleme) + '</td>' +
                '<td>' + esc(fmtTarih(r.created_at)) + '</td></tr>'
            );
        }).join('');
    }

    function renderItiraflar(rows, filter) {
        var tb = $('kmzItirafBody');
        if (!tb) return;
        var list = rows || [];
        if (filter && filter !== 'hepsi') {
            list = list.filter(function (r) {
                if (filter === 'silindi') return !!r.silindi_at;
                if (filter === 'gizli') return r.is_gizli && !r.silindi_at;
                return r.status === filter && !r.silindi_at;
            });
        }
        if (!list.length) {
            tb.innerHTML = '<tr><td colspan="9" class="kmz-empty">Kayıt yok</td></tr>';
            return;
        }
        tb.innerHTML = list.map(function (r) {
            return (
                '<tr>' +
                '<td>#' + esc(r.id) + '</td>' +
                '<td>' + statusBadge(r.status, r.silindi_at) + '</td>' +
                '<td>' + esc(r.username) + (r.is_gizli ? ' 🔒' : '') + '</td>' +
                '<td>' + esc(r.r) + '</td>' +
                '<td>' + esc(r.up_votes) + '/' + esc(r.down_votes) + '</td>' +
                '<td>' + esc(r.podyum_donem || '—') + '</td>' +
                '<td>' + esc(r.tekil_goruntulenme) + '</td>' +
                '<td class="kmz-wrap">' + esc(r.onizleme) + '</td>' +
                '<td>' + esc(fmtTarih(r.created_at)) + '</td></tr>'
            );
        }).join('');
    }

    function renderUyeler(rows) {
        var tb = $('kmzUyeBody');
        if (!tb) return;
        if (!rows || !rows.length) {
            tb.innerHTML = '<tr><td colspan="7" class="kmz-empty">Üye yok</td></tr>';
            return;
        }
        tb.innerHTML = rows.map(function (r) {
            return (
                '<tr>' +
                '<td class="kmz-wrap"><code style="font-size:11px">' + esc(String(r.id).slice(0, 8)) + '…</code></td>' +
                '<td><strong>' + esc(r.username) + '</strong></td>' +
                '<td class="kmz-wrap">' + esc(r.email) + '</td>' +
                '<td>' + esc(r.gender === 'male' ? '♂' : '♀') + '</td>' +
                '<td>' + esc(r.dogum_yili) + '</td>' +
                '<td>' + esc(r.itiraf_sayisi) + '</td>' +
                '<td>' + esc(fmtTarih(r.created_at)) + '</td></tr>'
            );
        }).join('');
    }

    function renderSikayetOzet(rows) {
        var tb = $('kmzSikayetOzetBody');
        if (!tb) return;
        if (!rows || !rows.length) {
            tb.innerHTML = '<tr><td colspan="4" class="kmz-empty">Şikayet yok</td></tr>';
            return;
        }
        tb.innerHTML = rows.map(function (r) {
            return (
                '<tr>' +
                '<td>#' + esc(r.id) + '</td>' +
                '<td>#' + esc(r.itiraf_id) + '</td>' +
                '<td>' + esc(r.sebep) + '</td>' +
                '<td>' + esc(fmtTarih(r.created_at)) + '</td></tr>'
            );
        }).join('');
    }

    function renderSikayetler(rows) {
        var tb = $('kmzSikayetBody');
        if (!tb) return;
        if (!rows || !rows.length) {
            tb.innerHTML = '<tr><td colspan="6" class="kmz-empty">Şikayet yok</td></tr>';
            return;
        }
        tb.innerHTML = rows.map(function (r) {
            return (
                '<tr>' +
                '<td>#' + esc(r.id) + '</td>' +
                '<td>#' + esc(r.itiraf_id) + ' ' + statusBadge(r.itiraf_status, false) + '</td>' +
                '<td>' + esc(r.sebep) + '</td>' +
                '<td class="kmz-wrap">' + esc(r.aciklama || '—') + '</td>' +
                '<td class="kmz-wrap">' + esc(r.itiraf_onizleme) + '</td>' +
                '<td>' + esc(fmtTarih(r.created_at)) + '</td></tr>'
            );
        }).join('');
    }

    function renderAll(data) {
        panelData = data;
        var ozet = data.ozet || {};
        renderKpi(ozet);
        renderBarChart('kmzChartItiraf', data.gunluk_itiraf || [], 'linear-gradient(180deg,#f59e0b,#d97706)');
        renderBarChart('kmzChartUye', data.gunluk_uye || [], 'linear-gradient(180deg,#22c55e,#15803d)');
        renderSiteAyar(data.site_ayar || []);
        renderPodyumDonem(data.podyum_donemler || []);
        renderKulisLider(data.kulis_lider || []);
        renderItiraflar(data.son_itiraflar || [], 'hepsi');
        renderUyeler(data.son_uyeler || []);
        renderSikayetler(data.sikayetler || []);
        renderSikayetOzet((data.sikayetler || []).slice(0, 5));

        var meta = $('kmzTopMeta');
        if (meta) {
            meta.textContent = 'Son güncelleme: ' + fmtTarih(data.zaman);
        }
    }

    async function loadPanel() {
        var loader = $('kmzLoader');
        if (loader) loader.classList.remove('kmz-hidden');
        try {
            var data = await fetchPanel();
            renderAll(data);
        } catch (e) {
            alert('Veri yüklenemedi: ' + (e.message || e));
        } finally {
            if (loader) loader.classList.add('kmz-hidden');
        }
    }

    function setSection(id) {
        var sections = document.querySelectorAll('.kmz-section');
        var navBtns = document.querySelectorAll('.kmz-nav button[data-section]');
        var i;
        for (i = 0; i < sections.length; i++) {
            sections[i].classList.toggle('aktif', sections[i].id === 'kmzSec-' + id);
        }
        for (i = 0; i < navBtns.length; i++) {
            navBtns[i].classList.toggle('aktif', navBtns[i].getAttribute('data-section') === id);
        }
        var titles = {
            ozet: 'Genel bakış',
            hikayeler: 'Hikayeler',
            uyeler: 'Üyeler',
            podyum: 'Podyum arşivi',
            kulis: 'Kulis liderlik',
            sikayetler: 'Şikayetler',
            ayarlar: 'Site ayarları'
        };
        var h = $('kmzPageTitle');
        if (h) h.textContent = titles[id] || id;
        closeSidebarMobile();
    }

    function closeSidebarMobile() {
        var sb = document.querySelector('.kmz-sidebar');
        var ov = $('kmzOverlay');
        if (sb) sb.classList.remove('acik');
        if (ov) ov.classList.remove('acik');
    }

    function bindNav() {
        var navBtns = document.querySelectorAll('.kmz-nav button[data-section]');
        var i;
        for (i = 0; i < navBtns.length; i++) {
            navBtns[i].addEventListener('click', function () {
                setSection(this.getAttribute('data-section'));
            });
        }

        var filter = $('kmzItirafFilter');
        if (filter) {
            filter.addEventListener('change', function () {
                if (panelData) renderItiraflar(panelData.son_itiraflar || [], filter.value);
            });
        }

        var toggle = $('kmzMenuToggle');
        var overlay = $('kmzOverlay');
        if (toggle) {
            toggle.addEventListener('click', function () {
                var sb = document.querySelector('.kmz-sidebar');
                if (sb) sb.classList.toggle('acik');
                if (overlay) overlay.classList.toggle('acik');
            });
        }
        if (overlay) overlay.addEventListener('click', closeSidebarMobile);
    }

    function onLoginSubmit(ev) {
        ev.preventDefault();
        var c = getConfig();
        var user = ($('kmzUser') || {}).value || '';
        var pass = ($('kmzPass') || {}).value || '';
        if (user !== c.user || pass !== c.pass) {
            showErr('kmzLoginErr', 'Kullanıcı adı veya şifre hatalı.');
            return;
        }
        if (!c.token || !c.url || !c.anonKey) {
            showErr('kmzLoginErr', 'kamikaze-config.js: token ve Supabase bilgilerini doldur.');
            return;
        }
        showErr('kmzLoginErr', '');
        setLoggedIn(true);
        showApp();
        loadPanel();
    }

    function onLogout() {
        setLoggedIn(false);
        panelData = null;
        showLogin();
        closeSidebarMobile();
    }

    function init() {
        bindNav();
        var form = $('kmzLoginForm');
        if (form) form.addEventListener('submit', onLoginSubmit);

        var logout = $('kmzLogout');
        if (logout) logout.addEventListener('click', onLogout);

        var refresh = $('kmzRefresh');
        if (refresh) refresh.addEventListener('click', loadPanel);

        if (isLoggedIn()) {
            showApp();
            loadPanel();
        } else {
            showLogin();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    global.KamikazePanel = { loadPanel: loadPanel, logout: onLogout };
})(window);
