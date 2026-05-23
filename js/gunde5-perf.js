/**
 * gunde5 — LCP: Analytics ve düşük öncelikli betikler sayfa yüklendikten sonra.
 */
(function (w) {
    'use strict';

    var GTAG_ID = 'G-WL5L866SD6';
    var SECONDARY = ['js/gunde5-ziyaret.js', 'js/gunde5-seo.js', 'js/gunde5-master.js'];

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
        loadSequential(SECONDARY.slice(), 0);
    }

    w.addEventListener('load', function () {
        loadGtag();
        var idle = w.requestIdleCallback || function (fn) { setTimeout(fn, 150); };
        idle(loadSecondary);
    }, { once: true });
})(window);
