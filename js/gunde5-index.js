/* gunde5 — anasayfa: ince itiraflar listesi, 5'li sayfalama */
(function (global) {
    'use strict';

    var SAYFA = 5;
    var MSJ_ZATEN_OYLADIN = 'Bu hikayeyi zaten oylamıştın, sonrakine geç dostum';
    var PAYLAS_CAGRI = '📌 Devamını REKLAMSIZ ve ÜCRETSİZ oku:';
    var state = {
        offset: 0,
        yukleniyor: false,
        bitti: false,
        yuklenenIdler: {}
    };

    function db() {
        return global.Gunde5DB;
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
        var yer = row.yasadigi_yer || row.city;
        if (yer) {
            p.push(String(yer).trim());
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
        try {
            return global.localStorage.getItem('g5_index_voted_' + id);
        } catch (e) {
            return null;
        }
    }

    function oyKaydet(id, tip) {
        try {
            global.localStorage.setItem('g5_index_voted_' + id, tip);
        } catch (e) { /* sessiz */ }
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

    async function hikayeListele(offset, limit) {
        var D = db();
        if (!D || !D.indexItirafListeleSayfa) {
            throw new Error('indexItirafListeleSayfa tanımlı değil');
        }
        return D.indexItirafListeleSayfa(offset, limit);
    }

    function kartElementOlustur(row, ilkKart) {
        var id = String(row.id);
        var cins = row.gender === 'male' ? 'male' : 'female';
        var rumuz = row.username || 'Anonim';
        var like = likeSayisi(row);
        var dislike = dislikeSayisi(row);
        var voted = oyDurumu(id);
        var meta = metaSatir(row);

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
            '<div class="card-body"><span class="short-text">' + esc(icerikMetni(row)) + '</span></div>' +
            '<div class="card-footer story-actions">' +
                '<div class="vote-box">' +
                    '<button type="button" class="vote-btn' + (voted === 'up' ? ' applauded' : '') +
                    '" data-vote="up" data-id="' + id + '">👏 Alkışla <span class="count">' + like + '</span></button>' +
                    '<button type="button" class="vote-btn' + (voted === 'down' ? ' disliked' : '') +
                    '" data-vote="down" data-id="' + id + '" aria-label="Beğenme">👎' +
                    (dislike ? ' <span class="count-down">' + dislike + '</span>' : '') +
                    '</button>' +
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

    function kartlariEkle(rows, ilkPart) {
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
                durumYaz('<p class="index-durum">Henüz hikaye yok.</p>');
                return;
            }

            kartlariEkle(rows, ilkPart);
        } catch (err) {
            var msg = hataMesaji(err);
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
            var downVal = sonuc.down_votes != null ? sonuc.down_votes : 0;
            var downSpan = downBtn.querySelector('.count-down');
            if (downVal > 0) {
                if (!downSpan) {
                    downSpan = document.createElement('span');
                    downSpan.className = 'count-down';
                    downBtn.appendChild(document.createTextNode(' '));
                    downBtn.appendChild(downSpan);
                }
                downSpan.textContent = String(downVal);
            } else if (downSpan) {
                downSpan.remove();
            }
        }
        oyButonRenklendir(card, tip);
    }

    function oyButonRenklendir(card, tip) {
        if (!card || !tip) return;
        var upBtn = card.querySelector('[data-vote="up"]');
        var downBtn = card.querySelector('[data-vote="down"]');
        if (upBtn) {
            upBtn.classList.toggle('applauded', tip === 'up');
        }
        if (downBtn) {
            downBtn.classList.toggle('disliked', tip === 'down');
        }
    }

    async function oyTikla(btn) {
        var id = btn.getAttribute('data-id');
        var tip = btn.getAttribute('data-vote');
        if (!id || !tip || oyDurumu(id)) {
            showToast(MSJ_ZATEN_OYLADIN);
            return;
        }

        var D = db();
        if (!D || !D.oyVer) {
            showToast('Oy servisi yüklenemedi.');
            return;
        }

        var card = document.getElementById('h-' + id);
        oyButonRenklendir(card, tip);
        btn.disabled = true;

        try {
            var sonuc = await D.oyVer(id, tip === 'up' ? 1 : -1);
            kartOyGuncelle(card, sonuc, tip);
            oyKaydet(id, tip);
            if (tip === 'up' && typeof global.confetti === 'function') {
                global.confetti({ particleCount: 50, spread: 60, origin: { y: 0.85 } });
            }
        } catch (err) {
            var mesaj = hataMesaji(err);
            if (zatenOyladinMi(mesaj)) {
                oyKaydet(id, tip);
                oyButonRenklendir(card, tip);
            }
            showToast(mesaj);
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
                    });
            });
            elCopy.addEventListener('click', function () {
                var aktif = paylasPaketOlustur(paylasAktifId);
                if (!aktif) return;
                paylasPanoyaYaz(aktif.paket, 'Metin ve link kopyalandı')
                    .catch(function () {
                        showToast(aktif.paket);
                    });
            });
        }

        backdrop.removeAttribute('hidden');
        backdrop.setAttribute('aria-hidden', 'false');
        backdrop.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function paylasTikla(id) {
        paylasSheetAc(id);
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

    async function baslat() {
        var D = db();
        if (!D || !D.isConfigured || !D.isConfigured()) {
            durumYaz('<p class="index-durum index-durum--hata">Veritabanı yapılandırılmadı.</p>');
            return;
        }
        await D.init();
        olaylariBagla();
        SAYFA = D.INDEX_SAYFA_BOYUT || 5;
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
