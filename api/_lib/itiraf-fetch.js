export async function itirafGetir(id) {
    var url = process.env.GUNDE5_SUPABASE_URL;
    var key = process.env.GUNDE5_SUPABASE_ANON_KEY;
    if (!url || !key || !id) return null;

    var api =
        url.replace(/\/$/, '') +
        '/rest/v1/itiraflar?id=eq.' +
        encodeURIComponent(String(id)) +
        '&select=id,username,content_short,content_full,age,gender,city,yasadigi_yer,baslik,created_at';

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

export function metinKisalt(metin, max) {
    var t = String(metin || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!t) return '';
    if (t.length <= max) return t;
    return t.slice(0, max - 1).trim() + '…';
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
