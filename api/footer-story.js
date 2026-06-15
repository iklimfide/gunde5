import { ipHashFromRequest, jsonResponse, parseBody, supabaseRpc } from './_lib/footer-submit.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method !== 'POST') {
        return jsonResponse({ ok: false, hata: 'Yalnızca POST.' }, 405);
    }

    var body = await parseBody(req);
    if (!body || typeof body !== 'object') {
        return jsonResponse({ ok: false, hata: 'Geçersiz istek.' }, 400);
    }

    var ipHash = await ipHashFromRequest(req);
    var payload = {
        type: body.type || 'story',
        username: body.username || '',
        content: body.content || '',
        age: body.age,
        city: body.city || '',
        gender: body.gender || '',
        visitor_id: body.visitor_id || '',
        user_agent: (req.headers.get('user-agent') || '').slice(0, 400),
        ip_hash: ipHash
    };

    var sonuc = await supabaseRpc('footer_gonder_hikaye', payload);
    return jsonResponse(sonuc, sonuc && sonuc.ok ? 200 : 400);
}
