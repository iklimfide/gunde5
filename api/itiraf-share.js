import { itirafGetir, itirafGetirSlug, metinKisalt } from './_lib/itiraf-fetch.js';
import { OG_DESCRIPTION, OG_IMAGE_ALT, OG_IMAGE_URL, OG_TITLE } from './_lib/og-brand.js';
import { slugPathtenOku } from './_lib/slug.js';

export const config = { runtime: 'edge' };

var SITE = 'https://gunde5.com';

/** X/Telegram/FB önizleme botları — anında yönlendirme kartı bozar */
function onizlemeBotu(ua) {
    if (!ua) return false;
    return /twitterbot|facebookexternalhit|facebot|linkedinbot|telegrambot|whatsapp|slackbot|discordbot|pinterest|embedly|quora link preview|vkshare|w3c_validator/i.test(
        ua
    );
}

function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function metinGoster(metin) {
    return escHtml(String(metin || '')).replace(/\n/g, '<br>');
}

function sayfaBaslik(row) {
    if (!row) return OG_TITLE;
    var rumuz = row.username || 'Anonim';
    var oniz = metinKisalt(row.content_short || row.content_full, 72);
    return oniz ? rumuz + ' — ' + oniz + ' | gunde5.com' : rumuz + ' | gunde5.com';
}

function indexlenebilirMi(row) {
    if (!row || row.silindi_at || row.is_gizli) return false;
    if (row.status === 'silindi') return false;
    if (row.created_at && new Date(row.created_at) > new Date()) return false;
    return true;
}

async function itirafCoz(pathname, queryId) {
    var parsed = slugPathtenOku(pathname);
    var row = null;

    if (parsed.slug) {
        row = await itirafGetirSlug(parsed.slug);
    }
    if (!row && (parsed.id || queryId)) {
        row = await itirafGetir(parsed.id || queryId);
    }
    return { row: row, parsed: parsed };
}

export default async function handler(req) {
    var url = new URL(req.url);
    var queryId = url.searchParams.get('id') || url.searchParams.get('itiraf');
    if (queryId && !/^\d+$/.test(queryId)) queryId = null;

    var cozum = await itirafCoz(url.pathname, queryId);
    var row = cozum.row;
    var parsed = cozum.parsed;
    var id = row ? String(row.id) : parsed.id || queryId || null;

    if (id && /^\d+$/.test(String(id)) && row && row.slug && parsed.id && !parsed.slug) {
        return new Response(null, {
            status: 301,
            headers: {
                Location: SITE + '/h/' + row.slug,
                'Cache-Control': 'public, s-maxage=86400'
            }
        });
    }

    var indexle = indexlenebilirMi(row);
    var rumuz = row ? row.username || 'Anonim' : 'gunde5.com';
    var aciklama = row
        ? metinKisalt(row.content_full || row.content_short, 160)
        : OG_DESCRIPTION;
    var baslik = sayfaBaslik(row);
    var paylasUrl = row && row.slug ? SITE + '/h/' + row.slug : id ? SITE + '/h/' + id : SITE + '/';
    var okumaUrl = id ? SITE + '/?itiraf=' + id : SITE + '/';
    var ogImage = id ? SITE + '/api/og?id=' + encodeURIComponent(id) + '&v=5' : OG_IMAGE_URL;
    var ogImageAlt = row ? rumuz + ' — gunde5.com' : OG_IMAGE_ALT;
    var bot = onizlemeBotu(req.headers.get('user-agent') || '');
    var govdeMetin = row ? row.content_full || row.content_short || '' : '';

    var html =
        '<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">' +
        '<title>' +
        escHtml(baslik) +
        '</title>' +
        '<meta name="description" content="' +
        escHtml(aciklama) +
        '">' +
        '<meta name="robots" content="' +
        (indexle ? 'index, follow, max-image-preview:large' : 'noindex, nofollow') +
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
        '<meta name="twitter:domain" content="gunde5.com">' +
        '<meta name="twitter:url" content="' +
        escHtml(paylasUrl) +
        '">' +
        '<meta name="twitter:image:width" content="1200">' +
        '<meta name="twitter:image:height" content="630">' +
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
        '">';

    if (row && indexle) {
        html +=
            '<script type="application/ld+json">' +
            JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: metinKisalt(row.content_short || row.content_full, 110),
                author: { '@type': 'Person', name: rumuz },
                datePublished: row.created_at,
                url: paylasUrl,
                description: aciklama,
                publisher: { '@type': 'Organization', name: 'gunde5.com' }
            }) +
            '</script>';
    }

    html +=
        '</head><body style="font-family:system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#111">' +
        '<header><a href="' +
        escHtml(SITE) +
        '">gunde5.com</a></header>';

    if (row) {
        html +=
            '<article style="margin-top:1.5rem">' +
            '<h1 style="font-size:1.25rem;margin:0 0 .5rem">' +
            escHtml(rumuz) +
            '</h1>' +
            '<div>' +
            metinGoster(govdeMetin) +
            '</div>' +
            '<p style="margin-top:1.5rem"><a href="' +
            escHtml(okumaUrl) +
            '">Tam deneyimde oku →</a></p>' +
            '</article>';
    } else {
        html += '<p><a href="' + escHtml(SITE) + '">Anasayfaya dön</a></p>';
    }

    if (!bot && row && !indexle) {
        html += '<script>location.replace(' + JSON.stringify(okumaUrl) + ');</script>';
    }

    html += '</body></html>';

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            Vary: 'User-Agent'
        }
    });
}
