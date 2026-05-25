/* gunde5 — meta / Open Graph güncelleme (paylaşım linkleri ?itiraf=) */
(function (global) {
    'use strict';

    var SITE_ORIGIN = 'https://gunde5.com';
    var SITE_NAME = 'gunde5.com';
    var DEFAULT_OG_IMAGE = SITE_ORIGIN + '/apple-touch-icon.png';
    var DEFAULT_DESC =
        'Kulis’te hikayeni yaz, oyla; her gün saat 13:12’de en iyi 5 hikaye Podyum’a çıkar. Eğlence ve mizah odaklı hikâye arenası.';

    function escAttr(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    function metaBul(selector) {
        return document.querySelector(selector);
    }

    function metaAyar(isim, icerik) {
        if (!icerik && icerik !== 0) return;
        var el = metaBul('meta[name="' + isim + '"]');
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute('name', isim);
            document.head.appendChild(el);
        }
        el.setAttribute('content', String(icerik));
    }

    function ogAyar(prop, icerik) {
        if (!icerik && icerik !== 0) return;
        var el = metaBul('meta[property="' + prop + '"]');
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute('property', prop);
            document.head.appendChild(el);
        }
        el.setAttribute('content', String(icerik));
    }

    function twitterAyar(isim, icerik) {
        if (!icerik && icerik !== 0) return;
        var el = metaBul('meta[name="twitter:' + isim + '"]');
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute('name', 'twitter:' + isim);
            document.head.appendChild(el);
        }
        el.setAttribute('content', String(icerik));
    }

    function canonicalAyar(url) {
        if (!url) return;
        var el = document.querySelector('link[rel="canonical"]');
        if (!el) {
            el = document.createElement('link');
            el.setAttribute('rel', 'canonical');
            document.head.appendChild(el);
        }
        el.setAttribute('href', url);
    }

    function metinKisalt(metin, max) {
        var t = String(metin || '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!t) return '';
        if (t.length <= max) return t;
        return t.slice(0, max - 1).trim() + '…';
    }

    function apply(opts) {
        opts = opts || {};
        if (opts.title) document.title = opts.title;
        if (opts.description) {
            metaAyar('description', opts.description);
            ogAyar('og:description', opts.description);
            twitterAyar('description', opts.description);
        }
        if (opts.title) {
            ogAyar('og:title', opts.title);
            twitterAyar('title', opts.title);
        }
        if (opts.canonical) canonicalAyar(opts.canonical);
        if (opts.ogUrl) ogAyar('og:url', opts.ogUrl);
        if (opts.ogType) ogAyar('og:type', opts.ogType);
        if (opts.ogImage) {
            ogAyar('og:image', opts.ogImage);
            twitterAyar('image', opts.ogImage);
        }
        if (opts.robots) metaAyar('robots', opts.robots);
    }

    function itirafUygula(row, sayfa) {
        if (!row) return;
        var rumuz = row.username || row.rumuz || 'Anonim';
        var yer = sayfa === 'podyum' ? 'Podyum' : 'Kulis';
        var aciklama = metinKisalt(row.content_short || row.content, 160) || DEFAULT_DESC;
        var baslik = rumuz + ' — ' + yer + ' | ' + SITE_NAME;
        var url = global.location.href.split('#')[0];

        apply({
            title: baslik,
            description: aciklama,
            canonical: url,
            ogUrl: url,
            ogType: 'article',
            ogImage: DEFAULT_OG_IMAGE,
            robots: 'index, follow, max-image-preview:large'
        });
    }

    function itirafSifirla(sayfa) {
        var varsayilan =
            sayfa === 'podyum'
                ? {
                      title: 'gunde5.com — Günün En İyi 5 Hikayesi | Podyum',
                      description:
                          'Her gün saat 13:12’de Kulis’in en çok oy alan 5 hikayesi Podyum’a çıkar. Arşiv ve şampiyonlar.',
                      canonical: SITE_ORIGIN + '/',
                      ogUrl: SITE_ORIGIN + '/',
                      ogType: 'website'
                  }
                : {
                      title: 'gunde5.com — Kulis Arenası | Hikaye yaz, oyla',
                      description:
                          'Perde arkası hikayelerini yaz, beğeni ve yorumlarla yarış. Her gün 13:12’de TOP 5 Podyum’a çıkar.',
                      canonical: SITE_ORIGIN + '/kulis',
                      ogUrl: SITE_ORIGIN + '/kulis',
                      ogType: 'website'
                  };
        apply(varsayilan);
    }

    global.Gunde5SEO = {
        SITE_ORIGIN: SITE_ORIGIN,
        SITE_NAME: SITE_NAME,
        DEFAULT_DESC: DEFAULT_DESC,
        DEFAULT_OG_IMAGE: DEFAULT_OG_IMAGE,
        apply: apply,
        itirafUygula: itirafUygula,
        itirafSifirla: itirafSifirla
    };
})(window);
