import { ImageResponse } from '@vercel/og';
import { itirafGetir, metinKisalt } from './_lib/itiraf-fetch.js';

export const config = { runtime: 'edge' };

var SITE = 'https://gunde5.com';
var DEFAULT_PNG = SITE + '/og-share.png';

function kart(rumuz, ozet, metaSatir) {
    var ust = [
        {
            type: 'div',
            props: {
                style: {
                    fontSize: 28,
                    fontWeight: 700,
                    color: '#fbbf24',
                    letterSpacing: '0.04em'
                },
                children: 'gunde5.com'
            }
        },
        {
            type: 'div',
            props: {
                style: { fontSize: 44, fontWeight: 800, lineHeight: 1.15 },
                children: rumuz
            }
        }
    ];

    if (metaSatir) {
        ust.push({
            type: 'div',
            props: {
                style: { fontSize: 24, color: '#94a3b8', fontWeight: 600 },
                children: metaSatir
            }
        });
    }

    return {
        type: 'div',
        props: {
            style: {
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 55%, #0f172a 100%)',
                color: '#f8fafc',
                padding: '56px 64px',
                fontFamily: 'system-ui, sans-serif'
            },
            children: [
                {
                    type: 'div',
                    props: {
                        style: { display: 'flex', flexDirection: 'column', gap: 16 },
                        children: ust
                    }
                },
                {
                    type: 'div',
                    props: {
                        style: {
                            fontSize: 30,
                            lineHeight: 1.45,
                            color: '#e2e8f0',
                            fontWeight: 500,
                            maxHeight: 280,
                            overflow: 'hidden'
                        },
                        children: ozet
                    }
                },
                {
                    type: 'div',
                    props: {
                        style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 22,
                            color: '#64748b',
                            fontWeight: 600
                        },
                        children: [
                            {
                                type: 'span',
                                props: { children: 'Devamini REKLAMSIZ ve UCRETSIZ oku' }
                            },
                            {
                                type: 'span',
                                props: { children: 'gunde5.com' }
                            }
                        ]
                    }
                }
            ]
        }
    };
}

async function varsayilanPng() {
    var res = await fetch(DEFAULT_PNG);
    if (!res.ok) throw new Error('og-share.png alinamadi');
    var buf = await res.arrayBuffer();
    return new Response(buf, {
        headers: {
            'Content-Type': 'image/png',
            'Content-Length': String(buf.byteLength),
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
        }
    });
}

export default async function handler(req) {
    try {
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

        var img = new ImageResponse(kart(rumuz, ozet, metaSatir), {
            width: 1200,
            height: 630
        });
        var buf = await img.arrayBuffer();
        return new Response(buf, {
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': String(buf.byteLength),
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
            }
        });
    } catch (e) {
        return varsayilanPng();
    }
}
