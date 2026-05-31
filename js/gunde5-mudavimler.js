/* gunde5 — müdavimler retention laboratuvarı (site_analytics) */
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

    function kpiKart(etiket, deger, alt, cls) {
        return (
            '<div class="istat-kpi' + (cls ? ' ' + cls : '') + '">' +
            '<span class="istat-kpi-etiket">' + esc(etiket) + '</span>' +
            '<span class="istat-kpi-deger">' + esc(deger) + '</span>' +
            (alt ? '<span class="istat-kpi-alt">' + esc(alt) + '</span>' : '') +
            '</div>'
        );
    }

    function hunisiHtml(hunisi, tekil) {
        var liste = arrCoz(hunisi);
        if (!liste.length) return '<p class="istat-bos">Huni verisi yok.</p>';
        var maxAdet = tekil || 1;
        var html = '<div class="mudavim-hunisi">';
        liste.forEach(function (basamak, i) {
            var adet = parseInt(basamak.adet, 10) || 0;
            var oran = parseFloat(basamak.oran);
            var genislik = Math.max(18, Math.round((adet / maxAdet) * 100));
            html += (
                '<div class="mudavim-huni-adim">' +
                '<div class="mudavim-huni-bar-wrap">' +
                '<div class="mudavim-huni-bar" style="width:' + genislik + '%">' +
                '<span class="mudavim-huni-adet">' + esc(fmtSayi(adet)) + '</span>' +
                '</div></div>' +
                '<div class="mudavim-huni-etiket">' +
                esc(basamak.etiket || '') +
                (i > 0 && !isNaN(oran) ? ' <span class="mudavim-huni-oran">%' + esc(fmtOran(oran)) + '</span>' : '') +
                '</div>' +
                (i < liste.length - 1 ? '<div class="mudavim-huni-ok" aria-hidden="true">↓</div>' : '') +
                '</div>'
            );
        });
        html += '</div>';
        return html;
    }

    function fmtGunKisa(gunStr) {
        if (!gunStr) return '';
        var p = String(gunStr).split('-');
        if (p.length !== 3) return gunStr;
        return parseInt(p[2], 10) + '/' + parseInt(p[1], 10);
    }

    function gunlukSadakatGrafikHtml(gunluk) {
        var liste = arrCoz(gunluk).filter(function (r) {
            var y = parseInt(r.yeni, 10) || 0;
            var g = parseInt(r.geri_gelen, 10) || 0;
            var d = parseInt(r.dun_de_gelen, 10) || 0;
            return (y + g + d) > 0;
        });
        if (!liste.length) return '<p class="istat-bos">Günlük veri yok.</p>';

        var seriler = [
            { alan: 'yeni', etiket: 'Yeni kullanıcı', cls: 'mudavim-legend--yeni', cizgi: 'mudavim-grafik-cizgi--yeni', bar: 'mudavim-bar--yeni' },
            { alan: 'geri_gelen', etiket: 'Geri gelen', cls: 'mudavim-legend--geri', cizgi: 'mudavim-grafik-cizgi--geri', bar: 'mudavim-bar--geri' },
            { alan: 'dun_de_gelen', etiket: 'Dün de gelen', cls: 'mudavim-legend--dun', cizgi: 'mudavim-grafik-cizgi--dun', bar: 'mudavim-bar--dun' }
        ];

        var legend = '<div class="mudavim-grafik-legend">' +
            seriler.map(function (s) {
                return '<span class="mudavim-legend-item ' + s.cls + '"><i></i> ' + esc(s.etiket) + '</span>';
            }).join('') +
            '</div>';

        if (liste.length < 14) {
            return sutunGrafikHtml(liste, seriler, legend);
        }
        return cizgiGrafikHtml(liste, seriler, legend);
    }

    function maxSeriDeger(liste, seriler) {
        var maxVal = 1;
        liste.forEach(function (r) {
            seriler.forEach(function (s) {
                var v = parseInt(r[s.alan], 10) || 0;
                if (v > maxVal) maxVal = v;
            });
        });
        return maxVal;
    }

    function sutunGrafikHtml(liste, seriler, legend) {
        var maxVal = maxSeriDeger(liste, seriler);
        var cols = liste.map(function (r) {
            var bars = seriler.map(function (s) {
                var adet = parseInt(r[s.alan], 10) || 0;
                var h = Math.max(4, Math.round((adet / maxVal) * 88));
                return (
                    '<div class="mudavim-sutun-bar ' + s.bar + '" style="height:' + h + 'px" title="' +
                    esc(s.etiket + ': ' + fmtSayi(adet)) + '"></div>'
                );
            }).join('');
            return (
                '<div class="mudavim-sutun-grup">' +
                '<div class="mudavim-sutun-bars">' + bars + '</div>' +
                '<span class="mudavim-sutun-etiket">' + esc(fmtGunKisa(r.gun)) + '</span>' +
                '</div>'
            );
        }).join('');

        return (
            '<div class="mudavim-cizgi-grafik mudavim-sutun-grafik">' +
            legend +
            '<div class="mudavim-sutunlar">' + cols + '</div>' +
            '</div>'
        );
    }

    function cizgiGrafikHtml(liste, seriler, legend) {
        var w = 640;
        var h = 200;
        var padL = 36;
        var padR = 12;
        var padT = 12;
        var padB = 28;
        var plotW = w - padL - padR;
        var plotH = h - padT - padB;
        var maxVal = maxSeriDeger(liste, seriler);

        function noktalar(alan) {
            if (liste.length === 1) {
                var v0 = parseInt(liste[0][alan], 10) || 0;
                var y0 = padT + plotH - (v0 / maxVal) * plotH;
                return padL + ',' + y0;
            }
            return liste.map(function (r, i) {
                var v = parseInt(r[alan], 10) || 0;
                var x = padL + (i / (liste.length - 1)) * plotW;
                var y = padT + plotH - (v / maxVal) * plotH;
                return x.toFixed(1) + ',' + y.toFixed(1);
            }).join(' ');
        }

        var gridY = [0, 0.5, 1].map(function (t) {
            var y = padT + plotH - t * plotH;
            return '<line class="mudavim-grafik-grid" x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y + '"/>';
        }).join('');

        var etiketStep = liste.length <= 14 ? 1 : Math.ceil(liste.length / 12);
        var xEtiketler = liste.map(function (r, i) {
            if (i % etiketStep !== 0 && i !== liste.length - 1) return '';
            var x = liste.length === 1
                ? padL
                : padL + (i / (liste.length - 1)) * plotW;
            return '<text class="mudavim-grafik-x" x="' + x + '" y="' + (h - 6) + '" text-anchor="middle">' + esc(fmtGunKisa(r.gun)) + '</text>';
        }).join('');

        var cizgiler = seriler.map(function (s) {
            return '<polyline class="mudavim-grafik-cizgi ' + s.cizgi + '" fill="none" points="' + noktalar(s.alan) + '"/>';
        }).join('');

        return (
            '<div class="mudavim-cizgi-grafik">' +
            legend +
            '<svg class="mudavim-grafik-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Günlük sadakat grafiği">' +
            gridY + cizgiler + xEtiketler +
            '</svg></div>'
        );
    }

    function render(veri) {
        var kok = document.getElementById('mudavimIcerik');
        if (!kok) return;

        if (!veri || !veri.ok) {
            kok.innerHTML = '<p class="istat-hata">' + esc((veri && veri.hata) || 'Veri alınamadı.') + '</p>';
            return;
        }

        var kpi = objCoz(veri.kpi);
        var html = '';

        html += '<p class="istat-donem-notu">Son <strong>' + fmtSayi(veri.gun) + '</strong> gün';
        if (veri.filtre && veri.filtre.etiket) {
            html += ' · <span class="istat-filtre-not">' + esc(veri.filtre.etiket) + '</span>';
        }
        html += ' · <a class="istat-capraz-link" href="/metrikler">Metrikler →</a>';
        html += ' · <a class="istat-capraz-link" href="/istatistikler">Trafik →</a></p>';

        html += '<section class="istat-bolum istat-bolum--hero mudavim-bolum--hero">';
        html += '<h2 class="istat-bolum-baslik">Sadakat özeti</h2>';
        html += '<div class="istat-kpi-grid istat-kpi-grid--hero">';
        html += kpiKart('Tekil ziyaretçi', fmtSayi(veri.tekil_ziyaretci), 'visitor_id / üye kimliği');
        html += kpiKart('🔁 Geri Gelen', fmtSayi(kpi.geri_gelen), 'Dönemde 2+ oturum');
        html += kpiKart('📆 İlk → Son ziyaret', fmtOran(kpi.yasam_suresi_gun) + ' gün', 'Ortalama sadakat süresi (geri gelenler)', 'mudavim-kpi--altin');
        html += '</div></section>';

        html += '<section class="istat-bolum mudavim-bolum--gunluk">';
        html += '<h2 class="istat-bolum-baslik">Günlük alışkanlık</h2>';
        html += '<div class="istat-kpi-grid">';
        html += kpiKart('🔥 Dün de Gelenler', fmtSayi(kpi.dun_de_gelen), 'Bugün gelenlerden dün de gelmiş olanlar · bugün: ' + fmtSayi(kpi.bugun_gelen));
        html += kpiKart('📈 Dün → Bugün Sadakat Oranı', '%' + fmtOran(kpi.dun_bugun_sadakat_oran), 'Dün de gelenler / bugün gelen toplam');
        html += '</div></section>';

        html += '<section class="istat-bolum"><h2 class="istat-bolum-baslik">Gün bazlı sadakat</h2>';
        html += '<div class="istat-kpi-grid">';
        html += kpiKart('📅 2+ Gün Gelen', fmtSayi(kpi.gun_2_plus), 'En az 2 farklı takvim günü');
        html += kpiKart('🔥 3+ Gün Gelen', fmtSayi(kpi.gun_3_plus), 'En az 3 farklı takvim günü');
        html += kpiKart('⭐ 5+ Gün Gelen', fmtSayi(kpi.gun_5_plus), 'En az 5 farklı takvim günü');
        html += kpiKart('🏆 10+ Gün Gelen', fmtSayi(kpi.gun_10_plus), 'En az 10 farklı takvim günü');
        html += '</div></section>';

        html += '<section class="istat-bolum"><h2 class="istat-bolum-baslik">Alışkanlık sinyalleri</h2>';
        html += '<div class="istat-kpi-grid">';
        html += kpiKart('⚡ Aynı Gün Tekrar', fmtSayi(kpi.ayni_gun_tekrar), 'Bir günde 2+ oturum');
        html += kpiKart('🚀 Güç Kullanıcı', fmtSayi(kpi.guc_kullanici), '3+ gün gelmiş + bir günde 2+ oturum');
        html += kpiKart('⏱ Ort. oturum', fmtOran(kpi.ortalama_oturum), 'Geri gelen başına oturum sayısı');
        html += kpiKart('📖 Ort. hikâye', fmtOran(kpi.ortalama_hikaye), veri.impression_var ? 'Geri gelen başına okunan hikâye' : 'loaded_count yedeği');
        html += kpiKart('📤 Paylaşım oranı', '%' + fmtOran(kpi.paylasim_oran), 'Geri gelenlerin paylaşan yüzdesi');
        html += kpiKart('👍 Beğeni oranı', '%' + fmtOran(kpi.begeni_oran), 'Geri gelenlerin oy veren yüzdesi');
        html += '</div></section>';

        html += '<section class="istat-bolum"><h2 class="istat-bolum-baslik">📈 Sadakat Hunisi</h2>';
        html += '<p class="istat-bolum-not">Oranlar bir önceki basamağa göre dönüşüm yüzdesidir.</p>';
        html += hunisiHtml(veri.hunisi, veri.tekil_ziyaretci);
        html += '</section>';

        var sadikSatirlar = arrCoz(veri.en_sadik).map(function (r, i) {
            return {
                ad: 'Müdavim #' + (i + 1),
                oturum: r.oturum,
                gun: r.gun,
                hikaye: r.hikaye,
                paylasim: r.paylasim,
                oy: r.oy
            };
        });
        html += tabloHtml(
            '🥇 En Sadık 20 Kullanıcı',
            [
                { etiket: 'Kullanıcı', alan: 'ad' },
                { etiket: 'Oturum', deger: function (r) { return fmtSayi(r.oturum); } },
                { etiket: 'Gün', deger: function (r) { return fmtSayi(r.gun); } },
                { etiket: 'Hikâye', deger: function (r) { return fmtSayi(r.hikaye); } },
                { etiket: 'Paylaşım', deger: function (r) { return fmtSayi(r.paylasim); } },
                { etiket: 'Oy', deger: function (r) { return fmtSayi(r.oy); } }
            ],
            sadikSatirlar,
            'Bu dönemde yeterli analytics verisi yok.',
            'Kimlikler anonimleştirilmiştir; gerçek visitor_id gösterilmez.'
        );

        html += '<section class="istat-bolum"><h2 class="istat-bolum-baslik">📅 Günlük Sadakat Grafiği</h2>';
        html += '<p class="istat-bolum-not">Yeni · Geri gelen · Dün de gelen (önceki takvim gününde de ziyaret etmiş). 14 günden az veri varsa sütun grafik gösterilir.</p>';
        html += gunlukSadakatGrafikHtml(veri.gunluk);
        html += '</section>';

        if (kpi.yasam_suresi_gun != null) {
            html += '<section class="istat-bolum mudavim-yasam-kutu">';
            html += '<h2 class="istat-bolum-baslik">📆 İlk Ziyaret → Son Ziyaret</h2>';
            html += '<p class="mudavim-yasam-metin">Ortalama sadakat süresi: <strong>' +
                esc(fmtOran(kpi.yasam_suresi_gun)) +
                ' gün</strong> (ilk ve son ziyaret arası).</p>';
            html += '</section>';
        }

        kok.innerHTML = html;
    }

    function yukleniyor(goster) {
        var el = document.getElementById('mudavimYukleniyor');
        if (el) el.hidden = !goster;
    }

    function haricSecimGuncelle() {
        document.querySelectorAll('[data-mudavim-haric]').forEach(function (btn) {
            var h = btn.getAttribute('data-mudavim-haric');
            btn.classList.toggle('istat-gun-btn--aktif', h === seciliHaric);
            btn.setAttribute('aria-pressed', h === seciliHaric ? 'true' : 'false');
        });
    }

    function gunSecimGuncelle() {
        document.querySelectorAll('[data-mudavim-gun]').forEach(function (btn) {
            var g = parseInt(btn.getAttribute('data-mudavim-gun'), 10);
            btn.classList.toggle('istat-gun-btn--aktif', g === seciliGun);
            btn.setAttribute('aria-pressed', g === seciliGun ? 'true' : 'false');
        });
    }

    async function veriYukle(gun, haric) {
        var D = db();
        if (!D || !D.masterMudavimIstatistik) return;
        if (gun) seciliGun = gun;
        if (haric) seciliHaric = haric;
        gunSecimGuncelle();
        haricSecimGuncelle();
        yukleniyor(true);
        try {
            var veri = await D.masterMudavimIstatistik(seciliGun, seciliHaric);
            render(veri);
        } catch (e) {
            render({ ok: false, hata: D.hataMesaji ? D.hataMesaji(e) : 'Hata' });
        } finally {
            yukleniyor(false);
        }
    }

    function yetkisizGoster(mesaj, girisGoster) {
        var y = document.getElementById('mudavimYetkisiz');
        var i = document.getElementById('mudavimIcerik');
        var f = document.getElementById('mudavimFiltre');
        var h = document.getElementById('mudavimHaricFiltre');
        var l = document.getElementById('mudavimYukleniyor');
        if (l) l.hidden = true;
        if (f) f.hidden = true;
        if (h) h.hidden = true;
        if (i) i.hidden = true;
        if (y) {
            y.hidden = false;
            var p = y.querySelector('.istat-yetkisiz-metin');
            if (p) p.textContent = mesaj;
            var g = document.getElementById('mudavimGirisBtn');
            if (g) g.hidden = !girisGoster;
        }
    }

    function icerikGoster() {
        var y = document.getElementById('mudavimYetkisiz');
        if (y) y.hidden = true;
        ['mudavimIcerik', 'mudavimFiltre', 'mudavimHaricFiltre'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.hidden = false;
        });
    }

    function filtreBagla() {
        if (filtreHazir) return;
        filtreHazir = true;
        document.querySelectorAll('[data-mudavim-gun]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var g = parseInt(btn.getAttribute('data-mudavim-gun'), 10);
                if (!g || g === seciliGun) return;
                veriYukle(g, null);
            });
        });
        document.querySelectorAll('[data-mudavim-haric]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var h = btn.getAttribute('data-mudavim-haric');
                if (!h || h === seciliHaric) return;
                veriYukle(null, h);
            });
        });
        var yenile = document.getElementById('mudavimYenile');
        if (yenile) yenile.addEventListener('click', function () { veriYukle(seciliGun, seciliHaric); });
        var giris = document.getElementById('mudavimGirisBtn');
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
            yetkisizGoster('Müdavimler laboratuvarını görmek için site yöneticisi hesabıyla giriş yapın.', true);
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

    global.Gunde5Mudavimler = { init: init, yenile: veriYukle };
    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
