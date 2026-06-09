/* gunde5 — Kamikaze: hikaye arama, düzenleme, planlama */
(function (global) {
    'use strict';

    var satirlar = [];
    var aramaMetni = '';
    var aramaZamanlayici = null;
    var aramaIstekNo = 0;
    var filtre = 'hepsi';
    var tarihYil = '';
    var tarihAy = '';
    var tarihGun = '';
    var tarihAgaci = null;
    var sira = 'desc';
    var AY_ADLARI = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    var drawerMod = '';
    var drawerId = null;
    var islemSuruyor = false;
    var panelYetkili = false;
    var authYenilemeBaglandi = false;
    var panelIstekNo = 0;
    var drawerTiklamaBaglandi = false;

    function db() { return global.Gunde5DB; }
    function ui() { return global.Gunde5UI; }
    function profil() { return global.Gunde5Profil; }

    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function arr(v) { return Array.isArray(v) ? v : []; }

    function fmtTarih(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleString('tr-TR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) {
            return String(iso);
        }
    }

    function ikiHane(n) { return n < 10 ? '0' + n : String(n); }

    function gunAnahtar(iso) {
        var D = db();
        if (D && D.kamikazeGunAnahtar) return D.kamikazeGunAnahtar(iso);
        if (!iso) return '';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.getFullYear() + '-' + ikiHane(d.getMonth() + 1) + '-' + ikiHane(d.getDate());
        } catch (e) {
            return '';
        }
    }

    function isoDatetimeLocalValue(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.getFullYear() + '-' + ikiHane(d.getMonth() + 1) + '-' + ikiHane(d.getDate()) +
                'T' + ikiHane(d.getHours()) + ':' + ikiHane(d.getMinutes());
        } catch (e) {
            return '';
        }
    }

    function datetimeLocalOku(raw) {
        var metin = String(raw || '').trim();
        if (!metin) return null;
        var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(metin);
        if (!m) return null;
        var d = new Date(
            parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10),
            parseInt(m[4], 10), parseInt(m[5], 10), m[6] ? parseInt(m[6], 10) : 0, 0
        );
        return isNaN(d.getTime()) ? null : d;
    }

    function indexYayindaMi(row) {
        if (!row || row.status === 'podyum' || row.silindi_at || row.status === 'silindi') return false;
        var t = new Date(row.created_at).getTime();
        return isFinite(t) && t <= Date.now();
    }

    function satirDurum(row) {
        if (!row) return 'index';
        if (row.silindi_at || row.status === 'silindi') return 'silinen';
        if (row.status === 'podyum') return 'podyum';
        if (row.status === 'kulis' && !indexYayindaMi(row)) return 'planli';
        if (row.is_gizli) return 'gizli';
        return 'index';
    }

    function durumEtiket(kod) {
        if (kod === 'planli') return 'planlı';
        if (kod === 'podyum') return 'podyum';
        if (kod === 'gizli') return 'gizli';
        if (kod === 'silinen') return 'silinen';
        return 'index';
    }

    function toast(msg, tur) {
        if (ui() && ui().showToast) ui().showToast(msg, tur);
    }

    function qs(id) { return document.getElementById(id); }

    function yukleniyorGoster(metin) {
        var yuk = qs('kmYukleniyor');
        var wrap = qs('kmYetkisiz');
        var arac = qs('kmAraclar');
        if (yuk) {
            yuk.hidden = false;
            var p = yuk.querySelector('p');
            if (p) p.textContent = metin || 'Oturum ve panel hazırlanıyor…';
        }
        if (wrap) wrap.hidden = true;
        if (arac) arac.hidden = true;
    }

    function yukleniyorGizle() {
        var yuk = qs('kmYukleniyor');
        if (yuk) yuk.hidden = true;
    }

    function yetkisizGoster(metin, giris) {
        yukleniyorGizle();
        var wrap = qs('kmYetkisiz');
        var arac = qs('kmAraclar');
        var metinEl = qs('kmYetkisizMetin');
        var btn = qs('kmGirisBtn');
        if (wrap) wrap.hidden = false;
        if (arac) arac.hidden = true;
        if (metinEl) metinEl.textContent = metin || 'Yetkisiz';
        if (btn) btn.hidden = !giris;
    }

    function araclariGoster() {
        yukleniyorGizle();
        var wrap = qs('kmYetkisiz');
        var arac = qs('kmAraclar');
        if (wrap) wrap.hidden = true;
        if (arac) arac.hidden = false;
    }

    function metaGuncelle(n) {
        var el = qs('kmMeta');
        if (!el) return;
        el.textContent = (n != null ? n : satirlar.length) + ' hikaye';
    }

    function listeYukleniyorGoster() {
        var el = qs('kmListe');
        if (el) el.innerHTML = '<p class="km-bos">Yükleniyor…</p>';
        var meta = qs('kmMeta');
        if (meta) meta.textContent = 'Yükleniyor…';
    }

    function filtreleriDomdanSenkronize() {
        var filtreEl = qs('kmFiltre');
        var yilEl = qs('kmYil');
        var ayEl = qs('kmAy');
        var gunEl = qs('kmGun');
        var siraEl = qs('kmSira');
        var ara = qs('kmAra');
        if (filtreEl) filtre = filtreEl.value;
        if (yilEl) tarihYil = yilEl.value || '';
        if (ayEl) tarihAy = ayEl.value || '';
        if (gunEl) tarihGun = gunEl.value || '';
        if (siraEl) sira = siraEl.value === 'asc' ? 'asc' : 'desc';
        if (ara) aramaMetni = ara.value;
    }

    async function filtreleriUygula() {
        filtreleriDomdanSenkronize();
        listeYukleniyorGoster();
        try {
            await panelYukle();
        } catch (e) {
            var D = db();
            var el = qs('kmListe');
            if (el) {
                el.innerHTML = '<p class="km-hata">' + esc(D && D.hataMesaji ? D.hataMesaji(e) : String(e)) + '</p>';
            }
            toast(D && D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        }
    }

    function bugunIstanbul() {
        var key = gunAnahtar(new Date().toISOString());
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
        if (!m) return null;
        return { yil: m[1], ay: m[2], gun: m[3] };
    }

    function varsayilanTarihUygula() {
        var b = bugunIstanbul();
        if (!b) return;
        tarihYil = b.yil;
        tarihAy = b.ay;
        tarihGun = b.gun;
    }

    function tarihAgacaGunEkle(yil, ay, gun) {
        if (!yil || !ay || !gun) return;
        if (!tarihAgaci) tarihAgaci = {};
        if (!tarihAgaci[yil]) tarihAgaci[yil] = {};
        if (!tarihAgaci[yil][ay]) tarihAgaci[yil][ay] = [];
        if (tarihAgaci[yil][ay].indexOf(gun) < 0) {
            tarihAgaci[yil][ay].push(gun);
            tarihAgaci[yil][ay].sort(function (a, b) {
                return parseInt(a, 10) - parseInt(b, 10);
            });
        }
    }

    function tarihAktifMi() {
        return !!tarihYil;
    }

    function listeTarihOpts() {
        var o = { sira: sira };
        if (!tarihYil) return o;
        o.yil = tarihYil;
        if (tarihAy) o.ay = tarihAy;
        if (tarihGun) o.gun = tarihGun;
        if (tarihYil && tarihAy && tarihGun) {
            o.tarih = tarihYil + '-' + tarihAy + '-' + tarihGun;
        }
        return o;
    }

    function satirTarihEslesir(row) {
        if (!tarihYil) return true;
        var key = gunAnahtar(row.created_at);
        if (!key) return false;
        var p = key.split('-');
        if (p[0] !== tarihYil) return false;
        if (tarihAy && p[1] !== tarihAy) return false;
        if (tarihGun && p[2] !== tarihGun) return false;
        return true;
    }

    function tarihAgaciOlustur(gunler) {
        var agac = {};
        arr(gunler).forEach(function (g) {
            var key = String(g).slice(0, 10);
            var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
            if (!m) return;
            var y = m[1];
            var mo = m[2];
            var d = m[3];
            if (!agac[y]) agac[y] = {};
            if (!agac[y][mo]) agac[y][mo] = [];
            if (agac[y][mo].indexOf(d) < 0) agac[y][mo].push(d);
        });
        Object.keys(agac).forEach(function (y) {
            Object.keys(agac[y]).forEach(function (mo) {
                agac[y][mo].sort(function (a, b) {
                    return parseInt(a, 10) - parseInt(b, 10);
                });
            });
        });
        return agac;
    }

    function tarihMenuCiz() {
        var yilEl = qs('kmYil');
        var ayEl = qs('kmAy');
        var gunEl = qs('kmGun');
        if (!yilEl || !ayEl || !gunEl) return;

        var yillar = tarihAgaci ? Object.keys(tarihAgaci).sort(function (a, b) {
            return parseInt(b, 10) - parseInt(a, 10);
        }) : [];
        if (tarihYil && yillar.indexOf(tarihYil) < 0) {
            yillar.unshift(tarihYil);
        }

        yilEl.innerHTML = '<option value="">Yıl</option>' +
            yillar.map(function (y) {
                return '<option value="' + esc(y) + '"' + (y === tarihYil ? ' selected' : '') + '>' + esc(y) + '</option>';
            }).join('');

        if (!tarihYil) {
            ayEl.innerHTML = '<option value="">Ay</option>';
            ayEl.disabled = true;
            gunEl.innerHTML = '<option value="">Gün</option>';
            gunEl.disabled = true;
            return;
        }

        if (!tarihAgaci || !tarihAgaci[tarihYil]) {
            tarihAgacaGunEkle(tarihYil, tarihAy, tarihGun);
        }

        var aylar = Object.keys(tarihAgaci[tarihYil]).sort(function (a, b) {
            return parseInt(a, 10) - parseInt(b, 10);
        });
        if (tarihAy && aylar.indexOf(tarihAy) < 0) {
            aylar.push(tarihAy);
            aylar.sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });
        }
        ayEl.disabled = false;
        ayEl.innerHTML = '<option value="">Tüm aylar</option>' +
            aylar.map(function (mo) {
                var ad = AY_ADLARI[parseInt(mo, 10)] || mo;
                return '<option value="' + esc(mo) + '"' + (mo === tarihAy ? ' selected' : '') + '>' + esc(ad) + '</option>';
            }).join('');

        if (!tarihAy) {
            gunEl.innerHTML = '<option value="">Gün</option>';
            gunEl.disabled = true;
            return;
        }

        if (!tarihAgaci[tarihYil][tarihAy]) {
            tarihAgacaGunEkle(tarihYil, tarihAy, tarihGun);
        }

        var gunler = tarihAgaci[tarihYil][tarihAy].slice();
        if (tarihGun && gunler.indexOf(tarihGun) < 0) {
            gunler.push(tarihGun);
            gunler.sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });
        }
        gunEl.disabled = false;
        gunEl.innerHTML = '<option value="">Tüm günler</option>' +
            gunler.map(function (d) {
                return '<option value="' + esc(d) + '"' + (d === tarihGun ? ' selected' : '') + '>' +
                    esc(String(parseInt(d, 10))) + '</option>';
            }).join('');
    }

    function filtreUygula(liste) {
        var gorunen = liste;
        if (filtre !== 'hepsi') {
            gorunen = gorunen.filter(function (r) { return satirDurum(r) === filtre; });
        }
        if (tarihAktifMi()) {
            gorunen = gorunen.filter(satirTarihEslesir);
        }
        gorunen = gorunen.slice();
        gorunen.sort(function (a, b) {
            var ta = new Date(a.created_at).getTime() || 0;
            var tb = new Date(b.created_at).getTime() || 0;
            return sira === 'asc' ? ta - tb : tb - ta;
        });
        return gorunen;
    }

    function rumuzSinif(row) {
        return row && row.gender === 'male' ? 'km-rumuz km-rumuz--male' : 'km-rumuz km-rumuz--female';
    }

    function satirBaslik(row) {
        if (row && row.slug) return '/' + String(row.slug);
        var oniz = String(row && (row.onizleme || row.content_short) || '').slice(0, 48);
        return oniz || '(#' + (row && row.id) + ')';
    }

    function satirHtml(row) {
        var kod = satirDurum(row);
        var baslik = esc(satirBaslik(row));
        var oniz = esc(String(row.onizleme || row.content_short || '').slice(0, 120));
        return (
            '<tr data-id="' + esc(row.id) + '">' +
            '<td>#' + esc(row.id) + '</td>' +
            '<td><span class="km-badge km-badge--' + esc(kod) + '">' + esc(durumEtiket(kod)) + '</span></td>' +
            '<td><span class="' + rumuzSinif(row) + '">' + esc(row.username || '—') + '</span>' +
            '<div class="km-onizleme"><strong class="km-baslik">' + baslik + '</strong>' +
            (oniz ? ' · ' + oniz : '') + '</div></td>' +
            '<td>' + esc(fmtTarih(row.created_at)) + '</td>' +
            '<td>👍 ' + esc(row.up_votes != null ? row.up_votes : 0) +
            ' · 👎 ' + esc(row.down_votes != null ? row.down_votes : 0) + '</td>' +
            '</tr>'
        );
    }

    function listeCiz() {
        var el = qs('kmListe');
        if (!el) return;
        var gorunen = filtreUygula(satirlar);
        metaGuncelle(gorunen.length);
        if (!gorunen.length) {
            el.innerHTML = '<p class="km-bos">' + (satirlar.length ? 'Bu filtrede hikaye yok.' : 'Hikaye yok.') + '</p>';
            return;
        }
        el.innerHTML =
            '<table class="km-table"><thead><tr>' +
            '<th>ID</th><th>Durum</th><th>Hikaye</th><th>Yayın</th><th>Oylar</th>' +
            '</tr></thead><tbody>' +
            gorunen.map(satirHtml).join('') +
            '</tbody></table>';
        el.querySelectorAll('tbody tr').forEach(function (tr) {
            tr.addEventListener('click', function () {
                var id = tr.getAttribute('data-id');
                if (id) detayAc(id);
            });
        });
    }

    function oturumHatasiMi(err) {
        var m = String((err && err.message) || err || '').toLowerCase();
        return m.indexOf('oturum') >= 0 || m.indexOf('giriş') >= 0 || m.indexOf('hazır değil') >= 0;
    }

    async function panelYukleTek() {
        var istekNo = ++panelIstekNo;
        var D = db();
        if (!D) throw new Error('Panel hazır değil.');
        if (istekNo !== panelIstekNo) return;
        if (aramaMetni.trim()) {
            await aramaYukle(true, istekNo);
            if (istekNo !== panelIstekNo) return;
            return;
        }
        var sonuc;
        var listeOpts = listeTarihOpts();
        if (tarihAktifMi() || filtre !== 'hepsi' || sira === 'asc') {
            if (!D.masterKamikazeListe) throw new Error('Panel hazır değil.');
            sonuc = await D.masterKamikazeListe(filtre, null, listeOpts);
            if (istekNo !== panelIstekNo) return;
            if (!sonuc || sonuc.ok === false) {
                throw new Error((sonuc && sonuc.hata) || 'Liste yüklenemedi');
            }
            satirlar = arr(sonuc.hikayeler);
        } else {
            if (!D.masterKamikazePanel) throw new Error('Panel hazır değil.');
            sonuc = await D.masterKamikazePanel();
            if (istekNo !== panelIstekNo) return;
            if (!sonuc || sonuc.ok === false) {
                throw new Error((sonuc && sonuc.hata) || 'Panel yüklenemedi');
            }
            satirlar = arr(sonuc.son_hikayeler);
        }
        listeCiz();
    }

    async function tarihAgaciYukle() {
        var D = db();
        if (!D || !D.masterKamikazeTarihler) return;
        try {
            var sonuc = await D.masterKamikazeTarihler();
            if (!sonuc || sonuc.ok === false) return;
            tarihAgaci = tarihAgaciOlustur(sonuc.tarihler);
            if (tarihYil && tarihAy && tarihGun) {
                tarihAgacaGunEkle(tarihYil, tarihAy, tarihGun);
            }
            tarihMenuCiz();
        } catch (e) { /* ağaç boş kalabilir */ }
    }

    function tarihDegisti(kaynak) {
        var yilEl = qs('kmYil');
        var ayEl = qs('kmAy');
        var gunEl = qs('kmGun');
        if (kaynak === 'yil') {
            tarihYil = yilEl ? yilEl.value : '';
            tarihAy = '';
            tarihGun = '';
            tarihMenuCiz();
        } else if (kaynak === 'ay') {
            tarihAy = ayEl ? ayEl.value : '';
            tarihGun = '';
            tarihMenuCiz();
        } else if (kaynak === 'gun') {
            tarihGun = gunEl ? gunEl.value : '';
        }
        filtreleriUygula();
    }

    async function panelYukle() {
        var sonHata = null;
        var deneme;
        for (deneme = 0; deneme < 3; deneme++) {
            try {
                await panelYukleTek();
                tarihMenuCiz();
                return;
            } catch (e) {
                sonHata = e;
                if (!oturumHatasiMi(e) || deneme >= 2) throw e;
                await new Promise(function (resolve) {
                    setTimeout(resolve, 400 + deneme * 350);
                });
            }
        }
        if (sonHata) throw sonHata;
    }

    async function aramaYukle(sessiz, panelIstek) {
        var D = db();
        var q = aramaMetni.trim();
        if (!D || !D.masterKamikazeAra) return;
        if (!q) {
            await panelYukleTek();
            if (panelIstek != null && panelIstek !== panelIstekNo) return;
            tarihMenuCiz();
            return;
        }
        var istekNo = ++aramaIstekNo;
        try {
            var sonuc = await D.masterKamikazeAra(q, 60);
            if (istekNo !== aramaIstekNo) return;
            if (panelIstek != null && panelIstek !== panelIstekNo) return;
            if (!sonuc || sonuc.ok === false) {
                if (!sessiz) toast((sonuc && sonuc.hata) || 'Arama başarısız', 'hata');
                return;
            }
            satirlar = arr(sonuc.hikayeler);
            listeCiz();
        } catch (e) {
            if (istekNo !== aramaIstekNo) return;
            if (panelIstek != null && panelIstek !== panelIstekNo) return;
            if (!sessiz) toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        }
    }

    function drawerKapat() {
        var d = qs('kmDrawer');
        if (d) {
            d.classList.remove('acik');
            d.hidden = true;
            d.setAttribute('aria-hidden', 'true');
        }
        document.body.style.overflow = '';
        drawerMod = '';
        drawerId = null;
    }

    function drawerAc(baslik) {
        var d = qs('kmDrawer');
        var h = qs('kmDrawerBaslik');
        if (h) h.textContent = baslik || 'Hikaye';
        if (d) {
            d.hidden = false;
            d.classList.add('acik');
            d.setAttribute('aria-hidden', 'false');
        }
        document.body.style.overflow = 'hidden';
    }

    function yerSelectHtml(secili) {
        var P = profil();
        var html = '<option value="">—</option>';
        if (P && P.YER_SECENEKLERI) {
            P.YER_SECENEKLERI.forEach(function (s) {
                html += '<option value="' + esc(s.value) + '"' +
                    (secili === s.value ? ' selected' : '') + '>' + esc(s.label) + '</option>';
            });
        }
        return html;
    }

    function detayFormHtml(h) {
        var yer = h.yasadigi_yer || '';
        return (
            '<p class="km-not">Planlı hikaye: yayın tarihi gelecekteyse sitede görünmez. Günde5 ritmine uygun sabah saati seç.</p>' +
            '<div class="km-grid km-grid--tek">' +
            '<div class="km-alan"><label>Rumuz<input type="text" id="kmDetayRumuz" maxlength="50" value="' + esc(h.username || '') + '"></label></div>' +
            '<div class="km-alan"><label>URL adı <span class="km-not-inline">(isteğe bağlı, 3–5 kelime)</span>' +
            '<input type="text" id="kmDetaySlugHint" maxlength="80" value="' + esc(h.slug_hint || '') + '" placeholder="örn. telefonsuz-market-listesi"></label>' +
            (h.slug ? '<p class="km-not">Canlı URL: <code>/h/' + esc(h.slug) + '</code></p>' : '') +
            '</div>' +
            '</div>' +
            '<div class="km-alan"><label>Hikaye metni<textarea id="kmDetayMetin">' + esc(h.content_full || '') + '</textarea></label></div>' +
            '<div class="km-grid">' +
            '<div class="km-alan"><label>Yaş<input type="number" id="kmDetayYas" min="18" max="120" value="' + esc(h.age != null ? h.age : '') + '"></label></div>' +
            '<div class="km-alan"><label>Cinsiyet<select id="kmDetayCinsiyet">' +
            '<option value="female"' + (h.gender === 'female' ? ' selected' : '') + '>Kadın</option>' +
            '<option value="male"' + (h.gender === 'male' ? ' selected' : '') + '>Erkek</option>' +
            '</select></label></div>' +
            '<div class="km-alan"><label>Yaşadığı yer<select id="kmDetayYer">' + yerSelectHtml(yer) + '</select></label></div>' +
            '<div class="km-alan" id="kmDetayYurtdisiWrap"' + (yer === 'yurtdisi' ? '' : ' hidden') + '>' +
            '<label>Yurtdışı şehir<input type="text" id="kmDetayYurtdisi" maxlength="80" value="' + esc(h.yurtdisi_sehir || '') + '"></label></div>' +
            '<div class="km-alan"><label>Yayın / planlama<input type="datetime-local" id="kmDetayYayin" step="60" value="' + esc(isoDatetimeLocalValue(h.created_at)) + '"></label></div>' +
            '<div class="km-alan"><label>Durum<select id="kmDetayStatus">' +
            '<option value="kulis"' + (h.status === 'kulis' ? ' selected' : '') + '>Index (kulis)</option>' +
            '<option value="podyum"' + (h.status === 'podyum' ? ' selected' : '') + '>Podyum</option>' +
            '</select></label></div>' +
            '<div class="km-alan"><label>👍 Beğeni<input type="number" id="kmDetayUp" min="0" value="' + esc(h.up_votes != null ? h.up_votes : 0) + '"></label></div>' +
            '<div class="km-alan"><label>👎 Beğenmeme<input type="number" id="kmDetayDown" min="0" value="' + esc(h.down_votes != null ? h.down_votes : 0) + '"></label></div>' +
            '</div>' +
            '<div class="km-actions">' +
            '<button type="button" class="km-btn km-btn--primary" data-km-act="kaydet">Kaydet</button>' +
            '<button type="button" class="km-btn" data-km-act="gizle">' + (h.is_gizli ? 'Göster' : 'Gizle') + '</button>' +
            '<button type="button" class="km-btn km-btn--danger" data-km-act="sil">Sil</button>' +
            '<button type="button" class="km-btn" data-km-act="geri_al"' + (h.silindi_at ? '' : ' hidden') + '>Geri al</button>' +
            '</div>'
        );
    }

    function yeniFormHtml() {
        return (
            '<p class="km-not">Boş bırakılan yayın tarihi = hemen yayın. Gelecek tarih = planlı (Günde5 formatı).</p>' +
            '<div class="km-grid km-grid--tek">' +
            '<div class="km-alan"><label>Rumuz *<input type="text" id="kmYeniRumuz" maxlength="50" placeholder="En az 2 karakter"></label></div>' +
            '<div class="km-alan"><label>URL adı <span class="km-not-inline">(isteğe bağlı)</span>' +
            '<input type="text" id="kmYeniSlugHint" maxlength="80" placeholder="örn. telefonsuz-market-listesi"></label></div>' +
            '</div>' +
            '<div class="km-alan"><label>Hikaye metni *<textarea id="kmYeniMetin" placeholder="Hikaye…"></textarea></label></div>' +
            '<div class="km-grid">' +
            '<div class="km-alan"><label>Yaş *<input type="number" id="kmYeniYas" min="18" max="120" placeholder="18–120"></label></div>' +
            '<div class="km-alan"><label>Cinsiyet<select id="kmYeniCinsiyet"><option value="female">Kadın</option><option value="male">Erkek</option></select></label></div>' +
            '<div class="km-alan"><label>Yaşadığı yer<select id="kmYeniYer">' + yerSelectHtml('') + '</select></label></div>' +
            '<div class="km-alan" id="kmYeniYurtdisiWrap" hidden><label>Yurtdışı şehir<input type="text" id="kmYeniYurtdisi" maxlength="80"></label></div>' +
            '<div class="km-alan km-grid--tek"><label>Yayın / planlama<input type="datetime-local" id="kmYeniYayin" step="60"></label></div>' +
            '</div>' +
            '<div class="km-actions">' +
            '<button type="button" class="km-btn km-btn--primary" data-km-act="yeni-kaydet">Hikayeyi ekle</button>' +
            '</div>'
        );
    }

    function yerBagla(prefix) {
        var yer = qs(prefix + 'Yer');
        var wrap = qs(prefix + 'YurtdisiWrap');
        if (!yer || !wrap) return;
        yer.addEventListener('change', function () {
            wrap.hidden = yer.value !== 'yurtdisi';
        });
    }

    function drawerTiklamaBagla() {
        if (drawerTiklamaBaglandi) return;
        var body = qs('kmDrawerBody');
        if (!body) return;
        drawerTiklamaBaglandi = true;
        body.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-km-act]');
            if (!btn || islemSuruyor) return;
            var act = btn.getAttribute('data-km-act');
            if (act === 'kaydet') detayKaydet();
            else if (act === 'gizle') detayGizleToggle();
            else if (act === 'sil') detaySil();
            else if (act === 'geri_al') detayGeriAl();
            else if (act === 'yeni-kaydet') yeniKaydet();
        });
    }

    function drawerFormBagla() {
        if (drawerMod === 'detay') yerBagla('kmDetay');
        if (drawerMod === 'yeni') yerBagla('kmYeni');
    }

    function kaydetBtnDurum(suruyor) {
        var btn = document.querySelector('[data-km-act="kaydet"]');
        if (!btn) return;
        btn.disabled = !!suruyor;
        btn.textContent = suruyor ? 'Kaydediliyor…' : 'Kaydet';
    }

    async function detayAc(id) {
        var D = db();
        if (!D || !D.masterKamikazeHikayeDetay) return;
        try {
            var sonuc = await D.masterKamikazeHikayeDetay(id);
            if (!sonuc || sonuc.ok === false || !sonuc.hikaye) {
                toast((sonuc && sonuc.hata) || 'Detay alınamadı', 'hata');
                return;
            }
            drawerMod = 'detay';
            drawerId = String(sonuc.hikaye.id);
            var body = qs('kmDrawerBody');
            if (body) body.innerHTML = detayFormHtml(sonuc.hikaye);
            drawerAc('#' + drawerId + ' — ' + (sonuc.hikaye.username || 'Hikaye'));
            drawerFormBagla();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        }
    }

    async function hikayeIslem(islem, ek) {
        var D = db();
        if (!D || !D.masterHikayeIslem) throw new Error('Panel hazır değil.');
        if (!drawerId) throw new Error('Hikaye seçilmedi.');
        var body = Object.assign({ itiraf_id: parseInt(drawerId, 10), islem: islem }, ek || {});
        var sonuc = await D.masterHikayeIslem(body);
        if (!sonuc || sonuc.ok === false) {
            throw new Error((sonuc && sonuc.hata) || 'İşlem başarısız');
        }
        return sonuc;
    }

    async function detayKaydet() {
        if (islemSuruyor) return;
        var D = db();
        var rumuz = String(qs('kmDetayRumuz') && qs('kmDetayRumuz').value || '').trim();
        var metin = String(qs('kmDetayMetin') && qs('kmDetayMetin').value || '').trim();
        var yas = parseInt(qs('kmDetayYas') && qs('kmDetayYas').value, 10);
        var planHam = String(qs('kmDetayYayin') && qs('kmDetayYayin').value || '').trim();
        if (rumuz.length < 2) { toast('Rumuz en az 2 karakter.', 'hata'); return; }
        if (!metin) { toast('Metin boş olamaz.', 'hata'); return; }
        islemSuruyor = true;
        kaydetBtnDurum(true);
        try {
            if (planHam) {
                var planIsoOn = D.planliTarihIso ? D.planliTarihIso(planHam) : null;
                if (!planIsoOn) throw new Error('Yayın tarihi geçersiz.');
            }
            var yer = qs('kmDetayYer') ? qs('kmDetayYer').value : '';
            await hikayeIslem('guncelle', {
                content_full: metin,
                slug_hint: String(qs('kmDetaySlugHint') && qs('kmDetaySlugHint').value || '').trim(),
                username: rumuz
            });
            await hikayeIslem('meta', {
                age: yas,
                gender: qs('kmDetayCinsiyet') ? qs('kmDetayCinsiyet').value : 'female',
                yasadigi_yer: yer || null,
                yurtdisi_sehir: yer === 'yurtdisi' ? String(qs('kmDetayYurtdisi') && qs('kmDetayYurtdisi').value || '').trim() || null : null
            });
            if (planHam) {
                var planIso = D.planliTarihIso ? D.planliTarihIso(planHam) : null;
                await hikayeIslem('yayin_tarihi', { created_at: planIso });
            }
            await hikayeIslem('status', { status: qs('kmDetayStatus') ? qs('kmDetayStatus').value : 'kulis' });
            await hikayeIslem('oylar', {
                up_votes: parseInt(qs('kmDetayUp') && qs('kmDetayUp').value, 10) || 0,
                down_votes: parseInt(qs('kmDetayDown') && qs('kmDetayDown').value, 10) || 0
            });
            toast('Kaydedildi.');
            drawerKapat();
            await filtreleriUygula();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        } finally {
            islemSuruyor = false;
            kaydetBtnDurum(false);
        }
    }

    async function detayGizleToggle() {
        if (islemSuruyor) return;
        var D = db();
        var gizleBtn = document.querySelector('[data-km-act="gizle"]');
        var gizle = gizleBtn && gizleBtn.textContent.indexOf('Gizle') >= 0;
        islemSuruyor = true;
        try {
            await hikayeIslem(gizle ? 'gizle' : 'goster');
            toast(gizle ? 'Gizlendi.' : 'Gösterildi.');
            await detayAc(drawerId);
            await panelYukle();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        } finally {
            islemSuruyor = false;
        }
    }

    async function detaySil() {
        if (islemSuruyor || !global.confirm('Bu hikayeyi silmek istiyor musun?')) return;
        var D = db();
        islemSuruyor = true;
        try {
            await hikayeIslem('sil');
            toast('Silindi.');
            drawerKapat();
            await panelYukle();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        } finally {
            islemSuruyor = false;
        }
    }

    async function detayGeriAl() {
        if (islemSuruyor) return;
        var D = db();
        islemSuruyor = true;
        try {
            await hikayeIslem('geri_al');
            toast('Geri alındı.');
            await detayAc(drawerId);
            await panelYukle();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        } finally {
            islemSuruyor = false;
        }
    }

    function yeniAc() {
        drawerMod = 'yeni';
        drawerId = null;
        var body = qs('kmDrawerBody');
        if (body) body.innerHTML = yeniFormHtml();
        drawerAc('Yeni hikaye');
        drawerFormBagla();
        var rumuz = qs('kmYeniRumuz');
        if (rumuz) rumuz.focus();
    }

    async function yeniKaydet() {
        if (islemSuruyor) return;
        var D = db();
        if (!D || !D.masterHikayeEkle) {
            toast('Hikaye ekleme hazır değil.', 'hata');
            return;
        }
        var rumuz = String(qs('kmYeniRumuz') && qs('kmYeniRumuz').value || '').trim();
        var metin = String(qs('kmYeniMetin') && qs('kmYeniMetin').value || '').trim();
        var yas = parseInt(qs('kmYeniYas') && qs('kmYeniYas').value, 10);
        var yer = qs('kmYeniYer') ? qs('kmYeniYer').value : '';
        var planHam = String(qs('kmYeniYayin') && qs('kmYeniYayin').value || '').trim();
        if (rumuz.length < 2) { toast('Rumuz gir.', 'hata'); return; }
        if (!metin) { toast('Metin gir.', 'hata'); return; }
        if (!yas || yas < 18 || yas > 120) { toast('Yaş 18–120.', 'hata'); return; }
        var payload = {
            username: rumuz,
            age: yas,
            gender: qs('kmYeniCinsiyet') ? qs('kmYeniCinsiyet').value : 'female',
            yasadigi_yer: yer || null,
            yurtdisi_sehir: yer === 'yurtdisi' ? String(qs('kmYeniYurtdisi') && qs('kmYeniYurtdisi').value || '').trim() || null : null,
            content_full: metin,
            slug_hint: String(qs('kmYeniSlugHint') && qs('kmYeniSlugHint').value || '').trim()
        };
        if (planHam) {
            var planTarih = datetimeLocalOku(planHam);
            if (!planTarih) { toast('Yayın tarihi geçersiz.', 'hata'); return; }
            payload.created_at = D.planliTarihIso ? D.planliTarihIso(planHam) : planTarih.toISOString();
        }
        islemSuruyor = true;
        try {
            var sonuc = await D.masterHikayeEkle(payload);
            if (typeof sonuc === 'string') {
                try { sonuc = JSON.parse(sonuc); } catch (eP) { /* */ }
            }
            if (!sonuc || sonuc.ok !== true) {
                throw new Error((sonuc && sonuc.hata) || 'Kayıt başarısız');
            }
            toast(planHam ? 'Planlandı.' : 'Eklendi.');
            drawerKapat();
            await panelYukle();
            if (sonuc.hikaye && sonuc.hikaye.id) detayAc(sonuc.hikaye.id);
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        } finally {
            islemSuruyor = false;
        }
    }

    function filtreBagla() {
        var ara = qs('kmAra');
        var filtreEl = qs('kmFiltre');
        var yilEl = qs('kmYil');
        var ayEl = qs('kmAy');
        var gunEl = qs('kmGun');
        var siraEl = qs('kmSira');
        var yenile = qs('kmYenile');
        var yeni = qs('kmYeni');
        var giris = qs('kmGirisBtn');

        if (ara) {
            ara.addEventListener('input', function () {
                aramaMetni = ara.value;
                clearTimeout(aramaZamanlayici);
                if (!aramaMetni.trim()) {
                    filtreleriUygula();
                    return;
                }
                listeYukleniyorGoster();
                aramaZamanlayici = setTimeout(function () { aramaYukle(false); }, 320);
            });
            ara.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    clearTimeout(aramaZamanlayici);
                    if (!aramaMetni.trim()) {
                        filtreleriUygula();
                        return;
                    }
                    listeYukleniyorGoster();
                    aramaYukle(false);
                }
            });
        }
        if (filtreEl) {
            filtreEl.addEventListener('change', function () { filtreleriUygula(); });
        }
        if (yilEl) yilEl.addEventListener('change', function () { tarihDegisti('yil'); });
        if (ayEl) ayEl.addEventListener('change', function () { tarihDegisti('ay'); });
        if (gunEl) gunEl.addEventListener('change', function () { tarihDegisti('gun'); });
        if (siraEl) {
            siraEl.addEventListener('change', function () { filtreleriUygula(); });
        }
        if (yenile) {
            yenile.addEventListener('click', function () {
                listeYukleniyorGoster();
                tarihAgaciYukle().then(function () {
                    return panelYukle();
                }).catch(function (e) {
                    toast(db().hataMesaji ? db().hataMesaji(e) : String(e), 'hata');
                });
            });
        }
        if (yeni) yeni.addEventListener('click', yeniAc);
        if (giris) giris.addEventListener('click', function () { global.location.href = '/bulut'; });

        document.querySelectorAll('[data-km-kapat]').forEach(function (el) {
            el.addEventListener('click', drawerKapat);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') drawerKapat();
        });
    }

    function authYenilemeBagla() {
        if (authYenilemeBaglandi) return;
        authYenilemeBaglandi = true;
        global.gunde5AuthDegisti = function (event) {
            if (!panelYetkili) return;
            if (event === 'SIGNED_OUT') {
                panelYetkili = false;
                yetkisizGoster('Kamikaze için site yöneticisi hesabıyla giriş yap.', true);
            }
        };
    }

    async function initBaslat() {
        var D = db();
        var U = ui();

        filtreBagla();
        drawerTiklamaBagla();
        authYenilemeBagla();
        if (!D) {
            yetkisizGoster('Panel modülü yüklenemedi. Sayfayı yenileyin (Ctrl+F5).', false);
            return;
        }

        try {
            yukleniyorGoster('Supabase başlatılıyor…');
            await D.init();
            yukleniyorGoster('Oturum doğrulanıyor (sunucuya bağlanılıyor)…');
            if (D.masterPanelHazir) {
                await D.masterPanelHazir();
            } else {
                await D.init();
                var durum = await D.masterDurum();
                if (!durum || !durum.master) throw new Error('yetkisiz');
            }
        } catch (e) {
            var mesaj = String((e && e.message) || e || '');
            if (mesaj.indexOf('Giriş') >= 0 || mesaj.indexOf('giriş') >= 0 ||
                    mesaj.indexOf('Oturum') >= 0 || mesaj.indexOf('oturum') >= 0 ||
                    mesaj.indexOf('Panel oturumu') >= 0) {
                yetkisizGoster('Kamikaze için site yöneticisi hesabıyla giriş yap.', true);
            } else if (mesaj.indexOf('yetkisiz') >= 0) {
                yetkisizGoster('Bu panel yalnızca site yöneticisi içindir.', false);
            } else {
                yetkisizGoster(D.hataMesaji ? D.hataMesaji(e) : mesaj, true);
            }
            return;
        }

        if (U && U.guncelleHeaderOturum) U.guncelleHeaderOturum();
        if (global.Gunde5Master && global.Gunde5Master.durumYenile) {
            try { await global.Gunde5Master.durumYenile(); } catch (e2) { /* */ }
        }

        panelYetkili = true;
        araclariGoster();
        listeYukleniyorGoster();
        varsayilanTarihUygula();
        await tarihAgaciYukle();
        try {
            await panelYukle();
        } catch (e4) {
            var el = qs('kmListe');
            if (el) el.innerHTML = '<p class="km-hata">' + esc(D.hataMesaji ? D.hataMesaji(e4) : String(e4)) + '</p>';
        }
    }

    global.Gunde5Kamikaze = { yenile: panelYukle };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBaslat);
    } else {
        initBaslat();
    }
})(window);
