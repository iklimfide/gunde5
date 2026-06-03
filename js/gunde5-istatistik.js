/* gunde5 — master trafik + günlük istatistikler */
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

    function fmtAktifDk(saniye) {
        var s = parseInt(saniye, 10);
        if (isNaN(s) || s <= 0) return '0';
        return fmtSayi(Math.round(s / 60));
    }

    function kisaMetin(s, max) {
        var t = String(s || '').trim();
        if (!t) return '—';
        if (t.length <= max) return esc(t);
        return esc(t.slice(0, max - 1)) + '…';
    }

    function arrCoz(v) { return Array.isArray(v) ? v : []; }

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

    function hikayeMatrisHtml(matris) {
        matris = matris || {};
        var gunler = arrCoz(matris.gunler);
        var satirlar = arrCoz(matris.satirlar);
        var html = '<section class="istat-bolum"><h2 class="istat-bolum-baslik">Hikaye okuma matrisi</h2>';
        html += '<p class="istat-bolum-not">Son 7 gün · en çok okunan 20 hikaye · oturumda hikaye başına en fazla 1 okuma.';
        if (matris.baslangic && matris.bitis) {
            html += ' ' + esc(matris.baslangic) + ' – ' + esc(matris.bitis) + '.';
        }
        html += '</p>';
        if (!gunler.length || !satirlar.length) {
            html += '<p class="istat-bos">Son bir haftada hikaye okuma kaydı yok.</p></section>';
            return html;
        }
        html += '<div class="istat-tablo-wrap istat-matris-wrap"><table class="istat-tablo istat-matris"><thead><tr>';
        html += '<th scope="col" class="istat-matris-kose">Hikaye</th>';
        gunler.forEach(function (g) {
            html += '<th scope="col" class="istat-matris-gun">' + esc(g.etiket || g.gun) + '</th>';
        });
        html += '<th scope="col" class="istat-matris-toplam">Σ</th></tr></thead><tbody>';
        satirlar.forEach(function (satir) {
            var hucreler = arrCoz(satir.okuma);
            html += '<tr><th scope="row" class="istat-matris-hikaye">' + kisaMetin(satir.baslik, 48) + '</th>';
            gunler.forEach(function (g, i) {
                var n = hucreler[i];
                var v = parseInt(n, 10);
                if (isNaN(v)) v = 0;
                var cls = v > 0 ? ' istat-matris-dolu' : ' istat-matris-bos';
                html += '<td class="istat-matris-sayi' + cls + '">' + fmtSayi(v) + '</td>';
            });
            html += '<td class="istat-matris-sayi istat-matris-toplam-hucre">' + fmtSayi(satir.toplam) + '</td></tr>';
        });
        html += '</tbody></table></div></section>';
        return html;
    }

    function indexArayuzBolumu(ia) {
        ia = ia || {};
        var terimler = arrCoz(ia.arama_terimleri);
        var html = '<section class="istat-bolum"><h2 class="istat-bolum-baslik">Anasayfa arayüzü</h2>';
        html += '<p class="istat-bolum-not">Alt bar, arama ve «daha fazla oku» tıklamaları (analytics). Eski kayıtlarda «Dünkü 5» / «Ara» ayrımı olmayabilir.</p>';
        html += '<div class="istat-kpi-grid">';
        html += kpiKart('Ara (alt bar)', fmtSayi(ia.altbar_ara), 'Arama kutusunu açma');
        html += kpiKart('Dünkü 5 (alt bar)', fmtSayi(ia.altbar_dun), 'Dünkü 5 kısayolu');
        html += kpiKart('Dün yayınlanan…', fmtSayi(ia.daha_fazla_dun), 'İlk «daha fazla» (dün)');
        html += kpiKart('Önceki günler…', fmtSayi(ia.daha_fazla_onceki), 'Sonraki «daha fazla»');
        html += kpiKart('Daha fazla (toplam)', fmtSayi(ia.daha_fazla_toplam), 'Tüm load_more_click');
        html += kpiKart('Arama yapıldı', fmtSayi(ia.arama), 'Gerçek sorgu gönderimi');
        html += '</div>';
        html += tabloHtml(
            'En çok aranan terimler',
            [
                { etiket: 'Terim', deger: function (r) { return r.terim; } },
                { etiket: 'Adet', deger: function (r) { return fmtSayi(r.adet); } }
            ],
            terimler,
            'Bu dönemde arama kaydı yok.',
            'Küçük harf, en fazla 40 terim.'
        );
        return html + '</section>';
    }

    function gunlukBolumu(gunluk) {
        if (!gunluk || !gunluk.ok) {
            return (
                '<section class="istat-bolum">' +
                '<h2 class="istat-bolum-baslik">Günlük metrikler</h2>' +
                '<p class="istat-hata">' + esc((gunluk && gunluk.hata) || 'Günlük veri yüklenemedi. Supabase SQL Editor\'da supabase/master-gunluk-istatistik.sql dosyasını çalıştırın.') + '</p>' +
                '</section>'
            );
        }

        var not = 'Hikaye okuma = story_impression (oturumda her hikaye en fazla 1 kez). ';
        if (gunluk.veri_baslangic) {
            not += 'Kayıtlar ' + fmtTarih(gunluk.veri_baslangic) + ' tarihinden itibaren.';
        }

        return tabloHtml(
            'Günlük özet',
            [
                { etiket: 'Gün', deger: function (r) { return r.gun_etiket || r.gun; } },
                { etiket: 'Sayfa açılışı', deger: function (r) { return fmtSayi(r.sayfa_acilisi); } },
                { etiket: 'Tekil oturum', deger: function (r) { return fmtSayi(r.tekil_oturum); } },
                { etiket: 'Tekil ziyaretçi', deger: function (r) { return fmtSayi(r.tekil_ziyaretci); } },
                { etiket: 'Hikaye okuma', deger: function (r) { return fmtSayi(r.hikaye_okuma); } },
                { etiket: 'Beğeni', deger: function (r) { return fmtSayi(r.begeni); } },
                { etiket: 'Beğenmeme', deger: function (r) { return fmtSayi(r.begenmeme); } },
                { etiket: 'Paylaşım', deger: function (r) { return fmtSayi(r.paylasim); } },
                { etiket: 'Daha fazla oku', deger: function (r) { return fmtSayi(r.daha_fazla_oku); } },
                { etiket: 'Aktif (dk)', deger: function (r) { return fmtAktifDk(r.aktif_saniye); } }
            ],
            arrCoz(gunluk.gunluk),
            'Bu dönemde günlük kayıt yok.',
            not
        ) + hikayeMatrisHtml(gunluk.hikaye_matris) + indexArayuzBolumu(gunluk.index_arayuz);
    }

    function render(veri, gunluk) {
        var kok = document.getElementById('istatistikIcerik');
        if (!kok) return;

        if (!veri || !veri.ok) {
            kok.innerHTML = '<p class="istat-hata">' + esc((veri && veri.hata) || 'Veri alınamadı.') + '</p>';
            return;
        }

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
            'direct / bilinmiyor = referrer alınamadı.'
        );

        html += gunlukBolumu(gunluk);

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
            var trafikPromise = D.masterTrafikIstatistik(seciliGun, seciliHaric);
            var gunlukPromise = D.masterGunlukIstatistik
                ? D.masterGunlukIstatistik(seciliGun, seciliHaric).catch(function (e) {
                    return {
                        ok: false,
                        hata: D.hataMesaji ? D.hataMesaji(e) : 'RPC yok veya hata'
                    };
                })
                : Promise.resolve({ ok: false, hata: 'master_gunluk_istatistik tanımlı değil' });
            var sonuc = await Promise.all([trafikPromise, gunlukPromise]);
            render(sonuc[0], sonuc[1]);
        } catch (e) {
            render({ ok: false, hata: D.hataMesaji ? D.hataMesaji(e) : 'Hata' }, null);
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
