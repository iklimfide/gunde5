/* gunde5 — master trafik + günlük istatistikler */
(function (global) {
    'use strict';

    var seciliGun = 30;
    var seciliHaric = 'master';
    var filtreHazir = false;
    var aramaTerimOlayHazir = false;
    var lazyOlayHazir = false;
    var trafikVeri = null;
    var son7Gunluk = null;
    var gunlukVeri = null;
    var gunlukVeriPromise = null;

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

    function jsonCoz(v) {
        if (v == null) return null;
        if (typeof v === 'string') {
            try { return JSON.parse(v); } catch (e) { return null; }
        }
        return v;
    }

    function aramaTerimleriAl(gunluk) {
        var ia = jsonCoz(gunluk && gunluk.index_arayuz);
        if (!ia || typeof ia !== 'object') return [];
        var liste = jsonCoz(ia.arama_terimleri);
        if (!Array.isArray(liste)) return [];
        return liste.map(function (r) {
            if (r == null) return null;
            if (typeof r === 'string') {
                var s = String(r).trim();
                return s.length >= 2 ? { terim: s, adet: 0 } : null;
            }
            var terim = String(r.terim != null ? r.terim : (r.query != null ? r.query : '')).trim();
            if (terim.length < 2) return null;
            return {
                terim: terim,
                adet: parseInt(r.adet != null ? r.adet : r.count, 10) || 0
            };
        }).filter(function (x) { return !!x; });
    }

    function tabloParcaHtml(kolonlar, satirlar, bosMesaj) {
        if (!satirlar.length) {
            return '<p class="istat-bos">' + esc(bosMesaj || 'Veri yok.') + '</p>';
        }
        var html = '<div class="istat-tablo-wrap"><table class="istat-tablo"><thead><tr>';
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
        html += '</tbody></table></div>';
        return html;
    }

    function tabloHtml(baslik, kolonlar, satirlar, bosMesaj, not) {
        var html = '<section class="istat-bolum"><h2 class="istat-bolum-baslik">' + esc(baslik) + '</h2>';
        if (not) html += '<p class="istat-bolum-not">' + esc(not) + '</p>';
        html += tabloParcaHtml(kolonlar, satirlar, bosMesaj);
        return html + '</section>';
    }

    function lazyKabuk(id, baslik, not) {
        return (
            '<section class="istat-bolum istat-bolum--lazy" data-istat-lazy="' + esc(id) + '">' +
            '<div class="istat-bolum-baslik-satir">' +
            '<h2 class="istat-bolum-baslik">' + esc(baslik) + '</h2>' +
            '<button type="button" class="istat-goster-btn" data-istat-goster="' + esc(id) + '">Göster</button>' +
            '</div>' +
            (not ? '<p class="istat-bolum-not">' + esc(not) + '</p>' : '') +
            '<div class="istat-lazy-icerik" data-istat-icerik="' + esc(id) + '" hidden></div>' +
            '</section>'
        );
    }

    function lazySifirla() {
        gunlukVeri = null;
        gunlukVeriPromise = null;
        document.querySelectorAll('.istat-lazy-icerik').forEach(function (el) {
            el.innerHTML = '';
            el.hidden = true;
            el.removeAttribute('data-yuklu');
        });
        document.querySelectorAll('[data-istat-goster]').forEach(function (btn) {
            btn.textContent = 'Göster';
            btn.disabled = false;
        });
    }

    async function gunlukGetir() {
        if (gunlukVeri) return gunlukVeri;
        if (!gunlukVeriPromise) {
            gunlukVeriPromise = loadGunluk().then(function (g) {
                gunlukVeri = g;
                return g;
            });
        }
        return gunlukVeriPromise;
    }

    async function loadGunluk() {
        var D = db();
        if (!D || !D.masterGunlukIstatistik) {
            return { ok: false, hata: 'master_gunluk_istatistik tanımlı değil' };
        }
        try {
            return await D.masterGunlukIstatistik(seciliGun, seciliHaric);
        } catch (e) {
            return {
                ok: false,
                hata: D.hataMesaji ? D.hataMesaji(e) : 'RPC yok veya hata'
            };
        }
    }

    async function loadSon7Gunluk() {
        var D = db();
        if (!D || !D.masterGunlukIstatistik) {
            return { ok: false, hata: 'master_gunluk_istatistik tanımlı değil' };
        }
        try {
            return await D.masterGunlukIstatistik(7, seciliHaric);
        } catch (e) {
            return {
                ok: false,
                hata: D.hataMesaji ? D.hataMesaji(e) : 'RPC yok veya hata'
            };
        }
    }

    function aramaTerimBolumHtml(gunluk) {
        var html = '<section class="istat-bolum" id="istatistikAramaTerim">';
        html += '<h2 class="istat-bolum-baslik">En çok aranan terimler</h2>';
        html += '<p class="istat-bolum-not">Arama önerilerini yönetin. Adet = seçili dönemdeki arama sayısı.</p>';
        html += '<div data-istat-arama-terim-icerik>';
        if (!gunluk || !gunluk.ok) {
            html += '<p class="istat-hata">' + esc((gunluk && gunluk.hata) || 'Günlük veri yüklenemedi.') + '</p>';
        } else {
            html += aramaTerimIcerik(aramaTerimleriAl(gunluk));
        }
        html += '</div></section>';
        return html;
    }

    function aramaTerimleriYerlestir(gunluk) {
        var wrap = document.querySelector('[data-istat-arama-terim-icerik]');
        if (!wrap) return;
        if (!gunluk || !gunluk.ok) {
            wrap.innerHTML = '<p class="istat-hata">' + esc((gunluk && gunluk.hata) || 'Günlük veri yüklenemedi.') + '</p>';
            return;
        }
        wrap.innerHTML = aramaTerimIcerik(aramaTerimleriAl(gunluk));
        aramaTerimTopluSilDurumGuncelle();
    }

    function referrerDetayHtml(veri) {
        var not = 'Ham referrer URL (veya «direkt / bilinmiyor»). En çok 25 kayıt.';
        return tabloParcaHtml(
            [
                { etiket: 'Referrer', deger: function (r) { return kisaMetin(r.referrer, 96); } },
                { etiket: 'Adet', deger: function (r) { return fmtSayi(r.adet); } }
            ],
            arrCoz(veri && veri.referrerlar),
            'Henüz referrer kaydı yok.'
        ) + (not ? '<p class="istat-bolum-not">' + esc(not) + '</p>' : '');
    }

    function gunlukOzetIcerik(gunluk) {
        if (!gunluk || !gunluk.ok) {
            return '<p class="istat-hata">' + esc((gunluk && gunluk.hata) || 'Günlük veri yüklenemedi.') + '</p>';
        }
        var not = 'Hikaye okuma = story_impression (oturumda her hikaye en fazla 1 kez). ';
        if (gunluk.veri_baslangic) {
            not += 'Kayıtlar ' + fmtTarih(gunluk.veri_baslangic) + ' tarihinden itibaren.';
        }
        return tabloParcaHtml(
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
            'Bu dönemde günlük kayıt yok.'
        ) + '<p class="istat-bolum-not">' + esc(not) + '</p>';
    }

    function listeFiltreIcerik(ia) {
        ia = ia || {};
        return tabloParcaHtml(
            [
                { etiket: 'Filtre', deger: function (r) { return r.etiket || r.kod; } },
                { etiket: 'Adet', deger: function (r) { return fmtSayi(r.adet); } }
            ],
            arrCoz(ia.siralama_filtreleri),
            'Bu dönemde sıralama değişikliği yok.'
        ) + '<p class="istat-bolum-not">Mobil açılır liste ve masaüstü yan menü.</p>';
    }

    function hikayeMatrisIcerik(matris) {
        matris = matris || {};
        var gunler = arrCoz(matris.gunler);
        var satirlar = arrCoz(matris.satirlar);
        var html = '<p class="istat-bolum-not">Son 7 gün · en çok okunan 20 hikaye · oturumda hikaye başına en fazla 1 okuma.';
        if (matris.baslangic && matris.bitis) {
            html += ' ' + esc(matris.baslangic) + ' – ' + esc(matris.bitis) + '.';
        }
        html += '</p>';
        if (!gunler.length || !satirlar.length) {
            html += '<p class="istat-bos">Son bir haftada hikaye okuma kaydı yok.</p>';
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
        html += '</tbody></table></div>';
        return html;
    }

    async function lazyBolumHtml(id) {
        if (id === 'referans-detay') {
            return referrerDetayHtml(trafikVeri);
        }
        var gunluk = await gunlukGetir();
        if (id === 'gunluk-ozet') return gunlukOzetIcerik(gunluk);
        if (id === 'hikaye-matris') return hikayeMatrisIcerik(gunluk.hikaye_matris);
        if (id === 'liste-filtre') return listeFiltreIcerik(gunluk.index_arayuz);
        return '';
    }

    async function lazyGoster(id) {
        var wrap = document.querySelector('[data-istat-icerik="' + id + '"]');
        var btn = document.querySelector('[data-istat-goster="' + id + '"]');
        if (!wrap || !btn) return;

        if (wrap.getAttribute('data-yuklu') === '1') {
            wrap.hidden = !wrap.hidden;
            btn.textContent = wrap.hidden ? 'Göster' : 'Gizle';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Yükleniyor…';
        try {
            wrap.innerHTML = await lazyBolumHtml(id);
            wrap.hidden = false;
            wrap.setAttribute('data-yuklu', '1');
            btn.textContent = 'Gizle';
        } catch (e) {
            var D = db();
            wrap.innerHTML = '<p class="istat-hata">' + esc(D && D.hataMesaji ? D.hataMesaji(e) : String(e)) + '</p>';
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
            var btn = e.target.closest('[data-istat-goster]');
            if (!btn) return;
            e.preventDefault();
            lazyGoster(btn.getAttribute('data-istat-goster') || '');
        });
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

    function escAttr(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;');
    }

    function toast(mesaj, hata) {
        if (global.showToast) {
            global.showToast(mesaj, !!hata);
            return;
        }
        if (hata) global.alert(mesaj);
    }

    function aramaTerimIcerik(terimler) {
        terimler = arrCoz(terimler);
        var html = '<div class="istat-bolum-baslik-satir istat-bolum-baslik-satir--ic">';
        html += '<div class="istat-terim-araclar">';
        html += '<button type="button" class="istat-terim-btn istat-terim-btn--ekle" data-istat-arama-ekle>Ekle</button>';
        html += '<button type="button" class="istat-terim-btn istat-terim-btn--sil istat-terim-btn--toplu-sil" data-istat-arama-toplu-sil disabled>Seçilenleri sil</button>';
        html += '</div></div>';
        if (!terimler.length) {
            html += '<p class="istat-bos">Bu dönemde arama kaydı yok.</p>';
            return html;
        }
        html += '<div class="istat-tablo-wrap"><table class="istat-tablo"><thead><tr>';
        html += '<th scope="col" class="istat-terim-sec-kutu"><input type="checkbox" id="istatAramaTumunuSec" data-istat-arama-tumunu-sec aria-label="Tüm terimleri seç"></th>';
        html += '<th scope="col">Terim</th><th scope="col">Adet</th><th scope="col">İşlem</th>';
        html += '</tr></thead><tbody>';
        terimler.forEach(function (r) {
            var terim = String(r.terim || '').trim();
            if (!terim) return;
            html += '<tr>';
            html += '<td class="istat-terim-sec-kutu"><input type="checkbox" class="istat-arama-terim-sec" data-istat-arama-sec value="' + escAttr(terim) + '" aria-label="' + escAttr(terim) + ' seç"></td>';
            html += '<td>' + esc(terim) + '</td>';
            html += '<td>' + esc(fmtSayi(r.adet)) + '</td>';
            html += '<td><div class="istat-terim-islem">';
            html += '<button type="button" class="istat-terim-btn istat-terim-btn--duzenle" data-istat-arama-duzenle data-terim="' + escAttr(terim) + '">Düzenle</button>';
            html += '<button type="button" class="istat-terim-btn istat-terim-btn--sil" data-istat-arama-sil data-terim="' + escAttr(terim) + '">Sil</button>';
            html += '</div></td></tr>';
        });
        html += '</tbody></table></div>';
        return html;
    }

    async function aramaTerimEkle() {
        var D = db();
        if (!D || !D.masterAramaTerimEkle) {
            toast('Terim yönetimi henüz kurulmamış. Supabase\'de index-arama-terim-yonetim.sql çalıştırın.', true);
            return;
        }
        var terim = global.prompt('Önerilere eklenecek arama terimi:', '');
        if (terim == null) return;
        terim = String(terim).trim();
        if (terim.length < 2) {
            toast('En az 2 karakter girin.', true);
            return;
        }
        try {
            await D.masterAramaTerimEkle(terim);
            toast('Terim eklendi.');
            await aramaSonrasiYenile();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : 'Eklenemedi.', true);
        }
    }

    async function aramaTerimDuzenle(eski) {
        var D = db();
        if (!D || !D.masterAramaTerimGuncelle) {
            toast('Terim yönetimi henüz kurulmamış.', true);
            return;
        }
        var yeni = global.prompt('Yeni terim:', eski);
        if (yeni == null) return;
        yeni = String(yeni).trim();
        if (yeni.length < 2) {
            toast('En az 2 karakter girin.', true);
            return;
        }
        if (yeni === eski) return;
        try {
            await D.masterAramaTerimGuncelle(eski, yeni);
            toast('Terim güncellendi.');
            await aramaSonrasiYenile();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : 'Güncellenemedi.', true);
        }
    }

    function seciliAramaTerimleri() {
        return Array.prototype.slice.call(
            document.querySelectorAll('.istat-arama-terim-sec:checked')
        ).map(function (cb) {
            return cb.value || '';
        }).filter(function (t) { return t.length >= 2; });
    }

    function aramaTerimTopluSilDurumGuncelle() {
        var btn = document.querySelector('[data-istat-arama-toplu-sil]');
        if (!btn) return;
        var n = seciliAramaTerimleri().length;
        btn.disabled = n === 0;
        btn.textContent = n > 0 ? ('Seçilenleri sil (' + n + ')') : 'Seçilenleri sil';
        var tumu = document.getElementById('istatAramaTumunuSec');
        var kutular = document.querySelectorAll('.istat-arama-terim-sec');
        if (tumu && kutular.length) {
            tumu.checked = n > 0 && n === kutular.length;
            tumu.indeterminate = n > 0 && n < kutular.length;
        }
    }

    async function aramaTerimTopluSil() {
        var D = db();
        var liste = seciliAramaTerimleri();
        if (!liste.length) {
            toast('Önce silinecek terimleri seçin.', true);
            return;
        }
        if (!D || !D.masterAramaTerimTopluSil) {
            toast('Toplu silme henüz kurulmamış. Supabase\'de index-arama-terim-yonetim.sql güncel sürümünü çalıştırın.', true);
            return;
        }
        if (!global.confirm(liste.length + ' terim kalıcı olarak silinsin mi?')) return;
        try {
            var sonuc = await D.masterAramaTerimTopluSil(liste);
            toast((sonuc.silinen || liste.length) + ' terim kaldırıldı.');
            await aramaSonrasiYenile();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : 'Silinemedi.', true);
        }
    }

    async function aramaTerimSil(terim) {
        var D = db();
        if (!D || !D.masterAramaTerimSil) {
            toast('Terim yönetimi henüz kurulmamış.', true);
            return;
        }
        if (!global.confirm('«' + terim + '» kalıcı olarak silinsin mi?')) return;
        try {
            await D.masterAramaTerimSil(terim);
            toast('Terim kaldırıldı.');
            await aramaSonrasiYenile();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : 'Silinemedi.', true);
        }
    }

    function aramaTerimOlayBagla() {
        if (aramaTerimOlayHazir) return;
        aramaTerimOlayHazir = true;
        document.addEventListener('click', function (e) {
            if (e.target.closest('[data-istat-arama-ekle]')) {
                e.preventDefault();
                aramaTerimEkle();
                return;
            }
            if (e.target.closest('[data-istat-arama-toplu-sil]')) {
                e.preventDefault();
                aramaTerimTopluSil();
                return;
            }
            var duzenle = e.target.closest('[data-istat-arama-duzenle]');
            if (duzenle) {
                e.preventDefault();
                aramaTerimDuzenle(duzenle.getAttribute('data-terim') || '');
                return;
            }
            var sil = e.target.closest('[data-istat-arama-sil]');
            if (sil) {
                e.preventDefault();
                aramaTerimSil(sil.getAttribute('data-terim') || '');
            }
        });
        document.addEventListener('change', function (e) {
            if (e.target.matches('[data-istat-arama-tumunu-sec]')) {
                var sec = !!e.target.checked;
                document.querySelectorAll('.istat-arama-terim-sec').forEach(function (cb) {
                    cb.checked = sec;
                });
                aramaTerimTopluSilDurumGuncelle();
                return;
            }
            if (e.target.matches('[data-istat-arama-sec]')) {
                aramaTerimTopluSilDurumGuncelle();
            }
        });
    }

    async function aramaSonrasiYenile() {
        gunlukVeri = null;
        gunlukVeriPromise = null;
        var gunluk = await gunlukGetir();
        aramaTerimleriYerlestir(gunluk);
        ['liste-filtre', 'gunluk-ozet', 'hikaye-matris'].forEach(function (id) {
            var wrap = document.querySelector('[data-istat-icerik="' + id + '"]');
            if (!wrap || wrap.getAttribute('data-yuklu') !== '1') return;
            if (id === 'liste-filtre') wrap.innerHTML = listeFiltreIcerik(gunluk.index_arayuz);
            else if (id === 'gunluk-ozet') wrap.innerHTML = gunlukOzetIcerik(gunluk);
            else if (id === 'hikaye-matris') wrap.innerHTML = hikayeMatrisIcerik(gunluk.hikaye_matris);
        });
    }

    function son7GunlukToplam() {
        var satirlar = arrCoz(son7Gunluk && son7Gunluk.gunluk);
        var tekil = 0;
        var gorunt = 0;
        var i;
        for (i = 0; i < satirlar.length; i++) {
            tekil += parseInt(satirlar[i].tekil_ziyaretci, 10) || 0;
            gorunt += parseInt(satirlar[i].sayfa_acilisi, 10) || 0;
        }
        return { tekil: tekil, gorunt: gorunt };
    }

    function son7GunlukHtml() {
        if (!son7Gunluk || !son7Gunluk.ok) {
            return (
                '<section class="istat-bolum istat-bolum--son7">' +
                '<h2 class="istat-bolum-baslik">Son 7 gün</h2>' +
                '<p class="istat-hata">' + esc((son7Gunluk && son7Gunluk.hata) || 'Günlük veri yüklenemedi.') + '</p>' +
                '</section>'
            );
        }
        var toplam = son7GunlukToplam();
        var html = '<section class="istat-bolum istat-bolum--son7">';
        html += '<h2 class="istat-bolum-baslik">Son 7 gün</h2>';
        html += tabloParcaHtml(
            [
                { etiket: 'Gün', deger: function (r) { return r.gun_etiket || r.gun; } },
                { etiket: 'Tekil kullanıcı', deger: function (r) { return fmtSayi(r.tekil_ziyaretci); } },
                { etiket: 'Görüntüleme', deger: function (r) { return fmtSayi(r.sayfa_acilisi); } }
            ],
            arrCoz(son7Gunluk.gunluk),
            'Son 7 günde kayıt yok.'
        );
        html += '<p class="istat-bolum-not">İstanbul günü · tekil kullanıcı = o günkü benzersiz ziyaretçi · görüntüleme = sayfa açılışı</p>';
        html += '<h3 class="istat-bolum-baslik istat-bolum-baslik--alt">Trafik özeti</h3>';
        html += '<div class="istat-kpi-grid istat-kpi-grid--hero">';
        html += kpiKart('Tekil kullanıcı', fmtSayi(toplam.tekil), '7 gün — günlük değerlerin toplamı');
        html += kpiKart('Görüntüleme', fmtSayi(toplam.gorunt), '7 gün — sayfa açılışı toplamı');
        html += '</div></section>';
        return html;
    }

    function trafikDonemOzetHtml(veri) {
        if (!veri || seciliGun === 7) return '';
        return (
            '<section class="istat-bolum istat-bolum--hero">' +
            '<h2 class="istat-bolum-baslik">Trafik özeti — son ' + fmtSayi(veri.gun) + ' gün</h2>' +
            '<div class="istat-kpi-grid istat-kpi-grid--hero">' +
            kpiKart('Toplam sayfa açılışı', fmtSayi(veri.toplam), 'ziyaret_kaydet — yenileme dahil') +
            kpiKart('Tekil oturum', fmtSayi(veri.tekil_oturum), 'Farklı oturum anahtarı') +
            kpiKart('Girişli ziyaret', fmtSayi(veri.girisli_ziyaret), 'user_id dolu kayıtlar') +
            '</div></section>'
        );
    }

    function render(veri) {
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

        html += son7GunlukHtml();
        html += trafikDonemOzetHtml(veri);

        html += aramaTerimBolumHtml(gunlukVeri);

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

        html += lazyKabuk(
            'referans-detay',
            'Trafik referansları (detay)',
            'Ham referrer URL listesi; gruplu tablonun altında en çok 25 kayıt.'
        );
        html += lazyKabuk(
            'gunluk-ozet',
            'Günlük özet',
            'Gün gün sayfa açılışı, oturum, okuma ve etkileşim.'
        );
        html += lazyKabuk(
            'hikaye-matris',
            'Hikaye okuma matrisi',
            'Son 7 gün · en çok okunan 20 hikaye.'
        );
        html += lazyKabuk(
            'liste-filtre',
            'Liste filtresi kullanımı',
            'Anasayfa sıralama filtresi değişiklikleri.'
        );

        kok.innerHTML = html;
        aramaTerimTopluSilDurumGuncelle();
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
        lazySifirla();
        yukleniyor(true);
        try {
            var sonuclar = await Promise.all([
                D.masterTrafikIstatistik(seciliGun, seciliHaric),
                loadSon7Gunluk(),
                loadGunluk()
            ]);
            var veri = sonuclar[0];
            son7Gunluk = sonuclar[1];
            gunlukVeri = sonuclar[2];
            gunlukVeriPromise = Promise.resolve(gunlukVeri);
            trafikVeri = veri;
            render(veri);
        } catch (e) {
            trafikVeri = null;
            son7Gunluk = null;
            gunlukVeri = null;
            gunlukVeriPromise = null;
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
        aramaTerimOlayBagla();
        lazyOlayBagla();
        await veriYukle(seciliGun);
    }

    global.Gunde5Istatistik = { init: init, yenile: veriYukle };
    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
