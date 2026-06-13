/* gunde5 — master site içi metrikler (site_analytics) */
(function (global) {
    'use strict';

    var seciliGun = 30;
    var seciliHaric = 'master';
    var filtreHazir = false;
    var lazyOlayHazir = false;
    var bugunSiraIds = [];
    var bugunSiraKayitli = false;
    var bugunSiraSatirlar = {};
    var siraKaydediyor = false;
    var puanGosterAdet = 20;
    var PUAN_ILK_ADET = 20;
    var PUAN_ADIM = 20;
    var puanSort = { kolon: 'puan', yon: 'desc' };

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

    /** Okuyucu başına net oy: (beğeni − beğenmeme) / görülme × 100 */
    function hikayeOkurPuani(satir) {
        var gor = parseInt(satir && satir.goruntulenme, 10);
        var beg = parseInt(satir && satir.begeni, 10);
        var begenme = parseInt(satir && satir.begenmeme, 10);
        if (!isFinite(gor) || gor <= 0) return null;
        if (!isFinite(beg)) beg = 0;
        if (!isFinite(begenme)) begenme = 0;
        return ((beg - begenme) / gor) * 100;
    }

    function cinsEtiket(gender) {
        if (gender === 'male') return 'Erkek';
        if (gender === 'female') return 'Kadın';
        return '—';
    }

    function cinsHtml(satir) {
        var cins = satir && satir.gender;
        var etiket = cinsEtiket(cins);
        if (etiket === '—') return etiket;
        var sinif = 'metrik-cins';
        if (cins === 'male') sinif += ' metrik-cins--erkek';
        else if (cins === 'female') sinif += ' metrik-cins--kadin';
        return '<span class="' + sinif + '">' + esc(etiket) + '</span>';
    }

    function hikayePuanDeger(satir) {
        if (satir && satir.puan != null && satir.puan !== '') {
            var sqlPuan = parseFloat(satir.puan);
            if (isFinite(sqlPuan)) return sqlPuan;
        }
        return hikayeOkurPuani(satir);
    }

    function hikayePuanHtml(satir) {
        var puan = hikayePuanDeger(satir);
        if (puan == null) return '—';
        var sinif = 'metrik-puan';
        if (puan > 0) sinif += ' metrik-puan--iyi';
        else if (puan < 0) sinif += ' metrik-puan--kotu';
        var metin = (puan > 0 ? '+' : '') + fmtOran(puan) + '%';
        return '<span class="' + sinif + '" title="(beğeni − beğenmeme) ÷ görülme">' + esc(metin) + '</span>';
    }

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

    function lazyKabuk(id, baslik, not) {
        return (
            '<section class="istat-bolum istat-bolum--lazy" data-metrik-lazy="' + esc(id) + '">' +
            '<div class="istat-bolum-baslik-satir">' +
            '<h2 class="istat-bolum-baslik">' + esc(baslik) + '</h2>' +
            '<button type="button" class="istat-goster-btn" data-metrik-goster="' + esc(id) + '">Göster</button>' +
            '</div>' +
            (not ? '<p class="istat-bolum-not">' + esc(not) + '</p>' : '') +
            '<div class="istat-lazy-icerik" data-metrik-icerik="' + esc(id) + '" hidden></div>' +
            '</section>'
        );
    }

    function lazySifirla() {
        document.querySelectorAll('[data-metrik-icerik]').forEach(function (el) {
            el.innerHTML = '';
            el.hidden = true;
            el.removeAttribute('data-yuklu');
        });
        document.querySelectorAll('[data-metrik-goster]').forEach(function (btn) {
            btn.textContent = 'Göster';
            btn.disabled = false;
        });
    }

    function lazyBolumHtml(id, veri) {
        if (id === 'icerik-performans') {
            return puanSiraliTabloIcerik(objCoz(veri && veri.icerik));
        }
        return '';
    }

    function lazyGoster(id) {
        var kok = document.getElementById('metrikIcerik');
        var wrap = document.querySelector('[data-metrik-icerik="' + id + '"]');
        var btn = document.querySelector('[data-metrik-goster="' + id + '"]');
        if (!wrap || !btn || !kok || !kok._g5SonVeri) return;

        if (wrap.getAttribute('data-yuklu') === '1') {
            wrap.hidden = !wrap.hidden;
            btn.textContent = wrap.hidden ? 'Göster' : 'Gizle';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Yükleniyor…';
        try {
            wrap.innerHTML = lazyBolumHtml(id, kok._g5SonVeri);
            wrap.hidden = false;
            wrap.setAttribute('data-yuklu', '1');
            btn.textContent = 'Gizle';
        } catch (e) {
            wrap.innerHTML = '<p class="istat-hata">' + esc(String(e)) + '</p>';
            wrap.hidden = false;
            btn.textContent = 'Göster';
        } finally {
            btn.disabled = false;
        }
    }

    function lazyOlayBagla() {
        if (lazyOlayHazir) return;
        lazyOlayHazir = true;
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-metrik-goster]');
            if (!btn) return;
            e.preventDefault();
            lazyGoster(btn.getAttribute('data-metrik-goster') || '');
        });
    }

    function puanLazyYenile() {
        var wrap = document.querySelector('[data-metrik-icerik="icerik-performans"]');
        var kok = document.getElementById('metrikIcerik');
        if (!wrap || wrap.getAttribute('data-yuklu') !== '1' || !kok || !kok._g5SonVeri) return;
        wrap.innerHTML = puanSiraliTabloIcerik(objCoz(kok._g5SonVeri.icerik));
    }

    function puanListeYedek(icerik) {
        var harita = {};
        function birlestir(liste) {
            arrCoz(liste).forEach(function (r) {
                if (!r || r.id == null) return;
                var key = String(r.id);
                var mevcut = harita[key] || { id: r.id, baslik: r.baslik };
                if (r.baslik) mevcut.baslik = r.baslik;
                if (r.begeni != null) mevcut.begeni = r.begeni;
                if (r.begenmeme != null) mevcut.begenmeme = r.begenmeme;
                if (r.paylasim != null) mevcut.paylasim = r.paylasim;
                if (r.goruntulenme != null) mevcut.goruntulenme = r.goruntulenme;
                harita[key] = mevcut;
            });
        }
        birlestir(icerik.en_begenilen);
        birlestir(icerik.en_begenilmeyen);
        birlestir(icerik.en_gorulen);
        birlestir(icerik.en_paylasilan);
        return Object.keys(harita).map(function (k) {
            return harita[k];
        }).filter(function (r) {
            var gor = parseInt(r.goruntulenme, 10);
            var beg = parseInt(r.begeni, 10) || 0;
            var begenme = parseInt(r.begenmeme, 10) || 0;
            return isFinite(gor) && gor > 0 && (beg > 0 || begenme > 0);
        }).sort(function (a, b) {
            var pa = hikayeOkurPuani(a);
            var pb = hikayeOkurPuani(b);
            if (pa == null && pb == null) return 0;
            if (pa == null) return 1;
            if (pb == null) return -1;
            return pb - pa;
        }).slice(0, 100);
    }

    function puanSiraliListe(icerik) {
        var liste = arrCoz(icerik.puan_sirali);
        if (liste.length) return liste;
        return puanListeYedek(icerik);
    }

    function puanKarsilastir(a, b, kolon, asc) {
        var va;
        var vb;
        var sonuc;
        if (kolon === 'baslik') {
            va = String((a && a.baslik) || '');
            vb = String((b && b.baslik) || '');
            try {
                sonuc = va.localeCompare(vb, 'tr', { sensitivity: 'base' });
            } catch (eLoc) {
                sonuc = va < vb ? -1 : va > vb ? 1 : 0;
            }
        } else if (kolon === 'gender') {
            va = a && a.gender === 'male' ? 1 : a && a.gender === 'female' ? 0 : -1;
            vb = b && b.gender === 'male' ? 1 : b && b.gender === 'female' ? 0 : -1;
            sonuc = va - vb;
        } else if (kolon === 'puan') {
            va = hikayePuanDeger(a);
            vb = hikayePuanDeger(b);
            if (va == null && vb == null) sonuc = 0;
            else if (va == null) sonuc = 1;
            else if (vb == null) sonuc = -1;
            else sonuc = va - vb;
        } else {
            va = parseInt(a && a[kolon], 10);
            vb = parseInt(b && b[kolon], 10);
            if (!isFinite(va)) va = 0;
            if (!isFinite(vb)) vb = 0;
            sonuc = va - vb;
        }
        if (sonuc === 0 && a && b && a.id != null && b.id != null) {
            sonuc = String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
        }
        return asc ? sonuc : -sonuc;
    }

    function puanSiralamaUygula(liste) {
        var k = puanSort.kolon;
        var asc = puanSort.yon === 'asc';
        return liste.slice().sort(function (a, b) {
            return puanKarsilastir(a, b, k, asc);
        });
    }

    function puanThBtn(kolon, etiket) {
        var aktif = puanSort.kolon === kolon;
        var ok = aktif ? (puanSort.yon === 'asc' ? '↑' : '↓') : '↕';
        var sinif = 'metrik-th-sort' + (aktif ? ' metrik-th-sort--aktif' : '');
        var yonEtiket = aktif
            ? (puanSort.yon === 'asc' ? 'artan' : 'azalan')
            : 'sırala';
        return (
            '<button type="button" class="' + sinif + '" data-puan-sort="' + esc(kolon) + '" ' +
            'aria-label="' + esc(etiket) + ' — ' + yonEtiket + ' sırala">' +
            esc(etiket) + ' <span class="metrik-th-ok" aria-hidden="true">' + ok + '</span></button>'
        );
    }

    function puanSatirHtml(r) {
        return (
            '<tr>' +
            '<td>' + kisaMetin(r.baslik, 64) + '</td>' +
            '<td>' + cinsHtml(r) + '</td>' +
            '<td>' + esc(fmtSayi(r.goruntulenme)) + '</td>' +
            '<td>' + esc(fmtSayi(r.begeni)) + '</td>' +
            '<td>' + esc(fmtSayi(r.begenmeme)) + '</td>' +
            '<td>' + esc(fmtSayi(r.paylasim)) + '</td>' +
            '<td>' + hikayePuanHtml(r) + '</td>' +
            '</tr>'
        );
    }

    function puanSiraliTabloIcerik(icerik) {
        var tum = puanSiralamaUygula(puanSiraliListe(icerik));
        var not = 'Puan = (beğeni − beğenmeme) ÷ görülme × 100 · görülme = DB tekil veya dönem impression (büyük olan) · dönem içi oy · sütun başlığına tıklayarak sırala';
        var html = '<div class="metrik-puan-bolum" id="metrikPuanBolum">';
        html += '<h3 class="istat-bolum-alt-baslik">Okuyucu puanı — hikâyeler</h3>';
        html += '<p class="istat-bolum-not">' + esc(not) + '</p>';
        if (!tum.length) {
            html += '<p class="istat-bos">Bu dönemde puanlanacak hikâye yok (görülme ve oy gerekli).</p></div>';
            return html;
        }
        var goster = tum.slice(0, puanGosterAdet);
        html += '<div class="istat-tablo-wrap"><table class="istat-tablo metrik-puan-tablo"><thead><tr>';
        html += '<th scope="col">' + puanThBtn('baslik', 'Başlık') + '</th>';
        html += '<th scope="col">' + puanThBtn('gender', 'Cins') + '</th>';
        html += '<th scope="col">' + puanThBtn('goruntulenme', 'Görülme') + '</th>';
        html += '<th scope="col">' + puanThBtn('begeni', 'Beğeni') + '</th>';
        html += '<th scope="col">' + puanThBtn('begenmeme', 'Beğenmeme') + '</th>';
        html += '<th scope="col">' + puanThBtn('paylasim', 'Paylaşım') + '</th>';
        html += '<th scope="col">' + puanThBtn('puan', 'Puan') + '</th>';
        html += '</tr></thead><tbody>';
        goster.forEach(function (r) {
            html += puanSatirHtml(r);
        });
        html += '</tbody></table></div>';
        html += '<p class="metrik-puan-ozet">' + fmtSayi(goster.length) + ' / ' + fmtSayi(tum.length) + ' hikâye</p>';
        if (tum.length > puanGosterAdet) {
            var kalan = tum.length - puanGosterAdet;
            var adim = Math.min(PUAN_ADIM, kalan);
            html += '<p class="metrik-puan-daha"><button type="button" class="istat-yenile-btn" id="metrikPuanDahaFazla">' +
                fmtSayi(adim) + ' tane daha göster (' + fmtSayi(kalan) + ' kaldı)</button></p>';
        }
        html += '</div>';
        return html;
    }

    function puanEtkilesimBagla() {
        var kok = document.getElementById('metrikIcerik');
        if (!kok || kok._g5PuanEtkilesim) return;
        kok._g5PuanEtkilesim = true;
        kok.addEventListener('click', function (e) {
            var sortBtn = e.target.closest('[data-puan-sort]');
            if (sortBtn) {
                e.preventDefault();
                var kolon = sortBtn.getAttribute('data-puan-sort');
                if (!kolon) return;
                if (puanSort.kolon === kolon) {
                    puanSort.yon = puanSort.yon === 'asc' ? 'desc' : 'asc';
                } else {
                    puanSort.kolon = kolon;
                    puanSort.yon = (kolon === 'baslik' || kolon === 'gender') ? 'asc' : 'desc';
                }
                puanLazyYenile();
                return;
            }
            var hedef = e.target;
            if (hedef && hedef.id === 'metrikPuanDahaFazla') {
                e.preventDefault();
                puanGosterAdet += PUAN_ADIM;
                puanLazyYenile();
            }
        });
    }

    function bugunSatirlariAyikla(satirlar) {
        var bugun = [];
        var diger = [];
        arrCoz(satirlar).forEach(function (r) {
            if (r && r.gun_etiket === 'Bugün' && r.id != null) bugun.push(r);
            else diger.push(r);
        });
        return { bugun: bugun, diger: diger };
    }

    function bugunSiraDurumGuncelle(icerik) {
        var parcalar = bugunSatirlariAyikla(icerik.son_gun_hikayeler);
        bugunSiraKayitli = !!icerik.bugun5_manuel_sira;
        bugunSiraSatirlar = {};
        bugunSiraIds = parcalar.bugun.map(function (r) {
            bugunSiraSatirlar[String(r.id)] = r;
            return r.id;
        });
    }

    function bugunSiraSatirHtml(id, idx, toplam) {
        var r = bugunSiraSatirlar[String(id)];
        if (!r) return '';
        var yukariKapali = idx <= 0 ? ' disabled' : '';
        var asagiKapali = idx >= toplam - 1 ? ' disabled' : '';
        var siraNo = idx + 1;
        return (
            '<tr class="metrik-sira-satir" data-metrik-sira-id="' + esc(String(id)) + '">' +
            '<td class="metrik-sira-hucre">' +
            '<span class="metrik-sira-no" aria-live="polite">' + esc(String(siraNo)) + '</span>' +
            '<div class="metrik-sira-kontrol">' +
            '<button type="button" class="metrik-sira-btn" data-metrik-sira-yon="yukari"' + yukariKapali + ' aria-label="' + siraNo + '. sıra, yukarı">↑</button>' +
            '<button type="button" class="metrik-sira-btn" data-metrik-sira-yon="asagi"' + asagiKapali + ' aria-label="' + siraNo + '. sıra, aşağı">↓</button>' +
            '</div></td>' +
            '<td>' + esc(r.gun_etiket || 'Bugün') + '</td>' +
            '<td>' + esc(r.yayin_tarihi || '—') + '</td>' +
            '<td>' + kisaMetin(r.baslik, 56) + '</td>' +
            '<td>' + cinsHtml(r) + '</td>' +
            '<td>' + esc(fmtSayi(r.goruntulenme)) + '</td>' +
            '<td>' + esc(fmtSayi(r.begeni)) + '</td>' +
            '<td>' + esc(fmtSayi(r.begenmeme)) + '</td>' +
            '<td>' + esc(fmtSayi(r.paylasim)) + '</td>' +
            '<td>' + hikayePuanHtml(r) + '</td>' +
            '</tr>'
        );
    }

    function sonGunHikayelerHtml(icerik) {
        var parcalar = bugunSatirlariAyikla(icerik.son_gun_hikayeler);
        var baslik = 'Dün ve bugün — son 10 hikâye';
        var not = 'İstanbul saati · görülme = DB tekil veya analytics impression (büyük olan) · oy/paylaşım analytics (hariç tut filtresine uygun, tüm zaman) · puan = (beğeni − beğenmeme) ÷ görülme × 100 (okuyucu başına net oy %)';
        var html = '<section class="istat-bolum metrik-sira-bolum"><h2 class="istat-bolum-baslik">' + esc(baslik) + '</h2>';
        html += '<p class="istat-bolum-not">' + esc(not) + '</p>';

        if (!parcalar.bugun.length && !parcalar.diger.length) {
            html += '<p class="istat-bos">Dün veya bugün yayınlanan hikâye yok.</p></section>';
            return html;
        }

        if (parcalar.bugun.length) {
            html += '<div class="metrik-sira-ust">';
            html += '<p class="metrik-sira-aciklama">Bugünün 5\'i — anasayfa sırası (↑↓ ile değiştir)</p>';
            if (bugunSiraKayitli) {
                html += '<span class="metrik-sira-rozet">Özel sıra aktif</span>';
            }
            html += '</div>';
            html += '<div class="metrik-sira-aksiyonlar">';
            html += '<button type="button" class="metrik-sira-kaydet-btn" id="metrikBugun5Kaydet">Sırayı kaydet</button>';
            html += '<button type="button" class="metrik-sira-sifirla-btn" id="metrikBugun5Sifirla">Yayın sırasına dön</button>';
            html += '</div>';
        }

        html += '<div class="istat-tablo-wrap"><table class="istat-tablo metrik-sira-tablo"><thead><tr>';
        if (parcalar.bugun.length) {
            html += '<th scope="col">Sıra</th>';
        }
        html += '<th scope="col">Gün</th><th scope="col">Yayın</th><th scope="col">Başlık</th><th scope="col">Cins</th>';
        html += '<th scope="col">Görülme</th><th scope="col">Beğeni</th><th scope="col">Beğenmeme</th><th scope="col">Paylaşım</th><th scope="col">Puan</th>';
        html += '</tr></thead><tbody>';

        if (parcalar.bugun.length) {
            bugunSiraIds.forEach(function (id, idx) {
                html += bugunSiraSatirHtml(id, idx, bugunSiraIds.length);
            });
        }

        parcalar.diger.forEach(function (r) {
            html += '<tr>' +
                (parcalar.bugun.length ? '<td></td>' : '') +
                '<td>' + esc(r.gun_etiket || '—') + '</td>' +
                '<td>' + esc(r.yayin_tarihi || '—') + '</td>' +
                '<td>' + kisaMetin(r.baslik, 56) + '</td>' +
                '<td>' + cinsHtml(r) + '</td>' +
                '<td>' + esc(fmtSayi(r.goruntulenme)) + '</td>' +
                '<td>' + esc(fmtSayi(r.begeni)) + '</td>' +
                '<td>' + esc(fmtSayi(r.begenmeme)) + '</td>' +
                '<td>' + esc(fmtSayi(r.paylasim)) + '</td>' +
                '<td>' + hikayePuanHtml(r) + '</td>' +
                '</tr>';
        });

        html += '</tbody></table></div></section>';
        return html;
    }

    function bugunSiraTasi(id, yon) {
        var idx = bugunSiraIds.indexOf(id);
        if (idx < 0) return;
        var hedef = yon === 'yukari' ? idx - 1 : idx + 1;
        if (hedef < 0 || hedef >= bugunSiraIds.length) return;
        var gecici = bugunSiraIds[idx];
        bugunSiraIds[idx] = bugunSiraIds[hedef];
        bugunSiraIds[hedef] = gecici;
    }

    function bugunSiraTabloYenile() {
        var govde = document.querySelector('.metrik-sira-tablo tbody');
        if (!govde || !bugunSiraIds.length) return;
        var diger = [];
        govde.querySelectorAll('tr:not(.metrik-sira-satir)').forEach(function (tr) {
            diger.push(tr.outerHTML);
        });
        var bugunHtml = '';
        bugunSiraIds.forEach(function (id, idx) {
            bugunHtml += bugunSiraSatirHtml(id, idx, bugunSiraIds.length);
        });
        govde.innerHTML = bugunHtml + diger.join('');
        siraKontrolBagla();
    }

    function siraKontrolBagla() {
        document.querySelectorAll('[data-metrik-sira-yon]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (btn.disabled) return;
                var satir = btn.closest('[data-metrik-sira-id]');
                if (!satir) return;
                var id = parseInt(satir.getAttribute('data-metrik-sira-id'), 10);
                if (!isFinite(id)) return;
                bugunSiraTasi(id, btn.getAttribute('data-metrik-sira-yon'));
                bugunSiraTabloYenile();
            });
        });
    }

    function siraAksiyonBagla() {
        var kok = document.getElementById('metrikIcerik');
        if (!kok || kok._g5SiraAksiyon) return;
        kok._g5SiraAksiyon = true;
        kok.addEventListener('click', function (e) {
            var hedef = e.target;
            if (!hedef || !hedef.id) return;
            if (hedef.id === 'metrikBugun5Kaydet') {
                e.preventDefault();
                siraKaydet();
            } else if (hedef.id === 'metrikBugun5Sifirla') {
                e.preventDefault();
                siraSifirla();
            }
        });
    }

    function toast(mesaj, hata) {
        var U = ui();
        if (U && U.showToast) U.showToast(mesaj, hata ? 'hata' : undefined);
    }

    async function siraKaydet() {
        if (siraKaydediyor) return;
        var D = db();
        if (!D || !D.masterBugun5SiraKaydet) return;
        siraKaydediyor = true;
        try {
            await D.masterBugun5SiraKaydet(bugunSiraIds);
            toast('Anasayfa sırası kaydedildi.');
            await veriYukle(seciliGun, seciliHaric);
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : 'Kaydedilemedi.', true);
        } finally {
            siraKaydediyor = false;
        }
    }

    async function siraSifirla() {
        if (siraKaydediyor) return;
        var D = db();
        if (!D || !D.masterBugun5SiraSifirla) return;
        siraKaydediyor = true;
        try {
            await D.masterBugun5SiraSifirla();
            toast('Yayın sırasına dönüldü.');
            await veriYukle(seciliGun, seciliHaric);
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : 'Sıfırlanamadı.', true);
        } finally {
            siraKaydediyor = false;
        }
    }

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

        html += lazyKabuk(
            'icerik-performans',
            'İçerik performansı',
            'Okuyucu puanı tablosu — «Göster» ile açılır.'
        );

        bugunSiraDurumGuncelle(icerik);
        html += sonGunHikayelerHtml(icerik);

        kok._g5SonVeri = veri;
        kok.innerHTML = html;
        siraKontrolBagla();
        puanEtkilesimBagla();
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
        lazySifirla();
        yukleniyor(true);
        puanGosterAdet = PUAN_ILK_ADET;
        puanSort = { kolon: 'puan', yon: 'desc' };
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
        siraAksiyonBagla();
        puanEtkilesimBagla();
        lazyOlayBagla();
        await veriYukle(seciliGun);
    }

    global.Gunde5Metrikler = { init: init, yenile: veriYukle };
    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
