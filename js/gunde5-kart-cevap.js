/* gunde5 — kart altında tam metin + cevaplar (tek sayfa) */
(function (global) {
    var UI = global.Gunde5UI;
    var DB = global.Gunde5DB;

    var kartState = {};

    function esc(s) {
        return UI ? UI.htmlEsc(s) : String(s);
    }

    function injectStyles() {
        if (document.getElementById('gunde5-kart-cevap-styles')) return;
        var s = document.createElement('style');
        s.id = 'gunde5-kart-cevap-styles';
        s.textContent =
            '.card-body{position:relative;text-align:justify;text-justify:inter-word}' +
            '.card-body::before{content:"gunde5.com";position:absolute;inset:0;display:grid;place-items:center;transform:rotate(-32deg);font-size:clamp(1.9rem,9vw,2.75rem);font-weight:900;letter-spacing:-0.04em;line-height:1;color:#111827;opacity:0.08;pointer-events:none;z-index:0;user-select:none;white-space:nowrap}' +
            'body.dark-mode .card-body::before{color:#e7e9ea;opacity:0.09}' +
            '.card-body > *{position:relative;z-index:1}' +
            '.kart-detay{margin-top:12px;padding-top:12px;border-top:1px solid rgba(0,0,0,0.06)}' +
            'body.dark-mode .kart-detay{border-top-color:rgba(255,255,255,0.06)}' +
            '.card.uzun-metin .short-text{display:inline;transition:opacity .2s ease-in-out}' +
            '.card.uzun-metin.acik .short-text{display:none}' +
            '.card.uzun-metin .full-text{display:block;max-height:0;overflow:hidden;opacity:0;margin-top:0;' +
            'transition:max-height .3s ease-in-out,opacity .25s ease-in-out,margin .3s ease-in-out}' +
            '.card.uzun-metin.acik .full-text{max-height:4000px;opacity:1}' +
            '.card.uzun-metin.acik{transition:box-shadow .3s ease-in-out}' +
            '.card.uzun-metin .read-more--ac{transition:color .2s ease}' +
            '.kart-daralt-satir{width:100%;text-align:center;margin-top:10px}' +
            '.kart-daralt-satir--alt{margin-top:14px;padding-top:4px}' +
            'button.kart-daralt{display:inline-block;border:none;background:none;font-size:13px;font-weight:700;cursor:pointer;padding:8px 16px;color:var(--text-muted)}' +
            '.female button.kart-daralt{color:var(--female-color)}' +
            '.male button.kart-daralt{color:var(--male-color)}' +
            '.kart-cevap-sahip-not{margin:0 0 12px;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:600;line-height:1.45;color:var(--text-muted);background:var(--bg-main);border:1px dashed var(--border-color)}' +
            '.kart-cevap-form{margin-bottom:12px}' +
            '.kart-cevap-form textarea{width:100%;min-height:72px;border:1.5px solid var(--border-color);border-radius:12px;padding:10px 12px;font-size:14px;background:var(--bg-main);color:var(--text-main);resize:vertical;margin-bottom:8px}' +
            '.kart-cevap-form textarea:focus{outline:none;border-color:#1d9bf0}' +
            '.kart-cevap-gonder{width:100%;padding:10px;border:none;border-radius:12px;background:#1d9bf0;color:#fff;font-size:13px;font-weight:800;cursor:pointer}' +
            '.kart-cevap-gonder:disabled{opacity:0.6}' +
            '.kart-ic-cevap{background:var(--bg-main);border:1px solid var(--border-color);border-radius:12px;padding:10px 12px;margin-bottom:8px}' +
            '.kart-ic-cevap-ust{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px}' +
            '.kart-ic-rumuz{font-size:12px;font-weight:800}' +
            '.kart-ic-rumuz--female{color:var(--female-color)}' +
            '.kart-ic-rumuz--male{color:var(--male-color)}' +
            '.kart-ic-zaman{font-size:11px;color:var(--text-muted)}' +
            '.kart-ic-metin{font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word}' +
            '.kart-ic-yorum{margin-top:8px;padding:8px 10px;border-radius:8px;background:var(--bg-card);font-size:13px;line-height:1.4}' +
            '.kart-ic-yorum-rumuz{font-weight:800}' +
            '.kart-ic-yorum-rumuz--female{color:var(--female-color)}' +
            '.kart-ic-yorum-rumuz--male{color:var(--male-color)}' +
            '.kart-ic-alt{display:flex;gap:10px;margin-top:6px;flex-wrap:wrap}' +
            '.kart-ic-btn{border:none;background:none;color:#1d9bf0;font-size:12px;font-weight:800;cursor:pointer;padding:0}' +
            '.kart-ic-yorum-form{margin-top:8px}' +
            '.kart-ic-yorum-form textarea{width:100%;border:1px solid var(--border-color);border-radius:10px;padding:8px;font-size:13px;background:var(--bg-card);color:var(--text-main);margin-bottom:6px}' +
            '.kart-ic-yorum-gonder{padding:6px 12px;border:none;border-radius:8px;background:#1d9bf0;color:#fff;font-size:12px;font-weight:800;cursor:pointer}' +
            '.kart-cevap-daha{width:100%;margin-top:4px;padding:10px;border:1px dashed var(--border-color);border-radius:10px;background:transparent;color:var(--text-muted);font-size:12px;font-weight:700;cursor:pointer}' +
            '.kart-cevap-daha[hidden]{display:none!important}' +
            '.kart-cevap-bos{margin:0;font-size:13px;font-weight:600;color:var(--text-muted);text-align:center}' +
            'button.cevap-ozet{display:inline-block;margin-top:8px;border:none;background:none;font-size:12px;font-weight:700;cursor:pointer;padding:0}' +
            '.card-footer button.cevap-ozet,.card-footer--podyum button.cevap-ozet{margin-top:0}' +
            '.female button.cevap-ozet{color:var(--female-color)}' +
            '.male button.cevap-ozet{color:var(--male-color)}' +
            'button.read-more{border:none;background:none;font:inherit;cursor:pointer;padding:0}' +
            '.read-more--ac{display:block;width:100%;text-align:center;margin-top:8px}' +
            'a.read-more{text-decoration:none}';
        document.head.appendChild(s);
    }

    function getCard(cardId) {
        return document.querySelector('.card[data-id="' + cardId + '"]');
    }

    function guncelleReadBtn(card, acik) {
        if (!card) return;
        var btn = card.querySelector('.read-more--ac');
        if (btn) btn.textContent = acik ? 'Daralt' : 'Devamını oku';
    }

    function daraltKart(cardId, optCard) {
        var card = optCard || getCard(cardId);
        if (!card) return;
        var s = st(cardId);
        s.acik = false;
        card.classList.remove('acik');
        var detay = card.querySelector('[data-kart-detay]');
        if (detay) detay.hidden = true;
        guncelleReadBtn(card, false);
    }

    /** Tekli odak: aynı anda yalnızca bir kart açık. */
    function daraltDigerKartlari(haricCardId) {
        var aciklar = document.querySelectorAll('.card.acik[data-id]');
        var i;
        for (i = 0; i < aciklar.length; i++) {
            var c = aciklar[i];
            var id = c.getAttribute('data-id');
            if (id && id !== haricCardId) {
                daraltKart(id, c);
            }
        }
    }

    function st(cardId) {
        if (!kartState[cardId]) {
            kartState[cardId] = { cevapOffset: 0, cevapToplam: 0, yuklendi: false, acik: false };
        }
        return kartState[cardId];
    }

    function guncelleDahaEskiBtn(btn, kalan) {
        if (!btn) return;
        kalan = parseInt(kalan, 10) || 0;
        var goster = kalan > 0;
        btn.hidden = !goster;
        btn.style.display = goster ? 'block' : 'none';
        if (goster) btn.textContent = 'Daha eski cevaplar (' + kalan + ')';
    }

    function zamanKisa(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    async function yenileYorumOzeti(cardId) {
        var card = getCard(cardId);
        if (!card || !DB.itirafYorumToplam) return;
        var n = await DB.itirafYorumToplam(cardId);
        guncelleCevapOzet(card, n);
        return n;
    }

    function guncelleCevapOzet(card, adet) {
        if (!card) return;
        var n = parseInt(adet, 10) || 0;
        var fmt = UI && UI.formatSayac ? UI.formatSayac(n) : String(n);
        var sayi = card.querySelector('[data-cevap-sayi]');
        var yorumBtn = card.querySelector('[data-cevap-yaz]');
        if (sayi) {
            sayi.textContent = fmt;
            return;
        }
        var btn = card.querySelector('[data-cevap-ozet]');
        if (!btn) {
            if (n < 1 || !yorumBtn) return;
            yorumBtn.insertAdjacentHTML('beforeend', '<span class="kart-aksiyon-sayi" data-cevap-sayi="">' + fmt + '</span>');
            return;
        }
        if (n < 1) {
            btn.style.display = 'none';
            return;
        }
        btn.style.display = '';
        btn.textContent = n === 1 ? '1 yorum' : n + ' yorum';
    }

    function rumuzSinif(gender) {
        return gender === 'male' ? 'kart-ic-rumuz--male' : 'kart-ic-rumuz--female';
    }

    function yorumRumuzSinif(gender) {
        return gender === 'male' ? 'kart-ic-yorum-rumuz--male' : 'kart-ic-yorum-rumuz--female';
    }

    function yorumHtml(y) {
        return (
            '<div class="kart-ic-yorum"><span class="kart-ic-yorum-rumuz ' + yorumRumuzSinif(y.gender) + '">' +
            esc(y.username) + '</span> <span>' + esc(y.content) + '</span></div>'
        );
    }

    function cevapHtml(c) {
        return (
            '<article class="kart-ic-cevap" data-cevap-id="' + c.id + '">' +
            '<div class="kart-ic-cevap-ust"><span class="kart-ic-rumuz ' + rumuzSinif(c.gender) + '">' +
            esc(c.username) + '</span>' +
            '<time class="kart-ic-zaman">' + esc(zamanKisa(c.created_at)) + '</time></div>' +
            '<p class="kart-ic-metin">' + esc(c.content) + '</p>' +
            '<div class="kart-ic-yorumlar" data-yorum-liste="' + c.id + '"></div>' +
            '<div class="kart-ic-alt">' +
            '<button type="button" class="kart-ic-btn" data-yorum-ac="' + c.id + '">Yanıtla</button>' +
            '<button type="button" class="kart-ic-btn" data-yorum-daha="' + c.id + '" style="display:none"></button>' +
            '</div>' +
            '<div class="kart-ic-yorum-form" data-yorum-form="' + c.id + '" hidden>' +
            '<textarea rows="2" maxlength="2000" placeholder="Yanıtını yaz…"></textarea>' +
            '<button type="button" class="kart-ic-yorum-gonder" data-yorum-gonder="' + c.id + '">Gönder</button>' +
            '</div></article>'
        );
    }

    async function yorumlariYukle(cevapId, listeEl, sifirla) {
        var key = 'y' + cevapId;
        if (!listeEl._off) listeEl._off = 0;
        if (sifirla) listeEl._off = 0;
        var rows = await DB.yorumlariListele(cevapId, listeEl._off, DB.YORUM_SAYFA);
        if (sifirla) listeEl.innerHTML = '';
        var i;
        for (i = 0; i < rows.length; i++) {
            listeEl.insertAdjacentHTML('beforeend', yorumHtml(rows[i]));
        }
        listeEl._off += rows.length;
        var toplam = await DB.yorumToplam(cevapId);
        var daha = listeEl.closest('.kart-ic-cevap').querySelector('[data-yorum-daha="' + cevapId + '"]');
        if (daha) {
            var kalan = toplam - listeEl._off;
            if (kalan > 0) {
                daha.style.display = '';
                daha.textContent = kalan + ' yanıt daha';
            } else {
                daha.style.display = 'none';
            }
        }
    }

    function baglaCevapKart(kartEl, cevapId) {
        var blok = kartEl.querySelector('[data-cevap-id="' + cevapId + '"]');
        if (!blok || blok._bagli) return;
        blok._bagli = true;
        var ac = blok.querySelector('[data-yorum-ac="' + cevapId + '"]');
        var form = blok.querySelector('[data-yorum-form="' + cevapId + '"]');
        var gonder = blok.querySelector('[data-yorum-gonder="' + cevapId + '"]');
        var daha = blok.querySelector('[data-yorum-daha="' + cevapId + '"]');
        var liste = blok.querySelector('[data-yorum-liste="' + cevapId + '"]');

        ac.addEventListener('click', function () {
            if (!UI.uyeGirisUyarisi('Yorum yazmak için üye girişi yapmanız gerekiyor.')) {
                return;
            }
            form.hidden = !form.hidden;
            if (!form.hidden) form.querySelector('textarea').focus();
        });
        gonder.addEventListener('click', async function () {
            if (!UI.uyeGirisUyarisi('Yorum yazmak için üye girişi yapmanız gerekiyor.')) {
                return;
            }
            var metin = form.querySelector('textarea').value;
            gonder.disabled = true;
            try {
                await DB.cevapGonder(kartEl.getAttribute('data-id'), metin, cevapId);
                form.querySelector('textarea').value = '';
                form.hidden = true;
                await yorumlariYukle(cevapId, liste, true);
                await yenileYorumOzeti(kartEl.getAttribute('data-id'));
                UI.showToast('Yanıtın gönderildi.');
            } catch (err) {
                UI.showToast(DB.hataMesaji(err), 'hata');
            }
            gonder.disabled = false;
        });
        daha.addEventListener('click', function () {
            yorumlariYukle(cevapId, liste, false);
        });
    }

    async function kokCevaplariYukle(cardId, daha) {
        var card = getCard(cardId);
        if (!card) return;
        var liste = card.querySelector('[data-cevap-liste]');
        var dahaBtn = card.querySelector('[data-cevap-daha]');
        var s = st(cardId);
        if (!daha) {
            s.cevapOffset = 0;
            liste.innerHTML = '<p class="kart-cevap-bos" style="padding:12px 0">Yükleniyor…</p>';
        }
        var rows = await DB.kokCevaplariListele(cardId, s.cevapOffset, DB.CEVAP_SAYFA);
        if (!daha) liste.innerHTML = '';
        if (!rows.length && s.cevapOffset === 0) {
            liste.innerHTML = '<p class="kart-cevap-bos" style="padding:12px 0;font-size:13px">Henüz cevap yok.</p>';
        } else {
            var i;
            for (i = 0; i < rows.length; i++) {
                liste.insertAdjacentHTML('beforeend', cevapHtml(rows[i]));
                var yListe = liste.querySelector('[data-yorum-liste="' + rows[i].id + '"]');
                await yorumlariYukle(rows[i].id, yListe, true);
                baglaCevapKart(card, rows[i].id);
            }
            s.cevapOffset += rows.length;
        }
        s.cevapToplam = await DB.kokCevapToplam(cardId);
        await yenileYorumOzeti(cardId);
        guncelleDahaEskiBtn(dahaBtn, s.cevapToplam - s.cevapOffset);
        s.yuklendi = true;
        uygulaKokCevapKurali(card);
    }

    function itirafSahibiMi(card) {
        var itirafUid = card.getAttribute('data-itiraf-user-id');
        var u = DB.getGunde5User();
        return !!(itirafUid && u && u.id && itirafUid === u.id);
    }

    function uygulaKokCevapKurali(card) {
        if (!card) return;
        var sahip = itirafSahibiMi(card);
        var form = card.querySelector('.kart-cevap-form');
        var not = card.querySelector('[data-kok-cevap-yasak]');
        if (form) form.hidden = sahip;
        if (not) not.hidden = !sahip;
    }

    function baglaKart(card) {
        injectStyles();
        if (global.Gunde5Goruntulenme && global.Gunde5Goruntulenme.bagla) {
            global.Gunde5Goruntulenme.bagla(card);
        }
        uygulaKokCevapKurali(card);
        if (card._cevapBagli) return;
        card._cevapBagli = true;
        var cardId = card.getAttribute('data-id');
        var detay = card.querySelector('[data-kart-detay]');
        var kokGonder = card.querySelector('[data-kok-gonder]');
        var dahaBtn = card.querySelector('[data-cevap-daha]');

        var readBtns = card.querySelectorAll('[data-read-toggle]');
        readBtns.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                toggle(cardId, false);
            });
        });

        var cevapBtn = card.querySelector('[data-cevap-yaz]');
        if (cevapBtn) {
            cevapBtn.addEventListener('click', function (e) {
                e.preventDefault();
                toggle(cardId, true);
            });
        }
        var ozetBtn = card.querySelector('[data-cevap-ozet]');
        if (ozetBtn) {
            ozetBtn.addEventListener('click', function (e) {
                e.preventDefault();
                toggle(cardId, true);
            });
        }

        if (kokGonder) {
            kokGonder.addEventListener('click', async function () {
                if (!UI.uyeGirisUyarisi('Cevap yazmak için üye girişi yapmanız gerekiyor.')) {
                    return;
                }
                var ta = card.querySelector('[data-kok-metin]');
                kokGonder.disabled = true;
                try {
                    await DB.cevapGonder(cardId, ta.value, null);
                    ta.value = '';
                    st(cardId).cevapOffset = 0;
                    await kokCevaplariYukle(cardId, false);
                    UI.showToast('Cevabın gönderildi.');
                } catch (err) {
                    UI.showToast(DB.hataMesaji(err), 'hata');
                }
                kokGonder.disabled = false;
            });
        }
        if (dahaBtn) {
            dahaBtn.addEventListener('click', function () {
                kokCevaplariYukle(cardId, true);
            });
        }
    }

    async function toggle(cardId, focusCevap) {
        injectStyles();
        var card = getCard(cardId);
        if (!card) return;
        baglaKart(card);
        var s = st(cardId);
        var detay = card.querySelector('[data-kart-detay]');

        if (focusCevap && !s.acik) {
            if (!UI.uyeGirisUyarisi('Yorum yazmak için üye girişi yapmanız gerekiyor.')) {
                return;
            }
        }

        if (s.acik) {
            daraltKart(cardId, card);
            return;
        }

        daraltDigerKartlari(cardId);
        s.acik = true;
        card.classList.add('acik');
        guncelleReadBtn(card, true);
        detay.hidden = false;
        uygulaKokCevapKurali(card);
        if (!s.yuklendi) {
            var dahaBtn = card.querySelector('[data-cevap-daha]');
            if (dahaBtn) guncelleDahaEskiBtn(dahaBtn, 0);
            await kokCevaplariYukle(cardId, false);
        }
        if (focusCevap) {
            if (itirafSahibiMi(card)) {
                var yanitBtn = card.querySelector('[data-yorum-ac]');
                if (yanitBtn) {
                    yanitBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } else {
                var ta = card.querySelector('[data-kok-metin]');
                if (ta && !ta.closest('[hidden]')) {
                    ta.focus();
                    ta.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }
    }

    function initSayfa() {
        injectStyles();
        document.querySelectorAll('.card[data-id]').forEach(baglaKart);
    }

    global.Gunde5KartCevap = {
        toggle: toggle,
        initSayfa: initSayfa,
        baglaKart: baglaKart,
        injectStyles: injectStyles,
        guncelleCevapOzet: guncelleCevapOzet
    };
    global.toggleKartDetay = toggle;
    injectStyles();
})(window);
