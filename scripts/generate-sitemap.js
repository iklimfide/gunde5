/**
 * Statik sitemap — anasayfa + indexlenebilir hikaye URL'leri (/h/{slug}).
 * Build: GUNDE5_SUPABASE_URL + GUNDE5_SUPABASE_ANON_KEY ile hikayeler çekilir.
 */
const fs = require('fs');
const path = require('path');

var BASE = 'https://gunde5.com';

function isoGun(iso) {
    if (!iso) return null;
    return String(iso).slice(0, 10);
}

function lastmodHikaye(row) {
    var yayin = isoGun(row.created_at);
    var guncel = isoGun(row.updated_at);
    if (guncel && yayin && guncel > yayin) return guncel;
    return yayin;
}

function fetchHikayeSluglari() {
    var url = process.env.GUNDE5_SUPABASE_URL;
    var key = process.env.GUNDE5_SUPABASE_ANON_KEY;
    if (!url || !key) {
        console.log('Supabase env yok; sitemap yalnizca anasayfa.');
        return Promise.resolve({ rows: [], enYeni: null });
    }

    var api =
        url.replace(/\/$/, '') +
        '/rest/v1/itiraflar?select=slug,created_at,updated_at' +
        '&slug=not.is.null' +
        '&silindi_at=is.null' +
        '&is_gizli=eq.false' +
        '&status=in.(kulis,podyum)' +
        '&created_at=lte.' + encodeURIComponent(new Date().toISOString()) +
        '&order=created_at.desc' +
        '&limit=5000';

    return fetch(api, {
        headers: {
            apikey: key,
            Authorization: 'Bearer ' + key
        }
    })
        .then(function (res) {
            if (!res.ok) {
                console.warn('Sitemap hikaye listesi alinamadi:', res.status);
                return { rows: [], enYeni: null };
            }
            return res.json();
        })
        .then(function (rows) {
            if (!rows || !rows.length) return { rows: [], enYeni: null };

            var gorulen = {};
            var temiz = [];
            var enYeni = null;

            rows.forEach(function (r) {
                if (!r || !r.slug || gorulen[r.slug]) return;
                gorulen[r.slug] = true;
                var lm = lastmodHikaye(r);
                temiz.push({
                    path: '/h/' + r.slug,
                    changefreq: 'monthly',
                    priority: '0.6',
                    lastmod: lm
                });
                if (lm && (!enYeni || lm > enYeni)) enYeni = lm;
            });

            return { rows: temiz, enYeni: enYeni };
        })
        .catch(function (err) {
            console.warn('Sitemap hikaye fetch hatasi:', err.message || err);
            return { rows: [], enYeni: null };
        });
}

function sitemapYaz(sayfalar) {
    var satirlar = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ];

    sayfalar.forEach(function (s) {
        satirlar.push('  <url>');
        satirlar.push('    <loc>' + BASE + s.path + '</loc>');
        if (s.lastmod) {
            satirlar.push('    <lastmod>' + s.lastmod + '</lastmod>');
        }
        satirlar.push('    <changefreq>' + s.changefreq + '</changefreq>');
        satirlar.push('    <priority>' + s.priority + '</priority>');
        satirlar.push('  </url>');
    });

    satirlar.push('</urlset>');
    satirlar.push('');

    var out = path.join(__dirname, '..', 'sitemap.xml');
    fs.writeFileSync(out, satirlar.join('\n'), 'utf8');
    console.log('sitemap.xml yazildi (' + sayfalar.length + ' URL).');
}

fetchHikayeSluglari().then(function (sonuc) {
    var anasayfa = {
        path: '/',
        changefreq: 'daily',
        priority: '1.0',
        lastmod: sonuc.enYeni || isoGun(new Date().toISOString())
    };
    sitemapYaz([anasayfa].concat(sonuc.rows));
    require('./generate-robots.js');
});
