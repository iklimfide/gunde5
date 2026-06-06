import { ImageResponse } from '@vercel/og';
import { itirafGetir, itirafAyniGunEs, metinKisalt, metinKisaltKart } from './_lib/itiraf-fetch.js';
import { OG_DESCRIPTION } from './_lib/og-brand.js';

export const config = { runtime: 'edge' };

var FONT =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
var METIN_LIMIT = 140;
var CTA = '\uD83D\uDCCC Devam\u0131n\u0131 REKLAMSIZ ve \u00DCCRETS\u0130Z oku';
var BOYUT = { width: 1200, height: 630 };

var OLCEK_IKILI = {
    kartW: 586,
    kartH: 614,
    ustSerit: 22,
    altSerit: 24,
    rumuz: 32,
    metin: 23,
    cta: 26,
    avatar: 54,
    avatarFont: 26,
    marka: 14,
    filigran: 130,
    padX: 18,
    padY: 16,
    govdeH: 480
};

var OLCEK_TEK = {
    kartW: 1200,
    kartH: 630,
    ustSerit: 28,
    altSerit: 28,
    rumuz: 46,
    metin: 34,
    cta: 34,
    avatar: 72,
    avatarFont: 36,
    marka: 22,
    filigran: 200,
    padX: 40,
    padY: 24,
    govdeH: 500
};

function cinsTema(cins) {
    if (cins === 'male') {
        return {
            bg: 'linear-gradient(165deg, #7eb0e8 0%, #5b8fd9 48%, #4a7bc8 100%)',
            serit: 'rgba(0, 0, 0, 0.28)',
            simge: '\uD83D\uDC68'
        };
    }
    return {
        bg: 'linear-gradient(165deg, #f0a4b8 0%, #e8879c 48%, #d97088 100%)',
        serit: 'rgba(0, 0, 0, 0.22)',
        simge: '\uD83D\uDC69'
    };
}

function temaEmoji(metin) {
    var t = String(metin || '').toLowerCase();
    if (/bavul|valiz|gurbet|yurtd|almanya|uçak|havaliman/.test(t)) return '\uD83E\uDDF3';
    if (/asansör|apartman|kat/.test(t)) return '\uD83D\uDED7';
    if (/mum|karanlık|elektrik/.test(t)) return '\uD83D\uDD6F';
    if (/kahve|çay|latte/.test(t)) return '\u2615';
    if (/aşk|sevgil|flört|aldat/.test(t)) return '\u2764\uFE0F';
    if (/komik|gül|kahkaha/.test(t)) return '\uD83D\uDE04';
    if (/okul|sınav|üniversite|öğretmen/.test(t)) return '\uD83D\uDCDA';
    if (/iş|patron|mesai|maaş|ofis/.test(t)) return '\uD83D\uDCBC';
    if (/aile|anne|baba|kardeş/.test(t)) return '\uD83C\uDFE0';
    if (/evlilik|düğün|nişan/.test(t)) return '\uD83D\uDC8D';
    return '\uD83D\uDCAC';
}

function rumuzBaslik(rumuz, yas) {
    var ad = String(rumuz || 'Anonim').trim();
    if (yas) return ad + ' (' + yas + ')';
    return ad;
}

function ozetMetin(kaynak) {
    return metinKisaltKart(String(kaynak || ''), METIN_LIMIT);
}

function hikayeKart(rumuz, ozet, yas, cins, filigranEmoji, olcek) {
    var o = olcek || OLCEK_TEK;
    var tema = cinsTema(cins);
    var baslik = rumuzBaslik(rumuz, yas);

    return {
        type: 'div',
        props: {
            style: {
                width: o.kartW,
                height: o.kartH,
                display: 'flex',
                flexDirection: 'column',
                background: tema.bg,
                fontFamily: FONT,
                color: '#ffffff',
                flexShrink: 0
            },
            children: [
                {
                    type: 'div',
                    props: {
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            backgroundColor: tema.serit,
                            color: '#ffffff',
                            fontSize: o.ustSerit,
                            fontWeight: 700,
                            padding: '10px 12px',
                            flexShrink: 0
                        },
                        children: 'gunde5.com | ' + rumuz
                    }
                },
                {
                    type: 'div',
                    props: {
                        style: {
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            flexGrow: 1,
                            width: '100%',
                            height: o.govdeH,
                            padding: o.padY + 'px ' + o.padX + 'px 12px',
                            overflow: 'hidden'
                        },
                        children: [
                            {
                                type: 'div',
                                props: {
                                    style: {
                                        position: 'absolute',
                                        top: 8,
                                        right: o.padX,
                                        fontSize: o.marka,
                                        fontWeight: 700,
                                        color: 'rgba(255, 255, 255, 0.42)'
                                    },
                                    children: 'gunde5.com'
                                }
                            },
                            {
                                type: 'div',
                                props: {
                                    style: {
                                        position: 'absolute',
                                        top: '56%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        fontSize: o.filigran,
                                        opacity: 0.14,
                                        display: 'flex'
                                    },
                                    children: filigranEmoji
                                }
                            },
                            {
                                type: 'div',
                                props: {
                                    style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        position: 'relative',
                                        zIndex: 1,
                                        flexShrink: 0,
                                        marginBottom: 10
                                    },
                                    children: [
                                        {
                                            type: 'div',
                                            props: {
                                                style: {
                                                    width: o.avatar,
                                                    height: o.avatar,
                                                    borderRadius: '50%',
                                                    backgroundColor: '#ffffff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: o.avatarFont,
                                                    flexShrink: 0
                                                },
                                                children: tema.simge
                                            }
                                        },
                                        {
                                            type: 'div',
                                            props: {
                                                style: {
                                                    fontSize: o.rumuz,
                                                    fontWeight: 800,
                                                    lineHeight: 1.1,
                                                    color: '#ffffff'
                                                },
                                                children: baslik
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                type: 'div',
                                props: {
                                    style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flexGrow: 1,
                                        position: 'relative',
                                        zIndex: 1
                                    },
                                    children: [
                                        {
                                            type: 'div',
                                            props: {
                                                style: {
                                                    fontSize: o.metin,
                                                    lineHeight: 1.48,
                                                    fontWeight: 500,
                                                    color: '#ffffff',
                                                    whiteSpace: 'pre-line',
                                                    flexShrink: 0
                                                },
                                                children: ozet
                                            }
                                        },
                                        {
                                            type: 'div',
                                            props: {
                                                style: {
                                                    display: 'flex',
                                                    alignItems: 'flex-end',
                                                    justifyContent: 'space-between',
                                                    gap: 8,
                                                    width: '100%',
                                                    marginTop: 14,
                                                    flexShrink: 0
                                                },
                                                children: [
                                                    {
                                                        type: 'div',
                                                        props: {
                                                            style: {
                                                                fontSize: o.cta,
                                                                lineHeight: 1.22,
                                                                fontWeight: 800,
                                                                color: '#ffffff',
                                                                flex: 1,
                                                                marginTop: 0
                                                            },
                                                            children: CTA
                                                        }
                                                    },
                                                    {
                                                        type: 'div',
                                                        props: {
                                                            style: {
                                                                display: 'flex',
                                                                gap: 8,
                                                                fontSize: o.cta + 4,
                                                                opacity: 0.9,
                                                                flexShrink: 0
                                                            },
                                                            children: [
                                                                { type: 'span', props: { children: '\uD83D\uDC4F' } },
                                                                { type: 'span', props: { children: '\u2197' } }
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
                },
                {
                    type: 'div',
                    props: {
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            backgroundColor: '#2a2a2a',
                            color: '#ffffff',
                            fontSize: o.altSerit,
                            fontWeight: 700,
                            padding: '12px 10px',
                            flexShrink: 0
                        },
                        children: rumuz + ' | gunde5.com'
                    }
                }
            ]
        }
    };
}

function kartFromRow(row, olcek) {
    var cins = row.gender === 'male' ? 'male' : 'female';
    var rumuz = row.username || 'Anonim';
    var kaynak = String(row.content_full || row.content_short || '');
    var ozet = ozetMetin(kaynak);
    var emoji = temaEmoji(String(row.baslik || '') + ' ' + kaynak);
    return hikayeKart(rumuz, ozet, row.age, cins, emoji, olcek);
}

function ikiliTuval(sol, sag) {
    return {
        type: 'div',
        props: {
            style: {
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'stretch',
                justifyContent: 'center',
                gap: 12,
                padding: 8,
                background: '#e5e7eb',
                fontFamily: FONT
            },
            children: [sol, sag]
        }
    };
}

function ikiliSirala(ana, es) {
    if (ana.gender === 'male' && es.gender !== 'male') return [ana, es];
    if (es.gender === 'male' && ana.gender !== 'male') return [es, ana];
    return [ana, es];
}

function varsayilanKart() {
    return hikayeKart('gunde5.com', ozetMetin(OG_DESCRIPTION), null, 'female', '\u2615', OLCEK_TEK);
}

async function pngYanit(tree) {
    var img = new ImageResponse(tree, BOYUT);
    var buf = await img.arrayBuffer();
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

        if (!row) {
            return pngYanit(varsayilanKart());
        }

        var es = await itirafAyniGunEs(row);
        if (es) {
            var ikili = ikiliSirala(row, es);
            return pngYanit(
                ikiliTuval(
                    kartFromRow(ikili[0], OLCEK_IKILI),
                    kartFromRow(ikili[1], OLCEK_IKILI)
                )
            );
        }

        return pngYanit(kartFromRow(row, OLCEK_TEK));
    } catch (e) {
        return pngYanit(varsayilanKart());
    }
}
