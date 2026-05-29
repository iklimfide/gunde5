/* gunde5 — master üye yönetimi (uyeler.html) */
(function (global) {
    'use strict';

    var SAYFA = 40;
    var seciliDurum = '';
    var aramaMetni = '';
    var offset = 0;
    var toplam = 0;
    var seciliUye = null;
    var seciliIcerik = null;

    function db() {
        return global.Gunde5DB;
    }

    function ui() {
        return global.Gunde5UI;
    }

    function profil() {
        return global.Gunde5Profil;
    }

    function esc(s) {
        if (s == null || s === '') return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function yasHesapla(dogumYili) {
        var y = parseInt(dogumYili, 10);
        if (isNaN(y)) return '—';
        return String(new Date().getFullYear() - y);
    }

    function fmtTarih(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return esc(iso);
        }
    }

    function durumEtiket(d) {
        if (d === 'ban') return 'Banlı';
        if (d === 'askida') return 'Askıda';
        return 'Aktif';
    }

    function yerGoster(u) {
        var P = profil();
        if (!P || !P.yasadigiYerGosterim) {
            if (u.yasadigi_yer === 'yurtdisi' && u.yurtdisi_sehir) {
                return 'Yurtdışı · ' + u.yurtdisi_sehir;
            }
            return u.yasadigi_yer || '—';
        }
        return P.yasadigiYerGosterim({
            yasadigiYer: u.yasadigi_yer,
            yurtdisiSehir: u.yurtdisi_sehir
        }) || '—';
    }

    function yetkisizGoster(metin, girisGoster) {
        var y = document.getElementById('uyelerYetkisiz');
        var app = document.getElementById('uyelerApp');
        var filtre = document.getElementById('uyelerFiltre');
        if (app) app.hidden = true;
        if (filtre) filtre.hidden = true;
        if (y) {
            y.hidden = false;
            var p = y.querySelector('.uyeler-yetkisiz-metin');
            if (p) p.textContent = metin;
            var btn = document.getElementById('uyelerGirisBtn');
            if (btn) btn.hidden = !girisGoster;
        }
    }

    function icerikGoster() {
        var y = document.getElementById('uyelerYetkisiz');
        var app = document.getElementById('uyelerApp');
        var filtre = document.getElementById('uyelerFiltre');
        if (y) y.hidden = true;
        if (app) app.hidden = false;
        if (filtre) filtre.hidden = false;
    }

    function yukleniyor(acik) {
        var el = document.getElementById('uyelerYukleniyor');
        if (el) el.hidden = !acik;
    }

    function listeRender(uyeler) {
        var wrap = document.getElementById('uyelerListe');
        var ozet = document.getElementById('uyelerOzet');
        if (!wrap) return;

        if (ozet) {
            var bas = toplam ? offset + 1 : 0;
            var son = Math.min(offset + SAYFA, toplam);
            ozet.textContent = toplam
                ? bas + '–' + son + ' / ' + toplam + ' üye'
                : 'Üye bulunamadı';
        }

        if (!uyeler || !uyeler.length) {
            wrap.innerHTML = '<p class="uyeler-bos">Sonuç yok.</p>';
            return;
        }

        var P = profil();
        var html =
            '<div class="uyeler-tablo-wrap"><table class="uyeler-tablo"><thead><tr>' +
            '<th>Rumuz</th><th>E-posta</th><th>Durum</th><th>Son aktif</th><th>IP</th><th>Hikaye</th><th>Kayıt</th>' +
            '</tr></thead><tbody>';

        uyeler.forEach(function (u) {
            var ist = u.istatistik || {};
            var akt = u.aktivite || {};
            var durum = u.durum || 'aktif';
            var durumCls = 'uyeler-durum--' + esc(durum);
            html +=
                '<tr class="uyeler-satir" data-uye-id="' + esc(u.id) + '" tabindex="0" role="button">' +
                '<td><strong>' + esc(u.username) + '</strong>' +
                (u.zorunlu_gizli ? ' <span class="uyeler-gizli">gizli</span>' : '') + '</td>' +
                '<td>' + esc(u.email) + '</td>' +
                '<td><span class="uyeler-durum ' + durumCls + '">' + esc(durumEtiket(durum)) + '</span></td>' +
                '<td>' + esc(fmtTarih(akt.son_aktif_at)) + '</td>' +
                '<td class="uyeler-ip">' + esc(akt.son_ip || '—') + '</td>' +
                '<td>' + esc(String(ist.hikaye != null ? ist.hikaye : 0)) + '</td>' +
                '<td>' + esc(fmtTarih(u.created_at)) + '</td>' +
                '</tr>';
        });
        html += '</tbody></table></div>';
        wrap.innerHTML = html;

        wrap.querySelectorAll('.uyeler-satir').forEach(function (tr) {
            tr.addEventListener('click', function () {
                detayAc(tr.getAttribute('data-uye-id'));
            });
            tr.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    detayAc(tr.getAttribute('data-uye-id'));
                }
            });
        });
    }

    function sayfalamaGuncelle() {
        var once = document.getElementById('uyelerOnceki');
        var sonraki = document.getElementById('uyelerSonraki');
        if (once) once.disabled = offset <= 0;
        if (sonraki) sonraki.disabled = offset + SAYFA >= toplam;
    }

    async function listeyiYukle(sifirla) {
        var D = db();
        if (!D || !D.masterUyeListele) return;
        if (sifirla) offset = 0;

        yukleniyor(true);
        try {
            var sonuc = await D.masterUyeListele({
                q: aramaMetni,
                limit: SAYFA,
                offset: offset,
                durum: seciliDurum
            });
            if (!sonuc || !sonuc.ok) {
                throw new Error((sonuc && sonuc.hata) || 'Liste alınamadı');
            }
            toplam = parseInt(sonuc.toplam, 10) || 0;
            listeRender(sonuc.uyeler || []);
            sayfalamaGuncelle();
        } catch (err) {
            var wrap = document.getElementById('uyelerListe');
            if (wrap) {
                wrap.innerHTML =
                    '<p class="uyeler-hata">' +
                    esc(D.hataMesaji ? D.hataMesaji(err) : String(err)) +
                    '</p>';
            }
        } finally {
            yukleniyor(false);
        }
    }

    function yilSecenekleriHtml(secili) {
        var y = new Date().getFullYear();
        var min = y - 100;
        var max = y - 18;
        var html = '<option value="">Yıl</option>';
        var i;
        for (i = max; i >= min; i--) {
            html +=
                '<option value="' + i + '"' +
                (String(secili) === String(i) ? ' selected' : '') +
                '>' + i + '</option>';
        }
        return html;
    }

    function selectYerHtml(secili) {
        var P = profil();
        if (!P || !P.YER_SECENEKLERI) return '';
        var html = '<option value="">—</option>';
        P.YER_SECENEKLERI.forEach(function (s) {
            html +=
                '<option value="' + esc(s.value) + '"' +
                (secili === s.value ? ' selected' : '') +
                '>' + esc(s.label) + '</option>';
        });
        return html;
    }

    function selectMeslekHtml(secili) {
        var P = profil();
        if (!P || !P.MESLEK_SECENEKLERI) return '';
        var html = '';
        P.MESLEK_SECENEKLERI.forEach(function (s) {
            html +=
                '<option value="' + esc(s.value) + '"' +
                (secili === s.value ? ' selected' : '') +
                '>' + esc(s.label) + '</option>';
        });
        return html;
    }

    function selectMedeniHtml(secili) {
        var P = profil();
        if (!P || !P.MEDENI_SECENEKLERI) return '';
        var html = '';
        P.MEDENI_SECENEKLERI.forEach(function (s) {
            html +=
                '<option value="' + esc(s.value) + '"' +
                (secili === s.value ? ' selected' : '') +
                '>' + esc(s.label) + '</option>';
        });
        return html;
    }

    function aktiviteHtml(u) {
        var a = (u && u.aktivite) || {};
        return (
            '<div class="uyeler-aktivite">' +
            '<p><span class="uyeler-aktivite-etiket">Son aktif</span> ' +
            esc(fmtTarih(a.son_aktif_at)) + '</p>' +
            '<p><span class="uyeler-aktivite-etiket">Son IP</span> ' +
            esc(a.son_ip || '—') + '</p>' +
            '<p><span class="uyeler-aktivite-etiket">Son sayfa</span> ' +
            esc(a.son_sayfa || '—') +
            (a.son_yol ? ' <span class="uyeler-aktivite-yol">(' + esc(a.son_yol) + ')</span>' : '') +
            '</p>' +
            '<p><span class="uyeler-aktivite-etiket">Kayıtlı ziyaret</span> ' +
            esc(String(a.ziyaret_sayisi != null ? a.ziyaret_sayisi : 0)) + '</p>' +
            '</div>'
        );
    }

    function detayShellHtml(u) {
        var ist = u.istatistik || {};
        var hSay = ist.hikaye != null ? ist.hikaye : 0;
        var ySay = ist.yorum != null ? ist.yorum : 0;
        return (
            '<div class="uyeler-sekme-nav" role="tablist">' +
            '<button type="button" class="uyeler-sekme-btn uyeler-sekme-btn--aktif" data-sekme="profil" role="tab">Profil</button>' +
            '<button type="button" class="uyeler-sekme-btn" data-sekme="hikaye" role="tab">Hikayeler (' +
            esc(String(hSay)) + ')</button>' +
            '<button type="button" class="uyeler-sekme-btn" data-sekme="yorum" role="tab">Yorumlar (' +
            esc(String(ySay)) + ')</button>' +
            '</div>' +
            '<div id="uyelerSekmeProfil" class="uyeler-sekme-panel" role="tabpanel">' +
            aktiviteHtml(u) +
            detayFormHtml(u) +
            '</div>' +
            '<div id="uyelerSekmeHikaye" class="uyeler-sekme-panel" role="tabpanel" hidden>' +
            '<p class="uyeler-bos" id="uyelerHikayeYukleniyor">Yükleniyor…</p>' +
            '<div id="uyelerHikayeListe"></div>' +
            '</div>' +
            '<div id="uyelerSekmeYorum" class="uyeler-sekme-panel" role="tabpanel" hidden>' +
            '<p class="uyeler-bos" id="uyelerYorumYukleniyor">Yükleniyor…</p>' +
            '<div id="uyelerYorumListe"></div>' +
            '</div>'
        );
    }

    function hikayeDurumEtiket(h) {
        if (h.silindi_at) return 'Silinmiş';
        if (h.status === 'podyum') return 'Podyum';
        return 'Kulis';
    }

    function hikayelerHtml(liste) {
        if (!liste || !liste.length) {
            return '<p class="uyeler-bos">Hikaye yok.</p>';
        }
        var html = '';
        liste.forEach(function (h) {
            var gizli = h.is_gizli ? 'Gizli' : 'Görünür';
            html +=
                '<article class="uyeler-icerik-kart" data-hikaye-id="' + esc(h.id) + '">' +
                '<div class="uyeler-icerik-ust">' +
                '<span>#' + esc(h.id) + ' · ' + esc(hikayeDurumEtiket(h)) + ' · ' + esc(fmtTarih(h.created_at)) +
                '</span>' +
                '<span class="uyeler-icerik-rozet">' + esc(gizli) +
                ' · 👍' + esc(String(h.up_votes)) + ' 👎' + esc(String(h.down_votes)) + '</span>' +
                '</div>' +
                '<textarea class="uyeler-icerik-ta" rows="4" maxlength="5000">' + esc(h.content_full || '') + '</textarea>' +
                '<div class="uyeler-icerik-aksiyon">' +
                '<button type="button" class="uyeler-btn uyeler-btn--kaydet" data-h-islem="kaydet">Kaydet</button>' +
                '<button type="button" class="uyeler-btn" data-h-islem="gizle_toggle">' +
                (h.is_gizli ? 'Göster' : 'Gizle') + '</button>';
            if (h.silindi_at) {
                html += '<button type="button" class="uyeler-btn" data-h-islem="geri_al">Geri al</button>';
            } else {
                html += '<button type="button" class="uyeler-btn uyeler-btn--tehlike" data-h-islem="sil">Sil</button>';
            }
            var link = h.status === 'podyum' ? '/podyum?itiraf=' + h.id : '/kulis?itiraf=' + h.id;
            html +=
                '<a class="uyeler-icerik-link" href="' + esc(link) + '" target="_blank" rel="noopener">Sayfada aç</a>' +
                '</div></article>';
        });
        return html;
    }

    function yorumlarHtml(liste) {
        if (!liste || !liste.length) {
            return '<p class="uyeler-bos">Yorum yok.</p>';
        }
        var html = '';
        liste.forEach(function (c) {
            var tur = c.parent_id ? 'Yanıt' : 'Cevap';
            var link = c.itiraf_status === 'podyum'
                ? '/podyum?itiraf=' + c.itiraf_id
                : '/kulis?itiraf=' + c.itiraf_id;
            html +=
                '<article class="uyeler-icerik-kart" data-cevap-id="' + esc(c.id) + '">' +
                '<div class="uyeler-icerik-ust">' +
                '<span>' + esc(tur) + ' #' + esc(c.id) + ' · Hikaye #' + esc(c.itiraf_id) +
                ' · ' + esc(fmtTarih(c.created_at)) + '</span>' +
                (c.itiraf_silindi ? '<span class="uyeler-icerik-rozet uyeler-icerik-rozet--silindi">Hikaye silinmiş</span>' : '') +
                '</div>' +
                '<textarea class="uyeler-icerik-ta" rows="3" maxlength="2000">' + esc(c.content || '') + '</textarea>' +
                '<div class="uyeler-icerik-aksiyon">' +
                '<button type="button" class="uyeler-btn uyeler-btn--kaydet" data-c-islem="kaydet">Kaydet</button>' +
                '<button type="button" class="uyeler-btn uyeler-btn--tehlike" data-c-islem="sil">Sil</button>' +
                '<a class="uyeler-icerik-link" href="' + esc(link) + '" target="_blank" rel="noopener">Hikayeye git</a>' +
                '</div></article>';
        });
        return html;
    }

    function detayFormHtml(u) {
        var yurtdisiGoster = u.yasadigi_yer === 'yurtdisi';
        return (
            '<form id="uyelerDetayForm" class="uyeler-detay-form">' +
            '<input type="hidden" name="uye_id" value="' + esc(u.id) + '">' +
            '<div class="uyeler-detay-grid">' +
            '<label class="uyeler-alan"><span>Rumuz</span><input name="username" maxlength="15" value="' +
            esc(u.username) + '"></label>' +
            '<label class="uyeler-alan"><span>E-posta</span><input name="email" type="email" maxlength="80" value="' +
            esc(u.email) + '"></label>' +
            '<label class="uyeler-alan"><span>Cinsiyet</span><select name="gender">' +
            '<option value="female"' + (u.gender === 'female' ? ' selected' : '') + '>Kadın</option>' +
            '<option value="male"' + (u.gender === 'male' ? ' selected' : '') + '>Erkek</option>' +
            '</select></label>' +
            '<label class="uyeler-alan"><span>Doğum yılı</span><select name="dogum_yili">' +
            yilSecenekleriHtml(u.dogum_yili) +
            '</select></label>' +
            '<label class="uyeler-alan"><span>Yaşadığı yer</span><select name="yasadigi_yer" id="uyelerYer">' +
            selectYerHtml(u.yasadigi_yer || '') +
            '</select></label>' +
            '<label class="uyeler-alan uyeler-alan--yurtdisi' +
            (yurtdisiGoster ? '' : ' uyeler-alan--gizli') +
            '" id="uyelerYurtdisiWrap"><span>Yurtdışı şehir</span><input name="yurtdisi_sehir" maxlength="80" value="' +
            esc(u.yurtdisi_sehir || '') + '"></label>' +
            '<label class="uyeler-alan"><span>Meslek</span><select name="meslek">' +
            selectMeslekHtml(u.meslek || '') +
            '</select></label>' +
            '<label class="uyeler-alan"><span>Medeni durum</span><select name="medeni_durum">' +
            selectMedeniHtml(u.medeni_durum || '') +
            '</select></label>' +
            '<div class="uyeler-alan uyeler-alan--tam uyeler-avatar-blok">' +
            '<span>Profil fotoğrafı</span>' +
            '<div class="uyeler-avatar-satir">' +
            '<div class="uyeler-avatar-onizleme" id="uyelerAvatarOnizleme" role="img" aria-label="Profil önizleme"></div>' +
            '<div class="uyeler-avatar-btns">' +
            '<button type="button" class="uyeler-btn uyeler-btn--kucuk" id="uyelerAvatarDegistir">Fotoğrafı değiştir</button>' +
            '<button type="button" class="uyeler-btn uyeler-btn--kucuk uyeler-btn--tehlike" id="uyelerAvatarKaldir"' +
            (u.avatar_url ? '' : ' hidden') + '>Fotoğrafı kaldır</button>' +
            '</div></div>' +
            '<input type="file" id="uyelerAvatarInput" accept="image/jpeg,image/png,image/webp,image/gif" hidden>' +
            '</div>' +
            '<label class="uyeler-alan uyeler-alan--tam"><span>Durum notu</span><textarea name="durum_notu" rows="2" maxlength="500">' +
            esc(u.durum_notu || '') + '</textarea></label>' +
            '</div>' +
            '<p class="uyeler-detay-meta">Durum: <strong>' + esc(durumEtiket(u.durum)) +
            '</strong> · Kayıt: ' + esc(fmtTarih(u.created_at)) +
            ' · Hikaye: ' + esc(String((u.istatistik && u.istatistik.hikaye) || 0)) +
            ' · Yorum: ' + esc(String((u.istatistik && u.istatistik.yorum) || 0)) + ')</p>' +
            '<div class="uyeler-detay-aksiyonlar">' +
            '<button type="button" class="uyeler-btn uyeler-btn--kaydet" id="uyelerKaydet">Kaydet</button>' +
            '<button type="button" class="uyeler-btn" data-islem="aktif">Aktif</button>' +
            '<button type="button" class="uyeler-btn" data-islem="askida">Askıya al</button>' +
            '<button type="button" class="uyeler-btn uyeler-btn--tehlike" data-islem="ban">Banla</button>' +
            '<button type="button" class="uyeler-btn" data-islem="gizli_uye">Gizli üye</button>' +
            '<button type="button" class="uyeler-btn" data-islem="gizli_kaldir">Rumuz göster</button>' +
            '<button type="button" class="uyeler-btn uyeler-btn--tehlike" data-islem="sil">Hesabı sil</button>' +
            '</div></form>'
        );
    }

    function detayKapat() {
        var modal = document.getElementById('uyelerDetayModal');
        if (modal) modal.hidden = true;
        seciliUye = null;
        seciliIcerik = null;
    }

    function sekmeGoster(ad) {
        document.querySelectorAll('.uyeler-sekme-btn').forEach(function (btn) {
            var aktif = btn.getAttribute('data-sekme') === ad;
            btn.classList.toggle('uyeler-sekme-btn--aktif', aktif);
            btn.setAttribute('aria-selected', aktif ? 'true' : 'false');
        });
        ['profil', 'hikaye', 'yorum'].forEach(function (s) {
            var panel = document.getElementById('uyelerSekme' + s.charAt(0).toUpperCase() + s.slice(1));
            if (panel) panel.hidden = s !== ad;
        });
    }

    function sekmeBagla() {
        document.querySelectorAll('.uyeler-sekme-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                sekmeGoster(btn.getAttribute('data-sekme'));
            });
        });
    }

    function icerikPanelGuncelle(icerik) {
        seciliIcerik = icerik;
        var hListe = document.getElementById('uyelerHikayeListe');
        var yListe = document.getElementById('uyelerYorumListe');
        var hYuk = document.getElementById('uyelerHikayeYukleniyor');
        var yYuk = document.getElementById('uyelerYorumYukleniyor');
        if (hYuk) hYuk.hidden = true;
        if (yYuk) yYuk.hidden = true;
        if (hListe) hListe.innerHTML = hikayelerHtml((icerik && icerik.hikayeler) || []);
        if (yListe) yListe.innerHTML = yorumlarHtml((icerik && icerik.yorumlar) || []);
    }

    async function icerikYenile() {
        var D = db();
        if (!D || !D.masterUyeIcerik || !seciliUye || !seciliUye.id) return;
        try {
            var sonuc = await D.masterUyeIcerik(seciliUye.id);
            if (!sonuc || !sonuc.ok) return;
            icerikPanelGuncelle(sonuc);
            icerikBagla();
        } catch (e) { /* sessiz */ }
    }

    function icerikBagla() {
        document.querySelectorAll('[data-hikaye-id]').forEach(function (kart) {
            var id = kart.getAttribute('data-hikaye-id');
            kart.querySelectorAll('[data-h-islem]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    hikayeIslem(id, btn.getAttribute('data-h-islem'), kart);
                });
            });
        });
        document.querySelectorAll('[data-cevap-id]').forEach(function (kart) {
            var id = kart.getAttribute('data-cevap-id');
            kart.querySelectorAll('[data-c-islem]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    cevapIslem(id, btn.getAttribute('data-c-islem'), kart);
                });
            });
        });
    }

    async function hikayeIslem(hikayeId, islem, kart) {
        var D = db();
        if (!D || !D.masterHikayeIslem) return;
        var ta = kart ? kart.querySelector('.uyeler-icerik-ta') : null;
        var body = { itiraf_id: hikayeId, islem: islem };

        if (islem === 'kaydet') {
            body.islem = 'guncelle';
            body.content_full = ta ? ta.value : '';
        } else if (islem === 'gizle_toggle') {
            var gizliBtn = kart.querySelector('[data-h-islem="gizle_toggle"]');
            body.islem = gizliBtn && gizliBtn.textContent.indexOf('Göster') >= 0 ? 'goster' : 'gizle';
        } else if (islem === 'sil') {
            if (!global.confirm('Bu hikayeyi silmek istiyor musun?')) return;
            body.islem = 'sil';
        } else if (islem === 'geri_al') {
            body.islem = 'geri_al';
        } else {
            return;
        }

        try {
            var sonuc = await D.masterHikayeIslem(body);
            if (!sonuc || !sonuc.ok) throw new Error((sonuc && sonuc.hata) || 'İşlem başarısız');
            if (ui() && ui().showToast) ui().showToast('Hikaye güncellendi');
            await icerikYenile();
            listeyiYukle(false);
        } catch (err) {
            if (ui() && ui().showToast) {
                ui().showToast(D.hataMesaji ? D.hataMesaji(err) : String(err), 'hata');
            }
        }
    }

    async function cevapIslem(cevapId, islem, kart) {
        var D = db();
        if (!D || !D.masterCevapIslem) return;
        if (islem === 'sil' && !global.confirm('Bu yorumu silmek istiyor musun?')) return;

        var ta = kart ? kart.querySelector('.uyeler-icerik-ta') : null;
        var body = {
            cevap_id: cevapId,
            islem: islem === 'kaydet' ? 'guncelle' : islem
        };
        if (islem === 'kaydet') body.content = ta ? ta.value : '';

        try {
            var sonuc = await D.masterCevapIslem(body);
            if (!sonuc || !sonuc.ok) throw new Error((sonuc && sonuc.hata) || 'İşlem başarısız');
            if (ui() && ui().showToast) ui().showToast(islem === 'sil' ? 'Yorum silindi' : 'Yorum güncellendi');
            if (islem === 'sil' && kart) kart.remove();
            else await icerikYenile();
        } catch (err) {
            if (ui() && ui().showToast) {
                ui().showToast(D.hataMesaji ? D.hataMesaji(err) : String(err), 'hata');
            }
        }
    }

    async function detayAc(uyeId) {
        var D = db();
        if (!D || !D.masterUyeDetay || !uyeId) return;
        var modal = document.getElementById('uyelerDetayModal');
        var govde = document.getElementById('uyelerDetayGovde');
        var baslik = document.getElementById('uyelerDetayBaslik');
        if (!modal || !govde) return;

        govde.innerHTML = '<p class="uyeler-bos">Yükleniyor…</p>';
        modal.hidden = false;
        sekmeGoster('profil');

        try {
            var sonuc = await D.masterUyeDetay(uyeId);
            if (!sonuc || !sonuc.ok || !sonuc.uye) {
                throw new Error((sonuc && sonuc.hata) || 'Üye bulunamadı');
            }
            seciliUye = sonuc.uye;
            if (baslik) baslik.textContent = seciliUye.username || 'Üye';
            govde.innerHTML = detayShellHtml(seciliUye);
            sekmeBagla();
            detayBagla();

            var icerikSonuc = { ok: false };
            if (D.masterUyeIcerik) {
                try {
                    icerikSonuc = await D.masterUyeIcerik(uyeId);
                } catch (e2) {
                    icerikSonuc = { ok: false };
                }
            }
            if (icerikSonuc && icerikSonuc.ok) {
                icerikPanelGuncelle(icerikSonuc);
                icerikBagla();
            } else {
                var hListe = document.getElementById('uyelerHikayeListe');
                var yListe = document.getElementById('uyelerYorumListe');
                if (hListe) {
                    hListe.innerHTML = '<p class="uyeler-hata">İçerik yüklenemedi. master-uye-aktivite-icerik.sql çalıştırın.</p>';
                }
                if (yListe) yListe.innerHTML = '';
            }
        } catch (err) {
            govde.innerHTML =
                '<p class="uyeler-hata">' + esc(D.hataMesaji ? D.hataMesaji(err) : String(err)) + '</p>';
        }
    }

    function detayBagla() {
        var form = document.getElementById('uyelerDetayForm');
        if (!form) return;

        var yerSel = form.querySelector('[name="yasadigi_yer"]');
        var yurtdisiWrap = document.getElementById('uyelerYurtdisiWrap');
        if (yerSel && yurtdisiWrap) {
            yerSel.addEventListener('change', function () {
                yurtdisiWrap.classList.toggle('uyeler-alan--gizli', yerSel.value !== 'yurtdisi');
            });
        }

        var kaydet = document.getElementById('uyelerKaydet');
        if (kaydet) {
            kaydet.addEventListener('click', function () {
                detayKaydet();
            });
        }

        form.querySelectorAll('[data-islem]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                uyeIslem(btn.getAttribute('data-islem'));
            });
        });

        avatarOnizlemeGuncelle(seciliUye);

        var avatarInput = document.getElementById('uyelerAvatarInput');
        var degistirBtn = document.getElementById('uyelerAvatarDegistir');
        var kaldirBtn = document.getElementById('uyelerAvatarKaldir');
        if (degistirBtn && avatarInput) {
            degistirBtn.addEventListener('click', function () {
                avatarInput.click();
            });
            avatarInput.addEventListener('change', function () {
                var f = avatarInput.files && avatarInput.files[0];
                avatarInput.value = '';
                if (f) avatarYukle(f);
            });
        }
        if (kaldirBtn) {
            kaldirBtn.addEventListener('click', function () {
                avatarKaldir();
            });
        }
    }

    function avatarOnizlemeGuncelle(u) {
        var el = document.getElementById('uyelerAvatarOnizleme');
        var kaldirBtn = document.getElementById('uyelerAvatarKaldir');
        if (!el || !u) return;
        var U = ui();
        if (U && U.uygulaAvatarElement) {
            U.uygulaAvatarElement(el, {
                gender: u.gender,
                avatarUrl: u.avatar_url || null
            });
        }
        if (kaldirBtn) kaldirBtn.hidden = !u.avatar_url;
    }

    async function avatarYukle(file) {
        var D = db();
        var form = document.getElementById('uyelerDetayForm');
        if (!D || !D.masterUyeAvatarYukle || !form) return;
        var uyeId = form.querySelector('[name="uye_id"]').value;
        try {
            var sonuc = await D.masterUyeAvatarYukle(uyeId, file);
            seciliUye = sonuc.uye;
            avatarOnizlemeGuncelle(seciliUye);
            if (ui() && ui().showToast) ui().showToast('Profil fotoğrafı güncellendi');
            listeyiYukle(false);
        } catch (err) {
            if (ui() && ui().showToast) {
                ui().showToast(D.hataMesaji ? D.hataMesaji(err) : String(err), 'hata');
            }
        }
    }

    async function avatarKaldir() {
        var D = db();
        var form = document.getElementById('uyelerDetayForm');
        if (!D || !D.masterUyeAvatarKaldir || !form) return;
        if (!global.confirm('Bu üyenin profil fotoğrafını kaldırmak istiyor musun?')) return;
        var uyeId = form.querySelector('[name="uye_id"]').value;
        try {
            var sonuc = await D.masterUyeAvatarKaldir(uyeId);
            seciliUye = sonuc.uye;
            avatarOnizlemeGuncelle(seciliUye);
            if (ui() && ui().showToast) ui().showToast('Profil fotoğrafı kaldırıldı');
            listeyiYukle(false);
        } catch (err) {
            if (ui() && ui().showToast) {
                ui().showToast(D.hataMesaji ? D.hataMesaji(err) : String(err), 'hata');
            }
        }
    }

    async function detayKaydet() {
        var D = db();
        var form = document.getElementById('uyelerDetayForm');
        if (!D || !D.masterUyeGuncelle || !form) return;

        var fd = new FormData(form);
        var body = {
            uye_id: fd.get('uye_id'),
            username: String(fd.get('username') || '').trim(),
            email: String(fd.get('email') || '').trim(),
            gender: fd.get('gender'),
            dogum_yili: parseInt(fd.get('dogum_yili'), 10),
            yasadigi_yer: fd.get('yasadigi_yer') || null,
            yurtdisi_sehir: fd.get('yurtdisi_sehir') || null,
            meslek: fd.get('meslek') || null,
            medeni_durum: fd.get('medeni_durum') || null,
            durum_notu: String(fd.get('durum_notu') || '').trim() || null
        };

        try {
            var sonuc = await D.masterUyeGuncelle(body);
            if (!sonuc || !sonuc.ok) throw new Error((sonuc && sonuc.hata) || 'Kaydedilemedi');
            if (ui() && ui().showToast) ui().showToast('Profil güncellendi');
            seciliUye = sonuc.uye;
            var baslik = document.getElementById('uyelerDetayBaslik');
            if (baslik && seciliUye) baslik.textContent = seciliUye.username;
            var profilPanel = document.getElementById('uyelerSekmeProfil');
            if (profilPanel) {
                profilPanel.innerHTML = aktiviteHtml(seciliUye) + detayFormHtml(seciliUye);
                detayBagla();
            }
            listeyiYukle(false);
        } catch (err) {
            if (ui() && ui().showToast) {
                ui().showToast(D.hataMesaji ? D.hataMesaji(err) : String(err), 'hata');
            }
        }
    }

    async function uyeIslem(islem) {
        var D = db();
        var form = document.getElementById('uyelerDetayForm');
        if (!D || !D.masterUyeIslem || !form) return;

        var uyeId = form.querySelector('[name="uye_id"]').value;
        if (!uyeId) return;

        if (islem === 'ban' && !global.confirm('Bu üyeyi banlamak istediğine emin misin?')) return;
        if (islem === 'sil' && !global.confirm('Hesap kalıcı silinecek (giriş ve profil). Emin misin?')) return;

        var not = '';
        if (islem === 'ban' || islem === 'askida') {
            not = global.prompt('İsteğe bağlı not (boş bırakılabilir):', '') || '';
        }

        try {
            var sonuc = await D.masterUyeIslem({ uye_id: uyeId, islem: islem, not: not });
            if (!sonuc || !sonuc.ok) throw new Error((sonuc && sonuc.hata) || 'İşlem başarısız');
            if (ui() && ui().showToast) {
                var mesaj = islem === 'sil' ? 'Üye silindi' : 'İşlem uygulandı: ' + islem;
                ui().showToast(mesaj);
            }
            if (islem === 'sil') {
                detayKapat();
                listeyiYukle(false);
                return;
            }
            if (sonuc.uye) {
                var det = await D.masterUyeDetay(uyeId);
                if (det && det.ok && det.uye) {
                    seciliUye = det.uye;
                    document.getElementById('uyelerDetayGovde').innerHTML = detayFormHtml(seciliUye);
                    detayBagla();
                }
            }
            listeyiYukle(false);
        } catch (err) {
            if (ui() && ui().showToast) {
                ui().showToast(D.hataMesaji ? D.hataMesaji(err) : String(err), 'hata');
            }
        }
    }

    function filtreBagla() {
        if (filtreBagla.hazir) return;
        filtreBagla.hazir = true;

        var araBtn = document.getElementById('uyelerAraBtn');
        var araInp = document.getElementById('uyelerAra');
        if (araBtn) {
            araBtn.addEventListener('click', function () {
                aramaMetni = araInp ? String(araInp.value || '').trim() : '';
                listeyiYukle(true);
            });
        }
        if (araInp) {
            araInp.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    aramaMetni = String(araInp.value || '').trim();
                    listeyiYukle(true);
                }
            });
        }

        document.querySelectorAll('[data-uyeler-durum]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('[data-uyeler-durum]').forEach(function (b) {
                    b.classList.remove('uyeler-filtre-btn--aktif');
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('uyeler-filtre-btn--aktif');
                btn.setAttribute('aria-pressed', 'true');
                seciliDurum = btn.getAttribute('data-uyeler-durum') || '';
                listeyiYukle(true);
            });
        });

        var once = document.getElementById('uyelerOnceki');
        var sonraki = document.getElementById('uyelerSonraki');
        if (once) {
            once.addEventListener('click', function () {
                offset = Math.max(0, offset - SAYFA);
                listeyiYukle(false);
            });
        }
        if (sonraki) {
            sonraki.addEventListener('click', function () {
                offset += SAYFA;
                listeyiYukle(false);
            });
        }

        var kapat = document.getElementById('uyelerDetayKapat');
        var modal = document.getElementById('uyelerDetayModal');
        if (kapat) kapat.addEventListener('click', detayKapat);
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === modal) detayKapat();
            });
        }

        var giris = document.getElementById('uyelerGirisBtn');
        if (giris) {
            giris.addEventListener('click', function () {
                if (typeof global.openAuthModal === 'function') global.openAuthModal('login');
            });
        }
    }

    async function init(yeniden) {
        var D = db();
        if (!D) return;

        if (!yeniden) {
            try {
                await D.init();
            } catch (e) { /* */ }
        }

        if (ui() && ui().guncelleHeaderOturum) ui().guncelleHeaderOturum();
        if (global.Gunde5Master && global.Gunde5Master.durumYenile) {
            try {
                await global.Gunde5Master.durumYenile();
            } catch (e2) { /* */ }
        }

        var oturum = D.getGunde5User && D.getGunde5User();
        if (!oturum || !oturum.id) {
            yetkisizGoster('Üye yönetimi için site yöneticisi hesabıyla giriş yapın.', true);
            return;
        }

        var durum;
        try {
            durum = await D.masterDurum();
        } catch (e3) {
            durum = { master: false };
        }

        if (!durum || !durum.master) {
            yetkisizGoster('Bu sayfa yalnızca site yöneticisi (master) hesabı içindir.', false);
            return;
        }

        icerikGoster();
        filtreBagla();
        await listeyiYukle(true);
    }

    global.Gunde5MasterUyeler = { init: init };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
