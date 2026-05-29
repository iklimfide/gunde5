import { itirafGetir, metinKisalt } from './_lib/itiraf-fetch.js';

export const config = { runtime: 'edge' };

var SITE = 'https://gunde5.com';
var DEFAULT_IMG = SITE + '/og-share.png';

function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function idOku(url) {
    var u = new URL(url);
    var id = u.searchParams.get('id') || u.searchParams.get('itiraf');
    if (id && /^\d+$/.test(id)) return id;
    var m = u.pathname.match(/\/(?:h|itiraf)\/(\d+)\/?$/);
    return m ? m[1] : null;
}

export default async function handler(req) {
    var url = new URL(req.url);
    var id = idOku(url);
    var row = id ? await itirafGetir(id) : null;

    var rumuz = row ? row.username || 'Anonim' : 'gunde5.com';
    var aciklama = row
        ? metinKisalt(row.content_short || row.content_full, 160)
        : 'Her gün halkın içinden harbi insan hikayeleri — reklamsız, ücretsiz.';
    var baslik = row ? rumuz + ' | gunde5.com' : 'gunde5.com | Günün harbi hikayeleri';
    var okumaUrl = id ? SITE + '/?itiraf=' + id : SITE + '/';
    var paylasUrl = id ? SITE + '/h/' + id : SITE + '/';
    var ogImage = id ? SITE + '/api/og?id=' + encodeURIComponent(id) : DEFAULT_IMG;
    var ogImageAlt = row ? rumuz + ' — gunde5.com' : 'gunde5.com';

    var html =
        '<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">' +
        '<title>' +
        escHtml(baslik) +
        '</title>' +
        '<meta name="description" content="' +
        escHtml(aciklama) +
        '">' +
        '<link rel="canonical" href="' +
        escHtml(paylasUrl) +
        '">' +
        '<meta property="og:type" content="article">' +
        '<meta property="og:site_name" content="gunde5.com">' +
        '<meta property="og:locale" content="tr_TR">' +
        '<meta property="og:title" content="' +
        escHtml(baslik) +
        '">' +
        '<meta property="og:description" content="' +
        escHtml(aciklama) +
        '">' +
        '<meta property="og:url" content="' +
        escHtml(paylasUrl) +
        '">' +
        '<meta property="og:image" content="' +
        escHtml(ogImage) +
        '">' +
        '<meta property="og:image:width" content="1200">' +
        '<meta property="og:image:height" content="630">' +
        '<meta property="og:image:type" content="image/png">' +
        '<meta property="og:image:alt" content="' +
        escHtml(ogImageAlt) +
        '">' +
        '<meta name="twitter:card" content="summary_large_image">' +
        '<meta name="twitter:image:alt" content="' +
        escHtml(ogImageAlt) +
        '">' +
        '<meta name="twitter:title" content="' +
        escHtml(baslik) +
        '">' +
        '<meta name="twitter:description" content="' +
        escHtml(aciklama) +
        '">' +
        '<meta name="twitter:image" content="' +
        escHtml(ogImage) +
        '">' +
        '<meta http-equiv="refresh" content="0;url=' +
        escHtml(okumaUrl) +
        '">' +
        '</head><body><p><a href="' +
        escHtml(okumaUrl) +
        '">gunde5.com</a></p>' +
        '<script>location.replace(' +
        JSON.stringify(okumaUrl) +
        ');</script></body></html>';

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
        }
    });
}
