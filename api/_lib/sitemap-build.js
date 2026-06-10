/**
 * Sitemap XML — anasayfa + indexlenebilir /h/{slug} URL'leri.
 * Kaynak: itiraflar.slug (yeniden üretilmez).
 */
var BASE = 'https://gunde5.com';

function isoGun(iso) {
    if (!iso) return null;
    return String(iso).slice(0, 10);
}

/** updated_at yalnızca created_at'tan sonra ise (gerçek düzenleme); eşitse yayın tarihi */
export function lastmodHikaye(row) {
    var yayin = isoGun(row.created_at);
    var guncel = isoGun(row.updated_at);
    if (!yayin) return guncel;
    if (!guncel || guncel <= yayin) return yayin;
    return guncel;
}

export async function fetchHikayeSayfalari() {
    var url = process.env.GUNDE5_SUPABASE_URL;
    var key = process.env.GUNDE5_SUPABASE_ANON_KEY;
    if (!url || !key) {
        return { rows: [], enYeni: null };
    }

    var simdi = new Date().toISOString();
    var api =
        url.replace(/\/$/, '') +
        '/rest/v1/itiraflar?select=slug,created_at,updated_at' +
        '&slug=not.is.null' +
        '&silindi_at=is.null' +
        '&is_gizli=eq.false' +
        '&status=in.(kulis,podyum)' +
        '&created_at=lte.' + encodeURIComponent(simdi) +
        '&order=created_at.desc' +
        '&limit=5000';

    var res = await fetch(api, {
        headers: {
            apikey: key,
            Authorization: 'Bearer ' + key
        }
    });

    if (!res.ok) {
        console.warn('Sitemap hikaye listesi alinamadi:', res.status);
        return { rows: [], enYeni: null };
    }

    var rows = await res.json();
    if (!rows || !rows.length) return { rows: [], enYeni: null };

    var gorulen = {};
    var temiz = [];
    var enYeni = null;

    rows.forEach(function (r) {
        if (!r || !r.slug || String(r.slug).trim() === '' || gorulen[r.slug]) return;
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
}

export function sitemapXmlOlustur(sayfalar) {
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
    return satirlar.join('\n');
}

export async function buildSitemapXml() {
    var sonuc = await fetchHikayeSayfalari();
    var anasayfa = {
        path: '/',
        changefreq: 'daily',
        priority: '1.0',
        lastmod: sonuc.enYeni || isoGun(new Date().toISOString())
    };
    return sitemapXmlOlustur([anasayfa].concat(sonuc.rows));
}
