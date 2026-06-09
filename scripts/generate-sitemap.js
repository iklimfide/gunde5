/**
 * Statik sitemap — anasayfa + indexlenebilir hikaye URL'leri (/h/{slug}).
 * Build: GUNDE5_SUPABASE_URL + GUNDE5_SUPABASE_ANON_KEY ile hikayeler çekilir.
 */
const fs = require('fs');
const path = require('path');

var BASE = 'https://gunde5.com';

var SAYFALAR = [{ path: '/', changefreq: 'daily', priority: '1.0' }];

function bugunIso() {
    return new Date().toISOString().slice(0, 10);
}

function isoGun(iso) {
    if (!iso) return bugunIso();
    return String(iso).slice(0, 10);
}

function fetchHikayeSluglari() {
    var url = process.env.GUNDE5_SUPABASE_URL;
    var key = process.env.GUNDE5_SUPABASE_ANON_KEY;
    if (!url || !key) {
        console.log('Supabase env yok; sitemap yalnizca anasayfa.');
        return Promise.resolve([]);
    }

    var api =
        url.replace(/\/$/, '') +
        '/rest/v1/itiraflar?select=slug,created_at' +
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
                return [];
            }
            return res.json();
        })
        .then(function (rows) {
            if (!rows || !rows.length) return [];
            return rows
                .filter(function (r) {
                    return r && r.slug;
                })
                .map(function (r) {
                    return {
                        path: '/h/' + r.slug,
                        changefreq: 'monthly',
                        priority: '0.6',
                        lastmod: isoGun(r.created_at)
                    };
                });
        })
        .catch(function (err) {
            console.warn('Sitemap hikaye fetch hatasi:', err.message || err);
            return [];
        });
}

function sitemapYaz(sayfalar) {
    var lastmod = bugunIso();
    var satirlar = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!-- gunde5 sitemap — uretim: ' + lastmod + ' -->',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ];

    sayfalar.forEach(function (s) {
        satirlar.push('  <url>');
        satirlar.push('    <loc>' + BASE + s.path + '</loc>');
        satirlar.push('    <lastmod>' + (s.lastmod || lastmod) + '</lastmod>');
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

fetchHikayeSluglari().then(function (hikayeler) {
    var tumu = SAYFALAR.concat(hikayeler);
    sitemapYaz(tumu);
    require('./generate-robots.js');
});
