/* gunde5 — anasayfa: ince itiraflar listesi, 5'li sayfalama */
(function (global) {
    'use strict';

    var SAYFA = 5;
    var MSJ_ZATEN_OYLADIN = 'Bu hikayeyi zaten oylamıştın, sonrakine geç dostum';
    var PAYLAS_CAGRI = '📌 Devamını REKLAMSIZ ve ÜCRETSİZ oku:';
    var CACHE_KEY = 'g5_index_feed_v1';
    var CACHE_TTL_MS = 5 * 60 * 1000;
    var ARAMA_DEBOUNCE = 320;
    var ARAMA_MIN = 2;
    var state = {
        offset: 0,
        yukleniyor: false,
        bitti: false,
        yuklenenIdler: {},
        siralama: 'yeni',
        aramaMetni: '',
        aramaAktif: false,
        rastgeleHavuz: null,
        aramaTimer: null
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
        analyticsIndex({
            event: 'load_more_click',
            loaded_count: loadedCount || SAYFA
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

    function metaSatir(row) {
        if (!row) return '';
        var p = [];
        if (row.age) {
            p.push(row.age + ' Yaş');
        }
        var P = global.Gunde5Profil;
        var yer = P && P.yasadigiYerSatirdan
            ? P.yasadigiYerSatirdan(row)
            : (row.yasadigi_yer || row.city);
        if (yer) {
            p.push(yer);
        }
        return p.join(' • ');
    }

    function icerikMetni(row) {
        return row.content_full || row.content_short || '';
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
        var UI = global.Gunde5UI;
        if (!D || !D.oyDurumlariSenkron || !rows || !rows.length) return;
        var ids = rows.map(function (r) { return r.id; });
        var durum = await D.oyDurumlariSenkron(ids);
        ids.forEach(function (id) {
            var tip = durum[id];
            if (!tip) return;
            var card = document.getElementById('h-' + id);
            if (UI && UI.kartOyDurumuRenklendir) {
                UI.kartOyDurumuRenklendir(card, tip);
            }
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

    function listeSifirla() {
        state.offset = 0;
        state.bitti = false;
        state.yuklenenIdler = {};
        state.rastgeleHavuz = null;
        loadMoreTemizle();
    }

    function onbellekKullanilabilirMi() {
        return state.siralama === 'yeni' && !state.aramaAktif && !hedefIdOku();
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

        if (state.siralama === 'rastgele') {
            if (!state.rastgeleHavuz) {
                var havuz = D.indexItirafHavuzGetir
                    ? await D.indexItirafHavuzGetir()
                    : [];
                state.rastgeleHavuz = karistir(havuz);
            }
            return state.rastgeleHavuz.slice(offset, offset + limit);
        }

        return D.indexItirafListeleSayfa(offset, limit, state.siralama);
    }

    function cacheOku() {
        try {
            var raw = global.sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var o = JSON.parse(raw);
            if (!o || !o.ts || !Array.isArray(o.rows) || !o.rows.length) return null;
            if (Date.now() - o.ts > CACHE_TTL_MS) return null;
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
        var el = listeEl();
        if (el) el.innerHTML = '';
        return kartlariEkle(cached.rows, true);
    }

    async function ilkSayfayiYenidenCiz(rows) {
        var el = listeEl();
        if (!el) return;
        el.innerHTML = '';
        state.yuklenenIdler = {};
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

        var art = document.createElement('article');
        art.className = 'story-card card ' + cins + (ilkKart ? ' focused' : '');
        art.id = 'h-' + id;
        art.setAttribute('data-id', id);

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
                    '<span class="kart-marka" aria-hidden="true">gunde<span class="brand-five">5</span>.com</span>' +
                '</div>' +
            '</div>' +
            '<div class="card-body">' +
                (baslik ? '<span class="kart-baslik">' + esc(baslik) + '</span>' : '') +
                '<span class="short-text">' + esc(icerikMetni(row)) + '</span></div>' +
            '<div class="card-footer story-actions">' +
                '<div class="vote-box">' +
                    '<button type="button" class="vote-btn' + (voted === 'up' ? ' applauded' : '') +
                    '" data-vote="up" data-id="' + id + '" aria-label="Beğendim">❤️ Beğendim <span class="count">' + like + '</span></button>' +
                    '<button type="button" class="vote-btn' + (voted === 'down' ? ' disliked' : '') +
                    '" data-vote="down" data-id="' + id + '" aria-label="Beğenmedim">👎 Beğenmedim <span class="count-down">' + dislike + '</span></button>' +
                '</div>' +
                '<button type="button" class="share-btn" data-share="' + id + '">🔗 Paylaş</button>' +
            '</div>';

        return art;
    }

    function loadMoreBtnHtml() {
        return '<button type="button" class="load-more-btn index-load-more">Daha Fazla Oku</button>';
    }

    function durumYaz(html) {
        var el = listeEl();
        if (el) {
            el.innerHTML = html;
        }
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
            eklendi = true;
        }
        if (!eklendi) return;

        el.appendChild(frag);
        await kartOyDurumlariniSenkron(rows);

        var A = global.Gunde5Analytics;
        if (A && A.kartlariIzle) A.kartlariIzle(el);

        if (rows.length >= SAYFA && !state.bitti) {
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

    async function sonrakiPart(btn) {
        if (state.yukleniyor || state.bitti) return;
        if (btn && btn.closest) {
            var wrap = btn.closest('.index-load-more-wrap');
            if (wrap) wrap.remove();
        }

        if (btn) {
            analyticsLoadMore(state.offset + SAYFA);
        }

        state.yukleniyor = true;
        var ilkPart = state.offset === 0;

        if (ilkPart) {
            durumYaz('<p class="index-durum">Yükleniyor…</p>');
        }

        try {
            var rows = await hikayeListele(state.offset, SAYFA);
            if (ilkPart) {
                var el = listeEl();
                if (el) el.innerHTML = '';
            }

            state.offset += rows.length;
            if (rows.length < SAYFA) {
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

            if (state.siralama === 'rastgele' && state.rastgeleHavuz) {
                if (state.offset >= state.rastgeleHavuz.length || rows.length < SAYFA) {
                    state.bitti = true;
                }
            }

            await kartlariEkle(rows, ilkPart);

            if (ilkPart && rows.length && onbellekKullanilabilirMi()) {
                cacheYaz(rows, state.offset, state.bitti);
            }

            if (ilkPart && state.aramaAktif) {
                if (!rows.length) {
                    durumAramaYaz('Sonuç yok');
                } else {
                    durumAramaYaz(rows.length + (state.bitti ? '' : '+') + ' sonuç');
                }
            }
        } catch (err) {
            var msg = hataMesaji(err);
            if (state.aramaAktif && ilkPart) {
                durumAramaYaz(msg, true);
            }
            if (ilkPart) {
                durumYaz('<p class="index-durum index-durum--hata">' + esc(msg) + '</p>');
            } else {
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
        await hedefKartaKaydirOtomatik(0);
    }

    async function arkaplanIlkSayfaYenile() {
        if (!onbellekKullanilabilirMi()) return;
        try {
            var D = db();
            var rows = D
                ? await D.indexItirafListeleSayfa(0, SAYFA, 'yeni')
                : await hikayeListele(0, SAYFA);
            if (!rows.length) return;

            cacheYaz(rows, rows.length, rows.length < SAYFA);

            var el = listeEl();
            if (!el) return;

            var kartSayisi = el.querySelectorAll('.story-card').length;
            var yeniIdler = ilkSayfaIdleri(rows);
            var domIdler = domIlkSayfaIdleri();

            if (kartSayisi <= SAYFA) {
                if (!idListesiAyni(domIdler, yeniIdler)) {
                    await ilkSayfayiYenidenCiz(rows);
                } else {
                    var i;
                    for (i = 0; i < rows.length; i++) {
                        kartOySayilariniGuncelle(
                            document.getElementById('h-' + rows[i].id),
                            rows[i]
                        );
                    }
                }
                return;
            }

            var j;
            for (j = 0; j < rows.length; j++) {
                kartOySayilariniGuncelle(
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
        if (upBtn) {
            var upSpan = upBtn.querySelector('.count');
            if (upSpan) upSpan.textContent = String(likeSayisi(row));
        }
        if (downBtn) {
            var downSpan = downBtn.querySelector('.count-down');
            if (downSpan) downSpan.textContent = String(dislikeSayisi(row));
        }
    }

    function kartOyGuncelle(card, sonuc, tip) {
        if (!card || !sonuc) return;
        var upBtn = card.querySelector('[data-vote="up"]');
        var downBtn = card.querySelector('[data-vote="down"]');
        if (upBtn) {
            var upSpan = upBtn.querySelector('.count');
            if (upSpan && sonuc.up_votes != null) {
                upSpan.textContent = String(sonuc.up_votes);
            }
        }
        if (downBtn) {
            var downSpan = downBtn.querySelector('.count-down');
            if (downSpan && sonuc.down_votes != null) {
                downSpan.textContent = String(sonuc.down_votes);
            }
        }
        if (tip) oyButonRenklendir(card, tip);
    }

    function oyButonRenklendir(card, tip) {
        var UI = global.Gunde5UI;
        if (UI && UI.kartOyDurumuRenklendir) {
            UI.kartOyDurumuRenklendir(card, tip);
            return;
        }
        if (!card || !tip) return;
        var upBtn = card.querySelector('[data-vote="up"]');
        var downBtn = card.querySelector('[data-vote="down"]');
        if (upBtn) upBtn.classList.toggle('applauded', tip === 'up');
        if (downBtn) downBtn.classList.toggle('disliked', tip === 'down');
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
            } else if (tip === 'up' && typeof global.confetti === 'function') {
                global.confetti({ particleCount: 50, spread: 60, origin: { y: 0.85 } });
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

    function paylasPaketOlustur(id) {
        var card = document.getElementById('h-' + id);
        if (!card) return null;
        var metinEl = card.querySelector('.short-text');
        var fullText = metinEl ? metinEl.textContent : '';
        var kanca = fullText.length > 140 ? fullText.substring(0, 140) + '...' : fullText;
        var url = 'https://gunde5.com/h/' + encodeURIComponent(String(id));
        var paket = kanca + '\n\n' + PAYLAS_CAGRI + '\n' + url;
        return { kanca: kanca, url: url, paket: paket };
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
            '&text=' + encodeURIComponent(veri.kanca + '\n\n' + PAYLAS_CAGRI);
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

    function aramaGirdiIsle(deger) {
        var q = String(deger || '').replace(/^\s+|\s+$/g, '');
        var onceAktif = state.aramaAktif;
        state.aramaMetni = q;

        if (state.aramaTimer) {
            clearTimeout(state.aramaTimer);
            state.aramaTimer = null;
        }

        if (q.length < ARAMA_MIN) {
            state.aramaAktif = false;
            durumAramaYaz(q.length ? 'En az 2 karakter yaz' : '');
            if (onceAktif || !q.length) {
                listeSifirla();
                sonrakiPart(null);
            }
            return;
        }

        state.aramaTimer = setTimeout(function () {
            state.aramaTimer = null;
            state.aramaAktif = true;
            listeSifirla();
            durumAramaYaz('Aranıyor…');
            sonrakiPart(null);
        }, ARAMA_DEBOUNCE);
    }

    function siralamaDegisti() {
        var sel = document.getElementById('indexSiralama');
        state.siralama = sel ? sel.value || 'yeni' : 'yeni';
        state.aramaAktif = false;
        state.aramaMetni = '';
        var inp = document.getElementById('indexAramaInput');
        if (inp) inp.value = '';
        durumAramaYaz('');
        listeSifirla();
        sonrakiPart(null);
    }

    function toolbarBagla() {
        var inp = document.getElementById('indexAramaInput');
        var sel = document.getElementById('indexSiralama');
        if (inp && inp.getAttribute('data-bound') !== '1') {
            inp.setAttribute('data-bound', '1');
            inp.addEventListener('input', function () {
                aramaGirdiIsle(inp.value);
            });
            inp.addEventListener('search', function () {
                if (!inp.value) aramaGirdiIsle('');
            });
        }
        if (sel && sel.getAttribute('data-bound') !== '1') {
            sel.setAttribute('data-bound', '1');
            sel.addEventListener('change', siralamaDegisti);
        }
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
            var moreBtn = e.target.closest('.index-load-more');
            if (moreBtn) {
                sonrakiPart(moreBtn);
            }
        });
    }

    async function indexMasterNavKur() {
        var hdr = document.getElementById('indexSiteHeader');
        if (!hdr) return;
        var D = db();
        if (!D || !D.masterDurum || !D.getGunde5User || !D.getGunde5User()) return;
        try {
            var durum = await D.masterDurum();
            if (!durum || !durum.master) return;
            hdr.hidden = false;
            document.documentElement.classList.add('g5-index-master-nav');
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

    async function baslat() {
        var D = db();
        if (!D || !D.isConfigured || !D.isConfigured()) {
            durumYaz('<p class="index-durum index-durum--hata">Veritabanı yapılandırılmadı.</p>');
            return;
        }
        await D.init();
        await indexMasterNavKur();
        toolbarBagla();
        olaylariBagla();
        SAYFA = D.INDEX_SAYFA_BOYUT || 5;

        var cached = onbellekKullanilabilirMi() ? cacheOku() : null;
        if (cached && cached.rows.length) {
            await onbellektenGoster(cached);
            arkaplanIlkSayfaYenile().then(function () {
                return hedefKartaKaydirOtomatik(0);
            });
            return;
        }

        await sonrakiPart(null);
    }

    function boot() {
        if (!db()) {
            durumYaz('<p class="index-durum index-durum--hata">gunde5-db yüklenemedi.</p>');
            return;
        }
        baslat().catch(function (err) {
            durumYaz('<p class="index-durum index-durum--hata">' + esc(hataMesaji(err)) + '</p>');
        });
    }

    global.Gunde5Index = { baslat: baslat };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window);
