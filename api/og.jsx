import { ImageResponse } from '@vercel/og';
import { itirafGetir, metinKisalt } from './_lib/itiraf-fetch.js';

export const config = { runtime: 'edge' };

var SITE = 'https://gunde5.com';

export default async function handler(req) {
    var url = new URL(req.url);
    var id = url.searchParams.get('id');
    var row = id && /^\d+$/.test(id) ? await itirafGetir(id) : null;

    var rumuz = row ? row.username || 'Anonim' : 'gunde5.com';
    var ozet = row
        ? metinKisalt(row.content_short || row.content_full, 140)
        : 'Günün harbi hikayeleri — reklamsız, ücretsiz';
    var meta = [];
    if (row && row.age) meta.push(row.age + ' yaş');
    var yer = row && (row.yasadigi_yer || row.city);
    if (yer) meta.push(String(yer).trim());
    var metaSatir = meta.join(' · ');

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 55%, #0f172a 100%)',
                    color: '#f8fafc',
                    padding: '56px 64px',
                    fontFamily: 'system-ui, sans-serif'
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div
                        style={{
                            fontSize: 28,
                            fontWeight: 700,
                            color: '#fbbf24',
                            letterSpacing: '0.04em'
                        }}
                    >
                        gunde5.com
                    </div>
                    <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.15 }}>{rumuz}</div>
                    {metaSatir ? (
                        <div style={{ fontSize: 24, color: '#94a3b8', fontWeight: 600 }}>{metaSatir}</div>
                    ) : null}
                </div>
                <div
                    style={{
                        fontSize: 30,
                        lineHeight: 1.45,
                        color: '#e2e8f0',
                        fontWeight: 500,
                        maxHeight: 280,
                        overflow: 'hidden'
                    }}
                >
                    {ozet}
                </div>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 22,
                        color: '#64748b',
                        fontWeight: 600
                    }}
                >
                    <span>📌 Devamını REKLAMSIZ ve ÜCRETSİZ oku</span>
                    <span>{SITE.replace('https://', '')}</span>
                </div>
            </div>
        ),
        { width: 1200, height: 630 }
    );
}
