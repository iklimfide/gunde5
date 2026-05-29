export async function itirafGetir(id) {
    var url = process.env.GUNDE5_SUPABASE_URL;
    var key = process.env.GUNDE5_SUPABASE_ANON_KEY;
    if (!url || !key || !id) return null;

    var api =
        url.replace(/\/$/, '') +
        '/rest/v1/itiraflar?id=eq.' +
        encodeURIComponent(String(id)) +
        '&select=id,username,content_short,content_full,age,gender,city,yasadigi_yer';

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
