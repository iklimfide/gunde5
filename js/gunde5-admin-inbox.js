(function (global) {
    'use strict';

    var aktifSekme = 'hikaye';
    var hikayeDurum = 'pending';
    var mesajDurum = 'unread';
    var hikayeSatirlar = {};

    function db() {
        return global.Gunde5DB;
    }

    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function tarih(iso) {
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleString('tr-TR');
        } catch (e) {
            return iso;
        }
    }

    function toast(m, tur) {
        if (global.Gunde5UI && Gunde5UI.showToast) Gunde5UI.showToast(m, tur);
    }

    function tabOku() {
        try {
            var p = new URL(global.location.href).searchParams.get('tab');
            if (p === 'mesaj' || p === 'hikaye') return p;
        } catch (e) { /* */ }
        return 'hikaye';
    }

    function tabUrlGuncelle(tab) {
        try {
            var u = new URL(global.location.href);
            u.searchParams.set('tab', tab);
            global.history.replaceState(null, '', u.pathname + u.search);
        } catch (e2) { /* */ }
    }

    function sekmeGoster(tab) {
        aktifSekme = tab === 'mesaj' ? 'mesaj' : 'hikaye';
        tabUrlGuncelle(aktifSekme);
        var hBtn = document.getElementById('admSekmeHikaye');
        var mBtn = document.getElementById('admSekmeMesaj');
        var hPanel = document.getElementById('admPanelHikaye');
        var mPanel = document.getElementById('admPanelMesaj');
        var hikaye = aktifSekme === 'hikaye';
        if (hBtn) {
            hBtn.classList.toggle('aktif', hikaye);
            hBtn.setAttribute('aria-selected', hikaye ? 'true' : 'false');
        }
        if (mBtn) {
            mBtn.classList.toggle('aktif', !hikaye);
            mBtn.setAttribute('aria-selected', hikaye ? 'false' : 'true');
        }
        if (hPanel) hPanel.hidden = !hikaye;
        if (mPanel) mPanel.hidden = hikaye;
        if (hikaye) hikayeListeYukle();
        else mesajListeYukle();
    }

    async function masterMi() {
        var D = db();
        if (!D || !D.masterDurum) return false;
        var d = await D.masterDurum();
        return !!(d && d.master);
    }

    function filtreCiz(elId, durumlar, aktif, onDegis) {
        var el = document.getElementById(elId);
        if (!el) return;
        el.innerHTML = durumlar
            .map(function (d) {
                return (
                    '<button type="button" data-durum="' +
                    d.id +
                    '"' +
                    (aktif === d.id ? ' class="aktif"' : '') +
                    '>' +
                    esc(d.etiket) +
                    '</button>'
                );
            })
            .join('');
        el.querySelectorAll('button').forEach(function (btn) {
            btn.addEventListener('click', function () {
                onDegis(btn.getAttribute('data-durum'));
            });
        });
    }

    function ikiHane(n) {
        return n < 10 ? '0' + n : String(n);
    }

    /** Yarın 08:00 — varsayılan plan slotu. */
    function varsayilanPlanDatetimeLocal() {
        var d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(8, 0, 0, 0);
        return d.getFullYear() + '-' + ikiHane(d.getMonth() + 1) + '-' + ikiHane(d.getDate()) +
            'T' + ikiHane(d.getHours()) + ':' + ikiHane(d.getMinutes());
    }

    function cinsiyetSubmissiondan(row) {
        var g = String(row && row.gender || '').toLowerCase();
        if (g.indexOf('erkek') >= 0) return 'male';
        return 'female';
    }

    function datetimeLocalOku(raw) {
        var metin = String(raw || '').trim();
        if (!metin) return null;
        var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(metin);
        if (!m) return null;
        var d = new Date(
            parseInt(m[1], 10),
            parseInt(m[2], 10) - 1,
            parseInt(m[3], 10),
            parseInt(m[4], 10),
            parseInt(m[5], 10),
            m[6] ? parseInt(m[6], 10) : 0,
            0
        );
        return isNaN(d.getTime()) ? null : d;
    }

    function acikModalVar() {
        var duzenle = document.getElementById('admDuzenleModal');
        var planla = document.getElementById('admPlanlaModal');
        return (duzenle && duzenle.classList.contains('acik')) || (planla && planla.classList.contains('acik'));
    }

    function modallariKapat() {
        duzenleModalKapat();
        planlaModalKapat();
    }

    function silOnay(tur) {
        return global.confirm(
            tur === 'mesaj'
                ? 'Bu mesaj kalıcı olarak silinsin mi?'
                : 'Bu hikaye kalıcı olarak silinsin mi?'
        );
    }

    async function hikayeIslem(id, action) {
        if (action === 'delete' && !silOnay('hikaye')) return;
        var D = db();
        if (!D || !D.masterSubmissionIslem) return;
        try {
            var sonuc = await D.masterSubmissionIslem(id, action);
            if (sonuc && sonuc.ok === false) {
                toast(sonuc.hata || 'İşlem başarısız', 'hata');
                return;
            }
            if (action === 'delete') {
                toast('Hikaye silindi.');
            } else if (action === 'reject') {
                toast('Reddedildi.');
                hikayeDurum = 'rejected';
                hikayeFiltreKur();
            } else if (action === 'archive') {
                toast('Arşivlendi.');
                hikayeDurum = 'archived';
                hikayeFiltreKur();
            } else if (action === 'pending') {
                toast('Tekrar bekleyene alındı.');
                hikayeDurum = 'pending';
                hikayeFiltreKur();
            } else {
                toast('Güncellendi.');
            }
            hikayeListeYukle();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        }
    }

    async function mesajIslem(id, action) {
        if (action === 'delete' && !silOnay('mesaj')) return;
        var D = db();
        if (!D || !D.masterMessageIslem) return;
        try {
            var sonuc = await D.masterMessageIslem(id, action);
            if (sonuc && sonuc.ok === false) {
                toast(sonuc.hata || 'İşlem başarısız', 'hata');
                return;
            }
            toast(action === 'delete' ? 'Mesaj silindi.' : 'Güncellendi.');
            mesajListeYukle();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        }
    }

    function duzenleModalKapat() {
        var modal = document.getElementById('admDuzenleModal');
        if (modal) {
            modal.classList.remove('acik');
            modal.hidden = true;
        }
        var planla = document.getElementById('admPlanlaModal');
        if (!planla || !planla.classList.contains('acik')) {
            document.body.style.overflow = '';
        }
    }

    function duzenleModalAc(row) {
        var modal = document.getElementById('admDuzenleModal');
        if (!modal || !row) return;
        document.getElementById('admDuzenleId').value = row.id || '';
        document.getElementById('admDuzenleSlugHintInput').value = row.title || '';
        document.getElementById('admDuzenleIcerik').value = row.content || '';
        document.getElementById('admDuzenleYas').value = row.age != null ? String(row.age) : '';
        document.getElementById('admDuzenleSehir').value = row.city || '';
        var cinsiyet = row.gender || '';
        modal.querySelectorAll('input[name="gender"]').forEach(function (r) {
            r.checked = r.value === cinsiyet;
        });
        modal.hidden = false;
        modal.classList.add('acik');
        document.body.style.overflow = 'hidden';
        document.getElementById('admDuzenleIcerik').focus();
    }

    function planlaModalKapat() {
        var modal = document.getElementById('admPlanlaModal');
        if (modal) {
            modal.classList.remove('acik');
            modal.hidden = true;
        }
        if (!document.getElementById('admDuzenleModal') ||
            !document.getElementById('admDuzenleModal').classList.contains('acik')) {
            document.body.style.overflow = '';
        }
    }

    function planlaModalAc(row) {
        var modal = document.getElementById('admPlanlaModal');
        if (!modal || !row) return;
        if (row.published_story_id) {
            toast('Bu gönderi zaten planlandı (#' + row.published_story_id + ').', 'hata');
            return;
        }
        document.getElementById('admPlanlaId').value = row.id || '';
        document.getElementById('admPlanlaSlugHintInput').value = row.title || '';
        document.getElementById('admPlanlaIcerik').value = row.content || '';
        var yas = parseInt(row.age, 10);
        document.getElementById('admPlanlaYas').value = (yas >= 18 && yas <= 120) ? String(yas) : '';
        document.getElementById('admPlanlaSehir').value = row.city || '';
        document.getElementById('admPlanlaCinsiyet').value = cinsiyetSubmissiondan(row);
        document.getElementById('admPlanlaRumuz').value = '';
        document.getElementById('admPlanlaYayin').value = varsayilanPlanDatetimeLocal();
        modal.hidden = false;
        modal.classList.add('acik');
        document.body.style.overflow = 'hidden';
        document.getElementById('admPlanlaRumuz').focus();
    }

    async function planlaKaydet(ev) {
        ev.preventDefault();
        var D = db();
        if (!D || !D.masterSubmissionPlanla) {
            toast('Planlama hazır değil. Supabase SQL Editor\'da supabase/master-submission-planla.sql dosyasını bir kez çalıştır.', 'hata');
            return;
        }
        var form = ev.target;
        var btn = document.getElementById('admPlanlaKaydet');
        var rumuz = (form.username && form.username.value || '').trim();
        var icerik = (form.content && form.content.value || '').trim();
        var yas = parseInt(form.age && form.age.value, 10);
        var planHam = (form.yayin && form.yayin.value || '').trim();
        var planTarih = datetimeLocalOku(planHam);

        if (rumuz.length < 2) {
            toast('Rumuz en az 2 karakter olmalı.', 'hata');
            return;
        }
        if (icerik.length < 50) {
            toast('Hikaye en az 50 karakter olmalı.', 'hata');
            return;
        }
        if (!yas || yas < 18 || yas > 120) {
            toast('Yaş 18–120 arasında olmalı.', 'hata');
            return;
        }
        if (!planHam || !planTarih) {
            toast('Geçerli bir yayın tarihi seç.', 'hata');
            return;
        }

        var planIso = D.planliTarihIso ? D.planliTarihIso(planHam) : planTarih.toISOString();
        if (!planIso) {
            toast('Yayın tarihi okunamadı. Tekrar seç.', 'hata');
            return;
        }

        var payload = {
            id: form.id.value,
            username: rumuz,
            age: yas,
            gender: form.gender ? form.gender.value : 'female',
            slug_hint: (form.slug_hint && form.slug_hint.value || '').trim(),
            title: (form.slug_hint && form.slug_hint.value || '').trim(),
            content: icerik,
            city: (form.city && form.city.value || '').trim(),
            created_at: planIso
        };

        btn.disabled = true;
        btn.textContent = 'Planlanıyor…';
        try {
            var sonuc = await D.masterSubmissionPlanla(payload);
            if (sonuc && sonuc.ok === false) {
                toast(sonuc.hata || 'Planlanamadı', 'hata');
                return;
            }
            var hid = sonuc && sonuc.published_story_id;
            toast(
                hid
                    ? 'Planlandı (#' + hid + '). Yayın: ' + planHam.replace('T', ' ')
                    : 'Planlandı.'
            );
            planlaModalKapat();
            hikayeDurum = 'approved';
            hikayeFiltreKur();
            hikayeListeYukle();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Planla ve onayla';
        }
    }

    async function duzenleKaydet(ev) {
        ev.preventDefault();
        var D = db();
        if (!D || !D.masterSubmissionGuncelle) return;
        var form = ev.target;
        var btn = document.getElementById('admDuzenleKaydet');
        var icerik = (form.content && form.content.value || '').trim();
        if (icerik.length < 50) {
            toast('Hikaye en az 50 karakter olmalı.', 'hata');
            return;
        }
        var genderEl = form.querySelector('input[name="gender"]:checked');
        var payload = {
            id: form.id.value,
            slug_hint: (form.slug_hint && form.slug_hint.value || '').trim(),
            title: (form.slug_hint && form.slug_hint.value || '').trim(),
            content: icerik,
            city: (form.city && form.city.value || '').trim(),
            gender: genderEl ? genderEl.value : ''
        };
        if (form.age && form.age.value) payload.age = parseInt(form.age.value, 10);
        btn.disabled = true;
        btn.textContent = 'Kaydediliyor…';
        try {
            var sonuc = await D.masterSubmissionGuncelle(payload);
            if (sonuc && sonuc.ok === false) {
                toast(sonuc.hata || 'Kaydedilemedi', 'hata');
                return;
            }
            toast('Hikaye güncellendi.');
            duzenleModalKapat();
            hikayeListeYukle();
        } catch (e) {
            toast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Kaydet';
        }
    }

    function hikayeKartHtml(row) {
        hikayeSatirlar[row.id] = row;
        var baslik = row.title ? esc(row.title) : esc(String(row.content || '').slice(0, 56) + (row.content && row.content.length > 56 ? '…' : ''));
        var meta =
            esc(row.status) + ' · ' + tarih(row.created_at);
        if (row.city) meta += ' · ' + esc(row.city);
        if (row.age) meta += ' · ' + esc(row.age);
        if (row.gender) meta += ' · ' + esc(row.gender);
        var planliSatir = '';
        if (row.published_story_id) {
            planliSatir =
                '<p class="adm-kart-planli">Planlı hikaye #' + esc(row.published_story_id) +
                ' · <a href="/kamikaze">Kamikaze\'de düzenle</a></p>';
        }
        var planBtn = row.published_story_id
            ? ''
            : '<button type="button" class="onay" data-a="planla">Planla…</button>';
        return (
            '<article class="adm-kart" data-id="' + esc(row.id) + '" data-tur="hikaye">' +
            '<div class="adm-kart-baslik">' + baslik + '</div>' +
            '<div class="adm-kart-meta">' + meta + '</div>' +
            '<div class="adm-kart-metin">' + esc(row.content) + '</div>' +
            planliSatir +
            '<div class="adm-aksiyon">' +
            '<button type="button" class="duzenle" data-a="edit">Düzenle</button>' +
            planBtn +
            '<button type="button" class="red" data-a="reject">Reddet</button>' +
            '<button type="button" data-a="archive">Arşivle</button>' +
            '<button type="button" class="sil" data-a="delete">Sil</button>' +
            '</div></article>'
        );
    }

    function mesajKartHtml(row) {
        var meta = esc(row.status) + ' · ' + tarih(row.created_at);
        if (row.email) meta += ' · ' + esc(row.email);
        return (
            '<article class="adm-kart" data-id="' + esc(row.id) + '" data-tur="mesaj">' +
            '<div class="adm-kart-meta">' + meta + '</div>' +
            '<div class="adm-kart-metin">' + esc(row.message) + '</div>' +
            '<div class="adm-aksiyon">' +
            '<button type="button" data-a="read">Okundu</button>' +
            '<button type="button" data-a="archive">Arşivle</button>' +
            '<button type="button" class="sil" data-a="delete">Sil</button>' +
            '</div></article>'
        );
    }

    function listeOlaylariBagla(listeId) {
        var liste = document.getElementById(listeId);
        if (!liste) return;
        liste.querySelectorAll('.adm-aksiyon button').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var kart = btn.closest('.adm-kart');
                var id = kart && kart.getAttribute('data-id');
                var tur = kart && kart.getAttribute('data-tur');
                var action = btn.getAttribute('data-a');
                if (!id || !action) return;
                if (tur === 'hikaye') {
                    if (action === 'edit') {
                        duzenleModalAc(hikayeSatirlar[id]);
                        return;
                    }
                    if (action === 'planla') {
                        planlaModalAc(hikayeSatirlar[id]);
                        return;
                    }
                    hikayeIslem(id, action);
                } else {
                    mesajIslem(id, action);
                }
            });
        });
    }

    async function hikayeListeYukle() {
        var liste = document.getElementById('admListeHikaye');
        var D = db();
        if (!liste || !D) return;
        liste.innerHTML = '<p class="adm-bos">Yükleniyor…</p>';
        hikayeSatirlar = {};
        try {
            var sonuc = await D.masterSubmissionsListele({ status: hikayeDurum, limit: 50 });
            if (!sonuc || sonuc.ok === false) {
                liste.innerHTML = '<p class="adm-hata">' + esc((sonuc && sonuc.hata) || 'Yüklenemedi') + '</p>';
                return;
            }
            var rows = sonuc.rows || [];
            if (!rows.length) {
                liste.innerHTML = '<p class="adm-bos">Hikaye yok.</p>';
                return;
            }
            liste.innerHTML = rows.map(hikayeKartHtml).join('');
            listeOlaylariBagla('admListeHikaye');
        } catch (e) {
            liste.innerHTML = '<p class="adm-hata">' + esc(D.hataMesaji ? D.hataMesaji(e) : String(e)) + '</p>';
        }
    }

    async function mesajListeYukle() {
        var liste = document.getElementById('admListeMesaj');
        var D = db();
        if (!liste || !D) return;
        liste.innerHTML = '<p class="adm-bos">Yükleniyor…</p>';
        try {
            var sonuc = await D.masterMessagesListele({ status: mesajDurum, limit: 50 });
            if (!sonuc || sonuc.ok === false) {
                liste.innerHTML = '<p class="adm-hata">' + esc((sonuc && sonuc.hata) || 'Yüklenemedi') + '</p>';
                return;
            }
            var rows = sonuc.rows || [];
            if (!rows.length) {
                liste.innerHTML = '<p class="adm-bos">Mesaj yok.</p>';
                return;
            }
            liste.innerHTML = rows.map(mesajKartHtml).join('');
            listeOlaylariBagla('admListeMesaj');
        } catch (e) {
            liste.innerHTML = '<p class="adm-hata">' + esc(D.hataMesaji ? D.hataMesaji(e) : String(e)) + '</p>';
        }
    }

    function hikayeFiltreKur() {
        filtreCiz(
            'admFiltreHikaye',
            [
                { id: 'pending', etiket: 'Bekleyen' },
                { id: 'approved', etiket: 'Onaylı' },
                { id: 'rejected', etiket: 'Reddedilen' },
                { id: 'archived', etiket: 'Arşiv' },
                { id: 'all', etiket: 'Tümü' }
            ],
            hikayeDurum,
            function (d) {
                hikayeDurum = d;
                hikayeFiltreKur();
                hikayeListeYukle();
            }
        );
    }

    function mesajFiltreKur() {
        filtreCiz(
            'admFiltreMesaj',
            [
                { id: 'unread', etiket: 'Okunmamış' },
                { id: 'read', etiket: 'Okundu' },
                { id: 'archived', etiket: 'Arşiv' },
                { id: 'all', etiket: 'Tümü' }
            ],
            mesajDurum,
            function (d) {
                mesajDurum = d;
                mesajFiltreKur();
                mesajListeYukle();
            }
        );
    }

    function sekmeBagla() {
        document.querySelectorAll('.adm-sekme-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                sekmeGoster(btn.getAttribute('data-tab'));
            });
        });
    }

    function modallariBagla() {
        duzenleModalBagla();
        var planlaModal = document.getElementById('admPlanlaModal');
        var planlaKapat = document.getElementById('admPlanlaKapat');
        var planlaForm = document.getElementById('admPlanlaForm');
        if (planlaKapat) planlaKapat.addEventListener('click', planlaModalKapat);
        if (planlaModal) {
            planlaModal.addEventListener('click', function (e) {
                if (e.target === planlaModal) planlaModalKapat();
            });
        }
        if (planlaForm) planlaForm.addEventListener('submit', planlaKaydet);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && acikModalVar()) modallariKapat();
        });
    }

    function duzenleModalBagla() {
        var modal = document.getElementById('admDuzenleModal');
        var kapat = document.getElementById('admDuzenleKapat');
        var form = document.getElementById('admDuzenleForm');
        if (kapat) kapat.addEventListener('click', duzenleModalKapat);
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === modal) duzenleModalKapat();
            });
        }
        if (form) form.addEventListener('submit', duzenleKaydet);
    }

    function yetkisizGoster() {
        var html =
            '<p class="adm-hata">Bu sayfa yalnızca site yöneticisi içindir. <a href="/bulut">Giriş</a></p>';
        document.getElementById('admListeHikaye').innerHTML = html;
        document.getElementById('admListeMesaj').innerHTML = '';
    }

    async function baslat() {
        var D = db();
        if (!D || !D.init) return;
        await D.init();
        modallariBagla();
        sekmeBagla();
        if (global.Gunde5UI && Gunde5UI.guncelleHeaderOturum) {
            Gunde5UI.guncelleHeaderOturum();
        }
        if (global.Gunde5Shell && Gunde5Shell.applyShell) {
            Gunde5Shell.applyShell();
        }
        if (!(await masterMi())) {
            yetkisizGoster();
            return;
        }
        hikayeFiltreKur();
        mesajFiltreKur();
        sekmeGoster(tabOku());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', baslat);
    } else {
        baslat();
    }
})(window);
