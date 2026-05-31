/**
 * Hikaye yaz modalı — index ve podyum.
 */
(function (global) {
    'use strict';

    var masterMode = false;
    var sending = false;

    function ui() {
        return global.Gunde5UI;
    }

    function db() {
        return global.Gunde5DB;
    }

    function el(id) {
        return document.getElementById(id);
    }

    function trim(s) {
        return String(s || '').replace(/^\s+|\s+$/g, '');
    }

    function toast(msg, tip) {
        if (ui() && ui().showToast) {
            ui().showToast(msg, tip);
            return;
        }
        if (typeof global.indexToast === 'function') {
            global.indexToast(msg);
        }
    }

    function modalAc() {
        if (ui() && ui().acHikayeModal) {
            ui().acHikayeModal();
            return;
        }
        var modal = el('hikayeModal');
        if (!modal) return;
        modal.classList.add('acik');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function modalKapat() {
        if (ui() && ui().kapatHikayeModal) {
            ui().kapatHikayeModal();
        }
    }

    function rpcJson(sonuc) {
        if (sonuc == null) return sonuc;
        if (typeof sonuc === 'string') {
            try {
                return JSON.parse(sonuc);
            } catch (e) {
                return sonuc;
            }
        }
        return sonuc;
    }

    function hataMesaji(err, yedek) {
        var D = db();
        if (D && D.hataMesaji) return D.hataMesaji(err);
        return (err && err.message) ? err.message : (yedek || 'İşlem başarısız');
    }

    function anasayfaMi() {
        var path = (global.location.pathname || '/').replace(/\/$/, '') || '/';
        return path === '' || path === '/' || path === '/index.html';
    }

    function yazDerinBaglantiMi() {
        if (global.location.hash === '#yaz') return true;
        try {
            return global.location.search.indexOf('yaz=1') >= 0;
        } catch (e) {
            return false;
        }
    }

    function yazDerinBaglantiTemizle() {
        if (!yazDerinBaglantiMi()) return;
        try {
            var url = new URL(global.location.href);
            url.searchParams.delete('yaz');
            if (url.hash === '#yaz') url.hash = '';
            global.history.replaceState(null, '', url.pathname + url.search + url.hash);
        } catch (eUrl) { /* ignore */ }
    }

    // --- Form durumu ---

    function uyeFormuSifirla() {
        var baslik = el('hikayeBaslik');
        var metin = el('hikayeTextarea');
        var gizli = el('gizliUyeSec');
        if (baslik) baslik.value = '';
        if (metin) metin.value = '';
        if (gizli) {
            gizli.classList.remove('aktif');
            gizli.setAttribute('aria-pressed', 'false');
        }
        gizliSecenegiGuncelle();
    }

    function masterFormuSifirla() {
        var alanlar = [
            'masterHikayeRumuz', 'masterHikayeYas', 'masterHikayeYurtdisi',
            'masterHikayeBaslik', 'masterHikayeMetin'
        ];
        alanlar.forEach(function (id) {
            var node = el(id);
            if (node) node.value = '';
        });
        var cins = el('masterHikayeCinsiyet');
        var il = el('masterHikayeIl');
        var plan = el('masterHikayePlan');
        if (cins) cins.value = 'female';
        if (il) il.value = '';
        if (plan) plan.value = '';
        masterYurtdisiGoster();
        masterPlanVarsayilan();
    }

    function formuSifirla() {
        uyeFormuSifirla();
        masterFormuSifirla();
    }

    function moduAyarla(master) {
        masterMode = !!master;
        var uye = el('hikayeUyeIcerik');
        var mst = el('hikayeMasterIcerik');
        var baslik = el('hikayeModalBaslik');
        var ipucu = document.querySelector('.hikaye-modal-ipucu');
        if (uye) uye.hidden = master;
        if (mst) mst.hidden = !master;
        if (baslik) baslik.textContent = master ? 'Hikaye ekle' : 'Hikayeni Yaz';
        if (ipucu) ipucu.hidden = master;
        if (master) {
            masterIlDoldur();
            masterYurtdisiGoster();
            masterPlanVarsayilan();
        }
    }

    function gizliSecenegiGuncelle() {
        var btn = el('gizliUyeSec');
        if (!btn) return;
        var D = db();
        var u = D && D.getGunde5User ? D.getGunde5User() : null;
        var zorunlu = !!(u && u.zorunluGizli);
        btn.hidden = zorunlu;
        if (zorunlu) {
            btn.classList.add('aktif');
            btn.setAttribute('aria-pressed', 'true');
        }
    }

    function masterIlDoldur() {
        var sel = el('masterHikayeIl');
        if (!sel || sel.options.length > 1) return;
        var P = global.Gunde5Profil;
        var html = '<option value="">— Seç —</option>';
        if (P && P.YER_SECENEKLERI) {
            P.YER_SECENEKLERI.forEach(function (s) {
                if (!s.value) return;
                html += '<option value="' + String(s.value).replace(/"/g, '&quot;') + '">' +
                    String(s.label).replace(/</g, '&lt;') + '</option>';
            });
        }
        sel.innerHTML = html;
    }

    function masterYurtdisiGoster() {
        var il = el('masterHikayeIl');
        var wrap = el('masterHikayeYurtdisiWrap');
        if (!il || !wrap) return;
        wrap.hidden = il.value !== 'yurtdisi';
    }

    function masterPlanVarsayilan() {
        var plan = el('masterHikayePlan');
        if (!plan || plan.value) return;
        var d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1);
        var gun = String(d.getDate());
        if (m.length < 2) m = '0' + m;
        if (gun.length < 2) gun = '0' + gun;
        plan.value = y + '-' + m + '-' + gun + 'T09:00';
    }

    function planliTarihIso() {
        var inp = el('masterHikayePlan');
        if (!inp || !inp.value) return null;
        var raw = trim(inp.value);
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return null;
        var d = new Date(raw);
        if (isNaN(d.getTime())) return null;
        return d.toISOString();
    }

    function gonderBtnAyar(btn, devam, metin) {
        if (!btn) return;
        btn.disabled = !!devam;
        if (metin != null) btn.textContent = metin;
    }

    async function masterMi() {
        try {
            var D = db();
            if (!D || !D.masterDurum) return false;
            var d = await D.masterDurum();
            return !!(d && d.master);
        } catch (e) {
            return false;
        }
    }

    // --- Gönderim ---

    function basariSonrasi(planliMi) {
        formuSifirla();
        modalKapat();
        yazDerinBaglantiTemizle();
        if (planliMi) {
            toast('Hikaye planlandı — anasayfada yayın saatinde görünür.');
            return;
        }
        toast('Hikaye yayında!');
        if (!anasayfaMi()) {
            global.setTimeout(function () {
                global.location.href = '/';
            }, 400);
            return;
        }
        if (global.Gunde5Index && global.Gunde5Index.baslat) {
            global.Gunde5Index.baslat().catch(function () {
                global.location.reload();
            });
            return;
        }
        global.location.reload();
    }

    async function gonderUye() {
        var metinEl = el('hikayeTextarea');
        var metin = trim(metinEl && metinEl.value);
        if (!metin) {
            if (metinEl) metinEl.focus();
            toast('Hikaye metnini yaz.', 'hata');
            return;
        }

        var baslik = trim(el('hikayeBaslik') && el('hikayeBaslik').value);
        var gizliBtn = el('gizliUyeSec');
        var gizli = gizliBtn && gizliBtn.classList.contains('aktif');
        var btn = el('hikayeGonderBtn');
        var btnMetin = btn ? btn.textContent : 'Gönder';

        sending = true;
        gonderBtnAyar(btn, true, 'Gönderiliyor…');
        try {
            var D = db();
            if (!D || !D.hikayeGonder) {
                throw new Error('Hikaye gönderme hazır değil. Sayfayı yenileyip tekrar dene.');
            }
            if (D.init) await D.init();
            await D.hikayeGonder(metin, gizli, baslik || null);
            basariSonrasi(false);
        } catch (err) {
            toast(hataMesaji(err), 'hata');
        } finally {
            sending = false;
            gonderBtnAyar(btn, false, btnMetin);
        }
    }

    async function gonderMaster() {
        var rumuzEl = el('masterHikayeRumuz');
        var yasEl = el('masterHikayeYas');
        var metinEl = el('masterHikayeMetin');
        var rumuz = trim(rumuzEl && rumuzEl.value);
        var yas = parseInt(yasEl && yasEl.value, 10);
        var cinsiyet = el('masterHikayeCinsiyet') ? el('masterHikayeCinsiyet').value : 'female';
        var yer = el('masterHikayeIl') ? el('masterHikayeIl').value : '';
        var yurtdisi = trim(el('masterHikayeYurtdisi') && el('masterHikayeYurtdisi').value);
        var baslik = trim(el('masterHikayeBaslik') && el('masterHikayeBaslik').value);
        var metin = trim(metinEl && metinEl.value);

        if (!rumuz) {
            if (rumuzEl) rumuzEl.focus();
            toast('Rumuz gir.', 'hata');
            return;
        }
        if (!yas || yas < 18 || yas > 120) {
            if (yasEl) yasEl.focus();
            toast('Yaş 18–120 arasında olmalı.', 'hata');
            return;
        }
        if (!metin) {
            if (metinEl) metinEl.focus();
            toast('Hikaye metnini yaz.', 'hata');
            return;
        }

        var btn = el('hikayeMasterGonderBtn');
        var btnMetin = btn ? btn.textContent : 'Gönder';
        var planIso = planliTarihIso();

        sending = true;
        gonderBtnAyar(btn, true, 'Gönderiliyor…');
        try {
            var D = db();
            if (!D || !D.masterHikayeEkle) {
                throw new Error('Hikaye gönderme hazır değil. Sayfayı yenileyip tekrar dene.');
            }
            if (D.init) await D.init();
            var body = {
                username: rumuz,
                age: yas,
                gender: cinsiyet,
                yasadigi_yer: yer || null,
                yurtdisi_sehir: yer === 'yurtdisi' ? (yurtdisi || null) : null,
                content_full: metin
            };
            if (baslik) body.baslik = baslik;
            if (planIso) body.created_at = planIso;

            var sonuc = rpcJson(await D.masterHikayeEkle(body));
            if (!sonuc || sonuc.ok !== true) {
                throw new Error((sonuc && sonuc.hata) || 'Kayıt başarısız');
            }
            var planliMi = planIso && new Date(planIso).getTime() > Date.now();
            basariSonrasi(planliMi);
        } catch (err) {
            toast(hataMesaji(err), 'hata');
        } finally {
            sending = false;
            gonderBtnAyar(btn, false, btnMetin);
        }
    }

    async function gonder() {
        if (sending) return;
        if (!ui() || !ui().hikayeUyeGerekli || !ui().hikayeUyeGerekli()) return;
        if (masterMode) await gonderMaster();
        else await gonderUye();
    }

    async function ac() {
        if (!ui() || !ui().hikayeUyeGerekli || !ui().hikayeUyeGerekli()) return;
        if (ui().closeAuthModal) ui().closeAuthModal();

        var D = db();
        if (D && D.init) {
            try {
                await D.init();
            } catch (eInit) { /* profil yüklenemese de modal açılabilir */ }
        }

        moduAyarla(await masterMi());
        formuSifirla();
        modalAc();

        global.setTimeout(function () {
            var hedef = masterMode ? el('masterHikayeRumuz') : el('hikayeBaslik');
            if (hedef) hedef.focus();
        }, 180);
    }

    // --- Olaylar ---

    function olaylariBagla(opts) {
        var modal = el('hikayeModal');
        if (!modal || modal.dataset.g5HikayeBound === '1') return;
        modal.dataset.g5HikayeBound = '1';

        var navId = (opts && opts.navYazId) || 'navYazBtn';
        var nav = el(navId);
        if (nav && nav.dataset.g5YazNavBound !== '1') {
            nav.dataset.g5YazNavBound = '1';
            nav.addEventListener('click', function (ev) {
                ev.preventDefault();
                ac();
            });
        }

        var kapat = el('hikayeModalKapat');
        if (kapat) {
            kapat.addEventListener('click', function () {
                modalKapat();
            });
        }

        modal.addEventListener('click', function (ev) {
            if (ev.target === modal) modalKapat();
        });

        var gizli = el('gizliUyeSec');
        if (gizli) {
            gizli.addEventListener('click', function () {
                this.classList.toggle('aktif');
                this.setAttribute('aria-pressed', this.classList.contains('aktif') ? 'true' : 'false');
            });
        }

        var uyeGonder = el('hikayeGonderBtn');
        var masterGonder = el('hikayeMasterGonderBtn');
        if (uyeGonder) uyeGonder.addEventListener('click', gonder);
        if (masterGonder) masterGonder.addEventListener('click', gonder);

        var masterIl = el('masterHikayeIl');
        if (masterIl) masterIl.addEventListener('change', masterYurtdisiGoster);

        var planTemizle = el('masterHikayePlanTemizle');
        if (planTemizle) {
            planTemizle.addEventListener('click', function () {
                var inp = el('masterHikayePlan');
                if (inp) {
                    inp.value = '';
                    inp.focus();
                }
            });
        }

        global.document.addEventListener('keydown', function (ev) {
            if (ev.key !== 'Escape') return;
            if (!modal.classList.contains('acik')) return;
            modalKapat();
        });
    }

    function init(opts) {
        if (!el('hikayeModal')) return;
        olaylariBagla(opts);
        if (yazDerinBaglantiMi()) {
            global.setTimeout(function () {
                ac();
            }, 400);
        }
    }

    global.acHikayeModal = ac;
    global.gonderHikaye = gonder;
    global.acItirafModal = ac;
    global.gonderItiraf = gonder;

    global.Gunde5HikayeYaz = {
        init: init,
        ac: ac,
        gonder: gonder
    };
})(window);
