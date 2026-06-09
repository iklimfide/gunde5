/**
 * gunde5 — Analytics / ziyaret / gtag (düşük öncelik).
 * Index: gunde5-index.js gecikmeyle yükler ve kick() çağırır.
 * Diğer sayfalar: load sonrası otomatik.
 */
(function (w) {
    'use strict';

    var GTAG_ID = 'G-WL5L866SD6';

    function isIndexSayfasi() {
        var p = (w.location && w.location.pathname) || '';
        return !p || p === '/' || p === '/index.html';
    }

    function itirafParamVar() {
        try {
            var params = new URLSearchParams(w.location.search || '');
            var q = params.get('itiraf') || params.get('h');
            return !!(q && /^\d+$/.test(q));
        } catch (e) {
            return false;
        }
    }

    function ikincilListe() {
        if (isIndexSayfasi()) {
            var liste = [
                'js/gunde5-analytics.js?v=4',
                'js/gunde5-ziyaret.js?v=17'
            ];
            if (itirafParamVar()) {
                liste.push('js/gunde5-index-seo.js?v=17');
            }
            return liste;
        }
        return ['js/gunde5-ziyaret.js', 'js/gunde5-seo.js', 'js/gunde5-master.js?v=4'];
    }

    function loadScript(src, cb) {
        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = function () { if (cb) cb(); };
        s.onerror = function () { if (cb) cb(); };
        (document.head || document.body).appendChild(s);
    }

    function loadSequential(list, i, done) {
        if (i >= list.length) {
            if (done) done();
            return;
        }
        loadScript(list[i], function () {
            loadSequential(list, i + 1, done);
        });
    }

    function loadGtag() {
        if (w.__g5GtagLoaded) return;
        w.__g5GtagLoaded = true;
        w.dataLayer = w.dataLayer || [];
        w.gtag = function () { w.dataLayer.push(arguments); };
        loadScript('https://www.googletagmanager.com/gtag/js?id=' + GTAG_ID, function () {
            w.gtag('js', new Date());
            w.gtag('config', GTAG_ID);
        });
    }

    function loadSecondary() {
        if (w.__g5SecondaryLoaded) return;
        w.__g5SecondaryLoaded = true;
        loadSequential(ikincilListe(), 0);
    }

    function kick() {
        loadGtag();
        var idle = w.requestIdleCallback || function (fn) { setTimeout(fn, 150); };
        idle(loadSecondary);
    }

    w.Gunde5Perf = { kick: kick };

    if (!isIndexSayfasi()) {
        w.addEventListener('load', function () {
            kick();
        }, { once: true });
    }
})(window);
