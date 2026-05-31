/* gunde5 — master trafik istatistikleri (site_ziyaretler) */
(function (global) {
    'use strict';

    var seciliGun = 30;
    var seciliHaric = 'master';
    var filtreHazir = false;

    function db() { return global.Gunde5DB; }
    function ui() { return global.Gunde5UI; }

    function esc(s) {
        if (s == null || s === '') return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function fmtSayi(n) {
        var x = parseInt(n, 10);
        if (isNaN(x)) return '0';
        try { return x.toLocaleString('tr-TR'); } catch (e) { return String(x); }
    }

    function fmtTarih(iso) {
        if (!iso) return '—';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return esc(iso);
            return d.toLocaleString('tr-TR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e2) { return esc(iso); }
    }

    function kisaMetin(s, max) {
        var t = String(s || '').trim();
        if (!t) return '—';
        if (t.length <= max) return esc(t);
        return esc(t.slice(0, max - 1)) + '…';
    }

    function arrCoz(v) { return Array.isArray(v) ? v : []; }

    var SITE_ETIKET = {
        uyeler: 'Üyeler',
        kulis: 'Kulis (aktif)',
        podyum: 'Podyum (aktif)',
        gizli_hikaye: 'Gizli hikaye',
        silinen: 'Silinen hikaye',
        cevaplar: 'Cevaplar',
        oylar: 'Oylar',
        sikayetler: 'Şikayetler'
    };

    function tabloHtml(baslik, kolonlar, satirlar, bosMesaj, not) {
        var html = '<section class="istat-bolum"><h2 class="istat-bolum-baslik">' + esc(baslik) + '</h2>';
        if (not) html += '<p class="istat-bolum-not">' + esc(not) + '</p>';
        if (!satirlar.length) {
            html += '<p class="istat-bos">' + esc(bosMesaj || 'Veri yok.') + '</p></section>';
            return html;
        }
        html += '<div class="istat-tablo-wrap"><table class="istat-tablo"><thead><tr>';
        kolonlar.forEach(function (k) {
            html += '<th scope="col">' + esc(k.etiket) + '</th>';
        });
        html += '</tr></thead><tbody>';
        satirlar.forEach(function (satir) {
            html += '<tr>';
            kolonlar.forEach(function (k) {
                var hucre = typeof k.deger === 'function' ? k.deger(satir) : satir[k.alan];
                html += '<td>' + (k.raw ? hucre : esc(hucre)) + '</td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table></div></section>';
        return html;
    }

    function kpiKart(etiket, deger, alt) {
        return (
            '<div class="istat-kpi">' +
            '<span class="istat-kpi-etiket">' + esc(etiket) + '</span>' +
            '<span class="istat-kpi-deger">' + esc(deger) + '</span>' +
            (alt ? '<span class="istat-kpi-alt">' + esc(alt) + '</span>' : '') +
            '</div>'
        );
    }

    function render(veri) {
        var kok = document.getElementById('istatistikIcerik');
        if (!kok) return;

        if (!veri || !veri.ok) {
            kok.innerHTML = '<p class="istat-hata">' + esc((veri && veri.hata) || 'Veri alınamadı.') + '</p>';
            return;
        }

        var site = veri.site || {};
        var html = '';

        html += '<p class="istat-donem-notu">Son <strong>' + fmtSayi(veri.gun) + '</strong> gün';
        if (veri.filtre && veri.filtre.etiket) {
            html += ' · <span class="istat-filtre-not">' + esc(veri.filtre.etiket) + '</span>';
        }
        html += ' · <a class="istat-capraz-link" href="/metrikler">Site içi metrikler →</a></p>';

        html += '<section class="istat-bolum istat-bolum--hero"><h2 class="istat-bolum-baslik">Trafik özeti</h2><div class="istat-kpi-grid istat-kpi-grid--hero">';
        html += kpiKart('Toplam sayfa açılışı', fmtSayi(veri.toplam), 'ziyaret_kaydet — yenileme dahil');
        html += kpiKart('Tekil oturum', fmtSayi(veri.tekil_oturum), 'Farklı oturum anahtarı');
        html += kpiKart('Girişli ziyaret', fmtSayi(veri.girisli_ziyaret), 'user_id dolu kayıtlar');
        html += '</div></section>';

        html += tabloHtml(
            'Trafik kaynakları',
            [
                { etiket: 'Kaynak', alan: 'kaynak' },
                { etiket: 'Adet', alan: 'adet', deger: function (r) { return fmtSayi(r.adet); } }
            ],
            arrCoz(veri.referrer_gruplu),
            'Henüz kaynak verisi yok.',
            'direct / bilinmiyor = referrer alınamadı; geri gelen kullanıcı anlamına gelmez.'
        );
        html += tabloHtml(
            'Referrer (ham)',
            [
                { etiket: 'Kaynak', alan: 'referrer', deger: function (r) { return kisaMetin(r.referrer, 80); } },
                { etiket: 'Adet', alan: 'adet', deger: function (r) { return fmtSayi(r.adet); } }
            ],
            arrCoz(veri.referrerlar)
        );
        html += tabloHtml(
            'Sayfalar',
            [
                { etiket: 'Sayfa', alan: 'sayfa' },
                { etiket: 'Ziyaret', alan: 'adet', deger: function (r) { return fmtSayi(r.adet); } }
            ],
            arrCoz(veri.sayfalar),
            'Bu dönemde sayfa kaydı yok.'
        );
        html += tabloHtml(
            'UTM kaynak',
            [
                { etiket: 'utm_source', alan: 'utm_source' },
                { etiket: 'Adet', alan: 'adet', deger: function (r) { return fmtSayi(r.adet); } }
            ],
            arrCoz(veri.utm_kaynaklar),
            'UTM kaydı yok.'
        );
        html += tabloHtml(
            'UTM medium',
            [
                { etiket: 'utm_medium', alan: 'utm_medium' },
                { etiket: 'Adet', alan: 'adet', deger: function (r) { return fmtSayi(r.adet); } }
            ],
            arrCoz(veri.utm_medium),
            'UTM medium yok.'
        );
        html += tabloHtml(
            'Cihaz',
            [
                { etiket: 'Cihaz', alan: 'cihaz' },
                { etiket: 'Adet', alan: 'adet', deger: function (r) { return fmtSayi(r.adet); } }
            ],
            arrCoz(veri.cihazlar)
        );
        html += tabloHtml(
            'Son 100 ziyaret kaydı',
            [
                { etiket: 'Tarih', deger: function (r) { return fmtTarih(r.created_at); } },
                { etiket: 'Sayfa', alan: 'sayfa' },
                { etiket: 'Yol', deger: function (r) { return kisaMetin(r.yol, 48); } },
                { etiket: 'Referrer', deger: function (r) { return kisaMetin(r.referrer, 40); } }
            ],
            arrCoz(veri.son_kayitlar),
            'Kayıt yok.'
        );

        html += '<details class="istat-detay"><summary>Site envanteri (tüm zaman)</summary>';
        html += '<div class="istat-kpi-grid istat-kpi-grid--site">';
        Object.keys(SITE_ETIKET).forEach(function (anahtar) {
            if (site[anahtar] == null) return;
            html += kpiKart(SITE_ETIKET[anahtar], fmtSayi(site[anahtar]));
        });
        html += '</div></details>';

        kok.innerHTML = html;
    }

    function yukleniyor(goster) {
        var el = document.getElementById('istatistikYukleniyor');
        if (el) el.hidden = !goster;
    }

    function haricSecimGuncelle() {
        document.querySelectorAll('[data-istat-haric]').forEach(function (btn) {
            var h = btn.getAttribute('data-istat-haric');
            btn.classList.toggle('istat-gun-btn--aktif', h === seciliHaric);
            btn.setAttribute('aria-pressed', h === seciliHaric ? 'true' : 'false');
        });
    }

    function gunSecimGuncelle() {
        document.querySelectorAll('[data-istat-gun]').forEach(function (btn) {
            var g = parseInt(btn.getAttribute('data-istat-gun'), 10);
            btn.classList.toggle('istat-gun-btn--aktif', g === seciliGun);
            btn.setAttribute('aria-pressed', g === seciliGun ? 'true' : 'false');
        });
    }

    async function veriYukle(gun, haric) {
        var D = db();
        if (!D || !D.masterTrafikIstatistik) return;
        if (gun) seciliGun = gun;
        if (haric) seciliHaric = haric;
        gunSecimGuncelle();
        haricSecimGuncelle();
        yukleniyor(true);
        try {
            var veri = await D.masterTrafikIstatistik(seciliGun, seciliHaric);
            render(veri);
        } catch (e) {
            render({ ok: false, hata: D.hataMesaji ? D.hataMesaji(e) : 'Hata' });
        } finally {
            yukleniyor(false);
        }
    }

    function yetkisizGoster(mesaj, girisGoster) {
        var y = document.getElementById('istatistikYetkisiz');
        var i = document.getElementById('istatistikIcerik');
        var f = document.getElementById('istatistikFiltre');
        var h = document.getElementById('istatistikHaricFiltre');
        var l = document.getElementById('istatistikYukleniyor');
        if (l) l.hidden = true;
        if (f) f.hidden = true;
        if (h) h.hidden = true;
        if (i) i.hidden = true;
        if (y) {
            y.hidden = false;
            var p = y.querySelector('.istat-yetkisiz-metin');
            if (p) p.textContent = mesaj || 'Bu sayfaya yalnızca site yöneticisi erişebilir.';
            var g = document.getElementById('istatistikGirisBtn');
            if (g) g.hidden = !girisGoster;
        }
    }

    function icerikGoster() {
        var y = document.getElementById('istatistikYetkisiz');
        var i = document.getElementById('istatistikIcerik');
        var f = document.getElementById('istatistikFiltre');
        var h = document.getElementById('istatistikHaricFiltre');
        if (y) y.hidden = true;
        if (f) f.hidden = false;
        if (h) h.hidden = false;
        if (i) i.hidden = false;
    }

    function filtreBagla() {
        if (filtreHazir) return;
        filtreHazir = true;
        document.querySelectorAll('[data-istat-gun]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var g = parseInt(btn.getAttribute('data-istat-gun'), 10);
                if (!g || g === seciliGun) return;
                veriYukle(g, null);
            });
        });
        document.querySelectorAll('[data-istat-haric]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var h = btn.getAttribute('data-istat-haric');
                if (!h || h === seciliHaric) return;
                veriYukle(null, h);
            });
        });
        var yenile = document.getElementById('istatistikYenile');
        if (yenile) yenile.addEventListener('click', function () { veriYukle(seciliGun, seciliHaric); });
        var giris = document.getElementById('istatistikGirisBtn');
        if (giris) {
            giris.addEventListener('click', function () {
                global.location.href = '/bulut';
            });
        }
    }

    async function init(yeniden) {
        var D = db();
        var U = ui();
        if (!D) return;
        if (!yeniden) { try { await D.init(); } catch (e) { /* */ } }
        if (U && U.guncelleHeaderOturum) U.guncelleHeaderOturum();
        if (global.Gunde5Master && global.Gunde5Master.durumYenile) {
            try { await global.Gunde5Master.durumYenile(); } catch (e2) { /* */ }
        }
        var oturum = D.getGunde5User && D.getGunde5User();
        if (!oturum || !oturum.id) {
            yetkisizGoster('İstatistikleri görmek için site yöneticisi hesabıyla giriş yapın.', true);
            return;
        }
        var durum;
        try { durum = await D.masterDurum(); } catch (e3) { durum = { master: false }; }
        if (!durum || !durum.master) {
            yetkisizGoster('Bu sayfa yalnızca site yöneticisi (master) hesabı içindir.', false);
            return;
        }
        icerikGoster();
        filtreBagla();
        await veriYukle(seciliGun);
    }

    global.Gunde5Istatistik = { init: init, yenile: veriYukle };
    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
