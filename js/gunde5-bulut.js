/**
 * gunde5.com — /bulut gizli yönetici girişi (master)
 */
(function (global) {
    'use strict';

    function el(id) {
        return global.document.getElementById(id);
    }

    function db() {
        return global.Gunde5DB;
    }

    function ui() {
        return global.Gunde5UI;
    }

    function toast(mesaj, tur) {
        if (ui() && ui().showToast) {
            ui().showToast(mesaj, tur);
            return;
        }
        var h = el('bulutHata');
        if (h) {
            h.textContent = mesaj;
            h.hidden = false;
        }
    }

    function yukleniyorGoster(acik) {
        var y = el('bulutYukleniyor');
        if (y) y.hidden = !acik;
    }

    function panelGoster(id) {
        var paneller = ['bulutGiris', 'bulutRed', 'bulutOk'];
        paneller.forEach(function (pid) {
            var node = el(pid);
            if (node) node.hidden = pid !== id;
        });
        yukleniyorGoster(false);
    }

    function hataGoster(mesaj) {
        var h = el('bulutHata');
        if (!h) {
            toast(mesaj, 'hata');
            return;
        }
        h.textContent = mesaj;
        h.hidden = !mesaj;
    }

    function yonlendirAnasayfa(gecikmeMs) {
        var ms = typeof gecikmeMs === 'number' ? gecikmeMs : 1200;
        global.setTimeout(function () {
            global.location.href = '/';
        }, ms);
    }

    async function masterMi() {
        var D = db();
        if (!D || !D.masterDurum) return false;
        try {
            var durum = await D.masterDurum();
            return !!(durum && durum.master);
        } catch (e) {
            return false;
        }
    }

    async function oturumKontrol() {
        var D = db();
        if (!D) {
            panelGoster('bulutGiris');
            hataGoster('Veritabanı yüklenemedi.');
            return;
        }

        try {
            await D.init();
        } catch (eInit) {
            panelGoster('bulutGiris');
            hataGoster(D.hataMesaji ? D.hataMesaji(eInit) : 'Bağlantı kurulamadı.');
            return;
        }

        var u = D.getGunde5User && D.getGunde5User();
        if (!u || !u.id) {
            panelGoster('bulutGiris');
            return;
        }

        if (await masterMi()) {
            panelGoster('bulutOk');
            yonlendirAnasayfa(1400);
            return;
        }

        var redMetin = el('bulutRedMetin');
        if (redMetin) {
            redMetin.textContent = '“' + (u.username || u.email || 'Hesap') + '” yönetici hesabı değil. Başka hesapla giriş yapın.';
        }
        panelGoster('bulutRed');
    }

    async function girisDene(ev) {
        if (ev) ev.preventDefault();
        var D = db();
        if (!D || !D.girisYap) return;

        var emailEl = el('bulutEmail');
        var sifreEl = el('bulutSifre');
        var btn = el('bulutSubmit');
        var email = emailEl ? String(emailEl.value).replace(/^\s+|\s+$/g, '') : '';
        var sifre = sifreEl ? sifreEl.value : '';

        hataGoster('');
        if (!email || !sifre) {
            hataGoster('E-posta ve şifre gerekli.');
            return;
        }

        if (btn) btn.disabled = true;

        try {
            await D.init();
            await D.girisYap({ email: email, password: sifre });

            if (!(await masterMi())) {
                if (D.cikisYap) await D.cikisYap();
                hataGoster('Bu hesap yönetici (master) hesabı değil.');
                if (btn) btn.disabled = false;
                return;
            }

            if (ui() && ui().guncelleHeaderOturum) ui().guncelleHeaderOturum();
            panelGoster('bulutOk');
            toast('Yönetici oturumu açıldı.');
            yonlendirAnasayfa(1000);
        } catch (err) {
            hataGoster(D.hataMesaji ? D.hataMesaji(err) : 'Giriş başarısız.');
            if (btn) btn.disabled = false;
        }
    }

    async function cikisDene() {
        var D = db();
        if (!D || !D.cikisYap) return;
        try {
            await D.cikisYap();
        } catch (e) { /* */ }
        if (ui() && ui().guncelleHeaderOturum) ui().guncelleHeaderOturum();
        panelGoster('bulutGiris');
        hataGoster('');
        var emailEl = el('bulutEmail');
        var sifreEl = el('bulutSifre');
        if (emailEl) emailEl.value = '';
        if (sifreEl) sifreEl.value = '';
        if (emailEl) emailEl.focus();
    }

    function olaylariBagla() {
        var form = el('bulutForm');
        if (form) form.addEventListener('submit', girisDene);

        var cikis = el('bulutCikisBtn');
        if (cikis) cikis.addEventListener('click', cikisDene);
    }

    function boot() {
        olaylariBagla();
        oturumKontrol();
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window);
