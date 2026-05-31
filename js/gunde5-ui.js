/* gunde5 — ortak arayüz yardımcıları */
(function (global) {
    function htmlEsc(s) {
        var d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }

    function metinGoster(s) {
        var t = s == null ? '' : String(s);
        if (global.Gunde5Perde && global.Gunde5Perde.metinPerdele) {
            t = global.Gunde5Perde.metinPerdele(t);
        }
        return htmlEsc(t);
    }

    function metinBol(metin) {
        var m = String(metin || '');
        if (m.length <= 140) {
            return { kisa: m, devam: false };
        }
        return { kisa: m.slice(0, 140) + '...', devam: true, devami: m.slice(140) };
    }

    function kullaniciMetaSatir(row) {
        if (global.Gunde5Profil && global.Gunde5Profil.kartMetaSatir) {
            return global.Gunde5Profil.kartMetaSatir(row);
        }
        return row && row.age ? row.age + ' Yaş' : '';
    }

    function kullaniciMetaHtml(row) {
        var meta = kullaniciMetaSatir(row);
        if (!meta) return '';
        return '<span class="user-meta">' + htmlEsc(meta) + '</span>';
    }

    function kartMetaDataAttr(kart, row) {
        if (!kart || !row) return;
        if (row.age != null && row.age !== '') {
            kart.setAttribute('data-itiraf-age', String(row.age));
        }
        if (row.gender) {
            kart.setAttribute('data-itiraf-gender', row.gender === 'male' ? 'male' : 'female');
        }
        if (row.yasadigi_yer) {
            kart.setAttribute('data-itiraf-yer', String(row.yasadigi_yer));
        } else {
            kart.removeAttribute('data-itiraf-yer');
        }
        if (row.yurtdisi_sehir) {
            kart.setAttribute('data-itiraf-yurtdisi', String(row.yurtdisi_sehir));
        } else {
            kart.removeAttribute('data-itiraf-yurtdisi');
        }
    }

    var TOAST_UYE_MS = 9000;

    function injectToastStyles() {
        if (document.getElementById('gunde5-toast-styles')) return;
        var s = document.createElement('style');
        s.id = 'gunde5-toast-styles';
        s.textContent =
            '.gunde5-toast{display:none;position:fixed;left:50%;top:50%;right:auto;bottom:auto;transform:translate(-50%,-50%);width:calc(100% - 32px);max-width:400px;margin:0;padding:12px 16px;border-radius:14px;background:#111827;color:#fff;font-size:13px;font-weight:700;text-align:center;z-index:3500;box-shadow:0 12px 40px rgba(0,0,0,.28)}' +
            '.gunde5-toast--hata{background:#991b1b}' +
            '.gunde5-toast--uye{max-width:360px;padding:14px 16px 12px;text-align:center}' +
            '.gunde5-toast--uye .gunde5-toast-metin{display:block;font-size:13px;font-weight:700;line-height:1.45;margin-bottom:12px}' +
            '.gunde5-toast--uye .gunde5-toast-aksiyonlar{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}' +
            '.gunde5-toast--uye .gunde5-toast-btn{flex:1;min-width:118px;max-width:168px;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;border:none;font-family:inherit}' +
            '.gunde5-toast--uye .gunde5-toast-btn--giris{background:#1d9bf0;color:#fff}' +
            '.gunde5-toast--uye .gunde5-toast-btn--kayit{background:#fff;color:#1d9bf0;border:2px solid #1d9bf0}' +
            'body.dark-mode .gunde5-toast--uye .gunde5-toast-btn--kayit{background:transparent;color:#60a5fa;border-color:#60a5fa}';
        document.head.appendChild(s);
    }

    function toastElAl() {
        injectToastStyles();
        var el = document.getElementById('gunde5Toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'gunde5Toast';
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
        }
        return el;
    }

    function showToastUyeGerekli(mesaj) {
        var el = toastElAl();
        clearTimeout(el._g5t);
        el.className = 'gunde5-toast gunde5-toast--uye gunde5-toast--hata';
        el.innerHTML =
            '<span class="gunde5-toast-metin">' +
            htmlEsc(mesaj) +
            '</span>' +
            '<div class="gunde5-toast-aksiyonlar">' +
            '<button type="button" class="gunde5-toast-btn gunde5-toast-btn--giris" data-g5-auth="login">Giriş yap</button>' +
            '<button type="button" class="gunde5-toast-btn gunde5-toast-btn--kayit" data-g5-auth="register">Kayıt ol</button>' +
            '</div>';
        el.style.display = 'block';
        if (!el._g5uyeBagli) {
            el._g5uyeBagli = true;
            el.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-g5-auth]');
                if (!btn) return;
                var mode = btn.getAttribute('data-g5-auth');
                el.style.display = 'none';
                el.innerHTML = '';
                if (typeof global.openAuthModal === 'function') {
                    global.openAuthModal(mode === 'register' ? 'register' : 'login');
                }
            });
        }
        el._g5t = setTimeout(function () {
            el.style.display = 'none';
            el.innerHTML = '';
        }, TOAST_UYE_MS);
    }

    function uyeGirisUyarisi(mesaj) {
        if (uyeMi()) return true;
        showToastUyeGerekli(
            mesaj || 'Bu işlem için üye girişi yapmanız gerekiyor.'
        );
        return false;
    }

    function showToast(mesaj, tip) {
        var el = toastElAl();
        el.className = 'gunde5-toast' + (tip === 'hata' ? ' gunde5-toast--hata' : '');
        el.textContent = mesaj;
        el.style.display = 'block';
        clearTimeout(el._g5t);
        el._g5t = setTimeout(function () {
            el.style.display = 'none';
        }, 3200);
    }

    function bosListe(mesaj) {
        return '<p class="liste-bos">' + htmlEsc(mesaj) + '</p>';
    }

    function bosListeHtml(html) {
        return '<p class="liste-bos">' + html + '</p>';
    }

    var LINK_INDEX = '<a href="/" class="sayfa-link">Anasayfa</a>';
    var LINK_PODYUM = '<a href="/podyum" class="sayfa-link">Podyum</a>';

    function podyumBosMesajiHtml() {
        injectSayfaLinkStyles();
        return bosListeHtml('Henüz podyum hikayesi yok. ' + LINK_INDEX + '\'te yeni hikayelere göz at!');
    }

    function injectSayfaLinkStyles() {
        var css =
            '.sayfa-link{color:inherit;font-weight:700;text-decoration:underline;text-underline-offset:2px}' +
            '.sayfa-link:hover{opacity:0.88}' +
            '.saat-vurgu{font-weight:900;color:#d97706;font-variant-numeric:tabular-nums;letter-spacing:0.03em}' +
            'body.dark-mode .saat-vurgu{color:#fbbf24}' +
            '.info-banner .saat-vurgu{color:#b45309}' +
            'body.dark-mode .info-banner .saat-vurgu{color:#fbbf24}';
        var s = document.getElementById('gunde5-sayfa-link-styles');
        if (!s) {
            s = document.createElement('style');
            s.id = 'gunde5-sayfa-link-styles';
            document.head.appendChild(s);
        }
        s.textContent = css;
    }

    function kartDetayShell() {
        return (
            '<div class="kart-detay" data-kart-detay hidden>' +
            '<p class="kart-cevap-sahip-not" data-kok-cevap-yasak hidden>Kendi hikayene doğrudan cevap yazılamaz. Başkalarının cevaplarına &quot;Yanıtla&quot; ile yazabilirsin.</p>' +
            '<div class="kart-cevap-form">' +
            '<textarea data-kok-metin rows="3" maxlength="2000" placeholder="Cevabını yaz…"></textarea>' +
            '<button type="button" class="kart-cevap-gonder" data-kok-gonder>Gönder</button>' +
            '</div>' +
            '<div data-cevap-liste></div>' +
            '<button type="button" class="kart-cevap-daha" data-cevap-daha hidden>Daha eski cevaplar</button>' +
            '<div class="kart-daralt-satir kart-daralt-satir--alt">' +
            '<button type="button" class="kart-daralt" data-read-toggle>Daralt</button>' +
            '</div>' +
            '</div>'
        );
    }

    function cevapOzetBtnHtml(adet, herZamanGoster) {
        var n = parseInt(adet, 10) || 0;
        var lbl = n === 1 ? '1 yorum' : n + ' yorum';
        var stil = !herZamanGoster && n < 1 ? ' style="display:none"' : '';
        return '<button type="button" class="cevap-ozet" data-cevap-ozet' + stil + '>' + htmlEsc(lbl) + '</button>';
    }

    function devamBtnHtml(devam) {
        if (!devam) return '';
        return '<button type="button" class="read-more read-more--ac" data-read-toggle>Devamını oku</button>';
    }

    var sikayetItirafId = null;

    function cardMenuBtnHtml(kartId) {
        return '<span class="kart-marka" aria-hidden="true">gunde5.com</span>' +
            '<button type="button" class="card-menu-btn" onclick="acSikayetModal(\'' + kartId + '\')" aria-label="Şikayet et" title="Şikayet et"><span class="card-menu-dots" aria-hidden="true">&#8942;</span></button>';
    }

    function formatSayac(n) {
        n = parseInt(n, 10) || 0;
        if (n >= 1000000) {
            var mn = n / 1000000;
            return (mn >= 10 ? Math.round(mn) : mn.toFixed(1).replace('.', ',')) + ' Mn';
        }
        if (n >= 1000) {
            var b = n / 1000;
            return (b >= 10 ? Math.round(b) : b.toFixed(1).replace('.', ',')) + ' B';
        }
        return String(n);
    }

    function sayiSpan(n, extraClass, dataAttrName) {
        n = parseInt(n, 10);
        if (isNaN(n) || n < 0) n = 0;
        var cls = 'kart-aksiyon-sayi' + (extraClass ? ' ' + extraClass : '');
        var attr = dataAttrName ? ' ' + dataAttrName + '=""' : '';
        return '<span class="' + cls + '"' + attr + '>' + formatSayac(n) + '</span>';
    }

    function ikonSvg(path, filled) {
        var fill = filled ? 'currentColor' : 'none';
        var stroke = filled ? 'none' : 'currentColor';
        var sw = filled ? '' : ' stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
        return '<span class="kart-aksiyon-ikon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="' + fill + '" stroke="' + stroke + '"' + sw + '>' + path + '</svg></span>';
    }

    var IKON_YORUM = '<path d="M12 21a9 9 0 1 0-8.5-6.2L3 21l6.2-1.5A8.96 8.96 0 0 0 12 21z"/>';

    function oyEmojiHtml(emoji) {
        return '<span class="kart-aksiyon-emoji" aria-hidden="true">' + emoji + '</span>';
    }
    var IKON_GORUNTULENME = '<path d="M3 19V9h2v10H3zm4 0V5h2v14H7zm4 0v-7h2v7h-2zm4 0V3h2v16h-2zm4 0v-6h2v6h-2z"/>';
    /** false: görüntülenme çubuğu yerinde kalır, görünmez; ileride true yap. */
    var SAYFA_GORUNTULENME_GORUNUR = false;
    var IKON_KAYDET = '<path d="M6 4h12v16l-6-4-6 4V4z"/>';
    var IKON_PAYLAS = '<path d="M12 5v14"/><path d="M7 10l5-5 5 5"/><path d="M5 19v2h14v-2"/>';

    function getKaydedilenIds() {
        try {
            var raw = global.localStorage.getItem('gunde5_kaydedilenler');
            var arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr.map(String) : [];
        } catch (e) {
            return [];
        }
    }

    function isItirafKayitli(itirafId) {
        return getKaydedilenIds().indexOf(String(itirafId)) >= 0;
    }

    function toggleKaydet(itirafId, btn) {
        if (!uyeGirisUyarisi('Kaydetmek için üye girişi yapmanız gerekiyor.')) {
            return;
        }
        var sid = String(itirafId);
        var ids = getKaydedilenIds();
        var i = ids.indexOf(sid);
        if (i >= 0) {
            ids.splice(i, 1);
            showToast('Kayıttan çıkarıldı.');
        } else {
            ids.push(sid);
            showToast('Kaydedildi.');
        }
        global.localStorage.setItem('gunde5_kaydedilenler', JSON.stringify(ids));
        if (btn) btn.classList.toggle('aktif', i < 0);
    }

    function toggleKaydetFromCard(btn) {
        var card = btn && btn.closest ? btn.closest('.card') : null;
        if (!card) return;
        toggleKaydet(card.getAttribute('data-id'), btn);
    }

    global.toggleKaydetFromCard = toggleKaydetFromCard;

    function kartOyDurumuRenklendir(card, tip) {
        if (!card) return;
        var upBtn = card.querySelector('[data-vote="up"]') || card.querySelector('.kart-aksiyon--begeni');
        var downBtn = card.querySelector('[data-vote="down"]') || card.querySelector('.kart-aksiyon--begenme');
        if (upBtn) {
            upBtn.classList.toggle('applauded', tip === 'up');
            upBtn.classList.toggle('aktif', tip === 'up');
        }
        if (downBtn) {
            downBtn.classList.toggle('disliked', tip === 'down');
            downBtn.classList.toggle('aktif', tip === 'down');
        }
    }

    function kartOyArayuzunuGuncelle(card, sonuc) {
        if (!card || !sonuc) return;
        var upEl = card.querySelector('.up-num');
        var downEl = card.querySelector('.down-num');
        if (upEl) upEl.textContent = formatSayac(sonuc.up_votes);
        if (downEl) downEl.textContent = formatSayac(sonuc.down_votes);
        var o = sonuc.oy;
        if (o === 1) kartOyDurumuRenklendir(card, 'up');
        else if (o === -1) kartOyDurumuRenklendir(card, 'down');
    }

    /** Podyum hibrit canlandırma: yalnızca sayıları günceller (oy düğmesi durumu değişmez). */
    function kartPodyumIstatistikEnjekteEt(card, istatistik) {
        if (!card || !istatistik) return;
        function tikla(span) {
            if (!span) return;
            span.classList.remove('g5-stat-tick');
            void span.offsetWidth;
            span.classList.add('g5-stat-tick');
            setTimeout(function () {
                span.classList.remove('g5-stat-tick');
            }, 220);
        }
        if (istatistik.up_votes !== undefined) {
            var upEl = card.querySelector('.up-num');
            if (upEl) {
                tikla(upEl);
                upEl.textContent = formatSayac(istatistik.up_votes);
            }
        }
        if (istatistik.down_votes !== undefined) {
            var downEl = card.querySelector('.down-num');
            if (downEl) {
                tikla(downEl);
                downEl.textContent = formatSayac(istatistik.down_votes);
            }
        }
        if (istatistik.cevap_sayisi !== undefined || istatistik.comment_count !== undefined) {
            var c = istatistik.cevap_sayisi !== undefined ? istatistik.cevap_sayisi : istatistik.comment_count;
            var cevapEl = card.querySelector('[data-cevap-sayi]');
            if (cevapEl) {
                tikla(cevapEl);
                cevapEl.textContent = formatSayac(c);
            }
        }
    }

    function injectKartAksiyonStyles() {
        var css =
            '.card-footer{padding-top:10px;border-top:1px solid rgba(0,0,0,0.06)}' +
            'body.dark-mode .card-footer{border-top-color:rgba(255,255,255,0.06)}' +
            '.kart-aksiyonlar{display:flex;align-items:center;justify-content:space-between;width:100%;gap:2px}' +
            '.kart-aksiyon{display:inline-flex;align-items:center;gap:4px;border:none;background:transparent;color:var(--text-muted);padding:8px;margin:0;border-radius:999px;cursor:pointer;font-size:16px;font-weight:400;font-family:inherit;line-height:1;transition:color .15s ease,background .15s ease}' +
            '.kart-aksiyon:hover{color:#1d9bf0;background:rgba(29,155,240,0.1)}' +
            '.kart-aksiyon--begeni:hover,.kart-aksiyon--begenme:hover{background:rgba(0,0,0,0.05)}' +
            'body.dark-mode .kart-aksiyon--begeni:hover,body.dark-mode .kart-aksiyon--begenme:hover{background:rgba(255,255,255,0.08)}' +
            '.kart-aksiyon--begeni.aktif{background:#22c55e;color:#fff}' +
            'body.dark-mode .kart-aksiyon--begeni.aktif{background:#16a34a;color:#fff}' +
            '.kart-aksiyon--begeni.aktif .kart-aksiyon-etiket,.kart-aksiyon--begeni.aktif .kart-aksiyon-sayi{color:#fff}' +
            '.kart-aksiyon--begenme.aktif{background:#f97316;color:#fff}' +
            'body.dark-mode .kart-aksiyon--begenme.aktif{background:#fb923c;color:#fff}' +
            '.kart-aksiyon--begenme.aktif .kart-aksiyon-etiket,.kart-aksiyon--begenme.aktif .kart-aksiyon-sayi{color:#fff}' +
            '.kart-aksiyon-emoji{font-size:18px;line-height:1;display:inline-flex;align-items:center;justify-content:center;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif}' +
            '.kart-aksiyon--kaydet:hover,.kart-aksiyon--kaydet.aktif{color:#1d9bf0}' +
            '.kart-aksiyon--kaydet.aktif svg{fill:currentColor;stroke:currentColor}' +
            '.kart-aksiyon--goruntulenme{cursor:default;pointer-events:none}' +
            '.kart-aksiyon--goruntulenme:hover{color:var(--text-muted);background:transparent}' +
            (SAYFA_GORUNTULENME_GORUNUR ? '' : '.kart-aksiyon--goruntulenme{visibility:hidden}') +
            '.kart-aksiyon-sayi{font-variant-numeric:tabular-nums;min-width:1ch;font-size:16px;font-weight:400;color:var(--text-muted);transition:transform .2s ease,color .2s ease}' +
            '.kart-aksiyon-sayi.g5-stat-tick{transform:scale(1.1);color:var(--text-main)}' +
            '.kart-aksiyon--begeni .kart-aksiyon-etiket,.kart-aksiyon--begenme .kart-aksiyon-etiket{font-size:12px;font-weight:700;color:var(--text-main);white-space:nowrap}' +
            '.kart-aksiyon-ikon{display:inline-flex;width:18px;height:18px;flex-shrink:0}' +
            '.kart-aksiyon-ikon svg{width:18px;height:18px;display:block}';
        var s = document.getElementById('gunde5-kart-aksiyon-styles');
        if (!s) {
            s = document.createElement('style');
            s.id = 'gunde5-kart-aksiyon-styles';
            document.head.appendChild(s);
        }
        s.textContent = css;
    }

    function kartAksiyonBarHtml(kartId, up, down, cevapSayisi, goruntulenme) {
        injectKartAksiyonStyles();
        var kayitliCls = isItirafKayitli(kartId) ? ' aktif' : '';
        var upN = up != null ? up : 0;
        var downN = down != null ? down : 0;
        var cevapN = cevapSayisi != null ? cevapSayisi : 0;
        var gorN = goruntulenme != null ? goruntulenme : 0;
        var D = global.Gunde5DB;
        var oyTip = D && D.oyDurumuOku ? D.oyDurumuOku(kartId) : null;
        var begeniCls = oyTip === 'up' ? ' aktif' : '';
        var begenmeCls = oyTip === 'down' ? ' aktif' : '';
        return (
            '<div class="kart-aksiyonlar">' +
                '<button type="button" class="kart-aksiyon kart-aksiyon--yorum" data-cevap-yaz aria-label="Yorumlar">' +
                    ikonSvg(IKON_YORUM, false) +
                    sayiSpan(cevapN, '', 'data-cevap-sayi') +
                '</button>' +
                '<button type="button" class="kart-aksiyon kart-aksiyon--begeni' + begeniCls + '" onclick="vote(\'' + kartId + '\', 1)" aria-label="Beğendim">' +
                    oyEmojiHtml('\u2764\uFE0F') +
                    '<span class="kart-aksiyon-etiket">Beğendim</span>' +
                    sayiSpan(upN, 'up-num', '') +
                '</button>' +
                '<button type="button" class="kart-aksiyon kart-aksiyon--begenme' + begenmeCls + '" onclick="vote(\'' + kartId + '\', -1)" aria-label="Beğenmedim">' +
                    oyEmojiHtml('\uD83D\uDC4E') +
                    '<span class="kart-aksiyon-etiket">Beğenmedim</span>' +
                    sayiSpan(downN, 'down-num', '') +
                '</button>' +
                '<span class="kart-aksiyon kart-aksiyon--goruntulenme"' +
                    (SAYFA_GORUNTULENME_GORUNUR ? ' aria-label="Sayfa görüntülenmesi"' : ' aria-hidden="true"') +
                    '>' +
                    ikonSvg(IKON_GORUNTULENME, true) +
                    '<span class="kart-aksiyon-sayi v-num" data-sayfa-goruntulenme>' + formatSayac(gorN) + '</span>' +
                '</span>' +
                '<button type="button" class="kart-aksiyon kart-aksiyon--kaydet' + kayitliCls + '" onclick="toggleKaydetFromCard(this)" aria-label="Kaydet" aria-pressed="' + (kayitliCls ? 'true' : 'false') + '">' +
                    ikonSvg(IKON_KAYDET, false) +
                '</button>' +
                '<button type="button" class="kart-aksiyon kart-aksiyon--paylas" onclick="paylasItirafFromCard(this)" aria-label="Paylaş">' +
                    ikonSvg(IKON_PAYLAS, false) +
                '</button>' +
            '</div>'
        );
    }

    function injectSikayetStyles() {
        if (document.getElementById('gunde5-sikayet-styles')) return;
        var s = document.createElement('style');
        s.id = 'gunde5-sikayet-styles';
        s.textContent =
            '.card-header{gap:12px}' +
            '.card-header-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:4px}' +
            '.kart-marka{font-size:14px;font-weight:800;letter-spacing:-0.02em;color:var(--text-muted);opacity:0.88;white-space:nowrap;user-select:none;line-height:1}' +
            'body.dark-mode .kart-marka{opacity:0.72}' +
            '.view-counter{display:inline-flex;align-items:center;gap:5px;flex-shrink:0;white-space:nowrap;font-size:11px;font-weight:700;color:var(--text-muted);padding:6px 11px;border-radius:14px;background:rgba(17,24,39,0.05);border:1px solid var(--border-color);line-height:1}' +
            'body.dark-mode .view-counter{background:rgba(255,255,255,0.06)}' +
            '.card-menu-btn{width:36px;height:36px;padding:0;border:1px solid var(--border-color);border-radius:50%;background:var(--bg-card);color:var(--text-muted);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}' +
            '.card-menu-btn:active{transform:scale(0.94)}' +
            '.card-menu-dots{font-size:20px;line-height:1;font-weight:900;letter-spacing:0}' +
            '.sikayet-modal{position:fixed;inset:0;z-index:2200;background:rgba(17,24,39,0.32);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .22s ease,visibility .22s ease}' +
            '.sikayet-modal.acik{opacity:1;visibility:visible;pointer-events:auto}' +
            '.sikayet-modal-panel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:calc(100% - 32px);max-width:400px;max-height:90vh;overflow-y:auto;background:#fff;border:1px solid #f3f4f6;border-radius:20px;padding:20px 18px 18px;box-shadow:0 10px 36px rgba(0,0,0,.12)}' +
            'body.dark-mode .sikayet-modal-panel{background:var(--bg-card);border-color:var(--border-color)}' +
            '.sikayet-modal-ust{position:relative;padding-right:36px;margin-bottom:14px}' +
            '.sikayet-modal-baslik{font-size:17px;font-weight:800;color:var(--text-main)}' +
            '.sikayet-modal-alt{font-size:12px;color:var(--text-muted);font-weight:500;margin-top:4px;line-height:1.45}' +
            '.sikayet-modal-kapat{position:absolute;top:0;right:0;width:32px;height:32px;border:1px solid #f3f4f6;border-radius:50%;background:#fff;color:#6b7280;font-size:20px;line-height:1;cursor:pointer}' +
            'body.dark-mode .sikayet-modal-kapat{background:var(--bg-main);border-color:var(--border-color);color:var(--text-muted)}' +
            '.sikayet-etiket{display:block;font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px}' +
            '.sikayet-select,.sikayet-textarea{display:block;width:100%;padding:12px 14px;border:1.5px solid var(--border-color);border-radius:12px;background:var(--bg-main);color:var(--text-main);font-size:14px;font-weight:500;outline:none;margin-bottom:14px}' +
            '.sikayet-select{cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath fill=\'%236b7280\' d=\'M1 1l5 5 5-5\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px}' +
            '.sikayet-textarea{min-height:88px;resize:vertical}' +
            '.sikayet-modal-alt-satir{display:flex;gap:10px;justify-content:flex-end}' +
            '.sikayet-btn{padding:12px 18px;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;border:none}' +
            '.sikayet-btn--iptal{background:var(--bg-main);border:1px solid var(--border-color);color:var(--text-main)}' +
            '.sikayet-btn--gonder{background:#f4212e;color:#fff}';
        document.head.appendChild(s);
    }

    function ensureSikayetModal() {
        if (document.getElementById('sikayetModal')) return;
        var wrap = document.createElement('div');
        wrap.id = 'sikayetModal';
        wrap.className = 'sikayet-modal';
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'true');
        wrap.setAttribute('aria-labelledby', 'sikayetModalBaslik');
        wrap.setAttribute('aria-hidden', 'true');
        wrap.innerHTML =
            '<div class="sikayet-modal-panel">' +
            '<div class="sikayet-modal-ust">' +
            '<h2 class="sikayet-modal-baslik" id="sikayetModalBaslik">Şikayet Et</h2>' +
            '<p class="sikayet-modal-alt">Bu hikayeyi neden uygunsuz bulduğunu seç. Ekibimiz inceler.</p>' +
            '<button type="button" class="sikayet-modal-kapat" onclick="kapatSikayetModal()" aria-label="Kapat">×</button>' +
            '</div>' +
            '<label class="sikayet-etiket" for="sikayetSebep">Sebep</label>' +
            '<select class="sikayet-select" id="sikayetSebep">' +
            '<option value="">Seçiniz</option>' +
            '<option value="spam">Spam veya reklam</option>' +
            '<option value="taciz">Taciz veya nefret</option>' +
            '<option value="kisisel_veri">Kişisel veri / mahremiyet</option>' +
            '<option value="telif">Telif veya yasadışı içerik</option>' +
            '<option value="diger">Diğer</option>' +
            '</select>' +
            '<label class="sikayet-etiket" for="sikayetAciklama">Açıklama (isteğe bağlı)</label>' +
            '<textarea class="sikayet-textarea" id="sikayetAciklama" maxlength="500" placeholder="Kısaca anlat…"></textarea>' +
            '<div class="sikayet-modal-alt-satir">' +
            '<button type="button" class="sikayet-btn sikayet-btn--iptal" onclick="kapatSikayetModal()">İptal</button>' +
            '<button type="button" class="sikayet-btn sikayet-btn--gonder" id="sikayetGonderBtn" onclick="gonderSikayet()">Gönder</button>' +
            '</div></div>';
        document.body.appendChild(wrap);
        wrap.addEventListener('click', function (e) {
            if (e.target === wrap) kapatSikayetModal();
        });
    }

    function acSikayetModal(itirafId) {
        if (!uyeGirisUyarisi('Şikayet etmek için üye girişi yapmanız gerekiyor.')) {
            return;
        }
        injectSikayetStyles();
        ensureSikayetModal();
        sikayetItirafId = String(itirafId);
        var sebep = document.getElementById('sikayetSebep');
        var aciklama = document.getElementById('sikayetAciklama');
        if (sebep) sebep.value = '';
        if (aciklama) aciklama.value = '';
        var modal = document.getElementById('sikayetModal');
        modal.classList.add('acik');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function authModalAcikMi() {
        var overlay = document.getElementById('authOverlay');
        if (!overlay) return false;
        return overlay.style.display === 'flex' || overlay.classList.contains('acik');
    }

    function hikayeModalEl() {
        return document.getElementById('itirafModal') || document.getElementById('hikayeModal');
    }

    function itirafModalAcikMi() {
        var modal = hikayeModalEl();
        return !!(modal && modal.classList.contains('acik'));
    }

    function guncelleModalScrollKilidi() {
        document.body.style.overflow = (authModalAcikMi() || itirafModalAcikMi()) ? 'hidden' : '';
    }

    function closeAuthModal() {
        var overlay = document.getElementById('authOverlay');
        if (!overlay) return;
        overlay.style.display = 'none';
        overlay.classList.remove('acik');
        overlay.setAttribute('aria-hidden', 'true');
        guncelleModalScrollKilidi();
    }

    function kapatItirafModal() {
        var modal = hikayeModalEl();
        if (!modal) return;
        modal.classList.remove('acik');
        modal.setAttribute('aria-hidden', 'true');
        guncelleModalScrollKilidi();
    }

    function kapatHikayeModal() {
        kapatItirafModal();
    }

    function acHikayeModal() {
        var modal = hikayeModalEl();
        if (!modal) return;
        modal.classList.add('acik');
        modal.setAttribute('aria-hidden', 'false');
        guncelleModalScrollKilidi();
    }

    function oturumModallariKapat() {
        closeAuthModal();
        kapatItirafModal();
    }

    global.closeAuthModal = closeAuthModal;
    global.kapatItirafModal = kapatItirafModal;
    global.kapatHikayeModal = kapatHikayeModal;
    global.oturumModallariKapat = oturumModallariKapat;

    function kapatSikayetModal() {
        var modal = document.getElementById('sikayetModal');
        if (!modal) return;
        modal.classList.remove('acik');
        modal.setAttribute('aria-hidden', 'true');
        sikayetItirafId = null;
        guncelleModalScrollKilidi();
    }

    async function gonderSikayet() {
        if (!sikayetItirafId) return;
        var db = global.Gunde5DB;
        if (!db || !db.sikayetGonder) {
            showToast('Şikayet şu an gönderilemiyor.', 'hata');
            return;
        }
        if (!uyeGirisUyarisi('Şikayet etmek için üye girişi yapmanız gerekiyor.')) {
            kapatSikayetModal();
            return;
        }
        var sebep = document.getElementById('sikayetSebep').value;
        var aciklama = document.getElementById('sikayetAciklama').value;
        var btn = document.getElementById('sikayetGonderBtn');
        if (btn) btn.disabled = true;
        try {
            await db.sikayetGonder(sikayetItirafId, sebep, aciklama);
            kapatSikayetModal();
            showToast('Şikayetin alındı, teşekkürler.');
        } catch (err) {
            showToast(db.hataMesaji ? db.hataMesaji(err) : String(err), 'hata');
        }
        if (btn) btn.disabled = false;
    }

    global.acSikayetModal = acSikayetModal;
    global.kapatSikayetModal = kapatSikayetModal;
    global.gonderSikayet = gonderSikayet;

    var podyumRozet = ['\uD83D\uDC51 Günün 1.si', '\uD83E\uDD48 Günün 2.si', '\uD83E\uDD49 Günün 3.si', 'Günün 4.si', 'Günün 5.si'];

    function podyumDonemTarihMs(donem) {
        var s = String(donem || '').trim();
        var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) {
            return Date.UTC(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
        }
        var tr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (tr) {
            return Date.UTC(parseInt(tr[3], 10), parseInt(tr[2], 10) - 1, parseInt(tr[1], 10));
        }
        var tr2 = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (tr2) {
            return Date.UTC(parseInt(tr2[3], 10), parseInt(tr2[2], 10) - 1, parseInt(tr2[1], 10));
        }
        return 0;
    }

    function podyumDonemleriKronolojikSirala(donemler) {
        return (donemler || []).slice().sort(function (a, b) {
            return podyumDonemTarihMs(b) - podyumDonemTarihMs(a);
        });
    }

    function kartBaslikHtml(row) {
        var b = row && row.baslik ? String(row.baslik).replace(/^\s+|\s+$/g, '') : '';
        if (!b) return '';
        return '<span class="kart-baslik">' + htmlEsc(b) + '</span>';
    }

    function renderPodyumCard(row, sira) {
        var cins = row.gender === 'male' ? 'male' : 'female';
        var rumuz = row.username || 'Müdavim';
        var bol = metinBol(row.content_full || row.content_short || '');
        var kartId = String(row.id);
        var siraIdx = sira;
        if (siraIdx == null || isNaN(siraIdx)) {
            siraIdx = Math.max(0, (parseInt(row.podyum_sira, 10) || 1) - 1);
        }
        var rozet = podyumRozet[siraIdx] || podyumRozet[4];
        var goruntulenme = row.sayfa_goruntulenme != null ? row.sayfa_goruntulenme : 0;
        var up = row.up_votes != null ? row.up_votes : 0;
        var down = row.down_votes != null ? row.down_votes : 0;
        var devamHtml = devamBtnHtml(bol.devam);
        var fullHtml = bol.devam
            ? '<span class="full-text">' + metinGoster(row.content_full || '') + '</span>'
            : '';
        var kart = document.createElement('div');
        kart.className = 'card podyum-kart ' + cins + (bol.devam ? ' uzun-metin' : '');
        kart.setAttribute('data-id', kartId);
        kart.setAttribute('data-status', 'podyum');
        if (row.user_id) kart.setAttribute('data-itiraf-user-id', String(row.user_id));
        if (rumuz && rumuz !== 'Gizli Üye') kart.setAttribute('data-itiraf-username', rumuz);
        kart.setAttribute('data-podyum-sira', String(siraIdx));
        if (row.podyum_donem) {
            kart.setAttribute('data-podyum-donem', String(row.podyum_donem));
        }
        kart.innerHTML =
            '<div class="podyum-rozet">' + htmlEsc(rozet) + '</div>' +
            '<div class="card-header">' +
                '<div class="user-block">' +
                    '<div class="avatar"></div>' +
                    '<div class="user-details">' +
                        '<span class="username">' + htmlEsc(rumuz) + '</span>' +
                        kullaniciMetaHtml(row) +
                    '</div>' +
                '</div>' +
                '<div class="card-header-actions">' +
                    cardMenuBtnHtml(kartId) +
                '</div>' +
            '</div>' +
            '<div class="card-body">' +
                kartBaslikHtml(row) +
                '<span class="short-text">' + metinGoster(bol.kisa) + '</span>' +
                fullHtml +
                devamHtml +
            '</div>' +
            '<div class="card-footer">' +
                kartAksiyonBarHtml(kartId, up, down, row.cevap_sayisi, goruntulenme) +
            '</div>' +
            kartDetayShell();
        kartMetaDataAttr(kart, row);
        avatarKartUygula(kart.querySelector('.avatar'), row);
        if (siraIdx === 0) {
            var lcpImg = kart.querySelector('.avatar img');
            if (lcpImg) lcpImg.fetchPriority = 'high';
        }
        return kart;
    }

    function uyeMi() {
        var db = global.Gunde5DB;
        if (!db || !db.getGunde5User) return false;
        var u = db.getGunde5User();
        return !!(u && u.username);
    }

    function gitProfilSayfasi() {
        if (uyeMi()) {
            window.location.href = '/profil';
            return;
        }
        uyeGirisUyarisi('Profil yalnızca giriş yapmış üyeler içindir.');
    }

    function itirafUyeGerekli() {
        return uyeGirisUyarisi('Hikaye yazmak için üye girişi yapmanız gerekiyor.');
    }

    var PODYUM_TR_SAAT = 13;
    var PODYUM_TR_DAKIKA = 12;
    var TR_TIMEZONE = 'Europe/Istanbul';

    function trZamanParcalari(tarih) {
        var map = {};
        new Intl.DateTimeFormat('en-US', {
            timeZone: TR_TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).formatToParts(tarih).forEach(function (part) {
            if (part.type !== 'literal') {
                map[part.type] = parseInt(part.value, 10);
            }
        });
        return map;
    }

    function trAnlikUtc(yil, ay, gun, saat, dk, sn) {
        var utc = Date.UTC(yil, ay - 1, gun, saat, dk, sn);
        var i;
        for (i = 0; i < 4; i++) {
            var p = trZamanParcalari(new Date(utc));
            utc += Date.UTC(yil, ay - 1, gun, saat, dk, sn) -
                Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
        }
        return utc;
    }

    /** Sonraki podyum anı: her gün 13:12 Türkiye saati (Europe/Istanbul). */
    function hedefSaatTr() {
        var simdi = Date.now();
        var p = trZamanParcalari(new Date(simdi));
        var hedef = trAnlikUtc(p.year, p.month, p.day, PODYUM_TR_SAAT, PODYUM_TR_DAKIKA, 0);
        if (hedef <= simdi) {
            var gece = trAnlikUtc(p.year, p.month, p.day, 23, 59, 0);
            var ertesi = trZamanParcalari(new Date(gece + 120000));
            hedef = trAnlikUtc(ertesi.year, ertesi.month, ertesi.day, PODYUM_TR_SAAT, PODYUM_TR_DAKIKA, 0);
        }
        return new Date(hedef);
    }

    /**
     * Şu anki podyum döneminin başlangıcı: son geçmiş 13:12 TR (Europe/Istanbul), ms UTC.
     * Önbellek anahtarı için kullanılır.
     */
    function sonPodyumTrAniUtc() {
        var simdi = Date.now();
        var p = trZamanParcalari(new Date(simdi));
        var bugun1312 = trAnlikUtc(p.year, p.month, p.day, PODYUM_TR_SAAT, PODYUM_TR_DAKIKA, 0);
        if (simdi >= bugun1312) {
            return bugun1312;
        }
        var oncekiGunBas = trAnlikUtc(p.year, p.month, p.day, 0, 0, 0) - 1;
        var d = trZamanParcalari(new Date(oncekiGunBas));
        return trAnlikUtc(d.year, d.month, d.day, PODYUM_TR_SAAT, PODYUM_TR_DAKIKA, 0);
    }

    function padSayi(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function baslatGeriSayim(elementId) {
        function guncelle() {
            var el = document.getElementById(elementId);
            if (!el) return;
            var fark = hedefSaatTr().getTime() - Date.now();
            if (fark < 0) fark = 0;
            var s = Math.floor(fark / 1000);
            var saat = Math.floor(s / 3600);
            var dk = Math.floor((s % 3600) / 60);
            var sn = s % 60;
            el.textContent = padSayi(saat) + ':' + padSayi(dk) + ':' + padSayi(sn);
        }
        guncelle();
        setInterval(guncelle, 1000);
    }

    function avatarKartUygula(el, row) {
        if (!el || !row) return;
        var cins = row.gender === 'male' ? 'male' : 'female';
        uygulaAvatarElement(el, {
            gender: cins,
            avatarUrl: row.is_gizli ? null : (row.avatar_url || null)
        });
    }

    function toggleHeaderMenu(ev) {
        if (ev) ev.stopPropagation();
        closeProfilMenu();
        var panel = document.getElementById('headerMenuPanel');
        var btn = document.getElementById('headerMenuBtn');
        if (!panel) return;
        var acik = panel.hidden;
        panel.hidden = !acik;
        if (btn) btn.setAttribute('aria-expanded', acik ? 'true' : 'false');
    }

    function closeHeaderMenu() {
        var panel = document.getElementById('headerMenuPanel');
        var btn = document.getElementById('headerMenuBtn');
        if (!panel) return;
        panel.hidden = true;
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    function initHeaderMenu() {
        document.addEventListener('click', function (e) {
            var panel = document.getElementById('headerMenuPanel');
            if (!panel || panel.hidden) return;
            var wrap = document.querySelector('.header-menu-wrap');
            if (wrap && !wrap.contains(e.target)) closeHeaderMenu();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeHeaderMenu();
        });
    }

    function headerMenuAuthClick(mode) {
        closeHeaderMenu();
        if (typeof global.openAuthModal === 'function') global.openAuthModal(mode);
    }

    function headerMenuTemaClick() {
        closeHeaderMenu();
        closeProfilMenu();
        if (typeof global.toggleTheme === 'function') global.toggleTheme();
    }

    function injectHeaderProfilMenuStyles() {
        if (document.getElementById('gunde5-header-profil-menu-styles')) return;
        var s = document.createElement('style');
        s.id = 'gunde5-header-profil-menu-styles';
        s.textContent =
            '.header-profil-wrap{position:relative;flex-shrink:0}' +
            '.header-profil-wrap[hidden]{display:none!important}' +
            'button.header-profil-link{border:none;padding:4px;font:inherit;cursor:pointer}' +
            '.header-profil-panel{position:absolute;top:calc(100% + 8px);right:0;min-width:188px;background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.18);padding:8px;z-index:220}' +
            'body.dark-mode .header-profil-panel{background:var(--bg-card);border-color:var(--border-color)}' +
            '.header-profil-menu-nav{display:flex;flex-direction:column;gap:2px}' +
            '.header-profil-menu-link{display:block;width:100%;padding:10px 12px;border-radius:10px;color:#111827;text-decoration:none;font-size:13px;font-weight:700;text-align:left;border:none;background:transparent;cursor:pointer;font-family:inherit}' +
            'body.dark-mode .header-profil-menu-link{color:var(--text-main)}' +
            '.header-profil-menu-link:hover{background:#f3f4f6}' +
            'body.dark-mode .header-profil-menu-link:hover{background:#2f3336}' +
            '.header-profil-menu-link--cikis{color:#dc2626}' +
            'body.dark-mode .header-profil-menu-link--cikis{color:#f87171}';
        document.head.appendChild(s);
    }

    function profilMenuPanelHtml() {
        return (
            '<nav class="header-profil-menu-nav" aria-label="Hesap menüsü">' +
            '<a href="/profil" class="header-profil-menu-link">👤 Profilim</a>' +
            '<a href="/hakkinda" class="header-profil-menu-link">ℹ️ Hakkında</a>' +
            '<a href="/profil" class="header-profil-menu-link">⚙️ Ayarlar</a>' +
            '<button type="button" class="header-profil-menu-link" id="headerProfilModBtn">🌓 Mod</button>' +
            '<button type="button" class="header-profil-menu-link header-profil-menu-link--cikis" id="headerProfilCikisBtn">🚪 Çıkış yap</button>' +
            '</nav>'
        );
    }

    function mountHeaderProfilMenu() {
        injectHeaderProfilMenuStyles();
        var link = document.getElementById('headerProfilLink');
        if (!link || link.getAttribute('data-profil-menu-ready') === '1') return;

        var wrap = document.createElement('div');
        wrap.className = 'header-profil-wrap';
        wrap.id = 'headerProfilWrap';
        wrap.hidden = true;
        link.parentNode.insertBefore(wrap, link);
        wrap.appendChild(link);

        if (link.tagName === 'A') {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                toggleProfilMenu(e);
            });
        } else {
            link.addEventListener('click', toggleProfilMenu);
        }
        link.setAttribute('role', 'button');
        link.setAttribute('aria-label', 'Hesap menüsü');
        link.setAttribute('aria-expanded', 'false');
        link.setAttribute('aria-haspopup', 'true');
        link.setAttribute('aria-controls', 'headerProfilPanel');

        var panel = document.createElement('div');
        panel.id = 'headerProfilPanel';
        panel.className = 'header-profil-panel';
        panel.hidden = true;
        panel.innerHTML = profilMenuPanelHtml();
        wrap.appendChild(panel);

        var modBtn = document.getElementById('headerProfilModBtn');
        if (modBtn) {
            modBtn.addEventListener('click', function (e) {
                e.preventDefault();
                headerMenuTemaClick();
            });
        }

        var cikisBtn = document.getElementById('headerProfilCikisBtn');
        if (cikisBtn) {
            cikisBtn.addEventListener('click', function (e) {
                e.preventDefault();
                headerProfilCikis();
            });
        }

        link.setAttribute('data-profil-menu-ready', '1');
    }

    function toggleProfilMenu(ev) {
        if (ev) ev.stopPropagation();
        closeHeaderMenu();
        var panel = document.getElementById('headerProfilPanel');
        var btn = document.getElementById('headerProfilLink');
        if (!panel) return;
        var acik = panel.hidden;
        panel.hidden = !acik;
        if (btn) btn.setAttribute('aria-expanded', acik ? 'true' : 'false');
    }

    function closeProfilMenu() {
        var panel = document.getElementById('headerProfilPanel');
        var btn = document.getElementById('headerProfilLink');
        if (!panel) return;
        panel.hidden = true;
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    async function headerProfilCikis() {
        closeProfilMenu();
        closeHeaderMenu();
        var db = global.Gunde5DB;
        if (!db || !db.cikisYap) return;
        try {
            await db.cikisYap();
            guncelleHeaderOturum();
            global.location.href = '/';
        } catch (err) {
            showToast(db.hataMesaji ? db.hataMesaji(err) : String(err), 'hata');
        }
    }

    function syncShellOturumClass(oturumAcik, u) {
        var html = document.documentElement;
        if (oturumAcik) {
            html.classList.add('g5-oturum');
            if (u && u.gender) html.setAttribute('data-user-gender', u.gender === 'male' ? 'male' : 'female');
        } else {
            html.classList.remove('g5-oturum');
            html.removeAttribute('data-user-gender');
        }
        if (global.Gunde5Shell && global.Gunde5Shell.syncBodyClasses) global.Gunde5Shell.syncBodyClasses();
    }

    function applyHeaderFromCache() {
        if (global.Gunde5Shell && global.Gunde5Shell.applyHeaderFromCache) {
            global.Gunde5Shell.applyHeaderFromCache();
        }
        if (!document.documentElement.classList.contains('g5-oturum')) return;
        mountHeaderProfilMenu();
        var u = global.Gunde5Shell && global.Gunde5Shell.readUser
            ? global.Gunde5Shell.readUser()
            : (global.Gunde5DB && global.Gunde5DB.getGunde5User ? global.Gunde5DB.getGunde5User() : null);
        if (!u || !u.username) return;
        uygulaAvatarElement(document.getElementById('headerProfilAvatar'), u);
        document.body.classList.add('oturum-acik');
        if (u.gender) document.body.setAttribute('data-user-gender', u.gender === 'male' ? 'male' : 'female');
    }

    function guncelleHeaderOturum() {
        mountHeaderProfilMenu();
        closeProfilMenu();
        closeHeaderMenu();
        var db = global.Gunde5DB;
        var u = db && db.getGunde5User ? db.getGunde5User() : null;
        var link = document.getElementById('headerProfilLink');
        var authBtns = document.getElementById('headerAuthBtns');
        var wrap = document.getElementById('headerProfilWrap');
        if (!link) return;
        if (u && u.username) {
            syncShellOturumClass(true, u);
            if (authBtns) authBtns.hidden = true;
            if (wrap) wrap.hidden = false;
            link.style.display = 'flex';
            document.body.classList.add('oturum-acik');
            var cins = u.gender === 'male' ? 'male' : 'female';
            link.className = 'header-profil-link cins-' + cins;
            uygulaAvatarElement(document.getElementById('headerProfilAvatar'), u);
            if (u.gender) document.body.setAttribute('data-user-gender', cins);
            if (global.Gunde5Bildirim && global.Gunde5Bildirim.baslat) global.Gunde5Bildirim.baslat();
            if (global.Gunde5Master && global.Gunde5Master.durumYenile) global.Gunde5Master.durumYenile();
        } else {
            syncShellOturumClass(false);
            if (authBtns) authBtns.hidden = false;
            if (wrap) wrap.hidden = true;
            link.style.display = 'none';
            document.body.classList.remove('oturum-acik');
            if (global.Gunde5Bildirim && global.Gunde5Bildirim.durdur) global.Gunde5Bildirim.durdur();
            if (global.Gunde5Master && global.Gunde5Master.durumYenile) global.Gunde5Master.durumYenile();
        }
    }

    function initHeaderProfilMenu() {
        mountHeaderProfilMenu();
        document.addEventListener('click', function (e) {
            var panel = document.getElementById('headerProfilPanel');
            if (!panel || panel.hidden) return;
            var wrap = document.getElementById('headerProfilWrap');
            if (wrap && !wrap.contains(e.target)) closeProfilMenu();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeProfilMenu();
        });
    }

    global.guncelleHeaderOturum = guncelleHeaderOturum;

    function uygulaAvatarElement(el, u) {
        if (!el) return;
        var cins = u && u.gender === 'male' ? 'male' : 'female';
        var img = el.querySelector('img');
        if (u && u.avatarUrl) {
            var headerAv = el.id === 'headerProfilAvatar';
            if (!img) {
                el.textContent = '';
                img = document.createElement('img');
                img.alt = '';
                el.appendChild(img);
            }
            img.loading = headerAv ? 'eager' : 'lazy';
            img.decoding = 'async';
            if (headerAv) img.fetchPriority = 'high';
            if (img.getAttribute('src') !== u.avatarUrl) img.setAttribute('src', u.avatarUrl);
            el.classList.add('has-foto');
            return;
        }
        if (img) img.remove();
        el.classList.remove('has-foto');
        el.textContent = cins === 'male' ? '\u2642' : '\u2640';
    }

    global.Gunde5UI = {
        htmlEsc: htmlEsc,
        metinGoster: metinGoster,
        metinBol: metinBol,
        showToast: showToast,
        showToastUyeGerekli: showToastUyeGerekli,
        uyeGirisUyarisi: uyeGirisUyarisi,
        bosListe: bosListe,
        bosListeHtml: bosListeHtml,
        podyumBosMesajiHtml: podyumBosMesajiHtml,
        renderPodyumCard: renderPodyumCard,
        podyumDonemTarihMs: podyumDonemTarihMs,
        podyumDonemleriKronolojikSirala: podyumDonemleriKronolojikSirala,
        kullaniciMetaSatir: kullaniciMetaSatir,
        kullaniciMetaHtml: kullaniciMetaHtml,
        kartMetaDataAttr: kartMetaDataAttr,
        cardMenuBtnHtml: cardMenuBtnHtml,
        avatarKartUygula: avatarKartUygula,
        injectSikayetStyles: injectSikayetStyles,
        uyeMi: uyeMi,
        gitProfilSayfasi: gitProfilSayfasi,
        itirafUyeGerekli: itirafUyeGerekli,
        hikayeUyeGerekli: itirafUyeGerekli,
        acHikayeModal: acHikayeModal,
        kapatHikayeModal: kapatHikayeModal,
        uygulaAvatarElement: uygulaAvatarElement,
        closeAuthModal: closeAuthModal,
        kapatItirafModal: kapatItirafModal,
        oturumModallariKapat: oturumModallariKapat,
        hedefSaatTr: hedefSaatTr,
        sonPodyumTrAniUtc: sonPodyumTrAniUtc,
        baslatGeriSayim: baslatGeriSayim,
        PODYUM_TR_SAAT: PODYUM_TR_SAAT,
        PODYUM_TR_DAKIKA: PODYUM_TR_DAKIKA,
        toggleHeaderMenu: toggleHeaderMenu,
        closeHeaderMenu: closeHeaderMenu,
        initHeaderMenu: initHeaderMenu,
        headerMenuAuthClick: headerMenuAuthClick,
        headerMenuTemaClick: headerMenuTemaClick,
        toggleProfilMenu: toggleProfilMenu,
        closeProfilMenu: closeProfilMenu,
        headerProfilCikis: headerProfilCikis,
        guncelleHeaderOturum: guncelleHeaderOturum,
        initHeaderProfilMenu: initHeaderProfilMenu,
        formatSayac: formatSayac,
        kartOyArayuzunuGuncelle: kartOyArayuzunuGuncelle,
        kartOyDurumuRenklendir: kartOyDurumuRenklendir,
        kartPodyumIstatistikEnjekteEt: kartPodyumIstatistikEnjekteEt,
        toggleKaydet: toggleKaydet,
        isItirafKayitli: isItirafKayitli
    };

    function initShellHeader() {
        initHeaderMenu();
        initHeaderProfilMenu();
        applyHeaderFromCache();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initShellHeader);
    } else {
        initShellHeader();
    }
    injectSayfaLinkStyles();
})(window);
