/** gunde5 — hikaye URL slug (itiraf-slug.sql ile aynı mantık) */

var STOP_KELIMELER = new Set([
    'gecen', 'guncen', 'gun', 'gunde', 'ben', 'bana', 'beni', 'bir', 'bu', 'su', 'ya',
    'gibi', 'diye', 'falan', 'aslinda', 'o', 'da', 'de', 'ki', 'mi', 'mu', 'mü', 'mı',
    'icin', 'ile', 've', 'ama', 'hem', 'ne', 'var', 'yok', 'cok', 'daha', 'en', 'her', 'hic',
    'ise', 'olan', 'olur', 'sey', 'kendi', 'onun', 'ona', 'onu', 'sen', 'sana', 'seni',
    'biz', 'bize', 'siz', 'onlar', 'nasil', 'neden', 'boyle', 'simdi', 'sonra', 'once',
    'bile', 'sadece', 'artik', 'yani', 'zaten', 'hala', 'hep', 'bazi', 'butun', 'tum',
    'cunku', 'eger', 'olarak', 'degil', 'uzerine', 'kadar', 'beri', 'gore', 'arada',
    'arasinda', 'hani', 'iste', 'tabi', 'tabii', 'yoksa', 'belki', 'keske', 'hala',
    'baya', 'bayağı', 'bayagi', 'falan', 'filan', 'hani', 'iste', 'sanki', 'galiba'
]);

export function slugNormalize(metin) {
    var t = String(metin || '')
        .toLowerCase()
        .replace(/ç/g, 'c')
        .replace(/ğ/g, 'g')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ş/g, 's')
        .replace(/ü/g, 'u')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return t.slice(0, 80);
}

export function slugUret(hint, content, id) {
    var hintTrim = String(hint || '').trim();
    var base;

    if (hintTrim) {
        base = slugNormalize(hintTrim);
    } else {
        var raw = String(content || '').slice(0, 250).toLowerCase();
        raw = raw
            .replace(/ç/g, 'c')
            .replace(/ğ/g, 'g')
            .replace(/ı/g, 'i')
            .replace(/ö/g, 'o')
            .replace(/ş/g, 's')
            .replace(/ü/g, 'u')
            .replace(/[^a-z0-9\s]+/g, ' ');
        var kelimeler = raw.split(/\s+/).filter(Boolean);
        var secilen = [];
        var i;
        for (i = 0; i < kelimeler.length && secilen.length < 7; i++) {
            if (STOP_KELIMELER.has(kelimeler[i])) continue;
            secilen.push(kelimeler[i]);
        }
        base = secilen.join('-');
    }

    if (!base) base = 'hikaye';
    return base + '-' + String(id);
}

/** /h/nesil-telefonsuz-1842 veya /h/1842 */
export function slugPathtenOku(pathname) {
    var m = String(pathname || '').match(/\/(?:h|itiraf)\/([^/?#]+)\/?$/);
    if (!m) return { slug: null, id: null };
    var parca = decodeURIComponent(m[1]);
    var idEslesme = parca.match(/^(\d+)$/);
    if (idEslesme) return { slug: null, id: idEslesme[1] };
    var sondaId = parca.match(/-(\d+)$/);
    if (sondaId) return { slug: parca, id: sondaId[1] };
    return { slug: parca, id: null };
}
