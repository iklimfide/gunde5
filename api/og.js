import { ImageResponse } from '@vercel/og';
import { itirafGetir, metinKisalt } from './_lib/itiraf-fetch.js';

export const config = { runtime: 'edge' };

var SITE = 'https://gunde5.com';
var DEFAULT_PNG = SITE + '/og-share.png';

var FONT =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function cinsTema(cins) {
    if (cins === 'male') {
        return {
            kartBg: '#eff6ff',
            border: '#bfdbfe',
            accent: '#2563eb',
            avatarBg: '#2563eb',
            simge: '\u2642'
        };
    }
    return {
        kartBg: '#fff1f2',
        border: '#fecdd3',
        accent: '#db2777',
        avatarBg: '#db2777',
        simge: '\u2640'
    };
}

function markaSatir() {
    return {
        type: 'div',
        props: {
            style: {
                display: 'flex',
                alignItems: 'center',
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#6b7280'
            },
            children: [
                { type: 'span', props: { children: 'gunde' } },
                {
                    type: 'span',
                    props: { style: { color: '#ef4444' }, children: '5' }
                },
                { type: 'span', props: { children: '.com' } }
            ]
        }
    };
}

function filigran() {
    return {
        type: 'div',
        props: {
            style: {
                position: 'absolute',
                top: '42%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(-32deg)',
                fontSize: 88,
                fontWeight: 900,
                letterSpacing: '-0.04em',
                color: 'rgba(17, 24, 39, 0.08)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none'
            },
            children: 'gunde5.com'
        }
    };
}

function kart(rumuz, ozet, metaSatir, cins) {
    var tema = cinsTema(cins);

    return {
        type: 'div',
        props: {
            style: {
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f3f4f6',
                padding: '40px 48px',
                fontFamily: FONT
            },
            children: [
                {
                type: 'div',
                props: {
                    style: {
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        height: '100%',
                        maxHeight: 550,
                        backgroundColor: tema.kartBg,
                        border: '3px solid ' + tema.border,
                        borderRadius: 36,
                        padding: '40px 44px',
                        overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)'
                    },
                    children: [
                        filigran(),
                        {
                            type: 'div',
                            props: {
                                style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 28,
                                    position: 'relative',
                                    zIndex: 1
                                },
                                children: [
                                    {
                                        type: 'div',
                                        props: {
                                            style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 20
                                            },
                                            children: [
                                                {
                                                    type: 'div',
                                                    props: {
                                                        style: {
                                                            width: 64,
                                                            height: 64,
                                                            borderRadius: '50%',
                                                            backgroundColor: tema.avatarBg,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: '#ffffff',
                                                            fontSize: 30,
                                                            fontWeight: 700,
                                                            flexShrink: 0
                                                        },
                                                        children: tema.simge
                                                    }
                                                },
                                                {
                                                    type: 'div',
                                                    props: {
                                                        style: {
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: 6
                                                        },
                                                        children: [
                                                            {
                                                                type: 'div',
                                                                props: {
                                                                    style: {
                                                                        fontSize: 36,
                                                                        fontWeight: 800,
                                                                        color: tema.accent,
                                                                        lineHeight: 1.15
                                                                    },
                                                                    children: rumuz
                                                                }
                                                            },
                                                            metaSatir
                                                                ? {
                                                                      type: 'div',
                                                                      props: {
                                                                          style: {
                                                                              fontSize: 22,
                                                                              fontWeight: 600,
                                                                              color: '#6b7280'
                                                                          },
                                                                          children: metaSatir
                                                                      }
                                                                  }
                                                                : null
                                                        ].filter(Boolean)
                                                    }
                                                }
                                            ]
                                        }
                                    },
                                    markaSatir()
                                ]
                            }
                        },
                        {
                            type: 'div',
                            props: {
                                style: {
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    position: 'relative',
                                    zIndex: 1,
                                    marginBottom: 24
                                },
                                children: {
                                    type: 'div',
                                    props: {
                                        style: {
                                            fontSize: 28,
                                            lineHeight: 1.55,
                                            color: '#111827',
                                            fontWeight: 500,
                                            textAlign: 'justify'
                                        },
                                        children: ozet
                                    }
                                }
                            }
                        },
                        {
                            type: 'div',
                            props: {
                                style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    borderTop: '2px solid rgba(0,0,0,0.06)',
                                    paddingTop: 22,
                                    position: 'relative',
                                    zIndex: 1
                                },
                                children: [
                                    {
                                        type: 'div',
                                        props: {
                                            style: {
                                                fontSize: 20,
                                                fontWeight: 700,
                                                color: '#6b7280'
                                            },
                                            children:
                                                '\uD83D\uDCCC Devam\u0131n\u0131 REKLAMSIZ ve \u00DCCRETS\u0130Z oku'
                                        }
                                    },
                                    {
                                        type: 'div',
                                        props: {
                                            style: {
                                                display: 'flex',
                                                gap: 16,
                                                fontSize: 20,
                                                fontWeight: 700,
                                                color: '#9ca3af'
                                            },
                                            children: [
                                                {
                                                    type: 'span',
                                                    props: { children: '\uD83D\uDC4F Alk\u0131\u015fla' }
                                                },
                                                {
                                                    type: 'span',
                                                    props: { children: '\uD83D\uDD17 Payla\u015f' }
                                                }
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
            ]
        }
    };
}

function varsayilanKart() {
    return kart(
        'gunde5.com',
        'Her g\u00fcn halk\u0131n i\u00e7inden 5 harbi insan hikayesi \u2014 reklams\u0131z, \u00fccretsiz.',
        null,
        'female'
    );
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

        var cins = row && row.gender === 'male' ? 'male' : 'female';
        var rumuz = row ? row.username || 'Anonim' : 'gunde5.com';
        var ozet = row
            ? metinKisalt(row.content_short || row.content_full, 200)
            : 'G\u00fcn\u00fcn harbi hikayeleri \u2014 reklams\u0131z, \u00fccretsiz.';
        var meta = [];
        if (row && row.age) meta.push(row.age + ' ya\u015f');
        var yer = row && (row.yasadigi_yer || row.city);
        if (yer) meta.push(String(yer).trim());
        var metaSatir = meta.join(' \u00b7 ');

        var tree = row ? kart(rumuz, ozet, metaSatir, cins) : varsayilanKart();

        var img = new ImageResponse(tree, {
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
