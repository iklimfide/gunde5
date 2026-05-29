/* gunde5 — index: ?itiraf= için tarayıcı meta (paylaşım önizlemesi Vercel api/itiraf-share) */
(function (global) {
    'use strict';

    var SITE = 'https://gunde5.com';
    var DEFAULT_IMG = SITE + '/og-share.png';

    function itirafIdOku() {
        try {
            var p = new URLSearchParams(global.location.search || '');
            var q = p.get('itiraf') || p.get('h');
            return q && /^\d+$/.test(q) ? q : null;
        } catch (e) {
            return null;
        }
    }

    function metaAyar(prop, icerik, isProperty) {
        if (!icerik) return;
        var sel = isProperty
            ? 'meta[property="' + prop + '"]'
            : 'meta[name="' + prop + '"]';
        var el = document.querySelector(sel);
        if (!el) {
            el = document.createElement('meta');
            if (isProperty) el.setAttribute('property', prop);
            else el.setAttribute('name', prop);
            document.head.appendChild(el);
        }
        el.setAttribute('content', String(icerik));
    }

    function metinKisalt(metin, max) {
        var t = String(metin || '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!t) return '';
        if (t.length <= max) return t.slice(0, max);
        return t.slice(0, max - 1).trim() + '…';
    }

    function itirafMetaUygula(row, id) {
        var rumuz = row.username || 'Anonim';
        var aciklama =
            metinKisalt(row.content_short || row.content_full, 160) ||
            'Günün harbi hikayeleri — reklamsız, ücretsiz.';
        var baslik = rumuz + ' | gunde5.com';
        var url = SITE + '/h/' + id;
        var ogImage = SITE + '/api/og?id=' + encodeURIComponent(id);

        document.title = baslik;
        metaAyar('description', aciklama, false);
        metaAyar('og:title', baslik, true);
        metaAyar('og:description', aciklama, true);
        metaAyar('og:url', url, true);
        metaAyar('og:type', 'article', true);
        metaAyar('og:image', ogImage, true);
        metaAyar('twitter:card', 'summary_large_image', false);
        metaAyar('twitter:title', baslik, false);
        metaAyar('twitter:description', aciklama, false);
        metaAyar('twitter:image', ogImage, false);

        var canon = document.querySelector('link[rel="canonical"]');
        if (canon) canon.setAttribute('href', url);
    }

    function baslat() {
        var id = itirafIdOku();
        if (!id) return;

        var D = global.Gunde5DB;
        if (!D || !D.isConfigured || !D.isConfigured()) return;

        D.init()
            .then(function () {
                return D.itirafGetir(id);
            })
            .then(function (row) {
                if (row) itirafMetaUygula(row, id);
            })
            .catch(function () { /* sessiz */ });
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', baslat);
    } else {
        baslat();
    }
})(window);
