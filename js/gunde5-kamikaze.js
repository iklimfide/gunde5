/* gunde5 — Kamikaze: hikaye arama, düzenleme, planlama */
(function (global) {
    'use strict';

    var satirlar = [];
    var aramaMetni = '';
    var aramaZamanlayici = null;
    var aramaIstekNo = 0;
    var filtre = 'hepsi';
    var drawerMod = '';
    var drawerId = null;
    var islemSuruyor = false;

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

    function yetkisizGoster(metin, giris) {
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

    function filtreUygula(liste) {
        if (filtre === 'hepsi') return liste;
        return liste.filter(function (r) { return satirDurum(r) === filtre; });
    }

    function rumuzSinif(row) {
        return row && row.gender === 'male' ? 'km-rumuz km-rumuz--male' : 'km-rumuz km-rumuz--female';
    }

    function satirBaslik(row) {
        var b = row && row.baslik != null ? String(row.baslik).replace(/^\s+|\s+$/g, '') : '';
        return b || '(Başlıksız)';
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

    async function panelYukle() {
        var D = db();
        if (!D) throw new Error('Panel hazır değil.');
        if (aramaMetni.trim()) {
            await aramaYukle(true);
            return;
        }
        var sonuc;
        if (filtre !== 'hepsi' && D.masterKamikazeListe) {
            sonuc = await D.masterKamikazeListe(filtre);
            if (!sonuc || sonuc.ok === false) {
                throw new Error((sonuc && sonuc.hata) || 'Liste yüklenemedi');
            }
            satirlar = arr(sonuc.hikayeler);
        } else {
            if (!D.masterKamikazePanel) throw new Error('Panel hazır değil.');
            sonuc = await D.masterKamikazePanel();
            if (!sonuc || sonuc.ok === false) {
                throw new Error((sonuc && sonuc.hata) || 'Panel yüklenemedi');
            }
            satirlar = arr(sonuc.son_hikayeler);
        }
        listeCiz();
    }

    async function aramaYukle(sessiz) {
        var D = db();
        var q = aramaMetni.trim();
        if (!D || !D.masterKamikazeAra) return;
        if (!q) {
            await panelYukle();
            return;
        }
        var istekNo = ++aramaIstekNo;
        try {
            var sonuc = await D.masterKamikazeAra(q, 60);
            if (istekNo !== aramaIstekNo) return;
            if (!sonuc || sonuc.ok === false) {
                if (!sessiz) toast((sonuc && sonuc.hata) || 'Arama başarısız', 'hata');
                return;
            }
            satirlar = arr(sonuc.hikayeler);
            listeCiz();
        } catch (e) {
            if (istekNo !== aramaIstekNo) return;
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
            '<div class="km-alan"><label>Başlık<input type="text" id="kmDetayBaslik" maxlength="120" value="' + esc(h.baslik || '') + '"></label></div>' +
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
            '<div class="km-alan"><label>Başlık<input type="text" id="kmYeniBaslik" maxlength="120"></label></div>' +
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

    function drawerBodyBagla() {
        var body = qs('kmDrawerBody');
        if (!body) return;
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
        if (drawerMod === 'detay') yerBagla('kmDetay');
        if (drawerMod === 'yeni') yerBagla('kmYeni');
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
            drawerBodyBagla();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        }
    }

    async function hikayeIslem(islem, ek) {
        var D = db();
        if (!D || !D.masterHikayeIslem || !drawerId) return null;
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
        try {
            await hikayeIslem('guncelle', {
                content_full: metin,
                baslik: String(qs('kmDetayBaslik') && qs('kmDetayBaslik').value || '').trim(),
                username: rumuz
            });
            var yer = qs('kmDetayYer') ? qs('kmDetayYer').value : '';
            await hikayeIslem('meta', {
                age: yas,
                gender: qs('kmDetayCinsiyet') ? qs('kmDetayCinsiyet').value : 'female',
                yasadigi_yer: yer || null,
                yurtdisi_sehir: yer === 'yurtdisi' ? String(qs('kmDetayYurtdisi') && qs('kmDetayYurtdisi').value || '').trim() || null : null
            });
            if (planHam) {
                var planIso = D.planliTarihIso ? D.planliTarihIso(planHam) : null;
                if (!planIso) { toast('Yayın tarihi geçersiz.', 'hata'); return; }
                await hikayeIslem('yayin_tarihi', { created_at: planIso });
            }
            await hikayeIslem('status', { status: qs('kmDetayStatus') ? qs('kmDetayStatus').value : 'kulis' });
            await hikayeIslem('oylar', {
                up_votes: parseInt(qs('kmDetayUp') && qs('kmDetayUp').value, 10) || 0,
                down_votes: parseInt(qs('kmDetayDown') && qs('kmDetayDown').value, 10) || 0
            });
            toast('Kaydedildi.');
            drawerKapat();
            await panelYukle();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        } finally {
            islemSuruyor = false;
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
        drawerBodyBagla();
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
            baslik: String(qs('kmYeniBaslik') && qs('kmYeniBaslik').value || '').trim()
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
        var yenile = qs('kmYenile');
        var yeni = qs('kmYeni');
        var giris = qs('kmGirisBtn');

        if (ara) {
            ara.addEventListener('input', function () {
                aramaMetni = ara.value;
                clearTimeout(aramaZamanlayici);
                aramaZamanlayici = setTimeout(function () { aramaYukle(false); }, 320);
            });
            ara.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    clearTimeout(aramaZamanlayici);
                    aramaYukle(false);
                }
            });
        }
        if (filtreEl) {
            filtreEl.addEventListener('change', function () {
                filtre = filtreEl.value;
                panelYukle().catch(function (e) {
                    toast(db().hataMesaji ? db().hataMesaji(e) : String(e), 'hata');
                });
            });
        }
        if (yenile) {
            yenile.addEventListener('click', function () {
                panelYukle().catch(function (e) {
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

    async function initBaslat() {
        var D = db();
        var U = ui();
        if (!D) return;

        filtreBagla();

        try {
            await D.init();
        } catch (e) { /* */ }

        if (D.oturumHazirBekle) {
            try { await D.oturumHazirBekle(8000); } catch (eO) { /* */ }
        }

        if (U && U.guncelleHeaderOturum) U.guncelleHeaderOturum();
        if (global.Gunde5Master && global.Gunde5Master.durumYenile) {
            try { await global.Gunde5Master.durumYenile(); } catch (e2) { /* */ }
        }

        var oturum = D.getGunde5User && D.getGunde5User();
        if (!oturum || !oturum.id) {
            yetkisizGoster('Kamikaze için site yöneticisi hesabıyla giriş yap.', true);
            return;
        }

        var durum;
        try {
            durum = await D.masterDurum();
        } catch (e3) {
            durum = { master: false };
        }
        if (!durum || !durum.master) {
            yetkisizGoster('Bu panel yalnızca site yöneticisi içindir.', false);
            return;
        }

        araclariGoster();
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
