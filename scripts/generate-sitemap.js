/**
 * Statik sitemap — indexlenebilir sayfalar (clean URL, .html yok).
 * robots.txt / meta noindex ile uyumlu; profil, admin, istatistik vb. dahil değil.
 */
const fs = require('fs');
const path = require('path');

var BASE = 'https://gunde5.com';
var SAYFALAR = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/podyum', changefreq: 'daily', priority: '0.9' },
    { path: '/hakkinda', changefreq: 'monthly', priority: '0.5' },
    { path: '/iletisim', changefreq: 'monthly', priority: '0.4' },
    { path: '/kvkk', changefreq: 'monthly', priority: '0.4' }
];

var satirlar = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];

SAYFALAR.forEach(function (s) {
    satirlar.push('  <url>');
    satirlar.push('    <loc>' + BASE + s.path + '</loc>');
    satirlar.push('    <changefreq>' + s.changefreq + '</changefreq>');
    satirlar.push('    <priority>' + s.priority + '</priority>');
    satirlar.push('  </url>');
});

satirlar.push('</urlset>');
satirlar.push('');

var out = path.join(__dirname, '..', 'sitemap.xml');
fs.writeFileSync(out, satirlar.join('\n'), 'utf8');
console.log('sitemap.xml yazıldı (' + SAYFALAR.length + ' URL).');
