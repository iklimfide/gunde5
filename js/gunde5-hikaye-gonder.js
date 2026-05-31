/**
 * Master — hikaye gönder sayfası (/hikaye-gonder)
 */
(function (global) {
    'use strict';

    var sending = false;

    function db() { return global.Gunde5DB; }
    function ui() { return global.Gunde5UI; }

    function el(id) { return document.getElementById(id); }

    function trim(s) {
        return String(s || '').replace(/^\s+|\s+$/g, '');
    }

    function toast(msg, tip) {
        if (ui() && ui().showToast) ui().showToast(msg, tip);
    }

    function rpcJson(sonuc) {
        if (sonuc == null) return sonuc;
        if (typeof sonuc === 'string') {
            try { return JSON.parse(sonuc); } catch (e) { return sonuc; }
        }
        return sonuc;
    }

    function hataMesaji(err) {
        var D = db();
        if (D && D.hataMesaji) return D.hataMesaji(err);
        return (err && err.message) ? err.message : 'İşlem başarısız';
    }

    function ilDoldur() {
        var sel = el('hgIl');
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

    function yurtdisiGoster() {
        var il = el('hgIl');
        var wrap = el('hgYurtdisiWrap');
        if (!il || !wrap) return;
        wrap.hidden = il.value !== 'yurtdisi';
    }

    /** datetime-local değerini yerel saat olarak okur (tarayıcı UTC yorumlama hatasına düşmemek için). */
    function planliTarihOku() {
        var inp = el('hgPlan');
        if (!inp) return null;
        var raw = trim(inp.value);
        if (!raw) return null;
        var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw);
        if (!m) return null;
        var d = new Date(
            parseInt(m[1], 10),
            parseInt(m[2], 10) - 1,
            parseInt(m[3], 10),
            parseInt(m[4], 10),
            parseInt(m[5], 10),
            m[6] ? parseInt(m[6], 10) : 0,
            0
        );
        if (isNaN(d.getTime())) return null;
        return d;
    }

    function formuSifirla() {
        ['hgRumuz', 'hgYas', 'hgYurtdisi', 'hgBaslik', 'hgMetin'].forEach(function (id) {
            var node = el(id);
            if (node) node.value = '';
        });
        var cins = el('hgCinsiyet');
        var il = el('hgIl');
        var plan = el('hgPlan');
        if (cins) cins.value = 'female';
        if (il) il.value = '';
        if (plan) plan.value = '';
        yurtdisiGoster();
    }

    function yetkisizGoster(metin, girisGoster) {
        var y = el('hgYetkisiz');
        var f = el('hgFormWrap');
        var m = el('hgYetkisizMetin');
        var g = el('hgGirisBtn');
        if (f) f.hidden = true;
        if (y) y.hidden = false;
        if (m) m.textContent = metin;
        if (g) g.hidden = !girisGoster;
    }

    function icerikGoster() {
        var y = el('hgYetkisiz');
        var f = el('hgFormWrap');
        if (y) y.hidden = true;
        if (f) f.hidden = false;
        ilDoldur();
        yurtdisiGoster();
    }

    async function gonder() {
        if (sending) return;

        var rumuzEl = el('hgRumuz');
        var yasEl = el('hgYas');
        var metinEl = el('hgMetin');
        var rumuz = trim(rumuzEl && rumuzEl.value);
        var yas = parseInt(yasEl && yasEl.value, 10);
        var cinsiyet = el('hgCinsiyet') ? el('hgCinsiyet').value : 'female';
        var yer = el('hgIl') ? el('hgIl').value : '';
        var yurtdisi = trim(el('hgYurtdisi') && el('hgYurtdisi').value);
        var baslik = trim(el('hgBaslik') && el('hgBaslik').value);
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

        var btn = el('hgGonderBtn');
        var btnMetin = 'Gönder';
        var planHam = trim(el('hgPlan') && el('hgPlan').value);
        var planTarih = planHam ? planliTarihOku() : null;

        if (planHam && !planTarih) {
            toast('Yayın tarihi okunamadı. Tarihi silip tekrar seç.', 'hata');
            return;
        }

        var D = db();
        if (!D || !D.masterHikayeEkle) {
            toast('Hikaye gönderme hazır değil. Sayfayı yenileyip tekrar dene.', 'hata');
            return;
        }

        sending = true;
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Gönderiliyor…';
        }

        var bitti = false;
        var guvenlikZamanlayici = global.setTimeout(function () {
            if (bitti) return;
            sending = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = btnMetin;
            }
            toast('Sunucu yanıt vermedi. Sayfayı yenileyip tekrar dene.', 'hata');
        }, 22000);

        try {
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
            if (planTarih) body.created_at = planTarih.toISOString();

            var sonuc = rpcJson(await D.masterHikayeEkle(body));
            if (!sonuc || sonuc.ok !== true) {
                throw new Error((sonuc && sonuc.hata) || 'Kayıt başarısız');
            }

            formuSifirla();
            if (planTarih) {
                toast('Hikaye planlandı — yayın: ' + planHam.replace('T', ' '));
            } else {
                toast('Hikaye yayında!');
            }
        } catch (err) {
            toast(hataMesaji(err), 'hata');
        } finally {
            bitti = true;
            global.clearTimeout(guvenlikZamanlayici);
            sending = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = btnMetin;
            }
        }
    }

    function olaylariBagla() {
        var form = el('hgForm');
        if (!form || form.dataset.g5HgBound === '1') return;
        form.dataset.g5HgBound = '1';

        form.addEventListener('submit', function (ev) {
            ev.preventDefault();
            gonder();
        });

        var il = el('hgIl');
        if (il) il.addEventListener('change', yurtdisiGoster);

        var planTemizle = el('hgPlanTemizle');
        if (planTemizle) {
            planTemizle.addEventListener('click', function () {
                var inp = el('hgPlan');
                if (inp) {
                    inp.value = '';
                    inp.focus();
                }
            });
        }

        var giris = el('hgGirisBtn');
        if (giris) {
            giris.addEventListener('click', function () {
                global.location.href = '/';
            });
        }
    }

    async function init() {
        var D = db();
        if (!D) return;
        try { await D.init(); } catch (eInit) { /* */ }
        if (ui() && ui().guncelleHeaderOturum) ui().guncelleHeaderOturum();
        if (global.Gunde5Master && global.Gunde5Master.durumYenile) {
            try { await global.Gunde5Master.durumYenile(); } catch (eM) { /* */ }
        }

        var oturum = D.getGunde5User && D.getGunde5User();
        if (!oturum || !oturum.id) {
            yetkisizGoster('Hikaye göndermek için site yöneticisi hesabıyla giriş yapın.', true);
            return;
        }

        var durum;
        try { durum = await D.masterDurum(); } catch (eD) { durum = { master: false }; }
        if (!durum || !durum.master) {
            yetkisizGoster('Bu sayfa yalnızca site yöneticisi (master) hesabı içindir.', false);
            return;
        }

        icerikGoster();
        olaylariBagla();
    }

    global.Gunde5HikayeGonder = { init: init };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
