/* gunde5 — hikâye metninde sağ tık / kopyalama engeli */
(function (global) {
    'use strict';

    var ICERIK_SEL =
        '.story-card .card-body, .card .card-body, .profil-itiraf-metin';

    function injectStyles() {
        var doc = global.document;
        if (!doc || doc.getElementById('g5-hikaye-koruma')) return;
        var s = doc.createElement('style');
        s.id = 'g5-hikaye-koruma';
        s.textContent =
            '.story-card .card-body,' +
            '.story-card .card-body .short-text,' +
            '.story-card .card-body .full-text,' +
            '.story-card .card-body .kart-baslik,' +
            '.card .card-body,' +
            '.card .card-body .short-text,' +
            '.card .card-body .full-text,' +
            '.card .card-body .kart-baslik,' +
            '.profil-itiraf-metin{' +
            '-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}';
        (doc.head || doc.documentElement).appendChild(s);
    }

    function hikayeIcerikHedefi(node) {
        return node && node.closest ? node.closest(ICERIK_SEL) : null;
    }

    function engelle(e) {
        if (hikayeIcerikHedefi(e.target)) e.preventDefault();
    }

    function bagla() {
        if (global.__g5HikayeKoruma) return;
        global.__g5HikayeKoruma = true;
        injectStyles();
        global.document.addEventListener('contextmenu', engelle);
        global.document.addEventListener('copy', engelle);
        global.document.addEventListener('cut', engelle);
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bagla);
    } else {
        bagla();
    }
})(window);
