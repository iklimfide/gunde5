/** Footer gönderim — IP hash + Supabase RPC */

function ipHashAl(req) {
    var fwd = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    var ip = String(fwd).split(',')[0].trim() || 'unknown';
    // Edge: basit hash (crypto.subtle async)
    return ip;
}

async function sha256Hex(metin) {
    var enc = new TextEncoder().encode(metin);
    var buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf))
        .map(function (b) {
            return b.toString(16).padStart(2, '0');
        })
        .join('');
}

export async function ipHashFromRequest(req) {
    var ip = ipHashAl(req);
    try {
        return await sha256Hex('g5-footer:' + ip);
    } catch (e) {
        return ip.slice(0, 64);
    }
}

export async function supabaseRpc(rpcName, body) {
    var url = process.env.GUNDE5_SUPABASE_URL;
    var key =
        process.env.GUNDE5_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.GUNDE5_SUPABASE_ANON_KEY;
    if (!url || !key) {
        return { ok: false, hata: 'Sunucu yapılandırması eksik.' };
    }

    var api = url.replace(/\/$/, '') + '/rest/v1/rpc/' + rpcName;
    var res = await fetch(api, {
        method: 'POST',
        headers: {
            apikey: key,
            Authorization: 'Bearer ' + key,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_body: body })
    });

    if (!res.ok) {
        var errText = await res.text();
        return { ok: false, hata: errText || 'Gönderilemedi.' };
    }
    return res.json();
}

export function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
        status: status || (data && data.ok ? 200 : 400),
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
        }
    });
}

export async function parseBody(req) {
    try {
        return await req.json();
    } catch (e) {
        return null;
    }
}
