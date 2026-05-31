/**
 * Hikaye yaz modalı — anasayfa ve podyum ortak.
 */
(function (global) {
    'use strict';

    var hikayeModalMasterMi = false;
    var gonderDevamEdiyor = false;

    function ui() {
        return global.Gunde5UI;
    }

    function db() {
        return global.Gunde5DB;
    }

    function rpcSonucNorm(sonuc) {
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

    function doldurMasterIlSecenekleri() {
        var sel = document.getElementById('masterHikayeIl');
        if (!sel || sel.options.length > 1) return;
        var P = global.Gunde5Profil;
        var html = '<option value="">— Seç —</option>';
        if (P && P.YER_SECENEKLERI) {
            P.YER_SECENEKLERI.forEach(function (s) {
                if (!s.value) return;
                html += '<option value="' + s.value.replace(/"/g, '&quot;') + '">' +
                    String(s.label).replace(/</g, '&lt;') + '</option>';
            });
        }
        sel.innerHTML = html;
    }

    function masterYurtdisiGoster() {
        var il = document.getElementById('masterHikayeIl');
        var wrap = document.getElementById('masterHikayeYurtdisiWrap');
        if (!il || !wrap) return;
        wrap.hidden = il.value !== 'yurtdisi';
    }

    function masterPlanVarsayilanDoldur() {
        var plan = document.getElementById('masterHikayePlan');
        if (!plan) return;
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

    function hikayeModalModuAyarla(master) {
        hikayeModalMasterMi = !!master;
        var uye = document.getElementById('hikayeUyeIcerik');
        var mst = document.getElementById('hikayeMasterIcerik');
        var baslik = document.getElementById('hikayeModalBaslik');
        var ipucu = document.querySelector('.hikaye-modal-ipucu');
        if (uye) uye.hidden = master;
        if (mst) mst.hidden = !master;
        if (baslik) {
            baslik.textContent = master ? 'Hikaye ekle' : 'Hikayeni Yaz';
        }
        if (ipucu) ipucu.style.display = master ? 'none' : '';
        if (master) {
            doldurMasterIlSecenekleri();
            masterYurtdisiGoster();
            masterPlanVarsayilanDoldur();
        }
    }

    function sifirlaHikayeModal() {
        var baslik = document.getElementById('hikayeBaslik');
        if (baslik) baslik.value = '';
        var ta = document.getElementById('hikayeTextarea');
        if (ta) ta.value = '';
        var gizli = document.getElementById('gizliUyeSec');
        if (gizli) {
            gizli.classList.remove('aktif');
            gizli.setAttribute('aria-pressed', 'false');
        }
        var rumuz = document.getElementById('masterHikayeRumuz');
        var yas = document.getElementById('masterHikayeYas');
        var cins = document.getElementById('masterHikayeCinsiyet');
        var il = document.getElementById('masterHikayeIl');
        var yurtdisi = document.getElementById('masterHikayeYurtdisi');
        var plan = document.getElementById('masterHikayePlan');
        var masterBaslik = document.getElementById('masterHikayeBaslik');
        var metin = document.getElementById('masterHikayeMetin');
        if (rumuz) rumuz.value = '';
        if (yas) yas.value = '';
        if (cins) cins.value = 'female';
        if (il) il.value = '';
        if (yurtdisi) yurtdisi.value = '';
        if (plan) plan.value = '';
        if (masterBaslik) masterBaslik.value = '';
        if (metin) metin.value = '';
        masterYurtdisiGoster();
    }

    function planliTarihIso() {
        var inp = document.getElementById('masterHikayePlan');
        if (!inp || !inp.value) return null;
        var raw = String(inp.value).trim();
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return null;
        var d = new Date(raw);
        if (isNaN(d.getTime())) return null;
        return d.toISOString();
    }

    function gonderBtnDurum(btn, devamEdiyor, metin) {
        if (!btn) return;
        btn.disabled = !!devamEdiyor;
        if (metin != null) btn.textContent = metin;
    }

    function anasayfaMi() {
        var path = (global.location.pathname || '/').replace(/\/$/, '') || '/';
        return path === '' || path === '/' || path === '/index.html';
    }

    function hikayeGonderBasariliYenile(planliMi) {
        sifirlaHikayeModal();
        if (ui() && ui().kapatHikayeModal) ui().kapatHikayeModal();
        if (ui() && ui().showToast) {
            if (planliMi) {
                ui().showToast('Hikaye planlandı — anasayfada yayın saatinde görünür.');
            } else {
                ui().showToast('Hikaye yayında!');
            }
        }
        if (planliMi) return;
        if (anasayfaMi()) {
            if (global.Gunde5Index && global.Gunde5Index.baslat) {
                global.Gunde5Index.baslat().catch(function () {
                    global.location.reload();
                });
                return;
            }
            global.location.reload();
            return;
        }
        global.setTimeout(function () { global.location.href = '/'; }, 400);
    }

    async function gonderMasterHikaye() {
        if (gonderDevamEdiyor) return;

        var rumuz = (document.getElementById('masterHikayeRumuz').value || '').replace(/^\s+|\s+$/g, '');
        var yas = parseInt(document.getElementById('masterHikayeYas').value, 10);
        var cinsiyet = document.getElementById('masterHikayeCinsiyet').value;
        var yer = document.getElementById('masterHikayeIl').value;
        var yurtdisi = document.getElementById('masterHikayeYurtdisi').value.replace(/^\s+|\s+$/g, '');
        var baslik = (document.getElementById('masterHikayeBaslik').value || '').replace(/^\s+|\s+$/g, '');
        var metin = (document.getElementById('masterHikayeMetin').value || '').replace(/^\s+|\s+$/g, '');

        if (!rumuz) {
            document.getElementById('masterHikayeRumuz').focus();
            return;
        }
        if (!yas || yas < 18 || yas > 120) {
            document.getElementById('masterHikayeYas').focus();
            ui().showToast('Yaş 18–120 arasında olmalı.', 'hata');
            return;
        }
        if (!metin) {
            document.getElementById('masterHikayeMetin').focus();
            return;
        }

        var btn = document.getElementById('hikayeMasterGonderBtn');
        var btnMetin = btn ? btn.textContent : 'Gönder';
        gonderDevamEdiyor = true;
        gonderBtnDurum(btn, true, 'Gönderiliyor…');

        var planIso = planliTarihIso();
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

            var sonuc = rpcSonucNorm(await D.masterHikayeEkle(body));
            if (!sonuc || sonuc.ok !== true) {
                throw new Error((sonuc && sonuc.hata) || 'Kayıt başarısız');
            }

            var planliMi = planIso && new Date(planIso).getTime() > Date.now();
            gonderDevamEdiyor = false;
            hikayeGonderBasariliYenile(planliMi);
        } catch (err) {
            var Derr = db();
            var mesaj = (Derr && Derr.hataMesaji)
                ? Derr.hataMesaji(err)
                : ((err && err.message) ? err.message : 'Kayıt başarısız');
            if (ui() && ui().showToast) ui().showToast(mesaj, 'hata');
        } finally {
            gonderDevamEdiyor = false;
            gonderBtnDurum(btn, false, btnMetin || 'Gönder');
        }
    }

    async function gonderHikaye() {
        if (gonderDevamEdiyor) return;
        if (!ui() || !ui().hikayeUyeGerekli || !ui().hikayeUyeGerekli()) return;

        if (hikayeModalMasterMi) {
            await gonderMasterHikaye();
            return;
        }

        var baslik = (document.getElementById('hikayeBaslik').value || '').replace(/^\s+|\s+$/g, '');
        var metin = document.getElementById('hikayeTextarea').value.replace(/^\s+|\s+$/g, '');
        if (!metin) {
            document.getElementById('hikayeTextarea').focus();
            return;
        }

        var gizli = document.getElementById('gizliUyeSec').classList.contains('aktif');
        var btn = document.getElementById('hikayeGonderBtn');
        var btnMetin = btn ? btn.textContent : 'Gönder';
        gonderDevamEdiyor = true;
        gonderBtnDurum(btn, true, 'Gönderiliyor…');

        try {
            var D = db();
            if (D.init) await D.init();
            await D.hikayeGonder(metin, gizli, baslik || null);
            gonderDevamEdiyor = false;
            hikayeGonderBasariliYenile(false);
        } catch (err) {
            var Derr = db();
            ui().showToast(Derr && Derr.hataMesaji ? Derr.hataMesaji(err) : String(err), 'hata');
        } finally {
            gonderDevamEdiyor = false;
            gonderBtnDurum(btn, false, btnMetin || 'Gönder');
        }
    }

    async function acHikayeModal() {
        if (!ui() || !ui().hikayeUyeGerekli || !ui().hikayeUyeGerekli()) return;
        ui().closeAuthModal();

        var master = false;
        try {
            var D = db();
            if (D && D.masterDurum) {
                var d = await D.masterDurum();
                master = !!(d && d.master);
            }
        } catch (eMaster) { /* ignore */ }

        hikayeModalModuAyarla(master);
        var modal = document.getElementById('hikayeModal');
        if (!modal) return;
        modal.classList.add('acik');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        global.setTimeout(function () {
            var el = master
                ? document.getElementById('masterHikayeRumuz')
                : document.getElementById('hikayeBaslik');
            if (el) el.focus();
        }, 220);
    }

    function etkinlikleriBagla(opts) {
        if (global.__g5HikayeYazBagli) return;
        global.__g5HikayeYazBagli = true;

        var o = opts || {};
        var navYaz = document.getElementById(o.navYazId || 'navYazBtn');
        var modalKapat = document.getElementById('hikayeModalKapat');
        var gizliSec = document.getElementById('gizliUyeSec');
        var gonderBtn = document.getElementById('hikayeGonderBtn');
        var masterIl = document.getElementById('masterHikayeIl');
        var masterGonder = document.getElementById('hikayeMasterGonderBtn');
        var modal = document.getElementById('hikayeModal');

        if (navYaz) navYaz.addEventListener('click', acHikayeModal);
        if (modalKapat) {
            modalKapat.addEventListener('click', function () {
                if (ui() && ui().kapatHikayeModal) ui().kapatHikayeModal();
            });
        }
        if (modal) {
            modal.addEventListener('click', function (ev) {
                if (ev.target === modal && ui() && ui().kapatHikayeModal) {
                    ui().kapatHikayeModal();
                }
            });
        }
        if (gizliSec) {
            gizliSec.addEventListener('click', function () {
                var b = this;
                b.classList.toggle('aktif');
                b.setAttribute('aria-pressed', b.classList.contains('aktif') ? 'true' : 'false');
            });
        }
        if (gonderBtn) gonderBtn.addEventListener('click', gonderHikaye);
        if (masterIl) masterIl.addEventListener('change', masterYurtdisiGoster);
        if (masterGonder) masterGonder.addEventListener('click', gonderHikaye);
        var planTemizle = document.getElementById('masterHikayePlanTemizle');
        if (planTemizle) {
            planTemizle.addEventListener('click', function () {
                var inp = document.getElementById('masterHikayePlan');
                if (inp) {
                    inp.value = '';
                    inp.focus();
                }
            });
        }
    }

    function init(opts) {
        etkinlikleriBagla(opts);
    }

    global.acHikayeModal = acHikayeModal;
    global.gonderHikaye = gonderHikaye;
    global.acItirafModal = acHikayeModal;
    global.gonderItiraf = gonderHikaye;

    global.Gunde5HikayeYaz = {
        init: init,
        ac: acHikayeModal,
        gonder: gonderHikaye
    };
})(window);
