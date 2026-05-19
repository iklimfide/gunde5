/* gunde5 — ortak arayüz yardımcıları */
(function (global) {
    function htmlEsc(s) {
        var d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }

    function metinBol(metin) {
        var m = String(metin || '');
        if (m.length <= 140) {
            return { kisa: m, devam: false };
        }
        return { kisa: m.slice(0, 140) + '...', devam: true, devami: m.slice(140) };
    }

    function kullaniciMetaSatir(row) {
        if (global.Gunde5Profil && global.Gunde5Profil.kartMetaSatir) {
            return global.Gunde5Profil.kartMetaSatir(row);
        }
        return row && row.age ? row.age + ' Yaş' : '';
    }

    function kullaniciMetaHtml(row) {
        var meta = kullaniciMetaSatir(row);
        if (!meta) return '';
        return '<span class="user-meta">' + htmlEsc(meta) + '</span>';
    }

    function showToast(mesaj, tip) {
        var el = document.getElementById('gunde5Toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'gunde5Toast';
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
        }
        el.className = 'gunde5-toast' + (tip === 'hata' ? ' gunde5-toast--hata' : '');
        el.textContent = mesaj;
        el.style.display = 'block';
        clearTimeout(el._g5t);
        el._g5t = setTimeout(function () {
            el.style.display = 'none';
        }, 3200);
    }

    function bosListe(mesaj) {
        return '<p class="liste-bos">' + htmlEsc(mesaj) + '</p>';
    }

    function kartDetayShell() {
        return (
            '<div class="kart-detay" data-kart-detay hidden>' +
            '<div class="kart-cevap-form">' +
            '<textarea data-kok-metin rows="3" maxlength="2000" placeholder="Cevabını yaz…"></textarea>' +
            '<button type="button" class="kart-cevap-gonder" data-kok-gonder>Gönder</button>' +
            '</div>' +
            '<div data-cevap-liste></div>' +
            '<button type="button" class="kart-cevap-daha" data-cevap-daha hidden>Daha eski cevaplar</button>' +
            '<div class="kart-daralt-satir kart-daralt-satir--alt">' +
            '<button type="button" class="kart-daralt" data-read-toggle>Daralt</button>' +
            '</div>' +
            '</div>'
        );
    }

    function cevapOzetBtnHtml(adet) {
        var n = parseInt(adet, 10) || 0;
        var lbl = n === 1 ? '1 yorum' : n + ' yorum';
        var stil = n < 1 ? ' style="display:none"' : '';
        return '<button type="button" class="cevap-ozet" data-cevap-ozet' + stil + '>' + htmlEsc(lbl) + '</button>';
    }

    function devamBtnHtml(devam) {
        if (!devam) return '';
        return (
            '<button type="button" class="read-more read-more--ac" data-read-toggle>Devamını oku</button>' +
            '<div class="kart-daralt-satir kart-daralt-satir--ust">' +
            '<button type="button" class="kart-daralt" data-read-toggle>Daralt</button>' +
            '</div>'
        );
    }

    var sikayetItirafId = null;

    function cardMenuBtnHtml(kartId) {
        return '<button type="button" class="card-menu-btn" onclick="acSikayetModal(\'' + kartId + '\')" aria-label="Şikayet et" title="Şikayet et"><span class="card-menu-dots" aria-hidden="true">&#8942;</span></button>';
    }

    function paylasBtnHtml() {
        return '<button type="button" class="vote-btn paylas-btn" onclick="paylasItirafFromCard(this)">\uD83D\uDD17 Payla\u015f</button>';
    }

    function injectSikayetStyles() {
        if (document.getElementById('gunde5-sikayet-styles')) return;
        var s = document.createElement('style');
        s.id = 'gunde5-sikayet-styles';
        s.textContent =
            '.card-header-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:8px}' +
            '.card-menu-btn{width:34px;height:34px;padding:0;border:1px solid var(--border-color);border-radius:50%;background:var(--bg-card);color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
            '.card-menu-btn:active{transform:scale(0.94)}' +
            '.card-menu-dots{font-size:20px;line-height:1;font-weight:900;letter-spacing:0}' +
            '.sikayet-modal{position:fixed;inset:0;z-index:2200;background:rgba(17,24,39,0.32);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .22s ease,visibility .22s ease}' +
            '.sikayet-modal.acik{opacity:1;visibility:visible;pointer-events:auto}' +
            '.sikayet-modal-panel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:calc(100% - 32px);max-width:400px;max-height:90vh;overflow-y:auto;background:#fff;border:1px solid #f3f4f6;border-radius:20px;padding:20px 18px 18px;box-shadow:0 10px 36px rgba(0,0,0,.12)}' +
            'body.dark-mode .sikayet-modal-panel{background:var(--bg-card);border-color:var(--border-color)}' +
            '.sikayet-modal-ust{position:relative;padding-right:36px;margin-bottom:14px}' +
            '.sikayet-modal-baslik{font-size:17px;font-weight:800;color:var(--text-main)}' +
            '.sikayet-modal-alt{font-size:12px;color:var(--text-muted);font-weight:500;margin-top:4px;line-height:1.45}' +
            '.sikayet-modal-kapat{position:absolute;top:0;right:0;width:32px;height:32px;border:1px solid #f3f4f6;border-radius:50%;background:#fff;color:#6b7280;font-size:20px;line-height:1;cursor:pointer}' +
            'body.dark-mode .sikayet-modal-kapat{background:var(--bg-main);border-color:var(--border-color);color:var(--text-muted)}' +
            '.sikayet-etiket{display:block;font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px}' +
            '.sikayet-select,.sikayet-textarea{display:block;width:100%;padding:12px 14px;border:1.5px solid var(--border-color);border-radius:12px;background:var(--bg-main);color:var(--text-main);font-size:14px;font-weight:500;outline:none;margin-bottom:14px}' +
            '.sikayet-select{cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath fill=\'%236b7280\' d=\'M1 1l5 5 5-5\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px}' +
            '.sikayet-textarea{min-height:88px;resize:vertical}' +
            '.sikayet-modal-alt-satir{display:flex;gap:10px;justify-content:flex-end}' +
            '.sikayet-btn{padding:12px 18px;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;border:none}' +
            '.sikayet-btn--iptal{background:var(--bg-main);border:1px solid var(--border-color);color:var(--text-main)}' +
            '.sikayet-btn--gonder{background:#f4212e;color:#fff}';
        document.head.appendChild(s);
    }

    function ensureSikayetModal() {
        if (document.getElementById('sikayetModal')) return;
        var wrap = document.createElement('div');
        wrap.id = 'sikayetModal';
        wrap.className = 'sikayet-modal';
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'true');
        wrap.setAttribute('aria-labelledby', 'sikayetModalBaslik');
        wrap.setAttribute('aria-hidden', 'true');
        wrap.innerHTML =
            '<div class="sikayet-modal-panel">' +
            '<div class="sikayet-modal-ust">' +
            '<h2 class="sikayet-modal-baslik" id="sikayetModalBaslik">Şikayet Et</h2>' +
            '<p class="sikayet-modal-alt">Bu itirafı neden uygunsuz bulduğunu seç. Ekibimiz inceler.</p>' +
            '<button type="button" class="sikayet-modal-kapat" onclick="kapatSikayetModal()" aria-label="Kapat">×</button>' +
            '</div>' +
            '<label class="sikayet-etiket" for="sikayetSebep">Sebep</label>' +
            '<select class="sikayet-select" id="sikayetSebep">' +
            '<option value="">Seçiniz</option>' +
            '<option value="spam">Spam veya reklam</option>' +
            '<option value="taciz">Taciz veya nefret</option>' +
            '<option value="kisisel_veri">Kişisel veri / mahremiyet</option>' +
            '<option value="telif">Telif veya yasadışı içerik</option>' +
            '<option value="diger">Diğer</option>' +
            '</select>' +
            '<label class="sikayet-etiket" for="sikayetAciklama">Açıklama (isteğe bağlı)</label>' +
            '<textarea class="sikayet-textarea" id="sikayetAciklama" maxlength="500" placeholder="Kısaca anlat…"></textarea>' +
            '<div class="sikayet-modal-alt-satir">' +
            '<button type="button" class="sikayet-btn sikayet-btn--iptal" onclick="kapatSikayetModal()">İptal</button>' +
            '<button type="button" class="sikayet-btn sikayet-btn--gonder" id="sikayetGonderBtn" onclick="gonderSikayet()">Gönder</button>' +
            '</div></div>';
        document.body.appendChild(wrap);
        wrap.addEventListener('click', function (e) {
            if (e.target === wrap) kapatSikayetModal();
        });
    }

    function acSikayetModal(itirafId) {
        injectSikayetStyles();
        ensureSikayetModal();
        sikayetItirafId = String(itirafId);
        var sebep = document.getElementById('sikayetSebep');
        var aciklama = document.getElementById('sikayetAciklama');
        if (sebep) sebep.value = '';
        if (aciklama) aciklama.value = '';
        var modal = document.getElementById('sikayetModal');
        modal.classList.add('acik');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function kapatSikayetModal() {
        var modal = document.getElementById('sikayetModal');
        if (!modal) return;
        modal.classList.remove('acik');
        modal.setAttribute('aria-hidden', 'true');
        sikayetItirafId = null;
        var itirafAcik = document.getElementById('itirafModal') && document.getElementById('itirafModal').classList.contains('acik');
        var authAcik = document.getElementById('authOverlay') && document.getElementById('authOverlay').style.display === 'flex';
        if (!itirafAcik && !authAcik) {
            document.body.style.overflow = '';
        }
    }

    async function gonderSikayet() {
        if (!sikayetItirafId) return;
        var db = global.Gunde5DB;
        if (!db || !db.sikayetGonder) {
            showToast('Şikayet şu an gönderilemiyor.', 'hata');
            return;
        }
        if (!uyeMi()) {
            showToast('Şikayet etmek için giriş yapmalısın.', 'hata');
            if (typeof global.openAuthModal === 'function') {
                kapatSikayetModal();
                global.openAuthModal('login');
            }
            return;
        }
        var sebep = document.getElementById('sikayetSebep').value;
        var aciklama = document.getElementById('sikayetAciklama').value;
        var btn = document.getElementById('sikayetGonderBtn');
        if (btn) btn.disabled = true;
        try {
            await db.sikayetGonder(sikayetItirafId, sebep, aciklama);
            kapatSikayetModal();
            showToast('Şikayetin alındı, teşekkürler.');
        } catch (err) {
            showToast(db.hataMesaji ? db.hataMesaji(err) : String(err), 'hata');
        }
        if (btn) btn.disabled = false;
    }

    global.acSikayetModal = acSikayetModal;
    global.kapatSikayetModal = kapatSikayetModal;
    global.gonderSikayet = gonderSikayet;

    function renderKulisCard(row) {
        var cins = row.gender === 'male' ? 'male' : 'female';
        var avatar = cins === 'female' ? '\u2640' : '\u2642';
        var rumuz = row.username || 'Müdavim';
        var woxi = row.is_gizli ? 'GizliUye' : rumuz;
        var bol = metinBol(row.content_full || row.content_short || '');
        var kartId = String(row.id);
        var devamHtml = devamBtnHtml(bol.devam);
        var fullHtml = bol.devam
            ? '<span class="full-text">' + htmlEsc(row.content_full || '') + '</span>'
            : '';
        var cevapOzeti = cevapOzetBtnHtml(row.cevap_sayisi);
        var up = row.up_votes != null ? row.up_votes : 0;
        var down = row.down_votes != null ? row.down_votes : 0;

        var kart = document.createElement('div');
        kart.className = 'card ' + cins + (bol.devam ? ' uzun-metin' : '');
        kart.setAttribute('data-id', kartId);
        kart.setAttribute('data-status', 'kulis');
        kart.innerHTML =
            '<div class="card-header">' +
                '<div class="user-block">' +
                    '<div class="avatar">' + avatar + '</div>' +
                    '<div class="user-details">' +
                        '<span class="username">' + htmlEsc(rumuz) + '</span>' +
                        kullaniciMetaHtml(row) +
                    '</div>' +
                '</div>' +
                '<div class="card-header-actions">' +
                    '<a href="https://woxifly.com/mesaj/' + encodeURIComponent(woxi) + '" target="_blank" rel="noopener" class="woxifly-btn">\uD83D\uDCAC Woxifly DM</a>' +
                    cardMenuBtnHtml(kartId) +
                '</div>' +
            '</div>' +
            '<div class="card-body">' +
                '<span class="short-text">' + htmlEsc(bol.kisa) + '</span>' +
                fullHtml +
                devamHtml +
                cevapOzeti +
            '</div>' +
            '<div class="card-footer">' +
                '<div class="vote-group">' +
                    '<button type="button" class="vote-btn vote-btn--begeni" onclick="vote(\'' + kartId + '\', 1)">\uD83D\uDC4D Beğendim (<span class="up-num">' + up + '</span>)</button>' +
                    '<button type="button" class="vote-btn vote-btn--begenme" onclick="vote(\'' + kartId + '\', -1)">\uD83D\uDC4E Beğenmedim (<span class="down-num">' + down + '</span>)</button>' +
                    '<button type="button" class="vote-btn cevap-btn" data-cevap-yaz>\uD83D\uDCAC Cevap yaz</button>' +
                    paylasBtnHtml() +
                '</div>' +
            '</div>' +
            kartDetayShell();
        return kart;
    }

    var podyumRozet = ['\uD83D\uDC51 Bugünün En İyi 1. İtirafı', '\uD83E\uDD48 Bugünün En İyi 2. İtirafı', '\uD83E\uDD49 Bugünün En İyi 3. İtirafı', '\uD83D\uDD25 Bugünün En İyi 4. İtirafı', '\uD83D\uDD25 Bugünün En İyi 5. İtirafı'];

    function renderPodyumCard(row, sira) {
        var cins = row.gender === 'male' ? 'male' : 'female';
        var avatar = cins === 'female' ? '\u2640' : '\u2642';
        var rumuz = row.username || 'Müdavim';
        var woxi = row.is_gizli ? 'GizliUye' : rumuz;
        var bol = metinBol(row.content_full || row.content_short || '');
        var kartId = String(row.id);
        var rozet = podyumRozet[sira] || podyumRozet[4];
        var goruntulenme = row.up_votes != null ? (row.up_votes * 420 + 12000) : 12000;
        var devamHtml = devamBtnHtml(bol.devam);
        var fullHtml = bol.devam
            ? '<span class="full-text">' + htmlEsc(row.content_full || '') + '</span>'
            : '';
        var cevapOzeti = cevapOzetBtnHtml(row.cevap_sayisi);

        var kart = document.createElement('div');
        kart.className = 'card ' + cins + (bol.devam ? ' uzun-metin' : '');
        kart.setAttribute('data-id', kartId);
        kart.setAttribute('data-status', 'podyum');
        kart.innerHTML =
            '<div class="card-header">' +
                '<div class="user-block">' +
                    '<div class="avatar">' + avatar + '</div>' +
                    '<div class="user-details">' +
                        '<span class="username">' + htmlEsc(rumuz) + '</span>' +
                        kullaniciMetaHtml(row) +
                    '</div>' +
                '</div>' +
                '<div class="card-header-actions">' +
                    '<div class="view-counter">\uD83D\uDC41\uFE0F <span class="v-num">' + goruntulenme.toLocaleString('tr-TR') + '</span></div>' +
                    cardMenuBtnHtml(kartId) +
                '</div>' +
            '</div>' +
            '<div class="woxifly-row">' +
                '<a href="https://woxifly.com/mesaj/' + encodeURIComponent(woxi) + '" target="_blank" rel="noopener" class="woxifly-btn">\uD83D\uDCAC Woxifly DM</a>' +
            '</div>' +
            '<div class="card-body">' +
                '<span class="short-text">' + htmlEsc(bol.kisa) + '</span>' +
                fullHtml +
                devamHtml +
                cevapOzeti +
            '</div>' +
            '<div class="card-footer card-footer--podyum">' +
                '<span class="podyum-score">' + rozet + '</span>' +
                '<button type="button" class="vote-btn cevap-btn cevap-btn--podyum" data-cevap-yaz>\uD83D\uDCAC Cevap yaz</button>' +
                paylasBtnHtml() +
            '</div>' +
            kartDetayShell();
        return kart;
    }

    function uyeMi() {
        var db = global.Gunde5DB;
        if (!db || !db.getGunde5User) return false;
        var u = db.getGunde5User();
        return !!(u && u.username);
    }

    function gitProfilSayfasi() {
        if (uyeMi()) {
            window.location.href = 'profil.html';
            return;
        }
        showToast('Profil yalnızca giriş yapmış üyeler içindir.', 'hata');
        if (typeof global.openAuthModal === 'function') {
            global.openAuthModal('login');
            return;
        }
        window.location.href = 'kulis.html';
    }

    function itirafUyeGerekli(openAuthFn) {
        if (uyeMi()) return true;
        showToast('İtiraf yazmak için üye girişi gerekir.', 'hata');
        if (typeof openAuthFn === 'function') openAuthFn('register');
        return false;
    }

    var PODYUM_TR_SAAT = 13;
    var PODYUM_TR_DAKIKA = 12;
    var TR_TIMEZONE = 'Europe/Istanbul';

    function trZamanParcalari(tarih) {
        var map = {};
        new Intl.DateTimeFormat('en-US', {
            timeZone: TR_TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).formatToParts(tarih).forEach(function (part) {
            if (part.type !== 'literal') {
                map[part.type] = parseInt(part.value, 10);
            }
        });
        return map;
    }

    function trAnlikUtc(yil, ay, gun, saat, dk, sn) {
        var utc = Date.UTC(yil, ay - 1, gun, saat, dk, sn);
        var i;
        for (i = 0; i < 4; i++) {
            var p = trZamanParcalari(new Date(utc));
            utc += Date.UTC(yil, ay - 1, gun, saat, dk, sn) -
                Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
        }
        return utc;
    }

    /** Sonraki podyum anı: her gün 13:12 Türkiye saati (Europe/Istanbul). */
    function hedefSaatTr() {
        var simdi = Date.now();
        var p = trZamanParcalari(new Date(simdi));
        var hedef = trAnlikUtc(p.year, p.month, p.day, PODYUM_TR_SAAT, PODYUM_TR_DAKIKA, 0);
        if (hedef <= simdi) {
            var gece = trAnlikUtc(p.year, p.month, p.day, 23, 59, 0);
            var ertesi = trZamanParcalari(new Date(gece + 120000));
            hedef = trAnlikUtc(ertesi.year, ertesi.month, ertesi.day, PODYUM_TR_SAAT, PODYUM_TR_DAKIKA, 0);
        }
        return new Date(hedef);
    }

    function padSayi(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function baslatGeriSayim(elementId) {
        function guncelle() {
            var el = document.getElementById(elementId);
            if (!el) return;
            var fark = hedefSaatTr().getTime() - Date.now();
            if (fark < 0) fark = 0;
            var s = Math.floor(fark / 1000);
            var saat = Math.floor(s / 3600);
            var dk = Math.floor((s % 3600) / 60);
            var sn = s % 60;
            el.textContent = padSayi(saat) + ':' + padSayi(dk) + ':' + padSayi(sn);
        }
        guncelle();
        setInterval(guncelle, 1000);
    }

    function uygulaAvatarElement(el, u) {
        if (!el) return;
        var cins = u && u.gender === 'male' ? 'male' : 'female';
        var img = el.querySelector('img');
        if (u && u.avatarUrl) {
            if (!img) {
                el.textContent = '';
                img = document.createElement('img');
                img.alt = '';
                el.appendChild(img);
            }
            img.src = u.avatarUrl;
            el.classList.add('has-foto');
            return;
        }
        if (img) img.remove();
        el.classList.remove('has-foto');
        el.textContent = cins === 'male' ? '\u2642' : '\u2640';
    }

    global.Gunde5UI = {
        htmlEsc: htmlEsc,
        metinBol: metinBol,
        showToast: showToast,
        bosListe: bosListe,
        renderKulisCard: renderKulisCard,
        renderPodyumCard: renderPodyumCard,
        kullaniciMetaSatir: kullaniciMetaSatir,
        kullaniciMetaHtml: kullaniciMetaHtml,
        uyeMi: uyeMi,
        gitProfilSayfasi: gitProfilSayfasi,
        itirafUyeGerekli: itirafUyeGerekli,
        uygulaAvatarElement: uygulaAvatarElement,
        hedefSaatTr: hedefSaatTr,
        baslatGeriSayim: baslatGeriSayim,
        PODYUM_TR_SAAT: PODYUM_TR_SAAT,
        PODYUM_TR_DAKIKA: PODYUM_TR_DAKIKA
    };
})(window);
