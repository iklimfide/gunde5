/* gunde5 — /planli: gelecek tarihli hikaye önizlemesi (master) */
(function (global) {
    'use strict';

    var tumSatirlar = [];
    var aramaMetni = '';
    var aramaZamanlayici = null;
    var tarihFiltre = '';
    var sira = 'desc';
    var indexSayisi = null;
    var drawerId = null;
    var islemSuruyor = false;
    var drawerTiklamaBaglandi = false;

    function db() { return global.Gunde5DB; }
    function ui() { return global.Gunde5UI; }
    function profil() { return global.Gunde5Profil; }

    function qs(id) { return document.getElementById(id); }

    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function metinGoster(metin) {
        var U = ui();
        if (U && U.metinGoster) return U.metinGoster(metin);
        return esc(metin);
    }

    function metaHtml(row) {
        var U = ui();
        if (U && U.kullaniciMetaHtml) return U.kullaniciMetaHtml(row);
        return row && row.age ? '<span class="user-meta">' + esc(row.age + ' Yaş') + '</span>' : '';
    }

    function gunAnahtar(iso) {
        if (!iso) return '';
        try {
            return new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Europe/Istanbul',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(new Date(iso));
        } catch (e) {
            return '';
        }
    }

    function gunEtiket(ymd) {
        if (!ymd) return '';
        var p = ymd.split('-');
        if (p.length !== 3) return ymd;
        return parseInt(p[2], 10) + '/' + parseInt(p[1], 10) + '/' + p[0];
    }

    function saatEtiket(iso) {
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleTimeString('tr-TR', {
                timeZone: 'Europe/Istanbul',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return '';
        }
    }

    function planliYayinEtiket(iso) {
        return '<span class="planli-yayin-etiket">⏳ ' + esc(saatEtiket(iso)) + '</span>';
    }

    function ikiHane(n) {
        return n < 10 ? '0' + n : String(n);
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

    function toast(msg, tur) {
        var U = ui();
        if (U && U.showToast) U.showToast(msg, tur);
    }

    function drawerKapat() {
        var d = qs('plDrawer');
        if (d) {
            d.classList.remove('acik');
            d.hidden = true;
            d.setAttribute('aria-hidden', 'true');
        }
        document.body.style.overflow = '';
        drawerId = null;
    }

    function drawerAc(baslik) {
        var d = qs('plDrawer');
        var h = qs('plDrawerBaslik');
        if (h) h.textContent = baslik || 'Hikâye düzenle';
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

    function slugOnizlemeUret(hint, metin, id) {
        var S = global.Gunde5Slug;
        if (!S || !S.slugUret || !id) return '';
        return '/h/' + S.slugUret(hint, metin, id);
    }

    function slugOnizlemeGuncelle(id) {
        var el = qs('plSlugOnizleme');
        if (!el) return;
        var hintEl = qs('plDetaySlugHint');
        var metinEl = qs('plDetayMetin');
        var yol = slugOnizlemeUret(
            hintEl ? hintEl.value : '',
            metinEl ? metinEl.value : '',
            id
        );
        el.textContent = yol || '—';
    }

    function slugOnizlemeBagla(id) {
        var hintEl = qs('plDetaySlugHint');
        var metinEl = qs('plDetayMetin');
        function guncelle() { slugOnizlemeGuncelle(id); }
        if (hintEl) hintEl.addEventListener('input', guncelle);
        if (metinEl) metinEl.addEventListener('input', guncelle);
        guncelle();
    }

    function detayFormHtml(h) {
        var yer = h.yasadigi_yer || '';
        var onizleme = slugOnizlemeUret(h.slug_hint, h.content_full, h.id) || (h.slug ? '/h/' + h.slug : '');
        return (
            '<p class="pl-form-not">Planlı hikaye: yayın tarihi gelecekteyse sitede görünmez. Günde5 ritmine uygun sabah saati seç.</p>' +
            '<div class="pl-grid pl-grid--tek">' +
            '<div class="pl-alan"><label>Rumuz<input type="text" id="plDetayRumuz" maxlength="50" value="' + esc(h.username || '') + '"></label></div>' +
            '<div class="pl-alan"><label>URL adı <span>(isteğe bağlı, 3–5 kelime)</span>' +
            '<input type="text" id="plDetaySlugHint" maxlength="80" value="' + esc(h.slug_hint || '') + '" placeholder="örn. telefonsuz-market-listesi"></label>' +
            '<p class="pl-form-not">URL önizleme: <code id="plSlugOnizleme">' + esc(onizleme || '—') + '</code></p>' +
            (h.slug && h.slug !== onizleme.replace(/^\/h\//, '') ?
                '<p class="pl-form-not">Kayıtlı canlı URL: <code>/h/' + esc(h.slug) + '</code></p>' : '') +
            '</div>' +
            '</div>' +
            '<div class="pl-alan"><label>Hikâye metni<textarea id="plDetayMetin">' + esc(h.content_full || '') + '</textarea></label></div>' +
            '<div class="pl-grid">' +
            '<div class="pl-alan"><label>Yaş<input type="number" id="plDetayYas" min="18" max="120" value="' + esc(h.age != null ? h.age : '') + '"></label></div>' +
            '<div class="pl-alan"><label>Cinsiyet<select id="plDetayCinsiyet">' +
            '<option value="female"' + (h.gender === 'female' ? ' selected' : '') + '>Kadın</option>' +
            '<option value="male"' + (h.gender === 'male' ? ' selected' : '') + '>Erkek</option>' +
            '</select></label></div>' +
            '<div class="pl-alan"><label>Yaşadığı yer<select id="plDetayYer">' + yerSelectHtml(yer) + '</select></label></div>' +
            '<div class="pl-alan" id="plDetayYurtdisiWrap"' + (yer === 'yurtdisi' ? '' : ' hidden') + '>' +
            '<label>Yurtdışı şehir<input type="text" id="plDetayYurtdisi" maxlength="80" value="' + esc(h.yurtdisi_sehir || '') + '"></label></div>' +
            '<div class="pl-alan"><label>Yayın / planlama<input type="datetime-local" id="plDetayYayin" step="60" value="' + esc(isoDatetimeLocalValue(h.created_at)) + '"></label></div>' +
            '<div class="pl-alan"><label>👍 Beğeni<input type="number" id="plDetayUp" min="0" value="' + esc(h.up_votes != null ? h.up_votes : 0) + '"></label></div>' +
            '<div class="pl-alan"><label>👎 Beğenmeme<input type="number" id="plDetayDown" min="0" value="' + esc(h.down_votes != null ? h.down_votes : 0) + '"></label></div>' +
            '</div>' +
            '<div class="pl-form-actions">' +
            '<button type="button" class="pl-form-btn pl-form-btn--primary" data-pl-act="kaydet">Kaydet</button>' +
            '<button type="button" class="pl-form-btn" data-pl-act="iptal">İptal</button>' +
            '<button type="button" class="pl-form-btn pl-form-btn--danger" data-pl-act="sil">Sil</button>' +
            '</div>'
        );
    }

    function yerBagla() {
        var yer = qs('plDetayYer');
        var wrap = qs('plDetayYurtdisiWrap');
        if (!yer || !wrap) return;
        yer.addEventListener('change', function () {
            wrap.hidden = yer.value !== 'yurtdisi';
        });
    }

    function kaydetBtnDurum(suruyor) {
        var btn = document.querySelector('[data-pl-act="kaydet"]');
        if (!btn) return;
        btn.disabled = !!suruyor;
        btn.textContent = suruyor ? 'Kaydediliyor…' : 'Kaydet';
    }

    async function hikayeIslem(islem, ek) {
        var D = db();
        if (!D || !D.masterHikayeIslem) throw new Error('Panel hazır değil.');
        if (!drawerId) throw new Error('Hikâye seçilmedi.');
        var body = Object.assign({ itiraf_id: parseInt(drawerId, 10), islem: islem }, ek || {});
        var sonuc = await D.masterHikayeIslem(body);
        if (!sonuc || sonuc.ok === false) {
            throw new Error((sonuc && sonuc.hata) || 'İşlem başarısız');
        }
        return sonuc;
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
            drawerId = String(sonuc.hikaye.id);
            var body = qs('plDrawerBody');
            if (body) body.innerHTML = detayFormHtml(sonuc.hikaye);
            drawerAc('#' + drawerId + ' — ' + (sonuc.hikaye.username || 'Hikâye'));
            yerBagla();
            slugOnizlemeBagla(parseInt(drawerId, 10));
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        }
    }

    async function detayKaydet() {
        if (islemSuruyor) return;
        var D = db();
        var rumuz = String(qs('plDetayRumuz') && qs('plDetayRumuz').value || '').trim();
        var metin = String(qs('plDetayMetin') && qs('plDetayMetin').value || '').trim();
        var yas = parseInt(qs('plDetayYas') && qs('plDetayYas').value, 10);
        var planHam = String(qs('plDetayYayin') && qs('plDetayYayin').value || '').trim();
        if (rumuz.length < 2) { toast('Rumuz en az 2 karakter.', 'hata'); return; }
        if (!metin) { toast('Metin boş olamaz.', 'hata'); return; }
        if (!planHam) { toast('Yayın tarihi gerekli.', 'hata'); return; }
        islemSuruyor = true;
        kaydetBtnDurum(true);
        try {
            var planIso = D.planliTarihIso ? D.planliTarihIso(planHam) : null;
            if (!planIso) throw new Error('Yayın tarihi geçersiz.');
            var yer = qs('plDetayYer') ? qs('plDetayYer').value : '';
            await hikayeIslem('guncelle', {
                content_full: metin,
                slug_hint: String(qs('plDetaySlugHint') && qs('plDetaySlugHint').value || '').trim(),
                username: rumuz
            });
            await hikayeIslem('meta', {
                age: yas,
                gender: qs('plDetayCinsiyet') ? qs('plDetayCinsiyet').value : 'female',
                yasadigi_yer: yer || null,
                yurtdisi_sehir: yer === 'yurtdisi'
                    ? String(qs('plDetayYurtdisi') && qs('plDetayYurtdisi').value || '').trim() || null
                    : null
            });
            await hikayeIslem('yayin_tarihi', { created_at: planIso });
            await hikayeIslem('oylar', {
                up_votes: parseInt(qs('plDetayUp') && qs('plDetayUp').value, 10) || 0,
                down_votes: parseInt(qs('plDetayDown') && qs('plDetayDown').value, 10) || 0
            });
            toast('Kaydedildi.');
            drawerKapat();
            await yukle();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        } finally {
            islemSuruyor = false;
            kaydetBtnDurum(false);
        }
    }

    async function detaySil() {
        if (islemSuruyor || !global.confirm('Bu planlı hikâyeyi silmek istiyor musun?')) return;
        var D = db();
        islemSuruyor = true;
        try {
            await hikayeIslem('sil');
            toast('Silindi.');
            drawerKapat();
            await yukle();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        } finally {
            islemSuruyor = false;
        }
    }

    function drawerTiklamaBagla() {
        if (drawerTiklamaBaglandi) return;
        drawerTiklamaBaglandi = true;
        document.addEventListener('click', function (e) {
            if (e.target.closest('[data-pl-kapat]')) {
                drawerKapat();
                return;
            }
            var btn = e.target.closest('[data-pl-act]');
            if (!btn || islemSuruyor) return;
            var act = btn.getAttribute('data-pl-act');
            if (act === 'kaydet') detayKaydet();
            else if (act === 'iptal') drawerKapat();
            else if (act === 'sil') detaySil();
        });
    }

    function duzenleBagla() {
        var liste = qs('plListe');
        if (!liste || liste.getAttribute('data-pl-duzen-bound') === '1') return;
        liste.setAttribute('data-pl-duzen-bound', '1');
        liste.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-pl-duzenle]');
            if (!btn || islemSuruyor) return;
            e.preventDefault();
            detayAc(btn.getAttribute('data-pl-duzenle'));
        });
    }

    function benzersizGunler(rows) {
        var map = {};
        var gunler = [];
        var i;
        for (i = 0; i < rows.length; i++) {
            var g = gunAnahtar(rows[i].created_at);
            if (!g || map[g]) continue;
            map[g] = true;
            gunler.push(g);
        }
        gunler.sort();
        return gunler;
    }

    function tarihSelectGuncelle(gunler) {
        var el = qs('plTarih');
        if (!el) return;
        var secili = tarihFiltre;
        if (secili && gunler.indexOf(secili) < 0) {
            secili = '';
            tarihFiltre = '';
        }
        var html = '<option value="">Tüm tarihler</option>';
        var i;
        for (i = 0; i < gunler.length; i++) {
            var g = gunler[i];
            html += '<option value="' + esc(g) + '"' + (g === secili ? ' selected' : '') + '>' +
                esc(gunEtiket(g)) + '</option>';
        }
        el.innerHTML = html;
    }

    function aramaEslesir(row, q) {
        if (!q) return true;
        var alt = q.toLowerCase();
        var parcalar = [
            row.id,
            row.username,
            row.baslik,
            row.slug,
            row.content_short,
            row.content_full
        ];
        var i;
        for (i = 0; i < parcalar.length; i++) {
            if (parcalar[i] != null && String(parcalar[i]).toLowerCase().indexOf(alt) >= 0) {
                return true;
            }
        }
        return false;
    }

    function filtreUygula(rows) {
        var gorunen = rows.slice();
        if (tarihFiltre) {
            gorunen = gorunen.filter(function (r) {
                return gunAnahtar(r.created_at) === tarihFiltre;
            });
        }
        var q = aramaMetni.replace(/^\s+|\s+$/g, '');
        if (q) {
            gorunen = gorunen.filter(function (r) { return aramaEslesir(r, q); });
        }
        gorunen.sort(function (a, b) {
            var ta = new Date(a.created_at).getTime() || 0;
            var tb = new Date(b.created_at).getTime() || 0;
            return sira === 'asc' ? ta - tb : tb - ta;
        });
        return gorunen;
    }

    function filtreleriDomdanSenkronize() {
        var tarihEl = qs('plTarih');
        var siraEl = qs('plSira');
        var araEl = qs('plAra');
        if (tarihEl) tarihFiltre = tarihEl.value || '';
        if (siraEl) sira = siraEl.value === 'desc' ? 'desc' : 'asc';
        if (araEl) aramaMetni = araEl.value;
    }

    function kartOlustur(row) {
        var id = String(row.id);
        var cins = row.gender === 'male' ? 'male' : 'female';
        var rumuz = row.username || 'Anonim';
        var tam = row.content_full || row.content_short || '';
        var slugLink = row.slug
            ? '<p class="pl-kart-link"><a href="/h/' + esc(row.slug) + '" target="_blank" rel="noopener">/h/' + esc(row.slug) + '</a></p>'
            : '';

        var art = document.createElement('article');
        art.className = 'story-card card ' + cins;
        art.id = 'pl-h-' + id;
        art.setAttribute('data-id', id);
        if (row.slug) art.setAttribute('data-slug', String(row.slug));

        art.innerHTML =
            '<div class="card-header">' +
                '<div class="user-block">' +
                    '<div class="avatar" aria-hidden="true">' + (cins === 'male' ? '\u2642' : '\u2640') + '</div>' +
                    '<div class="user-details">' +
                        '<span class="username">' + esc(rumuz) + '</span>' +
                        metaHtml(row) +
                    '</div>' +
                '</div>' +
                '<div class="card-header-actions">' +
                    '<div class="card-header-etiket">' + planliYayinEtiket(row.created_at) + '</div>' +
                    '<span class="kart-marka" aria-hidden="true">gunde<span class="brand-five">5</span>.com</span>' +
                '</div>' +
            '</div>' +
            '<div class="card-body">' +
                '<span class="short-text">' + metinGoster(tam) + '</span>' +
            '</div>' +
            '<div class="card-footer pl-kart-footer">' +
                '<button type="button" class="pl-duzenle-btn" data-pl-duzenle="' + esc(id) + '">✏️ Hikâyeyi düzenle</button>' +
                '<p class="pl-onizleme-not">Önizleme — henüz yayında değil</p>' +
            '</div>' +
            slugLink;

        return art;
    }

    function gunBlokOlustur(ymd, rows) {
        var blok = document.createElement('section');
        blok.className = 'pl-gun-blok';
        blok.setAttribute('data-gun', ymd);

        var bant = document.createElement('div');
        bant.className = 'pl-gun-bant';
        bant.innerHTML =
            '<div class="pl-gun-bant-etiket">Planlı yayın</div>' +
            '<div class="pl-gun-bant-tarih">' + esc(gunEtiket(ymd)) + '</div>' +
            '<div class="pl-gun-bant-saat">' + esc(rows.length) + ' hikaye · 07:00–07:04</div>';
        blok.appendChild(bant);

        var liste = document.createElement('div');
        liste.className = 'pl-liste';
        var i;
        for (i = 0; i < rows.length; i++) {
            liste.appendChild(kartOlustur(rows[i]));
        }
        blok.appendChild(liste);
        return blok;
    }

    function gunlereAyir(rows) {
        var map = {};
        var gunler = [];
        var i;
        for (i = 0; i < rows.length; i++) {
            var g = gunAnahtar(rows[i].created_at);
            if (!g) continue;
            if (!map[g]) {
                map[g] = [];
                gunler.push(g);
            }
            map[g].push(rows[i]);
        }
        return gunler.map(function (g) {
            return { gun: g, rows: map[g] };
        });
    }

    function metaGuncelle(gorunen, gruplar) {
        var meta = qs('plMeta');
        if (!meta) return;
        var toplam = gorunen.length;
        var gunSay = gruplar.length;
        var parcalar = [];
        if (indexSayisi != null) {
            parcalar.push('Yayında (index): ' + indexSayisi);
        }
        if (!tumSatirlar.length) {
            parcalar.push('0 planlı hikaye');
            meta.textContent = parcalar.join(' · ');
            return;
        }
        var metin = toplam + ' planlı hikaye · ' + gunSay + ' gün';
        if (toplam !== tumSatirlar.length) {
            metin += ' (toplam ' + tumSatirlar.length + ')';
        }
        parcalar.push(metin);
        meta.textContent = parcalar.join(' · ');
    }

    function listeCiz(rows) {
        var el = qs('plListe');
        if (!el) return;

        if (!tumSatirlar.length) {
            el.innerHTML = '<p class="pl-bos">Planlı hikaye yok. Kamikaze\'den gelecek tarihli kayıt ekleyebilirsin.</p>';
            metaGuncelle([], []);
            return;
        }

        if (!rows.length) {
            el.innerHTML = '<p class="pl-bos">Bu filtrede planlı hikaye yok.</p>';
            metaGuncelle([], []);
            return;
        }

        var gruplar = gunlereAyir(rows);
        var frag = document.createDocumentFragment();
        var i;
        for (i = 0; i < gruplar.length; i++) {
            frag.appendChild(gunBlokOlustur(gruplar[i].gun, gruplar[i].rows));
        }
        el.innerHTML = '';
        el.appendChild(frag);
        metaGuncelle(rows, gruplar);
    }

    function goster() {
        listeCiz(filtreUygula(tumSatirlar));
    }

    function yukleniyorGoster(metin) {
        var y = qs('plYukleniyor');
        var t = qs('plYetkisiz');
        var i = qs('plIcerik');
        if (y) {
            y.hidden = false;
            y.textContent = metin || 'Yükleniyor…';
        }
        if (t) t.hidden = true;
        if (i) i.hidden = true;
    }

    function yetkisizGoster(metin, giris) {
        var y = qs('plYukleniyor');
        var t = qs('plYetkisiz');
        var i = qs('plIcerik');
        var m = qs('plYetkisizMetin');
        var b = qs('plGirisBtn');
        if (y) y.hidden = true;
        if (t) t.hidden = false;
        if (i) i.hidden = true;
        if (m) m.textContent = metin || 'Yetkisiz';
        if (b) b.hidden = !giris;
    }

    function icerikGoster() {
        var y = qs('plYukleniyor');
        var t = qs('plYetkisiz');
        var i = qs('plIcerik');
        if (y) y.hidden = true;
        if (t) t.hidden = true;
        if (i) i.hidden = false;
    }

    async function yukle() {
        var D = db();
        if (!D || !D.planliHikayeListele) {
            throw new Error('Planlı liste hazır değil.');
        }
        filtreleriDomdanSenkronize();
        var sonuclar = await Promise.all([
            D.planliHikayeListele(),
            D.indexYayindaHikayeSay ? D.indexYayindaHikayeSay() : Promise.resolve(null)
        ]);
        tumSatirlar = sonuclar[0] || [];
        indexSayisi = sonuclar[1];
        tarihSelectGuncelle(benzersizGunler(tumSatirlar));
        goster();
        icerikGoster();
    }

    function filtreBagla() {
        var ara = qs('plAra');
        var tarihEl = qs('plTarih');
        var siraEl = qs('plSira');

        if (ara) {
            ara.addEventListener('input', function () {
                aramaMetni = ara.value;
                clearTimeout(aramaZamanlayici);
                aramaZamanlayici = setTimeout(function () { goster(); }, 280);
            });
            ara.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    clearTimeout(aramaZamanlayici);
                    aramaMetni = ara.value;
                    goster();
                }
            });
        }
        if (tarihEl) {
            tarihEl.addEventListener('change', function () {
                tarihFiltre = tarihEl.value || '';
                goster();
            });
        }
        if (siraEl) {
            siraEl.addEventListener('change', function () {
                sira = siraEl.value === 'desc' ? 'desc' : 'asc';
                goster();
            });
        }
    }

    async function initBaslat() {
        var D = db();
        var U = ui();
        var yenile = qs('plYenile');
        var giris = qs('plGirisBtn');

        filtreBagla();
        drawerTiklamaBagla();
        duzenleBagla();

        if (yenile) {
            yenile.addEventListener('click', function () {
                yukleniyorGoster('Yenileniyor…');
                yukle().catch(function (e) {
                    yetkisizGoster(D && D.hataMesaji ? D.hataMesaji(e) : String(e), false);
                });
            });
        }
        if (giris) {
            giris.addEventListener('click', function () {
                global.location.href = '/bulut';
            });
        }

        if (!D) {
            yetkisizGoster('Modül yüklenemedi. Sayfayı yenileyin.', false);
            return;
        }

        try {
            yukleniyorGoster('Oturum doğrulanıyor…');
            await D.init();
            if (D.masterPanelHazir) {
                await D.masterPanelHazir();
            } else {
                var durum = await D.masterDurum();
                if (!durum || !durum.master) throw new Error('yetkisiz');
            }
        } catch (e) {
            var mesaj = String((e && e.message) || e || '');
            if (mesaj.indexOf('Giriş') >= 0 || mesaj.indexOf('giriş') >= 0 ||
                    mesaj.indexOf('Oturum') >= 0 || mesaj.indexOf('oturum') >= 0) {
                yetkisizGoster('Planlı önizleme yalnızca site yöneticisi içindir. Giriş yap.', true);
            } else if (mesaj.indexOf('yetkisiz') >= 0) {
                yetkisizGoster('Bu sayfa yalnızca site yöneticisi içindir.', false);
            } else {
                yetkisizGoster(D.hataMesaji ? D.hataMesaji(e) : mesaj, true);
            }
            return;
        }

        if (U && U.guncelleHeaderOturum) U.guncelleHeaderOturum();
        var topbarSol = qs('planliTopbarSol');
        if (topbarSol) topbarSol.hidden = false;
        if (global.Gunde5Master && global.Gunde5Master.durumYenile) {
            try { await global.Gunde5Master.durumYenile(); } catch (e2) { /* */ }
        }

        yukleniyorGoster('Planlı hikayeler yükleniyor…');
        try {
            await yukle();
        } catch (e3) {
            var el = qs('plListe');
            if (el) el.innerHTML = '<p class="pl-hata">' + esc(D.hataMesaji ? D.hataMesaji(e3) : String(e3)) + '</p>';
            icerikGoster();
        }
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initBaslat);
    } else {
        initBaslat();
    }
})(window);
