/** gunde5 — hikaye URL slug (supabase/itiraf-slug*.sql ile aynı mantık) */

var SLUG_MAX_KELIME = 7;
var SLUG_MAX_UZUNLUK = 60;

var STOP_KELIMELER = new Set([
    'bir', 'bu', 'su', 'sü', 'ben', 'bana', 'beni', 'benim', 'biz', 'bizim', 'siz', 'sizin',
    'gecen', 'guncen', 'gun', 'gunde', 'birkac', 'once', 'sonra', 'aslinda', 'falan', 'yani',
    'diye', 'gibi', 'kadar', 'beri', 'cok', 'daha', 'yine', 'sey', 'hicbir', 'hic',
    'ya', 'o', 'da', 'de', 'ki', 'mi', 'mu', 'mü', 'mı', 'icin', 'ile', 've', 'ama', 'hem',
    'ne', 'var', 'yok', 'en', 'her', 'ise', 'olan', 'olur', 'kendi', 'onun', 'ona', 'onu',
    'sen', 'sana', 'seni', 'bize', 'onlar', 'nasil', 'neden', 'boyle', 'simdi', 'bile',
    'sadece', 'artik', 'zaten', 'hala', 'hep', 'bazi', 'butun', 'tum', 'cunku', 'eger',
    'olarak', 'degil', 'uzerine', 'gore', 'arada', 'arasinda', 'hani', 'iste', 'tabi',
    'tabii', 'yoksa', 'belki', 'keske', 'baya', 'bayagi', 'filan', 'sanki', 'galiba'
]);

export function slugNormalize(metin) {
    return String(metin || '')
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
}

export function slugKelimeGecerli(kelime, stopFiltre) {
    var w = String(kelime || '').trim();
    if (!w) return false;
    if (stopFiltre && STOP_KELIMELER.has(w)) return false;
    if (/^[0-9]+$/.test(w)) return true;
    if (w.length === 1 && /^[a-z]$/.test(w)) return false;
    return /^[a-z0-9]+$/.test(w);
}

export function slugKelimelerdenBase(kelimeler, opts) {
    var maxK = (opts && opts.maxKelimeler) || SLUG_MAX_KELIME;
    var maxLen = (opts && opts.maxUzunluk) || SLUG_MAX_UZUNLUK;
    var stopFiltre = !opts || opts.stopFiltre !== false;
    var liste = Array.isArray(kelimeler) ? kelimeler : [];
    var secilen = [];
    var i;

    for (i = 0; i < liste.length && secilen.length < maxK; i++) {
        if (slugKelimeGecerli(liste[i], stopFiltre)) {
            secilen.push(liste[i]);
        }
    }

    if (!secilen.length) {
        for (i = 0; i < liste.length && secilen.length < Math.min(3, maxK); i++) {
            var w = String(liste[i] || '').trim();
            if (w && /^[a-z0-9]{2,}$/.test(w)) secilen.push(w);
        }
    }

    if (!secilen.length) return 'hikaye';

    var parcalar = [];
    for (i = 0; i < secilen.length; i++) {
        var deneme = parcalar.length ? parcalar.join('-') + '-' + secilen[i] : secilen[i];
        if (deneme.length > maxLen) break;
        parcalar.push(secilen[i]);
    }

    if (parcalar.length) return parcalar.join('-');
    if (secilen[0].length <= maxLen) return secilen[0];
    return 'hikaye';
}

export function slugUret(hint, content, id) {
    var hintTrim = String(hint || '').trim();
    var base;

    if (hintTrim) {
        var normHint = slugNormalize(hintTrim);
        base = slugKelimelerdenBase(
            normHint.split('-').filter(Boolean),
            { stopFiltre: false }
        );
    } else {
        var raw = String(content || '').slice(0, 400).toLowerCase();
        raw = raw
            .replace(/ç/g, 'c')
            .replace(/ğ/g, 'g')
            .replace(/ı/g, 'i')
            .replace(/ö/g, 'o')
            .replace(/ş/g, 's')
            .replace(/ü/g, 'u')
            .replace(/[^a-z0-9\s]+/g, ' ');
        base = slugKelimelerdenBase(raw.split(/\s+/).filter(Boolean));
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
