/**
 * Statik sitemap — yalnızca gerçekten yayında ve indexlenen sayfalar.
 * Yeni sayfa eklendiğinde buraya ekle (clean URL, .html yok).
 */
const fs = require('fs');
const path = require('path');

var BASE = 'https://gunde5.com';

/** Şu an kullanıcıya açık tek yüzey: anasayfa (index.html). */
var SAYFALAR = [{ path: '/', changefreq: 'daily', priority: '1.0' }];

function bugunIso() {
    return new Date().toISOString().slice(0, 10);
}

var lastmod = bugunIso();
var satirlar = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- gunde5 sitemap — yayinda olan sayfalar; uretim: ' + lastmod + ' -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
];

SAYFALAR.forEach(function (s) {
    satirlar.push('  <url>');
    satirlar.push('    <loc>' + BASE + s.path + '</loc>');
    satirlar.push('    <lastmod>' + lastmod + '</lastmod>');
    satirlar.push('    <changefreq>' + s.changefreq + '</changefreq>');
    satirlar.push('    <priority>' + s.priority + '</priority>');
    satirlar.push('  </url>');
});

satirlar.push('</urlset>');
satirlar.push('');

var out = path.join(__dirname, '..', 'sitemap.xml');
fs.writeFileSync(out, satirlar.join('\n'), 'utf8');
console.log('sitemap.xml yazildi (' + SAYFALAR.length + ' URL, lastmod ' + lastmod + ').');
