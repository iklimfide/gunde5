/**
 * robots.txt — yalnızca anasayfa indexlensin; diğer yollar Disallow.
 * Paylaşım önizlemesi botları (/h/, /api/og) için istisna.
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

/** X/Telegram/FB kart botları — robots Disallow olsa da /h/ okuyabilsin. */
var ONIZLEME_BOTLARI = [
    'Twitterbot',
    'facebookexternalhit',
    'Facebot',
    'LinkedInBot',
    'TelegramBot',
    'WhatsApp',
    'Slackbot',
    'Discordbot',
    'Pinterest'
];

var ONIZLEME_IZIN = ['/h/', '/itiraf/', '/api/og'];

var lines = [
    '# gunde5.com — otomatik uretim; yayinda: yalnizca anasayfa',
    '# Paylasim onizleme botlari /h/ ve OG gorselini tarayabilir (Google index degil).'
];

ONIZLEME_BOTLARI.forEach(function (bot) {
    lines.push('User-agent: ' + bot);
    ONIZLEME_IZIN.forEach(function (p) {
        lines.push('Allow: ' + p);
    });
    lines.push('');
});

lines.push('User-agent: *');
lines.push('Allow: /');
lines.push('');

DISALLOW.forEach(function (p) {
    lines.push('Disallow: ' + p);
});

lines.push('');
lines.push('Sitemap: ' + SITE + '/sitemap.xml');
lines.push('');

var out = path.join(__dirname, '..', 'robots.txt');
fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.log('robots.txt yazildi (' + ONIZLEME_BOTLARI.length + ' onizleme botu, ' + DISALLOW.length + ' Disallow).');
