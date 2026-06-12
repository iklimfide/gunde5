var ITIRAF_SELECT =
    'id,username,content_short,content_full,age,gender,city,yasadigi_yer,baslik,slug,slug_hint,status,is_gizli,silindi_at,created_at';

async function itirafRestSorgu(filtre) {
    var url = process.env.GUNDE5_SUPABASE_URL;
    var key = process.env.GUNDE5_SUPABASE_ANON_KEY;
    if (!url || !key || !filtre) return null;

    var api = url.replace(/\/$/, '') + '/rest/v1/itiraflar?' + filtre + '&select=' + ITIRAF_SELECT + '&limit=1';

    var res = await fetch(api, {
        headers: {
            apikey: key,
            Authorization: 'Bearer ' + key
        }
    });

    if (!res.ok) return null;
    var rows = await res.json();
    return rows && rows[0] ? rows[0] : null;
}

export async function itirafGetir(id) {
    if (!id) return null;
    return itirafRestSorgu('id=eq.' + encodeURIComponent(String(id)));
}

export async function itirafGetirSlug(slug) {
    if (!slug) return null;
    var row = await itirafRestSorgu('slug=eq.' + encodeURIComponent(String(slug)));
    if (row) return row;
    return itirafGecmisSlugdanGetir(slug);
}

/** Backfill sonrası eski slug → güncel kayıt (itiraf_slug_gecmisi) */
async function itirafGecmisSlugdanGetir(eskiSlug) {
    var url = process.env.GUNDE5_SUPABASE_URL;
    var key = process.env.GUNDE5_SUPABASE_ANON_KEY;
    if (!url || !key || !eskiSlug) return null;

    var api =
        url.replace(/\/$/, '') +
        '/rest/v1/itiraf_slug_gecmisi?eski_slug=eq.' +
        encodeURIComponent(String(eskiSlug)) +
        '&select=itiraf_id&limit=1';

    var res = await fetch(api, {
        headers: {
            apikey: key,
            Authorization: 'Bearer ' + key
        }
    });

    if (!res.ok) return null;
    var rows = await res.json();
    if (!rows || !rows[0] || !rows[0].itiraf_id) return null;
    return itirafGetir(rows[0].itiraf_id);
}

export function ilkKelimeler(metin, maxKelime) {
    var t = String(metin || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!t || !maxKelime) return '';
    var kelimeler = t.split(' ');
    if (kelimeler.length <= maxKelime) return t;
    return kelimeler.slice(0, maxKelime).join(' ') + '…';
}

export function metinKisalt(metin, max) {
    var t = String(metin || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!t) return '';
    if (t.length <= max) return t;
    var kes = t.slice(0, max - 1).trim();
    var son = kes.lastIndexOf(' ');
    if (son > 0) kes = kes.slice(0, son).trim();
    return kes + '…';
}

/** Kart önizlemesi: satır sonlarını korur (gunde5-ui metinBol ile aynı). */
export function metinKisaltKart(metin, max) {
    var m = String(metin || '');
    if (!m) return '';
    if (m.length <= max) return m;
    return m.slice(0, max) + '...';
}

function istanbulYmd(iso) {
    if (!iso) return null;
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(iso));
}

function istanbulGunAraligi(ymd) {
    var bas = new Date(ymd + 'T00:00:00+03:00').toISOString();
    var parca = ymd.split('-');
    var son = new Date(
        Date.UTC(parseInt(parca[0], 10), parseInt(parca[1], 10) - 1, parseInt(parca[2], 10) + 1)
    );
    var sonYmd = son.toISOString().slice(0, 10);
    return {
        bas: bas,
        son: new Date(sonYmd + 'T00:00:00+03:00').toISOString()
    };
}

/** Aynı yayın gününden başka bir hikaye (önce karşı cinsiyet). */
export async function itirafAyniGunEs(anaRow) {
    var url = process.env.GUNDE5_SUPABASE_URL;
    var key = process.env.GUNDE5_SUPABASE_ANON_KEY;
    if (!url || !key || !anaRow || !anaRow.id || !anaRow.created_at) return null;

    var ymd = istanbulYmd(anaRow.created_at);
    if (!ymd) return null;
    var aralik = istanbulGunAraligi(ymd);
    var simdi = new Date().toISOString();
    var hedefCins = anaRow.gender === 'male' ? 'female' : 'male';

    var api =
        url.replace(/\/$/, '') +
        '/rest/v1/itiraflar?select=id,username,content_short,content_full,age,gender,baslik,created_at' +
        '&id=neq.' + encodeURIComponent(String(anaRow.id)) +
        '&created_at=gte.' + encodeURIComponent(aralik.bas) +
        '&created_at=lt.' + encodeURIComponent(aralik.son) +
        '&created_at=lte.' + encodeURIComponent(simdi) +
        '&silindi_at=is.null' +
        '&order=created_at.asc' +
        '&limit=12';

    var res = await fetch(api, {
        headers: {
            apikey: key,
            Authorization: 'Bearer ' + key
        }
    });

    if (!res.ok) return null;
    var rows = await res.json();
    if (!rows || !rows.length) return null;

    var i;
    for (i = 0; i < rows.length; i++) {
        if (rows[i].gender === hedefCins) return rows[i];
    }
    return rows[0];
}
