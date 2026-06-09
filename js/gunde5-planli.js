/* gunde5 — /planli: gelecek tarihli hikaye önizlemesi (master) */
(function (global) {
    'use strict';

    function db() { return global.Gunde5DB; }
    function ui() { return global.Gunde5UI; }

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
            '<div class="card-footer"><p class="pl-onizleme-not">Önizleme — henüz yayında değil</p></div>' +
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
        gunler.sort();
        return gunler.map(function (g) {
            return { gun: g, rows: map[g] };
        });
    }

    function listeCiz(rows) {
        var el = qs('plListe');
        var meta = qs('plMeta');
        if (!el) return;

        if (!rows.length) {
            el.innerHTML = '<p class="pl-bos">Planlı hikaye yok. Kamikaze\'den gelecek tarihli kayıt ekleyebilirsin.</p>';
            if (meta) meta.textContent = '0 hikaye';
            return;
        }

        var gruplar = gunlereAyir(rows);
        var frag = document.createDocumentFragment();
        var toplam = 0;
        var i;
        for (i = 0; i < gruplar.length; i++) {
            toplam += gruplar[i].rows.length;
            frag.appendChild(gunBlokOlustur(gruplar[i].gun, gruplar[i].rows));
        }
        el.innerHTML = '';
        el.appendChild(frag);
        if (meta) {
            meta.textContent = toplam + ' hikaye · ' + gruplar.length + ' gün';
        }
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
        var rows = await D.planliHikayeListele();
        listeCiz(rows || []);
        icerikGoster();
    }

    async function initBaslat() {
        var D = db();
        var U = ui();
        var yenile = qs('plYenile');
        var giris = qs('plGirisBtn');

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
