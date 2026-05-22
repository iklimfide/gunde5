/**
 * gunde5 — Moderasyon modu: karta gömülü aksiyonlar (ayrı kutu yok)
 */
(function (global) {
    'use strict';

    var MOD_KEY = 'gunde5_master_mod';
    var masterMi = false;
    var modAcik = false;
    var gozlemci = null;
    var uyeIdOnbellek = {};

    function db() {
        return global.Gunde5DB;
    }

    function ui() {
        return global.Gunde5UI;
    }

    function esc(s) {
        if (ui() && ui().htmlEsc) return ui().htmlEsc(s);
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function modKayitliAcik() {
        try {
            return localStorage.getItem(MOD_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function modKaydet(acik) {
        try {
            localStorage.setItem(MOD_KEY, acik ? '1' : '0');
        } catch (e) { /* */ }
    }

    function modAktifMi() {
        return masterMi && modAcik;
    }

    function injectStyles() {
        if (document.getElementById('gunde5-master-styles')) return;
        var s = document.createElement('style');
        s.id = 'gunde5-master-styles';
        s.textContent =
            '.master-uye-aksiyon{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:6px 12px 8px;margin:0;border-bottom:1px dashed var(--border-color,rgba(0,0,0,.1))}' +
            '.master-uye-aksiyon-etiket{font-size:10px;font-weight:800;color:var(--text-muted);width:100%;margin-bottom:2px;letter-spacing:.04em}' +
            '.master-hikaye-aksiyon{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:8px 0 2px;margin-top:2px;border-top:1px dashed var(--border-color,rgba(0,0,0,.12))}' +
            '.master-aksiyon-btn{padding:0;border:none;background:none;font-size:12px;font-weight:700;color:#b45309;cursor:pointer;font-family:inherit;line-height:1.3}' +
            '.master-aksiyon-btn:hover{text-decoration:underline}' +
            'body.dark-mode .master-aksiyon-btn{color:#fbbf24}' +
            '.master-aksiyon-btn--tehlike{color:#dc2626}' +
            'body.dark-mode .master-aksiyon-btn--tehlike{color:#f87171}' +
            '.master-aksiyon-btn--pasif{opacity:.45;pointer-events:none}' +
            '.master-aksiyon-ayrac{width:1px;height:14px;background:var(--border-color,rgba(0,0,0,.15));flex-shrink:0}' +
            '.master-duzenle-ta{width:100%;min-height:100px;padding:10px 12px;margin-top:6px;border:2px solid #f59e0b;border-radius:12px;font-size:14px;line-height:1.45;font-family:inherit;resize:vertical;background:var(--bg-card,#fff);color:var(--text-main,#111)}' +
            '.card.master-duzeniyor .short-text,.card.master-duzeniyor .full-text,.card.master-duzeniyor .devam-btn{display:none!important}' +
            '.master-gelismis{display:none;flex-wrap:wrap;gap:8px;align-items:center;width:100%;padding-top:6px}' +
            '.master-gelismis.acik{display:flex}' +
            '.master-gelismis input{width:48px;padding:4px 6px;border:1px solid var(--border-color);border-radius:6px;font-size:12px}' +
            '.master-gelismis select{padding:4px 8px;border-radius:6px;font-size:12px;border:1px solid var(--border-color)}' +
            '.header-profil-menu-link--master{color:#f59e0b}' +
            '.header-menu-link--master{color:#f59e0b;font-weight:800}' +
            'body.master-mod-aktif .header-profil-link{box-shadow:0 0 0 2px #f59e0b}' +
            '.profil-mod-ara{display:flex;gap:8px;margin:0 0 16px;align-items:center}' +
            '.profil-mod-ara input{flex:1;padding:10px 12px;border:1px solid var(--border-color);border-radius:10px;font-size:14px}' +
            '.profil-mod-sonuc{font-size:13px}' +
            '.profil-mod-uye{padding:12px 0;border-bottom:1px solid var(--border-color)}' +
            '.profil-mod-uye-bilgi{font-size:13px;font-weight:600;margin-bottom:6px;color:var(--text-main,#111)}' +
            'body.dark-mode .profil-mod-uye-bilgi{color:var(--text-main)}' +
            '.profil-mod-uye-bilgi span{color:var(--text-muted);font-weight:500}' +
            '.master-uye-bot-notu{font-size:11px;color:var(--text-muted);font-weight:600;line-height:1.4;margin:0;flex:1 1 100%}';
        document.head.appendChild(s);
    }

    async function durumYenile() {
        var D = db();
        masterMi = false;
        if (!D || !D.masterDurum || !D.getGunde5User || !D.getGunde5User()) {
            modAcik = false;
            document.body.classList.remove('master-mod-aktif');
            temizleKartlar();
            profilModTemizle();
            menuGuncelle();
            menuIstatistikGuncelle();
            return;
        }
        try {
            var d = await D.masterDurum();
            masterMi = !!(d && d.master);
        } catch (e) {
            masterMi = false;
        }
        modAcik = masterMi && modKayitliAcik();
        document.body.classList.toggle('master-mod-aktif', modAcik);
        menuGuncelle();
        menuIstatistikGuncelle();
        if (modAcik) {
            kartlariBagla();
            profilModMount();
        } else {
            temizleKartlar();
            profilModTemizle();
        }
    }

    function modToggle() {
        if (!masterMi) return;
        modAcik = !modAcik;
        modKaydet(modAcik);
        document.body.classList.toggle('master-mod-aktif', modAcik);
        menuGuncelle();
        menuIstatistikGuncelle();
        if (modAcik) {
            kartlariBagla();
            profilModMount();
        } else {
            temizleKartlar();
            profilModTemizle();
        }
        if (ui() && ui().showToast) {
            ui().showToast(modAcik ? 'Moderasyon açık' : 'Moderasyon kapalı');
        }
    }

    function menuGuncelle() {
        var btn = document.getElementById('headerProfilMasterBtn');
        if (!btn) return;
        if (!masterMi) {
            btn.hidden = true;
            return;
        }
        btn.hidden = false;
        btn.textContent = modAcik ? '🛡️ Moderasyon: Açık' : '🛡️ Moderasyon: Kapalı';
        btn.classList.toggle('header-profil-menu-link--master', modAcik);
    }

    function menuIstatistikKaldir() {
        var link = document.getElementById('headerMenuIstatistik');
        if (link && link.parentNode) link.parentNode.removeChild(link);
    }

    function menuIstatistikGuncelle() {
        if (!masterMi) {
            menuIstatistikKaldir();
            return;
        }
        var link = document.getElementById('headerMenuIstatistik');
        if (link) return;
        var nav = document.querySelector('.header-menu-nav');
        if (!nav) return;
        link = document.createElement('a');
        link.href = 'istatistikler.html';
        link.className = 'header-menu-link header-menu-link--master';
        link.id = 'headerMenuIstatistik';
        link.textContent = '📊 İstatistikler';
        var kvkk = nav.querySelector('a[href="kvkk.html"]');
        if (kvkk) nav.insertBefore(link, kvkk);
        else nav.appendChild(link);
    }

    function mountMenuItem() {
        var nav = document.querySelector('.header-profil-menu-nav');
        if (!nav || document.getElementById('headerProfilMasterBtn')) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'header-profil-menu-link header-profil-menu-link--master';
        btn.id = 'headerProfilMasterBtn';
        btn.hidden = true;
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            modToggle();
            if (ui() && ui().closeProfilMenu) ui().closeProfilMenu();
        });
        var modTheme = document.getElementById('headerProfilModBtn');
        if (modTheme && modTheme.parentNode === nav) {
            nav.insertBefore(btn, modTheme);
        } else {
            nav.appendChild(btn);
        }
        menuGuncelle();
    }

    function temizleKartlar() {
        uyeIdOnbellek = {};
        document.querySelectorAll('.card[data-master-ready]').forEach(function (card) {
            card.classList.remove('card--mod', 'master-duzeniyor');
            card.removeAttribute('data-master-ready');
            var hbar = card.querySelector('.master-hikaye-aksiyon');
            if (hbar) hbar.remove();
            var ubar = card.querySelector('.master-uye-aksiyon');
            if (ubar) ubar.remove();
            var ta = card.querySelector('.master-duzenle-ta');
            if (ta) ta.remove();
        });
    }

    function uyeToast(islem) {
        var mesaj = {
            gizli_uye: 'Üye gizli yapıldı',
            gizli_kaldir: 'Rumuz tekrar görünür',
            askida: 'Üye askıya alındı',
            ban: 'Üye banlandı',
            aktif: 'Üye aktif'
        };
        if (ui() && ui().showToast) ui().showToast(mesaj[islem] || 'Üye güncellendi');
    }

    function kartRumuzGizli(card) {
        var rumuz = card.querySelector('.username');
        if (rumuz) rumuz.textContent = 'Gizli Üye';
    }

    function kartRumuzGoster(card, ad) {
        var rumuz = card.querySelector('.username');
        if (rumuz && ad) rumuz.textContent = ad;
    }

    function kartTamMetin(card) {
        var body = card.querySelector('.card-body');
        if (!body) return '';
        var ft = body.querySelector('.full-text');
        var st = body.querySelector('.short-text');
        return ft ? ft.textContent : (st ? st.textContent : '');
    }

    function kartMetinGuncelle(card, tam) {
        var body = card.querySelector('.card-body');
        if (!body || !tam) return;
        var bol = tam.length > 140;
        var kisa = bol ? tam.slice(0, 137) + '...' : tam;
        var shortEl = body.querySelector('.short-text');
        var fullEl = body.querySelector('.full-text');
        if (shortEl) shortEl.textContent = kisa;
        if (bol) {
            if (!fullEl) {
                fullEl = document.createElement('span');
                fullEl.className = 'full-text';
                body.appendChild(fullEl);
            }
            fullEl.textContent = tam;
            card.classList.add('uzun-metin');
        } else if (fullEl) {
            fullEl.remove();
            card.classList.remove('uzun-metin');
        }
    }

    function oySayilariGuncelle(card, up, down) {
        var upEl = card.querySelector('.like-count');
        var downEl = card.querySelector('.dislike-count');
        if (upEl) upEl.textContent = String(up);
        if (downEl) downEl.textContent = String(down);
    }

    function duzenleKapat(card) {
        card.classList.remove('master-duzeniyor');
        var ta = card.querySelector('.master-duzenle-ta');
        if (ta) ta.remove();
        var bar = card.querySelector('.master-hikaye-aksiyon');
        if (bar) {
            bar.querySelectorAll('.master-aksiyon-duzenle').forEach(function (b) {
                b.classList.remove('master-aksiyon-btn--pasif');
            });
            var kaydet = bar.querySelector('[data-m-duzen-kaydet]');
            var iptal = bar.querySelector('[data-m-duzen-iptal]');
            if (kaydet) kaydet.hidden = true;
            if (iptal) iptal.hidden = true;
        }
    }

    function duzenleAc(card) {
        if (card.classList.contains('master-duzeniyor')) return;
        var body = card.querySelector('.card-body');
        if (!body) return;
        card.classList.add('master-duzeniyor');
        var ta = document.createElement('textarea');
        ta.className = 'master-duzenle-ta';
        ta.value = kartTamMetin(card);
        body.appendChild(ta);
        ta.focus();

        var bar = card.querySelector('.master-hikaye-aksiyon');
        if (bar) {
            bar.querySelectorAll('.master-aksiyon-duzenle').forEach(function (b) {
                b.classList.add('master-aksiyon-btn--pasif');
            });
            var kaydet = bar.querySelector('[data-m-duzen-kaydet]');
            var iptal = bar.querySelector('[data-m-duzen-iptal]');
            if (kaydet) kaydet.hidden = false;
            if (iptal) iptal.hidden = false;
        }
    }

    async function hikayeIslem(card, islem, ek) {
        var D = db();
        if (!D || !D.masterHikayeIslem) return;
        var id = card.getAttribute('data-id');
        var body = { itiraf_id: parseInt(id, 10), islem: islem };
        if (ek) {
            Object.keys(ek).forEach(function (k) {
                body[k] = ek[k];
            });
        }
        try {
            var sonuc = await D.masterHikayeIslem(body);
            if (!sonuc || !sonuc.ok) {
                throw new Error((sonuc && sonuc.hata) || 'İşlem başarısız');
            }
            var it = sonuc.itiraf;
            if (!it) return;
            if (islem === 'sil') {
                card.remove();
                if (ui() && ui().showToast) ui().showToast('Hikaye silindi');
                return;
            }
            duzenleKapat(card);
            kartMetinGuncelle(card, it.content_full);
            oySayilariGuncelle(card, it.up_votes, it.down_votes);
            if (ui() && ui().showToast) ui().showToast('Kaydedildi');
        } catch (err) {
            if (ui() && ui().showToast) ui().showToast(D.hataMesaji ? D.hataMesaji(err) : String(err), 'hata');
        }
    }

    async function uyeIslem(uyeId, islem, kartBaglam) {
        var D = db();
        if (!D || !D.masterUyeIslem || !uyeId) return;
        if (islem === 'ban' && !global.confirm('Bu üyeyi banlamak istediğine emin misin?')) return;
        try {
            var sonuc = await D.masterUyeIslem({ uye_id: uyeId, islem: islem });
            if (!sonuc || !sonuc.ok) throw new Error((sonuc && sonuc.hata) || 'İşlem başarısız');
            uyeToast(islem);
            if (kartBaglam) {
                if (islem === 'gizli_uye') {
                    document.querySelectorAll('.card[data-itiraf-user-id="' + uyeId + '"]').forEach(kartRumuzGizli);
                } else if (islem === 'gizli_kaldir' && sonuc.uye && sonuc.uye.username) {
                    document.querySelectorAll('.card[data-itiraf-user-id="' + uyeId + '"]').forEach(function (c) {
                        kartRumuzGoster(c, sonuc.uye.username);
                    });
                }
            }
        } catch (err) {
            if (ui() && ui().showToast) ui().showToast(D.hataMesaji ? D.hataMesaji(err) : String(err), 'hata');
        }
    }

    async function uyeIdCoz(card) {
        var uid = card.getAttribute('data-itiraf-user-id');
        if (uid) return uid;
        var rumuz = card.getAttribute('data-itiraf-username');
        if (!rumuz) {
            var el = card.querySelector('.username');
            rumuz = el ? el.textContent.trim() : '';
            if (rumuz && rumuz !== 'Gizli Üye' && rumuz !== 'Müdavim') {
                card.setAttribute('data-itiraf-username', rumuz);
            }
        }
        if (!rumuz || rumuz === 'Gizli Üye' || rumuz === 'Müdavim') return null;
        if (uyeIdOnbellek[rumuz]) return uyeIdOnbellek[rumuz];

        var D = db();
        if (!D || !D.masterUyeBul) return null;
        try {
            var sonuc = await D.masterUyeBul(rumuz);
            if (sonuc && sonuc.ok && sonuc.uye && sonuc.uye.id) {
                uyeIdOnbellek[rumuz] = sonuc.uye.id;
                card.setAttribute('data-itiraf-user-id', sonuc.uye.id);
                return sonuc.uye.id;
            }
            if (sonuc && !sonuc.ok && sonuc.hata && sonuc.hata !== 'uye bulunamadi') {
                if (ui() && ui().showToast) {
                    ui().showToast('Üye arama: ' + sonuc.hata, 'hata');
                }
            }
        } catch (e) {
            if (ui() && ui().showToast) {
                ui().showToast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
            }
        }
        return null;
    }

    function uyeAksiyonBar(uyeId, kartBaglam) {
        var bar = document.createElement('div');
        bar.className = 'master-uye-aksiyon';
        bar.innerHTML =
            '<span class="master-uye-aksiyon-etiket">Üye</span>' +
            '<button type="button" class="master-aksiyon-btn" data-m-u="gizli_uye">Gizli üye yap</button>' +
            '<button type="button" class="master-aksiyon-btn" data-m-u="gizli_kaldir">Rumuz göster</button>' +
            '<span class="master-aksiyon-ayrac" aria-hidden="true"></span>' +
            '<button type="button" class="master-aksiyon-btn" data-m-u="askida">Askıya al</button>' +
            '<button type="button" class="master-aksiyon-btn master-aksiyon-btn--tehlike" data-m-u="ban">Banla</button>' +
            '<button type="button" class="master-aksiyon-btn" data-m-u="aktif">Aktif yap</button>';

        bar.addEventListener('click', function (e) {
            var b = e.target.closest('[data-m-u]');
            if (!b) return;
            e.stopPropagation();
            uyeIslem(uyeId, b.getAttribute('data-m-u'), kartBaglam);
        });
        return bar;
    }

    function hikayeAksiyonBar(card) {
        var bar = document.createElement('div');
        bar.className = 'master-hikaye-aksiyon';

        var status = card.getAttribute('data-status') || 'kulis';
        var up = card.querySelector('.like-count');
        var down = card.querySelector('.dislike-count');
        var upVal = up ? up.textContent : '0';
        var downVal = down ? down.textContent : '0';

        bar.innerHTML =
            '<span class="master-uye-aksiyon-etiket">Hikaye</span>' +
            '<button type="button" class="master-aksiyon-btn master-aksiyon-duzenle" data-m-a="duzenle">Değiştir</button>' +
            '<button type="button" class="master-aksiyon-btn master-aksiyon-duzenle" data-m-a="gizle">Gizle</button>' +
            '<button type="button" class="master-aksiyon-btn master-aksiyon-duzenle" data-m-a="goster">Göster</button>' +
            '<span class="master-aksiyon-ayrac" aria-hidden="true"></span>' +
            '<button type="button" class="master-aksiyon-btn master-aksiyon-duzenle master-aksiyon-btn--tehlike" data-m-a="sil">Sil</button>' +
            '<button type="button" class="master-aksiyon-btn master-aksiyon-duzenle" data-m-a="gelismis">Gelişmiş</button>' +
            '<button type="button" class="master-aksiyon-btn" data-m-duzen-kaydet hidden>Kaydet</button>' +
            '<button type="button" class="master-aksiyon-btn" data-m-duzen-iptal hidden>İptal</button>' +
            '<div class="master-gelismis" data-m-gelismis>' +
            '<label>👍 <input type="number" data-m-up min="0" value="' + esc(upVal) + '"></label>' +
            '<label>👎 <input type="number" data-m-down min="0" value="' + esc(downVal) + '"></label>' +
            '<button type="button" class="master-aksiyon-btn" data-m-a="oylar">Oy kaydet</button>' +
            '<select data-m-status><option value="kulis"' + (status === 'kulis' ? ' selected' : '') + '>Kulis</option>' +
            '<option value="podyum"' + (status === 'podyum' ? ' selected' : '') + '>Podyum</option></select>' +
            '<button type="button" class="master-aksiyon-btn" data-m-a="status">Durum uygula</button>' +
            '<button type="button" class="master-aksiyon-btn" data-m-a="geri_al">Geri al (sil)</button>' +
            '</div>';

        bar.addEventListener('click', function (e) {
            var act = e.target.closest('[data-m-a]');
            if (!act) return;
            e.stopPropagation();
            var a = act.getAttribute('data-m-a');
            if (a === 'duzenle') {
                duzenleAc(card);
            } else if (a === 'gelismis') {
                var g = bar.querySelector('[data-m-gelismis]');
                if (g) g.classList.toggle('acik');
            } else if (a === 'oylar') {
                var uIn = bar.querySelector('[data-m-up]');
                var dIn = bar.querySelector('[data-m-down]');
                hikayeIslem(card, 'oylar', {
                    up_votes: parseInt(uIn && uIn.value, 10) || 0,
                    down_votes: parseInt(dIn && dIn.value, 10) || 0
                });
            } else if (a === 'status') {
                var sel = bar.querySelector('[data-m-status]');
                hikayeIslem(card, 'status', { status: sel ? sel.value : 'kulis' });
            } else {
                hikayeIslem(card, a, null);
            }
        });

        var kaydet = bar.querySelector('[data-m-duzen-kaydet]');
        var iptal = bar.querySelector('[data-m-duzen-iptal]');
        if (kaydet) {
            kaydet.addEventListener('click', function (e) {
                e.stopPropagation();
                var ta = card.querySelector('.master-duzenle-ta');
                hikayeIslem(card, 'guncelle', { content_full: ta ? ta.value : '' });
            });
        }
        if (iptal) {
            iptal.addEventListener('click', function (e) {
                e.stopPropagation();
                duzenleKapat(card);
            });
        }

        return bar;
    }

    async function kartBagla(card) {
        if (!modAktifMi() || !card || card.getAttribute('data-master-ready') === '1') return;
        card.setAttribute('data-master-ready', '1');
        card.classList.add('card--mod');

        var header = card.querySelector('.card-header');
        if (header && !card.querySelector('.master-uye-aksiyon')) {
            var uid = await uyeIdCoz(card);
            if (uid) {
                header.insertAdjacentElement('afterend', uyeAksiyonBar(uid, true));
            } else {
                var rumuz = card.getAttribute('data-itiraf-username') ||
                    (card.querySelector('.username') && card.querySelector('.username').textContent.trim());
                if (rumuz && rumuz !== 'Gizli Üye' && rumuz !== 'Müdavim') {
                    var uyari = document.createElement('div');
                    uyari.className = 'master-uye-aksiyon';
                    uyari.innerHTML =
                        '<span class="master-uye-aksiyon-etiket">Üye</span>' +
                        '<p class="master-uye-bot-notu"><strong>' + esc(rumuz) +
                        '</strong> — kayıtlı üye hesabı yok (bot/seed). Ban ve askıya yalnızca gerçek üyelerde; bu kart için alttaki <strong>Hikaye</strong> satırını kullan (Gizle, Sil…).</p>';
                    header.insertAdjacentElement('afterend', uyari);
                }
            }
        }

        if (card.querySelector('.master-hikaye-aksiyon')) return;
        var body = card.querySelector('.card-body');
        if (!body) return;
        var footer = card.querySelector('.card-footer');
        var bar = hikayeAksiyonBar(card);
        var uyeBar = card.querySelector('.master-uye-aksiyon');
        if (footer) {
            card.insertBefore(bar, footer);
        } else if (uyeBar) {
            uyeBar.insertAdjacentElement('afterend', bar);
        } else {
            body.insertAdjacentElement('afterend', bar);
        }
    }

    function kartlariBagla() {
        if (!modAktifMi()) return;
        document.querySelectorAll('.card[data-id]').forEach(function (card) {
            kartBagla(card).catch(function () { /* sessiz */ });
        });
    }

    function gozlemciBaslat() {
        if (gozlemci) return;
        gozlemci = new MutationObserver(function () {
            if (modAktifMi()) kartlariBagla();
        });
        ['podyumListe', 'kulisListe'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) gozlemci.observe(el, { childList: true, subtree: true });
        });
    }

    function profilModTemizle() {
        var wrap = document.getElementById('profilMasterWrap');
        if (wrap) {
            wrap.innerHTML = '';
            wrap.removeAttribute('data-ready');
        }
    }

    function profilModMount() {
        if (!modAktifMi()) return;
        var wrap = document.getElementById('profilMasterWrap');
        if (!wrap || wrap.getAttribute('data-ready') === '1') return;
        wrap.setAttribute('data-ready', '1');
        wrap.innerHTML =
            '<div class="profil-mod-ara">' +
            '<input type="search" id="profilMasterAra" placeholder="Üye ara (e-posta veya rumuz)…" autocomplete="off">' +
            '<button type="button" class="master-aksiyon-btn" id="profilMasterAraBtn">Ara</button>' +
            '</div>' +
            '<div class="profil-mod-sonuc" id="profilMasterSonuc"></div>';

        var araBtn = document.getElementById('profilMasterAraBtn');
        var inp = document.getElementById('profilMasterAra');
        async function ara() {
            var D = db();
            var el = document.getElementById('profilMasterSonuc');
            if (!D || !D.masterUyeAra || !el) return;
            try {
                var sonuc = await D.masterUyeAra(inp ? inp.value : '');
                if (!sonuc || !sonuc.ok) {
                    el.innerHTML = '<p>' + esc((sonuc && sonuc.hata) || 'Arama hatası') + '</p>';
                    return;
                }
                var liste = sonuc.sonuc || [];
                if (!liste.length) {
                    el.innerHTML = '<p>Sonuç yok.</p>';
                    return;
                }
                el.innerHTML = '';
                liste.forEach(function (u) {
                    var satir = document.createElement('div');
                    satir.className = 'profil-mod-uye';
                    var bilgi = document.createElement('div');
                    bilgi.className = 'profil-mod-uye-bilgi';
                    bilgi.innerHTML =
                        '<strong>' + esc(u.username) + '</strong> ' +
                        '<span>· ' + esc(u.email) + ' · ' + esc(u.durum) +
                        (u.zorunlu_gizli ? ' · gizli' : '') + '</span>';
                    satir.appendChild(bilgi);
                    satir.appendChild(uyeAksiyonBar(u.id, false));
                    el.appendChild(satir);
                });
            } catch (err) {
                el.innerHTML = '<p>' + esc(D.hataMesaji ? D.hataMesaji(err) : String(err)) + '</p>';
            }
        }
        if (araBtn) araBtn.addEventListener('click', ara);
        if (inp) {
            inp.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') ara();
            });
        }
    }

    function baslat() {
        injectStyles();
        mountMenuItem();
        menuIstatistikKaldir();
        durumYenile();
        gozlemciBaslat();
    }

    global.Gunde5Master = {
        baslat: baslat,
        durumYenile: durumYenile,
        modAktifMi: modAktifMi,
        modToggle: modToggle,
        kartlariBagla: kartlariBagla
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(baslat, 0);
        });
    } else {
        setTimeout(baslat, 0);
    }
})(window);
