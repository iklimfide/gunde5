/**
 * robots.txt — yalnızca anasayfa indexlensin; diğer yollar Disallow.
 * generate-sitemap.js ile aynı build adımında çalışır.
 */
const fs = require('fs');
const path = require('path');

var SITE = 'https://gunde5.com';

/** Üründe kapalı veya indexlenmemeli (dosya olsa bile). */
var DISALLOW = [
    '/podyum',
    '/podyum.html',
    '/kvkk',
    '/kvkk.html',
    '/hakkinda',
    '/hakkinda.html',
    '/iletisim',
    '/iletisim.html',
    '/profil',
    '/profil.html',
    '/istatistikler',
    '/istatistikler.html',
    '/metrikler',
    '/metrikler.html',
    '/mudavimler',
    '/mudavimler.html',
    '/uyeler',
    '/uyeler.html',
    '/bulut',
    '/bulut.html',
    '/hikaye-gonder',
    '/hikaye-gonder.html',
    '/kamikaze',
    '/kamikaze.html',
    '/sosyal-paylas',
    '/sosyal-paylas.html',
    '/admin/',
    '/h/',
    '/itiraf/',
    '/demo/',
    '/404',
    '/404.html'
];

var lines = [
    '# gunde5.com — otomatik uretim; yayinda: yalnizca anasayfa',
    'User-agent: *',
    'Allow: /',
    ''
];

DISALLOW.forEach(function (p) {
    lines.push('Disallow: ' + p);
});

lines.push('');
lines.push('Sitemap: ' + SITE + '/sitemap.xml');
lines.push('');

var out = path.join(__dirname, '..', 'robots.txt');
fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.log('robots.txt yazildi (' + DISALLOW.length + ' Disallow).');
