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
        } else {
            html.classList.remove('g5-oturum');
            html.removeAttribute('data-user-gender');
        }
        if (readTheme() === 'dark') html.classList.add('g5-tema-koyu');
        else html.classList.remove('g5-tema-koyu');
        syncBodyClasses();
    }

    function syncBodyClasses() {
        var doc = w.document;
        var body = doc && doc.body;
        if (!body) return;
        var html = doc.documentElement;
        body.classList.toggle('dark-mode', html.classList.contains('g5-tema-koyu'));
        body.classList.toggle('oturum-acik', html.classList.contains('g5-oturum'));
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
        w.document.addEventListener('DOMContentLoaded', syncBodyClasses);
    } else {
        syncBodyClasses();
    }

    w.toggleTheme = toggleTheme;
    w.Gunde5Shell = {
        applyShell: applyShell,
        readUser: readUser,
        readTheme: readTheme,
        setTheme: setTheme,
        toggleTheme: toggleTheme,
        syncBodyClasses: syncBodyClasses
    };
})(window);
