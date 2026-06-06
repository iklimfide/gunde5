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
        return false;
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
            '.master-bot-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:100%}' +
            '.master-bot-meta label{font-size:11px;font-weight:700;color:var(--text-muted);display:flex;align-items:center;gap:4px}' +
            '.master-bot-meta input,.master-bot-meta select{padding:4px 8px;border:1px solid var(--border-color,rgba(0,0,0,.12));border-radius:8px;font-size:12px;font-family:inherit;background:var(--bg-card,#fff);color:var(--text-main,#111)}' +
            '.master-bot-meta .master-bot-yurtdisi{flex:1 1 100%}' +
            '.master-bot-meta .master-bot-yurtdisi.master-bot-yurtdisi--gizli{display:none}';
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
            eskiMasterMenuTemizle();
            menuGuncelle();
            menuAdminGonderimGuncelle();
            menuIstatistikGuncelle();
            menuUyelerGuncelle();
            menuKamikazeGuncelle();
            menuSosyalPaylasGuncelle();
            eskiMasterMenuTemizle();
            return;
        }
        try {
            var d = await D.masterDurum();
            masterMi = !!(d && d.master);
        } catch (e) {
            masterMi = false;
        }
        modAcik = false;
        document.body.classList.remove('master-mod-aktif');
        eskiMasterMenuTemizle();
        menuGuncelle();
        menuAdminGonderimGuncelle();
        menuIstatistikGuncelle();
        menuUyelerGuncelle();
        menuKamikazeGuncelle();
        menuSosyalPaylasGuncelle();
        eskiMasterMenuTemizle();
        temizleKartlar();
        profilModTemizle();
    }

    function modToggle() {
        modAcik = false;
        document.body.classList.remove('master-mod-aktif');
        eskiMasterMenuTemizle();
        menuGuncelle();
        temizleKartlar();
        profilModTemizle();
    }

    function menuGuncelle() {
        var btn = document.getElementById('headerProfilMasterBtn');
        if (!btn) return;
        btn.hidden = true;
    }

    function masterMenuNavEkle(link, oncekiId) {
        var nav = document.querySelector('.header-menu-nav');
        if (!nav) return;
        var onceki = oncekiId && document.getElementById(oncekiId);
        if (onceki && onceki.parentNode === nav) {
            if (onceki.nextSibling) nav.insertBefore(link, onceki.nextSibling);
            else nav.appendChild(link);
        } else {
            nav.appendChild(link);
        }
    }

    function eskiMasterMenuTemizle() {
        ['headerMenuHikayeGonder'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });
    }

    function menuAdminGonderimKaldir() {
        var link = document.getElementById('headerMenuAdminInbox');
        if (link && link.parentNode) link.parentNode.removeChild(link);
        var eski = ['headerMenuAdminSubmissions', 'headerMenuAdminMessages'];
        eski.forEach(function (id) {
            var n = document.getElementById(id);
            if (n && n.parentNode) n.parentNode.removeChild(n);
        });
    }

    function menuAdminGonderimGuncelle() {
        if (!masterMi) {
            menuAdminGonderimKaldir();
            return;
        }
        menuAdminGonderimKaldir();
        var nav = document.querySelector('.header-menu-nav');
        if (!nav) return;
        if (document.getElementById('headerMenuAdminInbox')) return;
        var link = document.createElement('a');
        link.href = '/admin/inbox';
        link.className = 'header-menu-link header-menu-link--master';
        link.id = 'headerMenuAdminInbox';
        link.textContent = '📥 Gelen kutusu';
        masterMenuNavEkle(link, 'headerMenuIstatistik');
    }

    function menuIstatistikKaldir() {
        var link = document.getElementById('headerMenuIstatistik');
        if (link && link.parentNode) link.parentNode.removeChild(link);
    }

    function menuKamikazeKaldir() {
        var link = document.getElementById('headerMenuKamikaze');
        if (link && link.parentNode) link.parentNode.removeChild(link);
    }

    function menuKamikazeGuncelle() {
        if (!masterMi) {
            menuKamikazeKaldir();
            return;
        }
        if (document.getElementById('headerMenuKamikaze')) return;
        var nav = document.querySelector('.header-menu-nav');
        if (!nav) return;
        var link = document.createElement('a');
        link.href = '/kamikaze';
        link.className = 'header-menu-link header-menu-link--master';
        link.id = 'headerMenuKamikaze';
        link.textContent = '☄️ Kamikaze';
        masterMenuNavEkle(link, 'headerMenuMudavim');
        menuSosyalPaylasGuncelle();
    }

    function menuSosyalPaylasKaldir() {
        var link = document.getElementById('headerMenuSosyalPaylas');
        if (link && link.parentNode) link.parentNode.removeChild(link);
    }

    function menuSosyalPaylasGuncelle() {
        if (!masterMi) {
            menuSosyalPaylasKaldir();
            return;
        }
        var link = document.getElementById('headerMenuSosyalPaylas');
        if (link) return;
        var nav = document.querySelector('.header-menu-nav');
        if (!nav) return;
        link = document.createElement('a');
        link.href = '/sosyal-paylas';
        link.className = 'header-menu-link header-menu-link--master';
        link.id = 'headerMenuSosyalPaylas';
        link.textContent = '📱 Sosyal Medya Paylaşım';
        masterMenuNavEkle(link, 'headerMenuKamikaze');
    }

    function menuIstatistikGuncelle() {
        if (!masterMi) {
            menuAdminGonderimKaldir();
            menuIstatistikKaldir();
            menuMetrikKaldir();
            menuMudavimKaldir();
            menuKamikazeKaldir();
            menuSosyalPaylasKaldir();
            eskiMasterMenuTemizle();
            return;
        }
        var link = document.getElementById('headerMenuIstatistik');
        if (!link) {
            var nav = document.querySelector('.header-menu-nav');
            if (!nav) return;
            link = document.createElement('a');
            link.href = '/istatistikler';
            link.className = 'header-menu-link header-menu-link--master';
            link.id = 'headerMenuIstatistik';
            link.textContent = '📊 İstatistikler';
            masterMenuNavEkle(link, null);
        }
        menuMetrikGuncelle();
    }

    function menuMetrikKaldir() {
        var link = document.getElementById('headerMenuMetrik');
        if (link && link.parentNode) link.parentNode.removeChild(link);
    }

    function menuMetrikGuncelle() {
        if (!masterMi) {
            menuMetrikKaldir();
            menuMudavimKaldir();
            return;
        }
        var link = document.getElementById('headerMenuMetrik');
        if (link) return;
        var nav = document.querySelector('.header-menu-nav');
        if (!nav) return;
        link = document.createElement('a');
        link.href = '/metrikler';
        link.className = 'header-menu-link header-menu-link--master';
        link.id = 'headerMenuMetrik';
        link.textContent = '📈 Metrikler';
        masterMenuNavEkle(link, 'headerMenuIstatistik');
        menuMudavimGuncelle();
    }

    function menuMudavimKaldir() {
        var link = document.getElementById('headerMenuMudavim');
        if (link && link.parentNode) link.parentNode.removeChild(link);
    }

    function menuMudavimGuncelle() {
        if (!masterMi) {
            menuMudavimKaldir();
            return;
        }
        var link = document.getElementById('headerMenuMudavim');
        if (link) return;
        var nav = document.querySelector('.header-menu-nav');
        if (!nav) return;
        link = document.createElement('a');
        link.href = '/mudavimler';
        link.className = 'header-menu-link header-menu-link--master';
        link.id = 'headerMenuMudavim';
        link.textContent = '🏆 Müdavimler';
        masterMenuNavEkle(link, 'headerMenuMetrik');
        menuKamikazeGuncelle();
    }

    function menuUyelerKaldir() {
        var link = document.getElementById('headerMenuUyeler');
        if (link && link.parentNode) link.parentNode.removeChild(link);
    }

    function menuUyelerGuncelle() {
        menuUyelerKaldir();
    }

    function mountMenuItem() {
        var nav = document.querySelector('.header-profil-menu-nav');
        if (!nav) return;
        var btn = document.getElementById('headerProfilMasterBtn');
        if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
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

    function kartOySayisiOku(card) {
        var upEl = card.querySelector('.up-num');
        var downEl = card.querySelector('.down-num');
        return {
            up: upEl ? parseInt(upEl.textContent, 10) || 0 : 0,
            down: downEl ? parseInt(downEl.textContent, 10) || 0 : 0
        };
    }

    function oySayilariGuncelle(card, up, down) {
        var U = ui();
        var upN = parseInt(up, 10) || 0;
        var downN = parseInt(down, 10) || 0;
        var upStr = U && U.formatSayac ? U.formatSayac(upN) : String(upN);
        var downStr = U && U.formatSayac ? U.formatSayac(downN) : String(downN);
        var upEl = card.querySelector('.up-num');
        var downEl = card.querySelector('.down-num');
        if (upEl) upEl.textContent = upStr;
        if (downEl) downEl.textContent = downStr;
        var bar = card.querySelector('.master-hikaye-aksiyon');
        if (bar) {
            var uIn = bar.querySelector('[data-m-up]');
            var dIn = bar.querySelector('[data-m-down]');
            if (uIn) uIn.value = String(upN);
            if (dIn) dIn.value = String(downN);
        }
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
        if (!D || !D.masterHikayeIslem) {
            if (ui() && ui().showToast) ui().showToast('Master API yüklenemedi', 'hata');
            return;
        }
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
            var it = sonuc.hikaye;
            if (!it) return;
            if (islem === 'sil') {
                card.remove();
                if (ui() && ui().showToast) ui().showToast('Hikaye silindi');
                return;
            }
            if (islem !== 'meta') {
                duzenleKapat(card);
            }
            if (it.content_full != null) {
                kartMetinGuncelle(card, it.content_full);
            }
            if (it.up_votes != null) {
                oySayilariGuncelle(card, it.up_votes, it.down_votes);
            }
            if (islem === 'meta') {
                kartMetaGuncelleUi(card, it);
            }
            if (ui() && ui().showToast) {
                if (islem === 'oylar') {
                    ui().showToast('Oylar kaydedildi: 👍 ' + it.up_votes + ' · 👎 ' + it.down_votes);
                } else if (islem === 'meta') {
                    ui().showToast('Kart profili güncellendi');
                } else {
                    ui().showToast('Kaydedildi');
                }
            }
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
                    document.querySelectorAll('.card[data-hikaye-user-id="' + uyeId + '"]').forEach(kartRumuzGizli);
                } else if (islem === 'gizli_kaldir' && sonuc.uye && sonuc.uye.username) {
                    document.querySelectorAll('.card[data-hikaye-user-id="' + uyeId + '"]').forEach(function (c) {
                        kartRumuzGoster(c, sonuc.uye.username);
                    });
                }
            }
        } catch (err) {
            if (ui() && ui().showToast) ui().showToast(D.hataMesaji ? D.hataMesaji(err) : String(err), 'hata');
        }
    }

    async function uyeIdCoz(card) {
        var uid = card.getAttribute('data-hikaye-user-id');
        if (uid) return uid;
        var rumuz = card.getAttribute('data-hikaye-username');
        if (!rumuz) {
            var el = card.querySelector('.username');
            rumuz = el ? el.textContent.trim() : '';
            if (rumuz && rumuz !== 'Gizli Üye' && rumuz !== 'Müdavim') {
                card.setAttribute('data-hikaye-username', rumuz);
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
                card.setAttribute('data-hikaye-user-id', sonuc.uye.id);
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

    function profil() {
        return global.Gunde5Profil;
    }

    function kartMetaOku(card) {
        var age = parseInt(card.getAttribute('data-hikaye-age'), 10);
        if (isNaN(age)) {
            var metaEl = card.querySelector('.user-meta');
            if (metaEl) {
                var m = metaEl.textContent.match(/(\d+)\s*Yaş/);
                if (m) age = parseInt(m[1], 10);
            }
        }
        var gender = card.getAttribute('data-hikaye-gender');
        if (!gender) {
            gender = card.classList.contains('male') ? 'male' : 'female';
        }
        return {
            age: isNaN(age) ? 25 : age,
            gender: gender === 'male' ? 'male' : 'female',
            yasadigi_yer: card.getAttribute('data-hikaye-yer') || '',
            yurtdisi_sehir: card.getAttribute('data-hikaye-yurtdisi') || ''
        };
    }

    function kartMetaGuncelleUi(card, it) {
        if (!card || !it) return;
        var cins = it.gender === 'male' ? 'male' : 'female';
        card.classList.remove('male', 'female');
        card.classList.add(cins);
        if (it.age != null) card.setAttribute('data-hikaye-age', String(it.age));
        if (it.gender) card.setAttribute('data-hikaye-gender', it.gender);
        if (it.yasadigi_yer) {
            card.setAttribute('data-hikaye-yer', it.yasadigi_yer);
        } else {
            card.removeAttribute('data-hikaye-yer');
        }
        if (it.yurtdisi_sehir) {
            card.setAttribute('data-hikaye-yurtdisi', it.yurtdisi_sehir);
        } else {
            card.removeAttribute('data-hikaye-yurtdisi');
        }
        var det = card.querySelector('.user-details');
        if (det && ui() && ui().kullaniciMetaHtml) {
            var metaHtml = ui().kullaniciMetaHtml({
                age: it.age,
                gender: it.gender,
                yasadigi_yer: it.yasadigi_yer,
                yurtdisi_sehir: it.yurtdisi_sehir,
                meslek: it.meslek,
                medeni_durum: it.medeni_durum,
                is_gizli: false
            });
            var old = det.querySelector('.user-meta');
            if (old) {
                old.outerHTML = metaHtml;
            } else if (metaHtml) {
                det.insertAdjacentHTML('beforeend', metaHtml);
            }
        }
    }

    function botMetaBar(card) {
        var bar = document.createElement('div');
        bar.className = 'master-uye-aksiyon master-bot-meta-wrap';
        var meta = kartMetaOku(card);
        var P = profil();
        var yerHtml = '<option value="">—</option>';
        if (P && P.YER_SECENEKLERI) {
            P.YER_SECENEKLERI.forEach(function (s) {
                yerHtml +=
                    '<option value="' + esc(s.value) + '"' +
                    (meta.yasadigi_yer === s.value ? ' selected' : '') +
                    '>' + esc(s.label) + '</option>';
            });
        }
        var yurtdisiGizli = meta.yasadigi_yer !== 'yurtdisi';
        bar.innerHTML =
            '<span class="master-uye-aksiyon-etiket">Kart</span>' +
            '<div class="master-bot-meta">' +
            '<label>Yaş <input type="number" data-m-meta-age min="18" max="120" value="' +
            esc(meta.age) + '"></label>' +
            '<label>Cinsiyet <select data-m-meta-gender>' +
            '<option value="female"' + (meta.gender === 'female' ? ' selected' : '') + '>Kadın</option>' +
            '<option value="male"' + (meta.gender === 'male' ? ' selected' : '') + '>Erkek</option>' +
            '</select></label>' +
            '<label>İl <select data-m-meta-yer>' + yerHtml + '</select></label>' +
            '<label class="master-bot-yurtdisi' + (yurtdisiGizli ? ' master-bot-yurtdisi--gizli' : '') +
            '">Yurtdışı şehir <input type="text" data-m-meta-yurtdisi maxlength="80" value="' +
            esc(meta.yurtdisi_sehir) + '"></label>' +
            '<button type="button" class="master-aksiyon-btn" data-m-meta-kaydet>Profili kaydet</button>' +
            '</div>';

        var yerSel = bar.querySelector('[data-m-meta-yer]');
        var yurtdisiWrap = bar.querySelector('.master-bot-yurtdisi');
        if (yerSel && yurtdisiWrap) {
            yerSel.addEventListener('change', function () {
                yurtdisiWrap.classList.toggle('master-bot-yurtdisi--gizli', yerSel.value !== 'yurtdisi');
            });
        }
        bar.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-m-meta-kaydet]');
            if (!btn) return;
            e.stopPropagation();
            var ageInp = bar.querySelector('[data-m-meta-age]');
            var cinsSel = bar.querySelector('[data-m-meta-gender]');
            var yurtdisiInp = bar.querySelector('[data-m-meta-yurtdisi]');
            var yerVal = yerSel ? yerSel.value : '';
            hikayeIslem(card, 'meta', {
                age: parseInt(ageInp && ageInp.value, 10),
                gender: cinsSel ? cinsSel.value : 'female',
                yasadigi_yer: yerVal || null,
                yurtdisi_sehir: yerVal === 'yurtdisi' && yurtdisiInp
                    ? yurtdisiInp.value.trim() || null
                    : null
            });
        });
        return bar;
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
        var oySay = kartOySayisiOku(card);
        var upVal = String(oySay.up);
        var downVal = String(oySay.down);

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
            '<select data-m-status><option value="kulis"' + (status === 'kulis' ? ' selected' : '') + '>Index</option>' +
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
            } else if (!card.querySelector('.master-bot-meta-wrap')) {
                var rumuz = card.getAttribute('data-hikaye-username') ||
                    (card.querySelector('.username') && card.querySelector('.username').textContent.trim());
                if (rumuz && rumuz !== 'Gizli Üye' && rumuz !== 'Müdavim') {
                    header.insertAdjacentElement('afterend', botMetaBar(card));
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
        return;
    }

    function gozlemciBaslat() {
        if (gozlemci) return;
        gozlemci = new MutationObserver(function () {
            if (modAktifMi()) kartlariBagla();
        });
        ['podyumListe'].forEach(function (id) {
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
