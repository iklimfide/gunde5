/* gunde5 — master site içi metrikler (site_analytics) */
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

    function fmtOran(n) {
        var x = parseFloat(n);
        if (isNaN(x)) return '0';
        return x.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    }

    function fmtSure(sn) {
        var s = parseInt(sn, 10);
        if (isNaN(s) || s <= 0) return '—';
        var dk = Math.floor(s / 60);
        var kalan = s % 60;
        if (dk <= 0) return kalan + ' sn';
        return dk + ' dk ' + kalan + ' sn';
    }

    function kisaMetin(s, max) {
        var t = String(s || '').trim();
        if (!t) return '—';
        if (t.length <= max) return esc(t);
        return esc(t.slice(0, max - 1)) + '…';
    }

    function arrCoz(v) { return Array.isArray(v) ? v : []; }
    function objCoz(v) { return v && typeof v === 'object' ? v : {}; }

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

    function bolumAc(baslik) {
        return '<section class="istat-bolum"><h2 class="istat-bolum-baslik">' + esc(baslik) + '</h2>';
    }

    function bolumKapat() { return '</section>'; }

    function render(veri) {
        var kok = document.getElementById('metrikIcerik');
        if (!kok) return;

        if (!veri || !veri.ok) {
            kok.innerHTML = '<p class="istat-hata">' + esc((veri && veri.hata) || 'Veri alınamadı.') + '</p>';
            return;
        }

        var davranis = objCoz(veri.davranis);
        var etkilesim = objCoz(veri.etkilesim);
        var icerik = objCoz(veri.icerik);
        var html = '';

        html += '<p class="istat-donem-notu">Son <strong>' + fmtSayi(veri.gun) + '</strong> gün';
        if (veri.filtre && veri.filtre.etiket) {
            html += ' · <span class="istat-filtre-not">' + esc(veri.filtre.etiket) + '</span>';
        }
        html += ' · <a class="istat-capraz-link" href="/istatistikler">Trafik istatistikleri →</a></p>';

        html += '<section class="istat-bolum istat-bolum--hero"><h2 class="istat-bolum-baslik">Özet</h2><div class="istat-kpi-grid istat-kpi-grid--hero">';
        html += kpiKart('Tekil ziyaretçi', fmtSayi(veri.tekil_ziyaretci), 'Analytics visitor_id / üye');
        html += kpiKart('Geri gelen', fmtSayi(davranis.geri_gelen), 'Oran: %' + fmtOran(davranis.geri_gelen_oran) + ' · dönemde 2+ oturum (aynı gün dahil)');
        html += kpiKart('Ortalama hikâye', fmtOran(davranis.ortalama_hikaye), 'Index oturumu başına');
        html += kpiKart('Daha Fazla Oku', '%' + fmtOran(davranis.daha_fazla_oran), 'İlk 5\'i geçenler');
        html += kpiKart('Paylaşım', fmtSayi(etkilesim.paylasim), 'Paylaş butonu');
        html += kpiKart('Beğeni', fmtSayi(etkilesim.begeni), 'Beğendim tıklaması');
        html += '</div></section>';

        html += bolumAc('Okuma davranışı');
        html += '<div class="istat-kpi-grid">';
        html += kpiKart('Index oturumu', fmtSayi(davranis.index_oturum), 'analytics page_view index');
        html += kpiKart('Ortalama süre', fmtSure(davranis.ortalama_sure_sn), 'Heartbeat + son aktif');
        html += kpiKart('Etkileşim oranı', '%' + fmtOran(etkilesim.etkilesim_oran), 'Oy + paylaşım / tekil ziyaretçi');
        html += '</div>' + bolumKapat();

        html += bolumAc('Etkileşim');
        html += '<div class="istat-kpi-grid">';
        html += kpiKart('Beğeni', fmtSayi(etkilesim.begeni));
        html += kpiKart('Beğenmeme', fmtSayi(etkilesim.begenmeme));
        html += kpiKart('Paylaşım', fmtSayi(etkilesim.paylasim));
        html += '</div>' + bolumKapat();

        html += bolumAc('İçerik performansı');
        html += tabloHtml(
            'En çok beğenilen 10 hikâye',
            [
                { etiket: 'Başlık', deger: function (r) { return kisaMetin(r.baslik, 72); } },
                { etiket: 'Beğeni', deger: function (r) { return fmtSayi(r.begeni); } },
                { etiket: 'Beğenmeme', deger: function (r) { return fmtSayi(r.begenmeme); } },
                { etiket: 'Paylaşım', deger: function (r) { return fmtSayi(r.paylasim); } }
            ],
            arrCoz(icerik.en_begenilen),
            'Bu dönemde analytics oy olayı yok. index.html + gunde5-analytics.js gerekli.'
        );
        html += tabloHtml(
            'En çok paylaşılan 10 hikâye',
            [
                { etiket: 'Başlık', deger: function (r) { return kisaMetin(r.baslik, 72); } },
                { etiket: 'Paylaşım', deger: function (r) { return fmtSayi(r.paylasim); } },
                { etiket: 'Beğeni', deger: function (r) { return fmtSayi(r.begeni); } }
            ],
            arrCoz(icerik.en_paylasilan),
            'Bu dönemde paylaşım olayı yok.'
        );
        html += tabloHtml(
            'En çok beğenilmeyen 10 hikâye',
            [
                { etiket: 'Başlık', deger: function (r) { return kisaMetin(r.baslik, 72); } },
                { etiket: 'Beğenmeme', deger: function (r) { return fmtSayi(r.begenmeme); } },
                { etiket: 'Beğeni', deger: function (r) { return fmtSayi(r.begeni); } }
            ],
            arrCoz(icerik.en_begenilmeyen),
            'Bu dönemde beğenmeme olayı yok.'
        );
        if (icerik.impression_var && arrCoz(icerik.en_gorulen).length) {
            html += tabloHtml(
                'En çok görülen 10 hikâye',
                [
                    { etiket: 'Başlık', deger: function (r) { return kisaMetin(r.baslik, 72); } },
                    { etiket: 'Görüntülenme', deger: function (r) { return fmtSayi(r.goruntulenme); } }
                ],
                arrCoz(icerik.en_gorulen)
            );
        }
        html += bolumKapat();

        html += tabloHtml(
            'Dün ve bugün — son 10 hikâye',
            [
                { etiket: 'Gün', deger: function (r) { return r.gun_etiket || '—'; } },
                { etiket: 'Yayın', deger: function (r) { return r.yayin_tarihi || '—'; } },
                { etiket: 'Başlık', deger: function (r) { return kisaMetin(r.baslik, 56); } },
                { etiket: 'Görülme', deger: function (r) { return fmtSayi(r.goruntulenme); } },
                { etiket: 'Beğeni', deger: function (r) { return fmtSayi(r.begeni); } },
                { etiket: 'Beğenmeme', deger: function (r) { return fmtSayi(r.begenmeme); } },
                { etiket: 'Paylaşım', deger: function (r) { return fmtSayi(r.paylasim); } }
            ],
            arrCoz(icerik.son_gun_hikayeler),
            'Dün veya bugün yayınlanan hikâye yok.',
            'İstanbul saati · görülme = DB tekil veya analytics impression (büyük olan) · oy/paylaşım analytics (hariç tut filtresine uygun, tüm zaman)'
        );

        kok.innerHTML = html;
    }

    function yukleniyor(goster) {
        var el = document.getElementById('metrikYukleniyor');
        if (el) el.hidden = !goster;
    }

    function haricSecimGuncelle() {
        document.querySelectorAll('[data-metrik-haric]').forEach(function (btn) {
            var h = btn.getAttribute('data-metrik-haric');
            btn.classList.toggle('istat-gun-btn--aktif', h === seciliHaric);
            btn.setAttribute('aria-pressed', h === seciliHaric ? 'true' : 'false');
        });
    }

    function gunSecimGuncelle() {
        document.querySelectorAll('[data-metrik-gun]').forEach(function (btn) {
            var g = parseInt(btn.getAttribute('data-metrik-gun'), 10);
            btn.classList.toggle('istat-gun-btn--aktif', g === seciliGun);
            btn.setAttribute('aria-pressed', g === seciliGun ? 'true' : 'false');
        });
    }

    async function veriYukle(gun, haric) {
        var D = db();
        if (!D || !D.masterMetrikIstatistik) return;
        if (gun) seciliGun = gun;
        if (haric) seciliHaric = haric;
        gunSecimGuncelle();
        haricSecimGuncelle();
        yukleniyor(true);
        try {
            var veri = await D.masterMetrikIstatistik(seciliGun, seciliHaric);
            render(veri);
        } catch (e) {
            render({ ok: false, hata: D.hataMesaji ? D.hataMesaji(e) : 'Hata' });
        } finally {
            yukleniyor(false);
        }
    }

    function yetkisizGoster(mesaj, girisGoster) {
        var y = document.getElementById('metrikYetkisiz');
        var i = document.getElementById('metrikIcerik');
        var f = document.getElementById('metrikFiltre');
        var h = document.getElementById('metrikHaricFiltre');
        var l = document.getElementById('metrikYukleniyor');
        if (l) l.hidden = true;
        if (f) f.hidden = true;
        if (h) h.hidden = true;
        if (i) i.hidden = true;
        if (y) {
            y.hidden = false;
            var p = y.querySelector('.istat-yetkisiz-metin');
            if (p) p.textContent = mesaj;
            var g = document.getElementById('metrikGirisBtn');
            if (g) g.hidden = !girisGoster;
        }
    }

    function icerikGoster() {
        var y = document.getElementById('metrikYetkisiz');
        if (y) y.hidden = true;
        ['metrikIcerik', 'metrikFiltre', 'metrikHaricFiltre'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.hidden = false;
        });
    }

    function filtreBagla() {
        if (filtreHazir) return;
        filtreHazir = true;
        document.querySelectorAll('[data-metrik-gun]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var g = parseInt(btn.getAttribute('data-metrik-gun'), 10);
                if (!g || g === seciliGun) return;
                veriYukle(g, null);
            });
        });
        document.querySelectorAll('[data-metrik-haric]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var h = btn.getAttribute('data-metrik-haric');
                if (!h || h === seciliHaric) return;
                veriYukle(null, h);
            });
        });
        var yenile = document.getElementById('metrikYenile');
        if (yenile) yenile.addEventListener('click', function () { veriYukle(seciliGun, seciliHaric); });
        var giris = document.getElementById('metrikGirisBtn');
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
            yetkisizGoster('Metrikleri görmek için site yöneticisi hesabıyla giriş yapın.', true);
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

    global.Gunde5Metrikler = { init: init, yenile: veriYukle };
    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
