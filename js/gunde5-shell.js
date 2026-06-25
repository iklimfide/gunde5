/**
 * gunde5 — üst/alt kabuk: oturum ve tema önbelleği (ilk boyamada kayma önleme)
 */
(function (w) {
    'use strict';

    var KEY_USER = 'gunde5_user';
    var KEY_THEME = 'gunde5_tema';
    var STYLE_ID = 'gunde5-shell-styles';
    var THEME_BTN_ID = 'headerThemeBtn';

    function readUser() {
        try {
            var raw = w.localStorage.getItem(KEY_USER);
            if (!raw) return null;
            var u = JSON.parse(raw);
            return u && u.username ? u : null;
        } catch (e) {
            return null;
        }
    }

    function readTheme() {
        try {
            var t = w.localStorage.getItem(KEY_THEME);
            if (t === 'dark' || t === 'light') return t;
            var legacy = w.localStorage.getItem('theme');
            if (legacy === 'dark' || legacy === 'light') {
                w.localStorage.setItem(KEY_THEME, legacy);
                w.localStorage.removeItem('theme');
                return legacy;
            }
            return 'light';
        } catch (e) {
            return 'light';
        }
    }

    function preloadAvatar(url) {
        if (!url) return;
        var doc = w.document;
        if (!doc) return;
        var link = doc.getElementById('g5-header-av-preload');
        if (link && link.getAttribute('href') === url) return;
        if (link) link.remove();
        link = doc.createElement('link');
        link.id = 'g5-header-av-preload';
        link.rel = 'preload';
        link.as = 'image';
        link.href = url;
        (doc.head || doc.documentElement).appendChild(link);
    }

    function ensureViewportFit() {
        var doc = w.document;
        if (!doc) return;
        var meta = doc.querySelector('meta[name="viewport"]');
        if (!meta) return;
        var c = meta.getAttribute('content') || '';
        if (c.indexOf('viewport-fit') >= 0) return;
        meta.setAttribute('content', c + (c ? ', ' : '') + 'viewport-fit=cover');
    }

    function injectStyles() {
        var doc = w.document;
        if (!doc || doc.getElementById(STYLE_ID)) return;
        var s = doc.createElement('style');
        s.id = STYLE_ID;
        s.textContent =
            'html.g5-oturum #headerAuthBtns{display:none!important}' +
            'html.g5-oturum #headerProfilLink{display:flex!important}' +
            'html:not(.g5-oturum) #headerProfilLink{display:none!important}' +
            'html.g5-oturum #headerProfilWrap[hidden]{display:flex!important}' +
            'html.g5-oturum[data-user-gender="male"] #headerProfilLink.cins-male .header-profil-avatar:not(.has-foto),' +
            'html.g5-oturum[data-user-gender="male"] #headerProfilLink:not(.cins-female) .header-profil-avatar:not(.has-foto){background-color:#2563eb}' +
            'html.g5-oturum[data-user-gender="female"] #headerProfilLink.cins-female .header-profil-avatar:not(.has-foto),' +
            'html.g5-oturum[data-user-gender="female"] #headerProfilLink:not(.cins-male) .header-profil-avatar:not(.has-foto){background-color:#db2777}' +
            'html.g5-oturum .header-sag{min-width:84px}' +
            '.header-theme-btn{width:38px;height:38px;padding:0;border:1px solid rgba(255,255,255,.45);border-radius:10px;background:rgba(255,255,255,.18);color:#ffffff;display:inline-flex;align-items:center;justify-content:center;font-size:20px;font-weight:400;cursor:pointer;line-height:1;flex-shrink:0}' +
            '.header-theme-btn:hover{background:rgba(255,255,255,.24)}' +
            '.header-theme-btn:active{transform:scale(.96)}' +
            '.header-theme-btn:focus-visible{outline:2px solid rgba(255,255,255,.55);outline-offset:2px}' +
            'html.g5-tema-koyu{color-scheme:dark}' +
            'html.g5-tema-koyu body{background-color:#0f1419;color:#e7e9ea}';
        (doc.head || doc.documentElement).appendChild(s);
    }

    function ensureHeaderThemeButton() {
        var doc = w.document;
        if (!doc) return;
        var sag = doc.querySelector('.header-sag');
        if (!sag) return;

        var btn = doc.getElementById(THEME_BTN_ID);
        if (!btn) {
            btn = doc.createElement('button');
            btn.type = 'button';
            btn.id = THEME_BTN_ID;
            btn.className = 'header-theme-btn';
            btn.addEventListener('click', function () {
                toggleTheme();
            });
        }

        var authBtns = doc.getElementById('headerAuthBtns');
        var profilLink = doc.getElementById('headerProfilLink');
        if (authBtns && authBtns.parentNode === sag) {
            if (btn.parentNode !== sag || btn.nextSibling !== authBtns) {
                sag.insertBefore(btn, authBtns);
            }
        } else if (profilLink && profilLink.parentNode === sag) {
            if (btn.parentNode !== sag || btn.nextSibling !== profilLink) {
                sag.insertBefore(btn, profilLink);
            }
        } else if (btn.parentNode !== sag) {
            sag.appendChild(btn);
        }
    }

    function syncThemeButton() {
        var doc = w.document;
        if (!doc) return;
        var btn = doc.getElementById(THEME_BTN_ID);
        if (!btn) return;
        var dark = !!(doc.body && doc.body.classList.contains('dark-mode'));
        btn.textContent = dark ? '\u2600\uFE0F' : '\uD83C\uDF19';
        btn.setAttribute('aria-label', dark ? 'Aydınlık moda geç' : 'Karanlık moda geç');
        btn.title = dark ? 'Aydınlık moda geç' : 'Karanlık moda geç';
    }

    function applyShell() {
        var doc = w.document;
        if (!doc || !doc.documentElement) return;
        ensureViewportFit();
        injectStyles();
        var html = doc.documentElement;
        var u = readUser();
        if (u) {
            html.classList.add('g5-oturum');
            html.setAttribute('data-user-gender', u.gender === 'male' ? 'male' : 'female');
            if (u.avatarUrl) preloadAvatar(u.avatarUrl);
        } else {
            html.classList.remove('g5-oturum');
            html.removeAttribute('data-user-gender');
        }
        if (readTheme() === 'dark') html.classList.add('g5-tema-koyu');
        else html.classList.remove('g5-tema-koyu');
        syncBodyClasses();
        if (doc.body) {
            ensureHeaderThemeButton();
            applyHeaderFromCache();
        }
    }

    function syncBodyClasses() {
        var doc = w.document;
        var body = doc && doc.body;
        if (!body) return;
        var html = doc.documentElement;
        var dark = html.classList.contains('g5-tema-koyu');
        body.classList.toggle('dark-mode', dark);
        body.classList.toggle('oturum-acik', html.classList.contains('g5-oturum'));
        if (dark) html.setAttribute('data-theme', 'dark');
        else html.removeAttribute('data-theme');
        var meta = doc.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', dark ? '#0f1419' : '#ffffff');
        syncThemeButton();
    }

    /** F5: avatar hemen (gunde5-ui DOMContentLoaded beklemeden). */
    function applyHeaderFromCache() {
        var doc = w.document;
        if (!doc || !doc.documentElement.classList.contains('g5-oturum')) return;
        var u = readUser();
        if (!u) return;
        var authBtns = doc.getElementById('headerAuthBtns');
        var link = doc.getElementById('headerProfilLink');
        var wrap = doc.getElementById('headerProfilWrap');
        var el = doc.getElementById('headerProfilAvatar');
        if (authBtns) authBtns.hidden = true;
        if (wrap) wrap.hidden = false;
        if (link) {
            link.style.display = 'flex';
            link.className = 'header-profil-link cins-' + (u.gender === 'male' ? 'male' : 'female');
        }
        if (!el) return;
        var cins = u.gender === 'male' ? 'male' : 'female';
        var img = el.querySelector('img');
        if (u.avatarUrl) {
            if (!img) {
                el.textContent = '';
                img = doc.createElement('img');
                img.alt = '';
                el.appendChild(img);
            }
            img.loading = 'eager';
            img.decoding = 'async';
            if (img.getAttribute('src') !== u.avatarUrl) img.setAttribute('src', u.avatarUrl);
            el.classList.add('has-foto');
        } else {
            if (img) img.remove();
            el.classList.remove('has-foto');
            el.textContent = cins === 'male' ? '\u2642' : '\u2640';
        }
    }

    function podyumBannerOnbellek() {
        var path = (w.location.pathname || '').toLowerCase();
        if (path.indexOf('podyum') < 0 && path !== '/' && !path.endsWith('/')) return;
        try {
            var raw = w.localStorage.getItem('g5_podyum_ls_v1');
            if (!raw) return;
            var o = JSON.parse(raw);
            if (!o) return;
            var sec = document.getElementById('podyumSampiyonlar');
            var baslik = document.getElementById('podyumDonemBaslik');
            var top = document.getElementById('podyumTopEtiket');
            if (sec) sec.hidden = false;
            if (top && o.b) top.textContent = 'EFSANELER';
            if (baslik && o.b) baslik.textContent = o.b;
            if (o.r && o.r.length) {
                var i;
                for (i = 0; i < o.r.length && i < 2; i++) {
                    var av = o.r[i].av || o.r[i].avatar_url;
                    if (av) preloadAvatar(av);
                }
            }
        } catch (e) { /* sessiz */ }
    }

    function onDomReady() {
        ensureHeaderThemeButton();
        syncBodyClasses();
        applyHeaderFromCache();
        podyumBannerOnbellek();
    }

    function setTheme(dark) {
        try {
            w.localStorage.setItem(KEY_THEME, dark ? 'dark' : 'light');
        } catch (e) { /* sessiz */ }
        applyShell();
    }

    function toggleTheme() {
        var doc = w.document;
        var dark = !(doc.body && doc.body.classList.contains('dark-mode'));
        if (doc.body) doc.body.classList.toggle('dark-mode', dark);
        setTheme(dark);
    }

    applyShell();

    if (w.document.readyState === 'loading') {
        w.document.addEventListener('DOMContentLoaded', onDomReady);
    } else {
        onDomReady();
    }

    w.toggleTheme = toggleTheme;
    w.Gunde5Shell = {
        applyShell: applyShell,
        readUser: readUser,
        readTheme: readTheme,
        setTheme: setTheme,
        toggleTheme: toggleTheme,
        syncBodyClasses: syncBodyClasses,
        applyHeaderFromCache: applyHeaderFromCache
    };
})(window);
