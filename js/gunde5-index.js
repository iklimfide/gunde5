/* gunde5 — anasayfa: ince itiraflar listesi, 5'li sayfalama */
(function (global) {
    'use strict';

    var SAYFA = 5;
    var MSJ_ZATEN_OYLADIN = 'Bu hikayeyi zaten oylamıştın, sonrakine geç dostum';
    var PAYLAS_CAGRI = '📌 Devamını reklamsız ve ücretsiz oku:';
    var X_TWEET_LIMIT = 280;
    var HOOK_KELIME = 12;
    var FALLBACK_HOOKS = [
        'Bu hikâyeyi okumadan geçme 👇',
        'Bugünün en iyi okumalarından biri',
        'Gerçek bir hikâye — sen de oku',
        'Kahveni al, 5 dakika ayır ☕',
        'Okuyunca güleceksin (veya düşüneceksin)',
        'gunde5\'ten bir hikâye daha'
    ];
    var hikayeSatirCache = Object.create(null);
    var CACHE_KEY = 'g5_index_feed_v1';
    var CACHE_TTL_MS = 5 * 60 * 1000;
    var ARAMA_DEBOUNCE = 280;
    var ARAMA_MIN = 3;
    var ARAMA_ONERI_ADET = 6;
    /** Önbellekten gösterim sonrası arka plan feed yenilemesi (Dünkü 5 ile yarışmasın). */
    var arkaplanIlkSayfaTamam = Promise.resolve();
    var state = {
        offset: 0,
        yukleniyor: false,
        bitti: false,
        yuklenenIdler: {},
        siralama: 'yeni',
        aramaMetni: '',
        aramaAktif: false,
        rastgeleHavuz: null,
        aramaTimer: null,
        oneriIstekNo: 0,
        oneriListe: [],
        sonAramaMetni: '',
        listeIstekNo: 0,
        bugunBilgiGosterildi: false,
        loadMoreMetinGenel: false,
        aktifBaskiYmd: null,
        oncekiBaskiYmd: null
    };

    function db() {
        return global.Gunde5DB;
    }

    /** Index etkileşim olayları — Gunde5Analytics.track veya doğrudan RPC yedek */
    function analyticsIndex(govde) {
        var A = global.Gunde5Analytics;
        var gov = Object.assign({ sayfa: 'index' }, govde || {});
        if (A && typeof A.track === 'function') {
            A.track(gov);
            return;
        }
        var D = db();
        if (!D || !D.analyticsEventKaydet || !D.isConfigured || !D.isConfigured()) return;
        var sid = A && A.sessionIdAl ? A.sessionIdAl() : null;
        var vid = A && A.visitorIdAl ? A.visitorIdAl() : null;
        if (!sid || !vid) return;
        D.analyticsEventKaydet(Object.assign({ session_id: sid, visitor_id: vid }, gov)).catch(function () { /* */ });
    }

    function analyticsVote(id, tip) {
        var storyId = parseInt(id, 10);
        if (!storyId) return;
        analyticsIndex({
            event: 'story_vote',
            story_id: storyId,
            vote_type: tip === 'up' ? 'like' : 'dislike'
        });
    }

    function analyticsShare(id) {
        var storyId = parseInt(id, 10);
        if (!storyId) return;
        analyticsIndex({ event: 'story_share', story_id: storyId });
    }

    function analyticsLoadMore(loadedCount) {
        var tip = 'onceki';
        if (siralamaRituelModu()) {
            tip = state.loadMoreMetinGenel ? 'onceki' : 'dun';
        }
        analyticsIndex({
            event: 'load_more_click',
            loaded_count: loadedCount || SAYFA,
            sayfa: 'index',
            payload: { tip: tip }
        });
    }

    function analyticsIndexArama(q) {
        analyticsIndex({
            event: 'index_search',
            sayfa: 'index',
            payload: { query: String(q || '').slice(0, 120) }
        });
    }

    function hataMesaji(err) {
        var D = db();
        return D && D.hataMesaji ? D.hataMesaji(err) : (err && err.message ? err.message : String(err));
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function likeSayisi(row) {
        if (row.like != null && row.like !== '') {
            return parseInt(row.like, 10) || 0;
        }
        return parseInt(row.up_votes, 10) || 0;
    }

    function dislikeSayisi(row) {
        if (row.dislike != null && row.dislike !== '') {
            return parseInt(row.dislike, 10) || 0;
        }
        return parseInt(row.down_votes, 10) || 0;
    }

    /** Oy sayacı: 1214 → 1,2 B · 1_400_000_000 → 1.4B */
    function oySayaciGoster(n) {
        n = parseInt(n, 10) || 0;
        if (n < 0) n = 0;
        if (n >= 1e9) {
            var milyar = n / 1e9;
            return (milyar >= 10 ? String(Math.round(milyar)) : milyar.toFixed(1)) + 'B';
        }
        if (n >= 1e6) {
            var mn = n / 1e6;
            return (mn >= 10 ? String(Math.round(mn)) : mn.toFixed(1).replace('.', ',')) + ' Mn';
        }
        if (n >= 1e3) {
            var bin = n / 1e3;
            return (bin >= 10 ? String(Math.round(bin)) : bin.toFixed(1).replace('.', ',')) + ' B';
        }
        return String(n);
    }

    function oySayaciSpanHtml(sayi, sinif) {
        var n = parseInt(sayi, 10) || 0;
        return (
            '<span class="' +
            sinif +
            '" data-oy-sayi="' +
            n +
            '">' +
            esc(oySayaciGoster(n)) +
            '</span>'
        );
    }

    function oySpanGuncelle(span, sayi) {
        if (!span) return;
        var n = parseInt(sayi, 10) || 0;
        span.setAttribute('data-oy-sayi', String(n));
        span.textContent = oySayaciGoster(n);
    }

    function metaSatir(row) {
        if (!row) return '';
        var p = [];
        if (row.age) {
            p.push(row.age + ' Yaş');
        }
        var yer = yerSatirEtiket(row);
        if (yer) {
            p.push(yer);
        }
        return p.join(' • ');
    }

    var YER_ETIKET = {
        yurtdisi: 'Yurtdışı',
        istanbul_avrupa: 'İstanbul Avrupa',
        istanbul_anadolu: 'İstanbul Anadolu',
        ankara: 'Ankara',
        izmir: 'İzmir'
    };

    function basHarfBuyukTr(s) {
        var ham = String(s || '').trim();
        if (!ham) return '';
        try {
            return ham.charAt(0).toLocaleUpperCase('tr-TR') + ham.slice(1).toLocaleLowerCase('tr-TR');
        } catch (eBas) {
            var ilk = ham.charAt(0).toUpperCase();
            if (ilk === 'I') ilk = 'İ';
            return ilk + ham.slice(1).toLowerCase();
        }
    }

    function yerSatirEtiket(row) {
        if (!row) return '';
        if (row.yasadigi_yer) {
            if (row.yasadigi_yer === 'yurtdisi') {
                return row.yurtdisi_sehir
                    ? 'Yurtdışı · ' + basHarfBuyukTr(String(row.yurtdisi_sehir))
                    : 'Yurtdışı';
            }
            if (YER_ETIKET[row.yasadigi_yer]) return YER_ETIKET[row.yasadigi_yer];
            var ham = String(row.yasadigi_yer).trim();
            if (ham.indexOf('_') >= 0) {
                return ham.split('_').filter(Boolean).map(basHarfBuyukTr).join(' ');
            }
            return basHarfBuyukTr(ham);
        }
        if (row.city) {
            var c = String(row.city).trim();
            if (!c) return '';
            return YER_ETIKET[c] || basHarfBuyukTr(c.replace(/_/g, ' '));
        }
        return '';
    }

    function icerikMetni(row) {
        return row.content_full || row.content_short || '';
    }

    function icerikGoster(row) {
        var t = icerikMetni(row);
        if (global.Gunde5Perde && global.Gunde5Perde.metinPerdele) {
            t = global.Gunde5Perde.metinPerdele(t);
        }
        return esc(t);
    }

    function listeEl() {
        return document.getElementById('indexListe');
    }

    function oyDurumu(id) {
        var D = db();
        return D && D.oyDurumuOku ? D.oyDurumuOku(id) : null;
    }

    function oyKaydet(id, tip) {
        var D = db();
        if (D && D.oyDurumuKaydet) {
            D.oyDurumuKaydet(id, tip === 'up' ? 1 : -1);
        }
    }

    async function kartOyDurumlariniSenkron(rows) {
        var D = db();
        if (!D || !D.oyDurumlariSenkron || !rows || !rows.length) return;
        var ids = rows.map(function (r) { return r.id; });
        var durum = await D.oyDurumlariSenkron(ids);
        ids.forEach(function (id) {
            var tip = durum[id];
            if (!tip) return;
            var card = document.getElementById('h-' + id);
            oyButonRenklendir(card, tip);
        });
    }

    function zatenOyladinMi(mesaj) {
        if (!mesaj) return false;
        var m = String(mesaj).toLowerCase();
        return m.indexOf('zaten oylad') >= 0 || m.indexOf('zaten_oylad') >= 0;
    }

    function toastMetin(mesaj) {
        return zatenOyladinMi(mesaj) ? MSJ_ZATEN_OYLADIN : mesaj;
    }

    function showToast(text) {
        var toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = toastMetin(text);
        toast.classList.add('show');
        setTimeout(function () {
            toast.classList.remove('show');
        }, 3000);
    }

    function durumAramaYaz(metin, hata) {
        var el = document.getElementById('indexAramaDurum');
        if (!el) return;
        el.textContent = metin || '';
        el.classList.toggle('index-arama-durum--hata', !!hata);
    }

    function karistir(dizi) {
        var a = dizi.slice();
        var i;
        var j;
        var t;
        for (i = a.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
        return a;
    }

    function hikayeSatirCacheTemizle() {
        Object.keys(hikayeSatirCache).forEach(function (k) {
            delete hikayeSatirCache[k];
        });
    }

    function listeSifirla() {
        state.offset = 0;
        state.bitti = false;
        state.yuklenenIdler = {};
        hikayeSatirCacheTemizle();
        state.rastgeleHavuz = null;
        state.bugunBilgiGosterildi = false;
        state.loadMoreMetinGenel = false;
        state.aktifBaskiYmd = null;
        state.oncekiBaskiYmd = null;
        loadMoreTemizle();
    }

    function listeTemizle() {
        var el = listeEl();
        if (el) el.innerHTML = '';
    }

    /** Europe/Istanbul takvim günü (YYYY-MM-DD). */
    function trYmd(isoOrDate) {
        var t = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
        if (!isoOrDate || isNaN(t.getTime())) return null;
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Istanbul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(t);
    }

    function ymdGunFarki(ymdEski, ymdYeni) {
        var pe = ymdEski.split('-');
        var pn = ymdYeni.split('-');
        var msEski = Date.UTC(parseInt(pe[0], 10), parseInt(pe[1], 10) - 1, parseInt(pe[2], 10));
        var msYeni = Date.UTC(parseInt(pn[0], 10), parseInt(pn[1], 10) - 1, parseInt(pn[2], 10));
        return Math.round((msYeni - msEski) / 86400000);
    }

    /** YYYY-MM-DD → gg/aa/yyyy (başısıfırsız gün/ay, podyum ile aynı). */
    function ymdGgAaYyyy(ymd) {
        var p = String(ymd || '').split('-');
        if (p.length !== 3) return '';
        var y = parseInt(p[0], 10);
        var m = parseInt(p[1], 10);
        var g = parseInt(p[2], 10);
        if (!y || !m || !g) return '';
        return g + '/' + m + '/' + y;
    }

    /** Aktif baskı günü — ekranda gösterilen "bugünün 5'i". */
    function aktifBaskiYmd() {
        return state.aktifBaskiYmd || trYmd(new Date());
    }

    async function baskiYmdDurumGuncelle(rows, editionOverride) {
        if (editionOverride) {
            state.aktifBaskiYmd = editionOverride;
        } else if (rows && rows.length) {
            var D0 = db();
            if (D0 && D0.aktifBaskiGunGetir) {
                state.aktifBaskiYmd = await D0.aktifBaskiGunGetir();
            } else {
                state.aktifBaskiYmd = trYmd(rows[0].created_at);
            }
        } else {
            var D = db();
            if (D && D.aktifBaskiGunGetir) {
                state.aktifBaskiYmd = await D.aktifBaskiGunGetir();
            }
        }
        if (!state.aktifBaskiYmd) {
            state.oncekiBaskiYmd = null;
            return;
        }
        var D2 = db();
        if (D2 && D2.oncekiBaskiGunGetir) {
            state.oncekiBaskiYmd = await D2.oncekiBaskiGunGetir(state.aktifBaskiYmd);
        }
    }

    function yayinEtiketiHtml(createdAt) {
        if (!createdAt) return '';
        var ymd = trYmd(createdAt);
        if (!ymd) return '';
        var bugun = aktifBaskiYmd();
        if (!bugun) return '';
        var fark = ymdGunFarki(ymd, bugun);
        if (fark < 0) return '';
        if (fark === 0) {
            return '<span class="index-yayin-etiket index-yayin-etiket--bugun">🟢 Bugün yayınlandı</span>';
        }
        if (fark === 1) {
            return '<span class="index-yayin-etiket index-yayin-etiket--dun">🟠 Dün yayınlandı</span>';
        }
        if (fark >= 2 && fark <= 7) {
            return '<span class="index-yayin-etiket index-yayin-etiket--hafta">🔵 Bu hafta yayınlandı</span>';
        }
        var tarih = ymdGgAaYyyy(ymd);
        if (!tarih) return '';
        return '<span class="index-yayin-etiket index-yayin-etiket--eski">' + esc(tarih) + '</span>';
    }

    function bugunBilgiKutusuOlustur() {
        var kutu = document.createElement('div');
        kutu.className = 'index-bugun-bilgi';
        kutu.setAttribute('role', 'note');
        kutu.innerHTML =
            '<p class="index-bugun-bilgi-satir">📖 Bugünün 5 hikâyesini okuyorsun.</p>' +
            '<p class="index-bugun-bilgi-satir index-bugun-bilgi-satir--alt">Yarın burada yenileri olacak.</p>' +
            '<p class="index-bugun-bilgi-satir index-bugun-bilgi-satir--alt">↓ Eski hikâyeler aşağıda seni bekliyor.</p>';
        return kutu;
    }

    function onbellekKullanilabilirMi() {
        return state.siralama === 'yeni' && !state.aramaAktif && !hedefIdOku();
    }

    function siralamaTekSeferMi() {
        return state.siralama === 'gulumseten' || state.siralama === 'dun';
    }

    function siralamaRituelModu() {
        return state.siralama === 'yeni' && !state.aramaAktif;
    }

    function siralamaFetchLimit() {
        if (state.siralama === 'gulumseten') return 10;
        return SAYFA;
    }

    async function hikayeListele(offset, limit) {
        var D = db();
        if (!D || !D.indexItirafListeleSayfa) {
            throw new Error('indexItirafListeleSayfa tanımlı değil');
        }

        if (state.aramaAktif) {
            if (!D.indexItirafAra) {
                throw new Error('indexItirafAra tanımlı değil');
            }
            return D.indexItirafAra(state.aramaMetni, offset, limit);
        }

        if (state.siralama === 'dun') {
            if (offset > 0) return [];
            if (D.indexDunun5Getir) return D.indexDunun5Getir();
            return [];
        }

        if (state.siralama === 'gulumseten') {
            if (offset >= 10) return [];
            var gLim = Math.min(limit, 10 - offset);
            if (gLim <= 0) return [];
            return D.indexItirafListeleSayfa(offset, gLim, 'gulumseten');
        }

        if (state.siralama === 'rastgele') {
            if (!state.rastgeleHavuz) {
                var havuz = D.indexItirafHavuzGetir
                    ? await D.indexItirafHavuzGetir()
                    : [];
                state.rastgeleHavuz = karistir(havuz);
            }
            return state.rastgeleHavuz.slice(offset, offset + limit);
        }

        if (state.siralama === 'tum') {
            return D.indexItirafListeleSayfa(offset, limit, 'tum');
        }

        if (state.siralama === 'yeni') {
            if (offset === 0 && D.indexBugunun5Getir) {
                return D.indexBugunun5Getir();
            }
            return D.indexItirafListeleSayfa(offset, limit, 'yeni');
        }

        return D.indexItirafListeleSayfa(offset, limit, state.siralama);
    }

    function cacheEditionKey() {
        return state.aktifBaskiYmd || 'x';
    }

    function cacheOku() {
        try {
            var raw = global.sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var o = JSON.parse(raw);
            if (!o || !o.ts || !Array.isArray(o.rows) || !o.rows.length) return null;
            if (Date.now() - o.ts > CACHE_TTL_MS) return null;
            if (o.edition && o.edition !== cacheEditionKey()) return null;
            return o;
        } catch (e) {
            return null;
        }
    }

    function cacheYaz(rows, offset, bitti) {
        try {
            global.sessionStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                    ts: Date.now(),
                    edition: cacheEditionKey(),
                    offset: offset,
                    bitti: !!bitti,
                    rows: rows
                })
            );
        } catch (e) { /* kotası dolmuş olabilir */ }
    }

    function ilkSayfaIdleri(rows) {
        var ids = [];
        var i;
        for (i = 0; i < rows.length && i < SAYFA; i++) {
            ids.push(String(rows[i].id));
        }
        return ids;
    }

    function domIlkSayfaIdleri() {
        var el = listeEl();
        if (!el) return [];
        var cards = el.querySelectorAll('.story-card');
        var ids = [];
        var i;
        for (i = 0; i < cards.length && i < SAYFA; i++) {
            ids.push(cards[i].getAttribute('data-id'));
        }
        return ids;
    }

    function idListesiAyni(a, b) {
        if (a.length !== b.length) return false;
        var i;
        for (i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    function onbellektenGoster(cached) {
        state.offset = cached.offset || cached.rows.length;
        state.bitti = !!cached.bitti;
        state.yuklenenIdler = {};
        hikayeSatirCacheTemizle();
        state.aktifBaskiYmd = cached.edition || null;
        state.oncekiBaskiYmd = null;
        var el = listeEl();
        if (el) el.innerHTML = '';
        return baskiYmdDurumGuncelle(cached.rows, cached.edition).then(function () {
            return kartlariEkle(cached.rows, true);
        });
    }

    async function ilkSayfayiYenidenCiz(rows) {
        var el = listeEl();
        if (!el) return;
        if (el.querySelector('.index-dun-bolum-baslik')) {
            var i;
            for (i = 0; i < rows.length; i++) {
                kartVerisiniGuncelle(
                    document.getElementById('h-' + rows[i].id),
                    rows[i]
                );
            }
            state.offset = rows.length;
            state.bitti = rows.length < SAYFA;
            cacheYaz(rows, state.offset, state.bitti);
            return;
        }
        el.innerHTML = '';
        state.yuklenenIdler = {};
        hikayeSatirCacheTemizle();
        state.offset = rows.length;
        state.bitti = rows.length < SAYFA;
        await kartlariEkle(rows, true);
        cacheYaz(rows, state.offset, state.bitti);
    }

    function kartElementOlustur(row, ilkKart) {
        var id = String(row.id);
        var cins = row.gender === 'male' ? 'male' : 'female';
        var rumuz = row.username || 'Anonim';
        var like = likeSayisi(row);
        var dislike = dislikeSayisi(row);
        var voted = oyDurumu(id);
        var meta = metaSatir(row);
        var baslik = row.baslik ? String(row.baslik).replace(/^\s+|\s+$/g, '') : '';
        var yayinEtiket = yayinEtiketiHtml(row.created_at);

        var art = document.createElement('article');
        art.className = 'story-card card ' + cins + (ilkKart ? ' focused' : '');
        art.id = 'h-' + id;
        art.setAttribute('data-id', id);
        if (row.slug) art.setAttribute('data-slug', String(row.slug));
        if (row.social_hook) art.setAttribute('data-social-hook', String(row.social_hook));
        if (row.x_hook) art.setAttribute('data-x-hook', String(row.x_hook));
        if (row.slug_hint) art.setAttribute('data-slug-hint', String(row.slug_hint));
        hikayeSatirCache[id] = row;

        art.innerHTML =
            '<div class="card-header">' +
                '<div class="user-block">' +
                    '<div class="avatar" aria-hidden="true">' +
                        (cins === 'male' ? '\u2642' : '\u2640') +
                    '</div>' +
                    '<div class="user-details">' +
                        '<span class="username">' + esc(rumuz) + '</span>' +
                        (meta ? '<span class="user-meta">' + esc(meta) + '</span>' : '') +
                    '</div>' +
                '</div>' +
                '<div class="card-header-actions">' +
                    (yayinEtiket ? '<div class="card-header-etiket">' + yayinEtiket + '</div>' : '') +
                    '<span class="kart-marka" aria-hidden="true">gunde<span class="brand-five">5</span>.com</span>' +
                '</div>' +
            '</div>' +
            '<div class="card-body">' +
                (baslik ? '<span class="kart-baslik">' + esc(baslik) + '</span>' : '') +
                '<span class="short-text">' + icerikGoster(row) + '</span></div>' +
            '<div class="card-footer story-actions">' +
                '<div class="vote-box">' +
                    '<button type="button" class="vote-btn' + (voted === 'up' ? ' applauded' : '') +
                    '" data-vote="up" data-id="' + id + '" aria-label="Gülümsetti">😊 Gülümsetti ' + oySayaciSpanHtml(like, 'count') + '</button>' +
                    '<button type="button" class="vote-btn' + (voted === 'down' ? ' disliked' : '') +
                    '" data-vote="down" data-id="' + id + '" aria-label="Sarmadı">😐 Sarmadı ' + oySayaciSpanHtml(dislike, 'count-down') + '</button>' +
                '</div>' +
                '<div class="card-footer-paylas">' +
                    '<button type="button" class="share-btn" data-share="' + id + '" aria-label="Arkadaşına gönder">Arkadaşına Gönder</button>' +
                '</div>' +
            '</div>';

        return art;
    }

    function loadMoreBtnHtml() {
        var metin;
        var tumAltBtn = '';
        if (state.aramaAktif) {
            metin = '🔍 Daha fazla sonuç göster';
        } else if (state.siralama === 'tum') {
            metin = '📚 5 hikaye daha göster';
        } else if (state.siralama === 'rastgele') {
            metin = '🎲 5 hikaye daha göster';
        } else if (state.loadMoreMetinGenel) {
            metin = '📚 Önceki günlerin hikâyelerini göster';
        } else {
            metin = '📚 Dün yayınlanan hikâyeleri göster';
            tumAltBtn =
                '<button type="button" class="load-more-btn index-load-more-tum">' +
                esc('📚 Tüm arşivi göster') +
                '</button>';
        }
        return (
            '<button type="button" class="load-more-btn index-load-more index-load-more--onceki">' +
            esc(metin) +
            '</button>' +
            tumAltBtn
        );
    }

    function durumYaz(html) {
        var el = listeEl();
        if (!el) return;
        if (!html) {
            var mevcut = el.querySelector('.index-durum');
            if (mevcut) mevcut.remove();
            return;
        }
        if (el.querySelector('.story-card')) return;
        el.innerHTML = html;
    }

    function loadMoreTemizle() {
        var el = listeEl();
        if (!el) return;
        el.querySelectorAll('.index-load-more-wrap').forEach(function (n) {
            n.remove();
        });
    }

    async function kartlariEkle(rows, ilkPart) {
        var el = listeEl();
        if (!el || !rows.length) return;

        loadMoreTemizle();

        var frag = document.createDocumentFragment();
        var i;
        var eklendi = false;
        for (i = 0; i < rows.length; i++) {
            if (state.yuklenenIdler[rows[i].id]) continue;
            state.yuklenenIdler[rows[i].id] = true;
            frag.appendChild(
                kartElementOlustur(
                    rows[i],
                    !hedefIdOku() && ilkPart && i === 0 && el.children.length === 0
                )
            );
            if (
                !state.bugunBilgiGosterildi &&
                siralamaRituelModu() &&
                !hedefIdOku() &&
                el.querySelectorAll('.story-card').length + frag.querySelectorAll('.story-card').length === 1
            ) {
                frag.appendChild(bugunBilgiKutusuOlustur());
                state.bugunBilgiGosterildi = true;
            }
            eklendi = true;
        }
        if (!eklendi) return;

        el.appendChild(frag);
        await kartOyDurumlariniSenkron(rows);

        var A = global.Gunde5Analytics;
        if (A && A.kartlariIzle) A.kartlariIzle(el);

        var fetchLimit = siralamaFetchLimit();
        if (rows.length >= fetchLimit && !state.bitti && !siralamaTekSeferMi()) {
            var btnWrap = document.createElement('div');
            btnWrap.className = 'index-load-more-wrap';
            btnWrap.innerHTML = loadMoreBtnHtml();
            el.appendChild(btnWrap);
        }
    }

    function hedefIdOku() {
        try {
            var p = new URLSearchParams(global.location.search || '');
            var q = p.get('itiraf') || p.get('h');
            return q && /^\d+$/.test(q) ? q : null;
        } catch (e) {
            return null;
        }
    }

    async function hedefKartaKaydirOtomatik(depth) {
        var id = hedefIdOku();
        if (!id || depth > 40) return;
        var card = document.getElementById('h-' + id);
        if (card) {
            card.classList.add('focused');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        if (!state.bitti && !state.yukleniyor) {
            await sonrakiPart(null);
            return hedefKartaKaydirOtomatik(depth + 1);
        }
    }

    async function sonrakiPart(btn, partOpts) {
        var skipHedefKaydir = partOpts && partOpts.skipHedefKaydir;
        var kullaniciLoadMore = !!(btn && !skipHedefKaydir);
        var aramaZorla = !!(partOpts && partOpts.aramaZorla);

        if (kullaniciLoadMore) {
            await feedIlkYuklemeBekle();
            var bekleLm = 0;
            while (state.yukleniyor && bekleLm < 150) {
                bekleLm += 1;
                await new Promise(function (resolve) {
                    global.setTimeout(resolve, 40);
                });
            }
        }

        if (state.yukleniyor && !aramaZorla) return;
        if (!state.aramaAktif && state.bitti && !kullaniciLoadMore) return;

        var dunIlkYukleme = kullaniciLoadMore && siralamaRituelModu() && !state.loadMoreMetinGenel;
        var fetchLimit = siralamaFetchLimit();

        if (btn && btn.closest) {
            var wrap = btn.closest('.index-load-more-wrap');
            if (wrap) wrap.remove();
        }

        if (btn) {
            analyticsLoadMore(state.offset + fetchLimit);
        }
        if (btn && siralamaRituelModu()) {
            state.loadMoreMetinGenel = true;
        }

        var istekNo = ++state.listeIstekNo;
        state.yukleniyor = true;
        var ilkPart = state.offset === 0;

        if (ilkPart) {
            if (state.aramaAktif) {
                listeTemizle();
                durumAramaYaz('Aranıyor…');
            } else {
                durumYaz('<p class="index-durum">Yükleniyor…</p>');
            }
        }

        try {
            var rows = await hikayeListele(state.offset, fetchLimit);
            if (istekNo !== state.listeIstekNo) return;

            if (ilkPart) {
                var el = listeEl();
                if (el && (state.aramaAktif || state.siralama !== 'dun' || !el.querySelector('.index-dun-bolum-baslik'))) {
                    el.innerHTML = '';
                }
            }

            state.offset += rows.length;
            if (rows.length < fetchLimit || siralamaTekSeferMi()) {
                state.bitti = true;
            }

            if (!rows.length && ilkPart) {
                if (state.aramaAktif) {
                    durumYaz('');
                    durumAramaYaz('Sonuç yok');
                } else {
                    durumYaz('<p class="index-durum">Henüz hikaye yok.</p>');
                }
                return;
            }

            if (ilkPart && siralamaRituelModu()) {
                await baskiYmdDurumGuncelle(rows);
            }

            if (state.siralama === 'rastgele' && state.rastgeleHavuz) {
                if (state.offset >= state.rastgeleHavuz.length || rows.length < SAYFA) {
                    state.bitti = true;
                }
            }

            await kartlariEkle(rows, ilkPart);

            if (state.siralama === 'dun' && ilkPart && rows.length) {
                var ilkDun = document.getElementById('h-' + rows[0].id);
                var elDun = listeEl();
                if (elDun && ilkDun) {
                    dunBolumBasligiYerlestir(elDun, ilkDun);
                }
            }

            if (state.aramaAktif && ilkPart && rows.length) {
                var elArama = listeEl();
                if (elArama && !elArama.querySelector('.story-card')) {
                    state.yuklenenIdler = {};
                    hikayeSatirCacheTemizle();
                    await kartlariEkle(rows, ilkPart);
                }
            }

            if (dunIlkYukleme && rows.length) {
                await yuklenenDunHikayelerineKaydir(rows);
            }

            if (ilkPart && rows.length && onbellekKullanilabilirMi()) {
                cacheYaz(rows, state.offset, state.bitti);
            }

            if (ilkPart && state.aramaAktif) {
                if (!rows.length) {
                    durumAramaYaz('Sonuç yok');
                } else {
                    durumAramaYaz(rows.length + (state.bitti ? '' : '+') + ' sonuç');
                    var elListe = listeEl();
                    if (elListe && elListe.querySelector('.story-card')) {
                        elListe.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            }
        } catch (err) {
            var msg = hataMesaji(err);
            if (state.aramaAktif && ilkPart && istekNo === state.listeIstekNo) {
                durumAramaYaz(msg, true);
            }
            if (ilkPart && istekNo === state.listeIstekNo) {
                var elErr = listeEl();
                if (elErr && elErr.querySelector('.story-card')) {
                    showToast(msg);
                } else if (!state.aramaAktif) {
                    durumYaz('<p class="index-durum index-durum--hata">' + esc(msg) + '</p>');
                }
            } else if (istekNo === state.listeIstekNo) {
                showToast(msg);
                if (!state.bitti) {
                    var el2 = listeEl();
                    if (el2) {
                        var errWrap = document.createElement('div');
                        errWrap.className = 'index-load-more-wrap';
                        errWrap.innerHTML = loadMoreBtnHtml();
                        el2.appendChild(errWrap);
                    }
                }
            }
        } finally {
            state.yukleniyor = false;
        }
        if (!skipHedefKaydir && !dunIlkYukleme) {
            await hedefKartaKaydirOtomatik(0);
        }
    }

    async function arkaplanIlkSayfaYenile() {
        if (!onbellekKullanilabilirMi() || state.aramaAktif) return;
        try {
            var D = db();
            var rows = D
                ? (D.indexBugunun5Getir
                    ? await D.indexBugunun5Getir()
                    : await D.indexItirafListeleSayfa(0, SAYFA, 'yeni'))
                : await hikayeListele(0, SAYFA);
            if (!rows.length) return;

            await baskiYmdDurumGuncelle(rows);
            cacheYaz(rows, rows.length, rows.length < SAYFA);

            var el = listeEl();
            if (!el || state.aramaAktif) return;

            var kartSayisi = el.querySelectorAll('.story-card').length;
            var yeniIdler = ilkSayfaIdleri(rows);
            var domIdler = domIlkSayfaIdleri();

            if (kartSayisi <= SAYFA) {
                if (el.querySelector('.index-dun-bolum-baslik')) {
                    var k;
                    for (k = 0; k < rows.length; k++) {
                        kartVerisiniGuncelle(
                            document.getElementById('h-' + rows[k].id),
                            rows[k]
                        );
                    }
                    return;
                }
                if (!idListesiAyni(domIdler, yeniIdler)) {
                    await ilkSayfayiYenidenCiz(rows);
                } else {
                    var i;
                    for (i = 0; i < rows.length; i++) {
                        kartVerisiniGuncelle(
                            document.getElementById('h-' + rows[i].id),
                            rows[i]
                        );
                    }
                }
                return;
            }

            var j;
            for (j = 0; j < rows.length; j++) {
                kartVerisiniGuncelle(
                    document.getElementById('h-' + rows[j].id),
                    rows[j]
                );
            }
        } catch (e) { /* sessiz — önbellek zaten gösteriliyor */ }
    }

    function kartOySayilariniGuncelle(card, row) {
        if (!card || !row) return;
        var upBtn = card.querySelector('[data-vote="up"]');
        var downBtn = card.querySelector('[data-vote="down"]');
        if (upBtn) oySpanGuncelle(upBtn.querySelector('.count'), likeSayisi(row));
        if (downBtn) oySpanGuncelle(downBtn.querySelector('.count-down'), dislikeSayisi(row));
    }

    /** Kamikaze düzenlemesi sonrası kart gövdesini (rumuz, meta, başlık, metin) günceller. */
    function kartMetniniGuncelle(card, row) {
        if (!card || !row) return;
        var rumuz = row.username || 'Anonim';
        var meta = metaSatir(row);
        var baslik = row.baslik ? String(row.baslik).replace(/^\s+|\s+$/g, '') : '';
        var cins = row.gender === 'male' ? 'male' : 'female';

        card.classList.remove('male', 'female');
        card.classList.add(cins);

        var userEl = card.querySelector('.username');
        if (userEl) userEl.textContent = rumuz;

        var metaEl = card.querySelector('.user-meta');
        if (meta) {
            if (metaEl) {
                metaEl.textContent = meta;
            } else {
                var details = card.querySelector('.user-details');
                if (details) {
                    var span = document.createElement('span');
                    span.className = 'user-meta';
                    span.textContent = meta;
                    details.appendChild(span);
                }
            }
        } else if (metaEl) {
            metaEl.remove();
        }

        var avatar = card.querySelector('.avatar');
        if (avatar) avatar.textContent = cins === 'male' ? '\u2642' : '\u2640';

        var body = card.querySelector('.card-body');
        if (!body) return;

        var baslikEl = body.querySelector('.kart-baslik');
        if (baslik) {
            if (baslikEl) {
                baslikEl.textContent = baslik;
            } else {
                var yeniBaslik = document.createElement('span');
                yeniBaslik.className = 'kart-baslik';
                yeniBaslik.textContent = baslik;
                body.insertBefore(yeniBaslik, body.firstChild);
            }
        } else if (baslikEl) {
            baslikEl.remove();
        }

        var shortEl = body.querySelector('.short-text');
        if (shortEl) shortEl.innerHTML = icerikGoster(row);
    }

    function kartVerisiniGuncelle(card, row) {
        if (row && row.id != null) {
            hikayeSatirCache[String(row.id)] = row;
            if (row.social_hook) card.setAttribute('data-social-hook', String(row.social_hook));
            else card.removeAttribute('data-social-hook');
            if (row.x_hook) card.setAttribute('data-x-hook', String(row.x_hook));
            else card.removeAttribute('data-x-hook');
            if (row.slug_hint) card.setAttribute('data-slug-hint', String(row.slug_hint));
            else card.removeAttribute('data-slug-hint');
        }
        kartMetniniGuncelle(card, row);
        kartOySayilariniGuncelle(card, row);
    }

    function kartOyGuncelle(card, sonuc, tip) {
        if (!card || !sonuc) return;
        var upBtn = card.querySelector('[data-vote="up"]');
        var downBtn = card.querySelector('[data-vote="down"]');
        if (upBtn && sonuc.up_votes != null) {
            oySpanGuncelle(upBtn.querySelector('.count'), sonuc.up_votes);
        }
        if (downBtn && sonuc.down_votes != null) {
            oySpanGuncelle(downBtn.querySelector('.count-down'), sonuc.down_votes);
        }
        if (tip) oyButonRenklendir(card, tip);
    }

    function oyButonRenklendir(card, tip) {
        if (!card) return;
        var upBtn = card.querySelector('[data-vote="up"]');
        var downBtn = card.querySelector('[data-vote="down"]');
        if (upBtn) {
            upBtn.classList.toggle('applauded', tip === 'up');
            upBtn.classList.toggle('aktif', tip === 'up');
        }
        if (downBtn) {
            downBtn.classList.toggle('disliked', tip === 'down');
            downBtn.classList.toggle('aktif', tip === 'down');
        }
    }

    function confettiPatlat() {
        if (typeof global.confetti === 'function') {
            global.confetti({ particleCount: 50, spread: 60, origin: { y: 0.85 } });
            return;
        }
        if (global.__g5ConfettiYukleniyor) return;
        global.__g5ConfettiYukleniyor = true;
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
        s.onload = function () {
            global.__g5ConfettiYukleniyor = false;
            if (typeof global.confetti === 'function') {
                global.confetti({ particleCount: 50, spread: 60, origin: { y: 0.85 } });
            }
        };
        s.onerror = function () {
            global.__g5ConfettiYukleniyor = false;
        };
        document.head.appendChild(s);
    }

    async function oyTikla(btn) {
        var id = btn.getAttribute('data-id');
        var tip = btn.getAttribute('data-vote');
        if (!id || !tip) return;

        var D = db();
        var card = document.getElementById('h-' + id);

        if (oyDurumu(id)) {
            oyButonRenklendir(card, oyDurumu(id));
            showToast(MSJ_ZATEN_OYLADIN);
            return;
        }

        if (D && D.oyDurumuSunucudan) {
            var sunucuOy = await D.oyDurumuSunucudan(id);
            if (sunucuOy) {
                oyButonRenklendir(card, sunucuOy);
                showToast(MSJ_ZATEN_OYLADIN);
                return;
            }
        }

        if (!D || !D.oyVer) {
            showToast('Oy servisi yüklenemedi.');
            return;
        }

        oyButonRenklendir(card, tip);
        btn.disabled = true;

        analyticsVote(id, tip);

        try {
            var sonuc = await D.oyVer(id, tip === 'up' ? 1 : -1);
            var gercekTip = sonuc.oy === 1 ? 'up' : (sonuc.oy === -1 ? 'down' : tip);
            kartOyGuncelle(card, sonuc, gercekTip);
            oyKaydet(id, gercekTip);
            if (sonuc.zaten_oyladin) {
                showToast(MSJ_ZATEN_OYLADIN);
            } else if (tip === 'up') {
                confettiPatlat();
            }
        } catch (err) {
            var mesaj = hataMesaji(err);
            if (zatenOyladinMi(mesaj)) {
                var gercek = D.oyDurumuSunucudan
                    ? await D.oyDurumuSunucudan(id)
                    : null;
                oyButonRenklendir(card, gercek || tip);
                showToast(MSJ_ZATEN_OYLADIN);
            } else {
                oyButonRenklendir(card, null);
                showToast(mesaj);
            }
        } finally {
            btn.disabled = false;
        }
    }

    var paylasSheetBagli = false;
    var paylasAktifId = null;

    function slugHintMetin(hint) {
        return String(hint || '').trim().replace(/-/g, ' ').replace(/\s+/g, ' ');
    }

    function fallbackHookSec() {
        return FALLBACK_HOOKS[Math.floor(Math.random() * FALLBACK_HOOKS.length)];
    }

    /** Kelime ortasından kesmez; en fazla maxKelime adet. */
    function ilkKelimeler(metin, maxKelime) {
        var t = String(metin || '').replace(/\s+/g, ' ').trim();
        if (!t || !maxKelime) return '';
        var kelimeler = t.split(' ');
        if (kelimeler.length <= maxKelime) return t;
        return kelimeler.slice(0, maxKelime).join(' ') + '…';
    }

    /** Başlık / slug ipucu / hikâyenin ilk kelimeleri. */
    function generateHook(story) {
        if (!story) return '';
        var b = String(story.baslik || '').trim();
        if (b) return b;
        var hint = slugHintMetin(story.slug_hint);
        if (hint) return hint;
        return ilkKelimeler(icerikMetni(story), HOOK_KELIME);
    }

    function storyHookAl(story) {
        if (!story) return fallbackHookSec();
        var ozel = String(story.social_hook || story.x_hook || '').trim();
        if (ozel) return ozel;
        var uretilen = generateHook(story);
        if (uretilen) return uretilen;
        return fallbackHookSec();
    }

    function hookKisalt(hook, maxLen) {
        var s = String(hook || '').trim();
        if (!maxLen || s.length <= maxLen) return s;
        if (maxLen <= 1) return '…';
        var kes = s.slice(0, maxLen - 1).trim();
        var son = kes.lastIndexOf(' ');
        if (son > maxLen * 0.5) kes = kes.slice(0, son).trim();
        return kes + '…';
    }

    function storyPaylasUrl(story) {
        var sid = story && story.id != null ? String(story.id) : '';
        var slug = story && story.slug ? String(story.slug) : '';
        if (!slug && sid) {
            var card = document.getElementById('h-' + sid);
            slug = card ? card.getAttribute('data-slug') : '';
        }
        return slug
            ? 'https://gunde5.com/h/' + encodeURIComponent(slug)
            : 'https://gunde5.com/h/' + encodeURIComponent(sid);
    }

    function buildTweetText(story) {
        var storyUrl = storyPaylasUrl(story);
        var hook = storyHookAl(story);
        var tail = '\n\n' + PAYLAS_CAGRI + '\n' + storyUrl;
        var maxHook = X_TWEET_LIMIT - tail.length;
        if (maxHook < 1) {
            hook = '';
        } else if (hook.length > maxHook) {
            hook = hookKisalt(hook, maxHook);
        }
        var tweetText = hook + tail;
        return { hook: hook, url: storyUrl, paket: tweetText, tweetText: tweetText };
    }

    function storySatirBul(id) {
        var sid = String(id);
        if (hikayeSatirCache[sid]) return hikayeSatirCache[sid];
        var card = document.getElementById('h-' + sid);
        if (!card) return null;
        return {
            id: sid,
            slug: card.getAttribute('data-slug') || '',
            baslik: ((card.querySelector('.kart-baslik') || {}).textContent || '').trim(),
            content_short: ((card.querySelector('.short-text') || {}).textContent || '').trim(),
            social_hook: card.getAttribute('data-social-hook') || '',
            x_hook: card.getAttribute('data-x-hook') || '',
            slug_hint: card.getAttribute('data-slug-hint') || '',
            username: ((card.querySelector('.username') || {}).textContent || '').trim()
        };
    }

    function paylasPaketOlustur(id) {
        var story = storySatirBul(id);
        if (!story) return null;
        return buildTweetText(story);
    }

    function paylasSheetKapat() {
        var backdrop = document.getElementById('indexShareBackdrop');
        if (!backdrop) return;
        backdrop.classList.remove('is-open');
        backdrop.setAttribute('hidden', '');
        backdrop.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function paylasPanoyaYaz(metin, basariMesaji) {
        if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
            return global.navigator.clipboard.writeText(metin).then(function () {
                if (basariMesaji) showToast(basariMesaji);
            });
        }
        return Promise.reject(new Error('clipboard yok'));
    }

    function paylasSheetAc(id) {
        var veri = paylasPaketOlustur(id);
        if (!veri) return;
        paylasAktifId = id;

        var backdrop = document.getElementById('indexShareBackdrop');
        var elX = document.getElementById('indexShareX');
        var elWa = document.getElementById('indexShareWa');
        var elTg = document.getElementById('indexShareTg');
        var elFb = document.getElementById('indexShareFb');
        var elIg = document.getElementById('indexShareIg');
        var elCopy = document.getElementById('indexShareCopy');
        if (!backdrop || !elX) return;

        elX.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(veri.paket);
        elWa.href = 'https://wa.me/?text=' + encodeURIComponent(veri.paket);
        elTg.href = 'https://t.me/share/url?url=' + encodeURIComponent(veri.url) +
            '&text=' + encodeURIComponent(veri.hook + '\n\n' + PAYLAS_CAGRI);
        elFb.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(veri.url);

        if (!paylasSheetBagli) {
            paylasSheetBagli = true;
            document.getElementById('indexShareClose').addEventListener('click', paylasSheetKapat);
            backdrop.addEventListener('click', function (e) {
                if (e.target === backdrop) paylasSheetKapat();
            });
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') paylasSheetKapat();
            });
            elIg.addEventListener('click', function () {
                var aktif = paylasPaketOlustur(paylasAktifId);
                if (!aktif) return;
                paylasPanoyaYaz(aktif.paket, 'Link kopyalandı — Instagram\'da yapıştırabilirsin')
                    .catch(function () {
                        showToast(aktif.paket);
                    })
                    .finally(paylasSheetKapat);
            });
            elCopy.addEventListener('click', function () {
                var aktif = paylasPaketOlustur(paylasAktifId);
                if (!aktif) return;
                paylasPanoyaYaz(aktif.paket, 'Metin ve link kopyalandı')
                    .catch(function () {
                        showToast(aktif.paket);
                    })
                    .finally(paylasSheetKapat);
            });
            [elX, elWa, elTg, elFb].forEach(function (el) {
                if (el) el.addEventListener('click', paylasSheetKapat);
            });
        }

        backdrop.removeAttribute('hidden');
        backdrop.setAttribute('aria-hidden', 'false');
        backdrop.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function paylasTikla(id) {
        analyticsShare(id);
        paylasSheetAc(id);
    }

    function aramaInputAriaGuncelle(acik) {
        var inp = document.getElementById('indexAramaInput');
        if (inp) inp.setAttribute('aria-expanded', acik ? 'true' : 'false');
    }

    function aramaOneriGizle() {
        var el = document.getElementById('indexAramaOneri');
        var toolbar = document.getElementById('indexToolbar');
        state.oneriListe = [];
        if (el) {
            el.innerHTML = '';
            el.hidden = true;
        }
        if (toolbar) toolbar.classList.remove('index-toolbar--arama-oneri');
        aramaInputAriaGuncelle(false);
    }

    function aramaOneriGoster(liste) {
        var el = document.getElementById('indexAramaOneri');
        var toolbar = document.getElementById('indexToolbar');
        if (!el) return;
        if (!liste || !liste.length) {
            aramaOneriGizle();
            return;
        }
        state.oneriListe = liste.slice();
        el.innerHTML = liste.map(function (s, idx) {
            return '<li class="index-arama-oneri-item" role="option" tabindex="-1" data-oneri-idx="' + idx + '">' +
                esc(s) + '</li>';
        }).join('');
        el.hidden = false;
        if (toolbar) toolbar.classList.add('index-toolbar--arama-oneri');
        aramaKutuKonumGuncelle();
        aramaInputAriaGuncelle(true);
    }

    async function aramaOneriYenile(q) {
        var D = db();
        var oneriFn = D && (D.indexAramaGecmisiOneri || D.indexItirafAraOneri);
        if (!oneriFn) {
            aramaOneriGizle();
            return;
        }
        var istekNo = ++state.oneriIstekNo;
        try {
            var liste = await oneriFn.call(D, q, ARAMA_ONERI_ADET);
            if (istekNo !== state.oneriIstekNo) return;
            if (String(state.aramaMetni || '').replace(/^\s+|\s+$/g, '') !== q) return;
            aramaOneriGoster(liste);
        } catch (e) {
            if (istekNo !== state.oneriIstekNo) return;
            aramaOneriGizle();
        }
    }

    function aramaModundanCik(gosterFeed) {
        var onceAktif = state.aramaAktif;
        state.aramaAktif = false;
        state.sonAramaMetni = '';
        durumAramaYaz('');
        aramaOneriGizle();
        if (onceAktif || gosterFeed) {
            listeSifirla();
            listeTemizle();
            sonrakiPart(null);
        }
    }

    function aramaGirdiIsle(deger) {
        var q = String(deger || '').replace(/^\s+|\s+$/g, '');
        var onceAktif = state.aramaAktif;
        state.aramaMetni = q;

        if (state.aramaTimer) {
            clearTimeout(state.aramaTimer);
            state.aramaTimer = null;
        }

        if (onceAktif && q !== state.sonAramaMetni) {
            state.aramaAktif = false;
            listeSifirla();
            listeTemizle();
            sonrakiPart(null);
        }

        if (!q.length) {
            aramaModundanCik(true);
            return;
        }

        if (q.length < ARAMA_MIN) {
            durumAramaYaz('');
            aramaOneriGizle();
            return;
        }

        durumAramaYaz('');
        state.aramaTimer = setTimeout(function () {
            state.aramaTimer = null;
            aramaOneriYenile(q);
        }, ARAMA_DEBOUNCE);
    }

    function aramaCalistir() {
        var inp = document.getElementById('indexAramaInput');
        var q = String((inp && inp.value) || state.aramaMetni || '').replace(/^\s+|\s+$/g, '');
        if (q.length < ARAMA_MIN) {
            durumAramaYaz('En az 3 karakter yaz', true);
            aramaOneriGizle();
            return;
        }
        aramaOneriGizle();
        if (state.aramaTimer) {
            clearTimeout(state.aramaTimer);
            state.aramaTimer = null;
        }
        state.oneriIstekNo += 1;
        state.aramaMetni = q;
        state.sonAramaMetni = q;
        if (inp && inp.value !== q) inp.value = q;
        state.aramaAktif = true;
        analyticsIndexArama(q);
        listeSifirla();
        listeTemizle();
        durumAramaYaz('Aranıyor…');
        sonrakiPart(null, { aramaZorla: true });
    }

    function aramaOneriSec(idx) {
        var metin = state.oneriListe[idx];
        if (!metin) return;
        var inp = document.getElementById('indexAramaInput');
        if (inp) inp.value = metin;
        aramaCalistir();
    }

    function siralamaDegisti() {
        var sel = document.getElementById('indexSiralama');
        var onceki = state.siralama;
        var yeni = sel ? sel.value || 'yeni' : 'yeni';
        if (yeni !== onceki && /^(yeni|gulumseten|dun|rastgele|tum)$/.test(yeni)) {
            analyticsIndex({
                event: 'index_sort_change',
                payload: { siralama: yeni }
            });
        }
        state.siralama = yeni;
        state.aramaAktif = false;
        state.aramaMetni = '';
        state.sonAramaMetni = '';
        var inp = document.getElementById('indexAramaInput');
        if (inp) inp.value = '';
        durumAramaYaz('');
        aramaOneriGizle();
        listeSifirla();
        listeTemizle();
        sonrakiPart(null);
    }

    function aramaKutuKonumGuncelle() {
        var toolbar = document.getElementById('indexToolbar');
        var topbar = document.getElementById('indexPageTopbar');
        if (!toolbar || !toolbar.classList.contains('index-toolbar--arama-acik') || !topbar) return;
        var top = Math.round(topbar.getBoundingClientRect().bottom + 8);
        toolbar.style.setProperty('--index-arama-top', top + 'px');
    }

    function altBarAraTikla() {
        analyticsIndex({ event: 'altbar_ara_click', sayfa: 'index' });
        var toolbar = document.getElementById('indexToolbar');
        var inp = document.getElementById('indexAramaInput');
        if (toolbar) {
            toolbar.classList.add('index-toolbar--arama-acik');
            aramaKutuKonumGuncelle();
        }
        if (inp) {
            global.setTimeout(function () {
                aramaKutuKonumGuncelle();
                inp.focus({ preventScroll: true });
            }, 80);
        }
    }

    function altBarEnIyilerTikla() {
        analyticsIndex({ event: 'altbar_eniyiler_click', sayfa: 'index' });
        altBarAramaKapat();
        var sel = document.getElementById('indexSiralama');
        if (sel && sel.value !== 'gulumseten') {
            sel.value = 'gulumseten';
            siralamaDegisti();
        } else if (state.siralama !== 'gulumseten') {
            state.siralama = 'gulumseten';
            listeSifirla();
            listeTemizle();
            sonrakiPart(null);
        }
        global.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function pcSolMenuAktif(siralama) {
        var links = document.querySelectorAll('.pc-left-link[data-pc-sort]');
        var i;
        for (i = 0; i < links.length; i++) {
            links[i].classList.toggle(
                'pc-left-link--aktif',
                links[i].getAttribute('data-pc-sort') === siralama
            );
        }
    }

    function tumArsiviGoster() {
        analyticsIndex({ event: 'index_tum_arsiv_click', sayfa: 'index' });
        altBarAramaKapat();
        var sel = document.getElementById('indexSiralama');
        if (sel && sel.value !== 'tum') {
            sel.value = 'tum';
            siralamaDegisti();
        } else if (state.siralama !== 'tum') {
            state.siralama = 'tum';
            listeSifirla();
            listeTemizle();
            sonrakiPart(null);
        }
        pcSolMenuAktif('tum');
        global.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function altBarAramaKapat() {
        var toolbar = document.getElementById('indexToolbar');
        if (toolbar) {
            toolbar.classList.remove('index-toolbar--arama-acik');
            toolbar.classList.remove('index-toolbar--arama-oneri');
            toolbar.style.removeProperty('--index-arama-top');
        }
        aramaOneriGizle();
    }

    /** Aktif baskıdan önceki yayın günü (YYYY-MM-DD). */
    function ymdDun() {
        if (state.oncekiBaskiYmd) return state.oncekiBaskiYmd;
        var bugun = aktifBaskiYmd();
        if (!bugun) return null;
        var p = bugun.split('-');
        var d = new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
        d.setUTCDate(d.getUTCDate() - 1);
        var y = d.getUTCFullYear();
        var m = d.getUTCMonth() + 1;
        var g = d.getUTCDate();
        return y + '-' + (m < 10 ? '0' : '') + m + '-' + (g < 10 ? '0' : '') + g;
    }

    async function dunun5Getir() {
        var D = db();
        if (!D) return [];
        if (D.init) await D.init();
        if (D.indexDunun5Getir) {
            try {
                var dogrudan = await D.indexDunun5Getir();
                if (dogrudan && dogrudan.length) return dogrudan;
            } catch (eDun) { /* taramaya düş */ }
        }
        if (!D.indexItirafListeleSayfa) return [];
        var dun = ymdDun();
        if (!dun) return [];
        var dunRows = [];
        var off = 0;
        var batch = 60;
        var maxTarama = 400;
        while (dunRows.length < 5 && off < maxTarama) {
            var parca = await D.indexItirafListeleSayfa(off, batch, 'yeni');
            if (!parca.length) break;
            var i;
            for (i = 0; i < parca.length; i++) {
                if (trYmd(parca[i].created_at) === dun) dunRows.push(parca[i]);
            }
            off += parca.length;
            if (parca.length < batch) break;
        }
        dunRows.sort(function (a, b) {
            return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        });
        return dunRows.slice(0, 5);
    }

    function dunIdlerDomdaEksik(idler) {
        if (!idler || !idler.length) return true;
        var i;
        for (i = 0; i < idler.length; i++) {
            if (!document.getElementById('h-' + idler[i])) return true;
        }
        return false;
    }

    var dunTiklaniyor = false;
    var loadMoreTiklaniyor = false;

    function dunIdListesi(opts) {
        if (!opts) return null;
        if (Array.isArray(opts)) {
            return opts.map(function (id) { return String(id); }).filter(Boolean);
        }
        if (Array.isArray(opts.ids)) {
            return opts.ids.map(function (id) { return String(id); }).filter(Boolean);
        }
        return null;
    }

    function dunSatirlar(opts) {
        if (!opts || Array.isArray(opts)) return null;
        return Array.isArray(opts.rows) ? opts.rows : null;
    }

    function dunKartBul(idler) {
        var i, el;
        if (idler && idler.length) {
            for (i = 0; i < idler.length; i++) {
                el = document.getElementById('h-' + idler[i]);
                if (el) return el;
            }
        }
        var dunEtiket = document.querySelector('.index-yayin-etiket--dun');
        return dunEtiket ? dunEtiket.closest('.story-card') : null;
    }

    async function dunKartLayoutBekle(kart) {
        var deneme = 0;
        while (deneme < 30) {
            if (kart && kart.isConnected && kart.offsetHeight > 0) {
                var r = kart.getBoundingClientRect();
                if (r.height > 0) return true;
            }
            deneme += 1;
            await new Promise(function (resolve) {
                requestAnimationFrame(resolve);
            });
        }
        return !!(kart && kart.isConnected);
    }

    async function dunKartaKaydir(kart) {
        if (!kart || !kart.id) return false;
        if (!(await dunKartLayoutBekle(kart))) return false;
        var mobil = false;
        try {
            mobil = window.matchMedia && window.matchMedia('(max-width: 1023px)').matches;
        } catch (eM) { /* */ }
        var blok = mobil ? 'center' : 'start';
        kart.scrollIntoView({ behavior: 'auto', block: blok });
        await new Promise(function (resolve) {
            requestAnimationFrame(resolve);
        });
        kart.scrollIntoView({ behavior: 'smooth', block: blok });
        try {
            if (global.history && global.history.replaceState) {
                global.history.replaceState(null, '', '#' + kart.id);
            } else {
                location.hash = '#' + kart.id;
            }
        } catch (eHash) {
            location.hash = '#' + kart.id;
        }
        qsaFocusTemizle(kart);
        kart.classList.add('focused');
        return true;
    }

    async function feedIlkYuklemeBekle() {
        var deneme = 0;
        while (state.yukleniyor && deneme < 150) {
            deneme += 1;
            await new Promise(function (resolve) {
                global.setTimeout(resolve, 40);
            });
        }
        try {
            await arkaplanIlkSayfaTamam;
        } catch (eFeed) { /* */ }
    }

    function qsaFocusTemizle(aktif) {
        var el = listeEl();
        if (!el) return;
        var cards = el.querySelectorAll('.story-card.focused');
        var i;
        for (i = 0; i < cards.length; i++) {
            if (cards[i] !== aktif) cards[i].classList.remove('focused');
        }
    }

    function dunListeEklemeNoktasi(el) {
        var anchor = el.querySelector('.index-load-more-wrap');
        if (anchor) return { tip: 'before', ref: anchor };
        return { tip: 'append', ref: null };
    }

    function dunListeYerlestir(el, node, nokta) {
        if (!el || !node) return;
        if (nokta.tip === 'after' && nokta.ref) {
            if (nokta.ref.nextSibling) {
                el.insertBefore(node, nokta.ref.nextSibling);
            } else {
                el.appendChild(node);
            }
            return;
        }
        if (nokta.tip === 'before' && nokta.ref) {
            el.insertBefore(node, nokta.ref);
            return;
        }
        el.appendChild(node);
    }

    function dunBolumBasligiYerlestir(el, refKart) {
        if (!el || el.querySelector('.index-dun-bolum-baslik')) return;
        var baslikEl = document.createElement('p');
        baslikEl.className = 'index-dun-bolum-baslik';
        baslikEl.setAttribute('role', 'note');
        baslikEl.textContent = '📅 Dünün 5\'i';
        if (refKart && refKart.parentNode === el) {
            el.insertBefore(baslikEl, refKart);
            return;
        }
        dunListeYerlestir(el, baslikEl, dunListeEklemeNoktasi(el));
    }

    async function yuklenenDunHikayelerineKaydir(rows) {
        var dun = ymdDun();
        var i, kart, el;
        if (dun && rows && rows.length) {
            for (i = 0; i < rows.length; i++) {
                if (!rows[i] || rows[i].id == null) continue;
                if (trYmd(rows[i].created_at) !== dun) continue;
                kart = document.getElementById('h-' + rows[i].id);
                if (!kart) continue;
                el = listeEl();
                if (el) dunBolumBasligiYerlestir(el, kart);
                await dunDomHazirBekle();
                if (await dunKartaKaydir(kart)) return;
            }
        }
        var etiket = document.querySelector('.index-yayin-etiket--dun');
        kart = etiket ? etiket.closest('.story-card') : null;
        if (!kart) return;
        el = listeEl();
        if (el) dunBolumBasligiYerlestir(el, kart);
        await dunDomHazirBekle();
        await dunKartaKaydir(kart);
    }

    async function dunSatirlariListeyeEkle(rows) {
        if (!rows || !rows.length) return;
        var eksik = [];
        var i;
        for (i = 0; i < rows.length; i++) {
            if (!rows[i] || rows[i].id == null) continue;
            if (!document.getElementById('h-' + rows[i].id)) {
                eksik.push(rows[i]);
            }
        }
        if (!eksik.length) return;

        eksik.sort(function (a, b) {
            return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        });

        var el = listeEl();
        if (!el) return;

        var nokta = dunListeEklemeNoktasi(el);

        var frag = document.createDocumentFragment();
        for (i = 0; i < eksik.length; i++) {
            state.yuklenenIdler[eksik[i].id] = true;
            var dunKart = kartElementOlustur(eksik[i], false);
            dunKart.setAttribute('data-g5-dun', '1');
            frag.appendChild(dunKart);
        }
        dunListeYerlestir(el, frag, nokta);
        if (eksik[0] && eksik[0].id != null) {
            dunBolumBasligiYerlestir(el, document.getElementById('h-' + eksik[0].id));
        } else {
            dunBolumBasligiYerlestir(el, null);
        }

        await kartOyDurumlariniSenkron(eksik);
        var A = global.Gunde5Analytics;
        if (A && A.kartlariIzle) A.kartlariIzle(el);
    }

    function dunDomHazirBekle() {
        return new Promise(function (resolve) {
            requestAnimationFrame(function () {
                requestAnimationFrame(resolve);
            });
        });
    }

    async function dunHikayelerineGit(opts) {
        analyticsIndex({ event: 'altbar_dun_click', sayfa: 'index' });
        var D = db();
        if (D && D.init) await D.init();
        await feedIlkYuklemeBekle();

        var idler = dunIdListesi(opts);
        var dunRows = dunSatirlar(opts);

        if (!dunRows || !dunRows.length) {
            dunRows = await dunun5Getir();
            idler = dunRows.map(function (r) { return String(r.id); });
        }

        if (!dunRows.length) {
            showToast('Dün için yayınlanmış hikâye yok.');
            return;
        }

        if (dunIdlerDomdaEksik(idler)) {
            await dunSatirlariListeyeEkle(dunRows);
            await dunDomHazirBekle();
        }

        var kart = dunKartBul(idler);
        if (await dunKartaKaydir(kart)) return;

        var moreBtn = document.querySelector('.index-load-more');
        if (dunIdlerDomdaEksik(idler) && moreBtn && !state.bitti) {
            var depth;
            for (depth = 0; depth < 30; depth++) {
                if (!dunIdlerDomdaEksik(idler)) break;
                if (state.yukleniyor) {
                    await new Promise(function (resolve) {
                        global.setTimeout(resolve, 200);
                    });
                    continue;
                }
                if (state.bitti) break;
                moreBtn = document.querySelector('.index-load-more');
                if (!moreBtn) break;
                await sonrakiPart(moreBtn, { skipHedefKaydir: true });
                await dunDomHazirBekle();
                kart = dunKartBul(idler);
                if (await dunKartaKaydir(kart)) return;
            }
        }

        if (dunIdlerDomdaEksik(idler)) {
            await dunSatirlariListeyeEkle(dunRows);
            await dunDomHazirBekle();
            kart = dunKartBul(idler);
            if (await dunKartaKaydir(kart)) return;
        }

        kart = dunKartBul(idler);
        if (await dunKartaKaydir(kart)) return;

        showToast('Dünkü hikâyeler gösterilemedi.');
    }

    async function altBarDunTikla() {
        if (dunTiklaniyor) return;
        dunTiklaniyor = true;
        try {
            await dunHikayelerineGit();
        } catch (err) {
            showToast(hataMesaji(err));
        } finally {
            dunTiklaniyor = false;
        }
    }

    function aramaViewportBagla() {
        if (global.__g5AramaViewportBound) return;
        global.__g5AramaViewportBound = true;
        var guncelle = function () {
            aramaKutuKonumGuncelle();
        };
        global.addEventListener('resize', guncelle, { passive: true });
        if (global.visualViewport) {
            global.visualViewport.addEventListener('resize', guncelle, { passive: true });
            global.visualViewport.addEventListener('scroll', guncelle, { passive: true });
        }
    }

    function altBarBagla() {
        aramaViewportBagla();
        var ara = document.getElementById('indexAltbarAra');
        var enIyiler = document.getElementById('indexAltbarEnIyiler');
        var dun = document.getElementById('indexAltbarDun');
        if (ara && ara.getAttribute('data-bound') !== '1') {
            ara.setAttribute('data-bound', '1');
            ara.addEventListener('click', altBarAraTikla);
        }
        if (enIyiler && enIyiler.getAttribute('data-bound') !== '1') {
            enIyiler.setAttribute('data-bound', '1');
            enIyiler.addEventListener('click', altBarEnIyilerTikla);
        }
        if (dun && dun.getAttribute('data-bound') !== '1') {
            dun.setAttribute('data-bound', '1');
            dun.addEventListener('click', function () {
                altBarDunTikla();
            });
        }
        var tailDun = document.getElementById('pageTailDunBtn');
        if (tailDun && tailDun.getAttribute('data-bound') !== '1') {
            tailDun.setAttribute('data-bound', '1');
            tailDun.addEventListener('click', function (e) {
                e.preventDefault();
                altBarDunTikla();
            });
        }
    }

    function toolbarBagla() {
        var inp = document.getElementById('indexAramaInput');
        var btn = document.getElementById('indexAramaBtn');
        var oneri = document.getElementById('indexAramaOneri');
        var sel = document.getElementById('indexSiralama');
        if (btn && btn.getAttribute('data-bound') !== '1') {
            btn.setAttribute('data-bound', '1');
            btn.addEventListener('mousedown', function (e) {
                e.preventDefault();
            });
            btn.addEventListener('click', function () {
                aramaCalistir();
            });
        }
        if (oneri && oneri.getAttribute('data-bound') !== '1') {
            oneri.setAttribute('data-bound', '1');
            oneri.addEventListener('mousedown', function (e) {
                e.preventDefault();
            });
            oneri.addEventListener('click', function (e) {
                var li = e.target.closest('[data-oneri-idx]');
                if (!li) return;
                aramaOneriSec(parseInt(li.getAttribute('data-oneri-idx'), 10));
            });
        }
        if (inp && inp.getAttribute('data-bound') !== '1') {
            inp.setAttribute('data-bound', '1');
            inp.addEventListener('input', function () {
                aramaGirdiIsle(inp.value);
            });
            inp.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    aramaCalistir();
                }
            });
            inp.addEventListener('search', function () {
                if (!inp.value) {
                    aramaModundanCik(true);
                    altBarAramaKapat();
                }
            });
            inp.addEventListener('blur', function () {
                global.setTimeout(function () {
                    if (document.activeElement !== inp &&
                        document.activeElement !== btn &&
                        !(oneri && oneri.contains(document.activeElement))) {
                        altBarAramaKapat();
                    }
                }, 120);
            });
        }
        if (sel && sel.getAttribute('data-bound') !== '1') {
            sel.setAttribute('data-bound', '1');
            sel.addEventListener('change', siralamaDegisti);
        }
    }

    function indexOnbellekTemizle() {
        try {
            sessionStorage.removeItem(CACHE_KEY);
        } catch (e) { /* sessiz */ }
    }

    function itirafGuncellendiDinle() {
        if (global.__g5IndexItirafGuncellendiBound) return;
        global.__g5IndexItirafGuncellendiBound = true;
        global.addEventListener('gunde5-itiraf-guncellendi', function () {
            indexOnbellekTemizle();
            arkaplanIlkSayfaYenile().catch(function () { /* sessiz */ });
        });
    }

    function olaylariBagla() {
        var el = listeEl();
        if (!el || el.getAttribute('data-bound') === '1') return;
        el.setAttribute('data-bound', '1');
        el.addEventListener('click', function (e) {
            var voteBtn = e.target.closest('[data-vote]');
            if (voteBtn) {
                oyTikla(voteBtn).catch(function (err) {
                    showToast(hataMesaji(err));
                });
                return;
            }
            var shareBtn = e.target.closest('[data-share]');
            if (shareBtn) {
                paylasTikla(shareBtn.getAttribute('data-share'));
                return;
            }
            var tumBtn = e.target.closest('.index-load-more-tum');
            if (tumBtn) {
                tumArsiviGoster();
                return;
            }
            var moreBtn = e.target.closest('.index-load-more');
            if (moreBtn) {
                if (loadMoreTiklaniyor) return;
                loadMoreTiklaniyor = true;
                sonrakiPart(moreBtn).catch(function (err) {
                    showToast(hataMesaji(err));
                }).finally(function () {
                    loadMoreTiklaniyor = false;
                });
            }
        });
    }

    function scriptYukle(src) {
        return new Promise(function (resolve) {
            var s = document.createElement('script');
            s.src = src;
            s.defer = true;
            s.onload = function () { resolve(); };
            s.onerror = function () { resolve(); };
            document.head.appendChild(s);
        });
    }

    var SAHIP_ARAC_GECIKME_MS = 6000;

    function sahipAraclariPlanla() {
        if (global.__g5SahipPlanli) return;
        global.__g5SahipPlanli = true;
        setTimeout(function () {
            if (global.__g5SecondaryLoaded) return;
            scriptYukle('js/gunde5-perf.js?v=3').then(function () {
                if (global.Gunde5Perf && global.Gunde5Perf.kick) {
                    global.Gunde5Perf.kick();
                }
            });
        }, SAHIP_ARAC_GECIKME_MS);
    }

    async function indexMasterNavKur() {
        var menuSol = document.getElementById('indexTopbarSol');
        if (!menuSol) return;
        var D = db();
        if (!D || !D.masterDurum) return;
        try {
            var durum = await D.masterDurum();
            if (!durum || !durum.master) return;
            await scriptYukle('js/gunde5-ui.js');
            await scriptYukle('js/gunde5-master.js?v=4');
            menuSol.hidden = false;
            if (global.Gunde5Shell && global.Gunde5Shell.applyShell) {
                global.Gunde5Shell.applyShell();
            }
            if (global.Gunde5UI && global.Gunde5UI.guncelleHeaderOturum) {
                global.Gunde5UI.guncelleHeaderOturum();
            }
            if (global.Gunde5Master && global.Gunde5Master.durumYenile) {
                await global.Gunde5Master.durumYenile();
            }
        } catch (e) { /* master nav isteğe bağlı */ }
    }

    function indexMasterNavErtele() {
        var idle = global.requestIdleCallback || function (fn) { setTimeout(fn, 300); };
        idle(function () {
            indexMasterNavKur();
        });
    }

    async function baslat() {
        var D = db();
        if (!D || !D.isConfigured || !D.isConfigured()) {
            durumYaz('<p class="index-durum index-durum--hata">Veritabanı yapılandırılmadı.</p>');
            return;
        }
        await D.init();
        toolbarBagla();
        altBarBagla();
        olaylariBagla();
        itirafGuncellendiDinle();
        SAYFA = D.INDEX_SAYFA_BOYUT || 5;

        var cached = onbellekKullanilabilirMi() ? cacheOku() : null;
        if (cached && cached.rows.length && D.aktifBaskiGunGetir) {
            var guncelBaski = await D.aktifBaskiGunGetir();
            if (guncelBaski && cached.edition && cached.edition !== guncelBaski) {
                cached = null;
            }
        }
        if (cached && cached.rows.length) {
            await onbellektenGoster(cached);
            indexMasterNavErtele();
            arkaplanIlkSayfaTamam = arkaplanIlkSayfaYenile()
                .then(function () {
                    return hedefKartaKaydirOtomatik(0);
                })
                .catch(function () {
                    return null;
                });
            return;
        }

        await sonrakiPart(null);
        arkaplanIlkSayfaTamam = Promise.resolve();
        indexMasterNavErtele();
    }

    function boot() {
        sahipAraclariPlanla();
        if (!db()) {
            durumYaz('<p class="index-durum index-durum--hata">gunde5-db yüklenemedi.</p>');
            return;
        }
        baslat().catch(function (err) {
            durumYaz('<p class="index-durum index-durum--hata">' + esc(hataMesaji(err)) + '</p>');
        });
    }

    global.Gunde5Index = { baslat: baslat, dunHikayelerineGit: dunHikayelerineGit };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window);
