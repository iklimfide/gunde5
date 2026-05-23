/**
 * gunde5 — üst/alt kabuk: oturum ve tema önbelleği (ilk boyamada kayma önleme)
 */
(function (w) {
    'use strict';

    var KEY_USER = 'gunde5_user';
    var KEY_THEME = 'gunde5_tema';
    var STYLE_ID = 'gunde5-shell-styles';

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
            return w.localStorage.getItem(KEY_THEME) === 'dark' ? 'dark' : 'light';
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
            'html.g5-tema-koyu{color-scheme:dark}' +
            'html.g5-tema-koyu body{background-color:#0f1419;color:#e7e9ea}';
        (doc.head || doc.documentElement).appendChild(s);
    }

    function applyShell() {
        var doc = w.document;
        if (!doc || !doc.documentElement) return;
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
        if (doc.body) applyHeaderFromCache();
    }

    function syncBodyClasses() {
        var doc = w.document;
        var body = doc && doc.body;
        if (!body) return;
        var html = doc.documentElement;
        body.classList.toggle('dark-mode', html.classList.contains('g5-tema-koyu'));
        body.classList.toggle('oturum-acik', html.classList.contains('g5-oturum'));
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
        if (path.indexOf('index') < 0 && path !== '/' && !path.endsWith('/')) return;
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
