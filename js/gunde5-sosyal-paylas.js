/* gunde5 — master: Bugünün 5'i sosyal medya paylaşım metni */
(function (global) {
    'use strict';

    var PAYLAS_SIRA_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
    var PAYLAS_SATIR_MAX = 28;
    var X_KARAKTER_LIMIT = 275;
    var MARKA_UST = "☕ Bugünün 5'i geldi.";
    var MARKA_ORTA = 'Her sabah 5 gerçek hikaye.';
    var MARKA_ALT = 'Kahveni al, 5 dakika ayır ☕';
    var MARKA_URL = 'gunde5.com';
    var MARKA_X = "Bizi X'ten takip edin @gunde5_com";
    var hazir = false;
    var sonSatirlar = [];
    var igFormat = 'kare';

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

    function arr(v) { return Array.isArray(v) ? v : []; }

    function fmtTarih(iso) {
        if (!iso) return '—';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return String(iso);
            return d.toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return String(iso);
        }
    }

    /** Europe/Istanbul takvim günü (YYYY-MM-DD) — anasayfa ile aynı. */
    function trYmd(isoOrDate) {
        var t = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
        if (!isoOrDate || isNaN(t.getTime())) return null;
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Istanbul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(t);
    }

    function slugHintGoster(hint) {
        return String(hint || '')
            .trim()
            .replace(/-/g, ' ')
            .replace(/\s+/g, ' ');
    }

    /** Kelime sınırında kısalt; sosyal listede … yok */
    function metinKisaltKelime(metin, max) {
        var b = String(metin || '').trim();
        if (!max || b.length <= max) return b;
        var kes = b.slice(0, max);
        var devam = b.charAt(max);
        if (!devam || devam === ' ' || /[.,!?;:]/.test(devam)) return kes.trim();
        var son = kes.lastIndexOf(' ');
        if (son > 10) kes = kes.slice(0, son);
        return kes.trim();
    }

    /** baslik → slug_hint → hikaye kancası → rumuz */
    function paylasBaslik(row, maxLen) {
        var limit = maxLen || PAYLAS_SATIR_MAX;
        var b = String(row && row.baslik || '').trim();
        if (b) return metinKisaltKelime(b, limit);

        var hint = slugHintGoster(row && row.slug_hint);
        if (hint) return metinKisaltKelime(hint, limit);

        var metin = String(row && (row.content_full || row.content_short) || '')
            .replace(/\s+/g, ' ')
            .trim();
        var kanca = metinKisaltKelime(metin, limit);
        if (kanca) return kanca;

        var u = String(row && row.username || '').trim();
        if (u) return metinKisaltKelime(u, limit);
        return 'Hikaye #' + (row && row.id);
    }

    function baslikZatenEmoji(baslik) {
        var ilk = String(baslik || '').trim().charAt(0);
        if (!ilk) return false;
        try {
            return /\p{Extended_Pictographic}/u.test(ilk);
        } catch (e) {
            var k = ilk.charCodeAt(0);
            return k >= 0x2600;
        }
    }

    /** Başlık içeriğine göre tek emoji (fazla süsleme yok). */
    function baslikEmoji(baslik) {
        if (baslikZatenEmoji(baslik)) return '';
        var t = String(baslik || '').toLowerCase();
        var kurallar = [
            [/aşk|sevgil|flört|aldat|kıskanç/, '❤️'],
            [/komik|gül|kahkaha|saçma/, '😄'],
            [/okul|sınav|üniversite|öğretmen|ders/, '📚'],
            [/iş|patron|mesai|maaş|ofis/, '💼'],
            [/aile|anne|baba|kardeş/, '🏠'],
            [/evlilik|düğün|nişan/, '💍'],
            [/yurtdış|yurt dış/, '✈️'],
            [/gece|rüya|uyku/, '🌙'],
            [/kahve|çay|latte|filtre/, '☕'],
            [/market|alışveriş|manav|kasiyer/, '🛒'],
            [/kavga|sinir|tartış/, '😤'],
            [/üzüc|ağla|hüzün/, '😢'],
            [/arkadaş|dost|kanka/, '🤝']
        ];
        var i;
        for (i = 0; i < kurallar.length; i++) {
            if (kurallar[i][0].test(t)) return kurallar[i][1] + ' ';
        }
        return '';
    }

    function baslikKisalt(baslik, max) {
        var b = String(baslik || '').trim();
        if (!max || b.length <= max) return b;
        return b.slice(0, max - 1).trim() + '…';
    }

    function listeSatiri(idx, row, maxBaslik) {
        var baslik = paylasBaslik(row, maxBaslik || PAYLAS_SATIR_MAX);
        var ek = baslikEmoji(baslik);
        return PAYLAS_SIRA_EMOJI[idx] + ' ' + ek + baslik;
    }

    function paylasMetniOlusturHam(rows, maxBaslik) {
        var liste = arr(rows);
        var lines = [MARKA_UST, ''];
        var i;
        for (i = 0; i < liste.length && i < 5; i++) {
            lines.push(listeSatiri(i, liste[i], maxBaslik));
        }
        if (!liste.length) {
            lines.push('1️⃣ — (bugünkü hikâye henüz yok)');
        }
        lines.push('');
        lines.push(MARKA_ORTA);
        lines.push(MARKA_ALT);
        lines.push('');
        lines.push(MARKA_URL);
        lines.push(MARKA_X);
        return lines.join('\n');
    }

    function paylasMetniOlustur(rows) {
        var metin = paylasMetniOlusturHam(rows, PAYLAS_SATIR_MAX);
        if (metin.length <= X_KARAKTER_LIMIT) return metin;
        var max = PAYLAS_SATIR_MAX - 2;
        while (max >= 14) {
            metin = paylasMetniOlusturHam(rows, max);
            if (metin.length <= X_KARAKTER_LIMIT) return metin;
            max -= 2;
        }
        return paylasMetniOlusturHam(rows, 14).slice(0, X_KARAKTER_LIMIT - 1) + '…';
    }

    function xKarakterGuncelle(metin) {
        var el = document.getElementById('spXKarSay');
        if (!el) return;
        var n = String(metin || '').length;
        el.textContent =
            n + ' / ' + X_KARAKTER_LIMIT + ' karakter' +
            (n > X_KARAKTER_LIMIT ? ' (limit aşıldı)' : '');
    }

    async function bugununBesHikayeleriGetir() {
        var D = db();
        if (D && D.indexBugunun5Getir) {
            return D.indexBugunun5Getir();
        }
        throw new Error('indexBugunun5Getir tanımlı değil');
    }

    function twitterIntentUrl(metin) {
        return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(String(metin || ''));
    }

    function igKartIcerikHtml(rows) {
        var liste = arr(rows);
        var html = '<div class="sp-ig-kart-govde">';
        html += '<div class="sp-ig-kart-ust">' + esc(MARKA_UST) + '</div>';
        html += '<ul class="sp-ig-kart-liste">';
        var i;
        for (i = 0; i < liste.length && i < 5; i++) {
            html += '<li>' + esc(listeSatiri(i, liste[i], PAYLAS_SATIR_MAX)) + '</li>';
        }
        if (!liste.length) {
            html += '<li class="sp-ig-kart-liste--bos">Henüz bugünkü hikâye yok</li>';
        }
        html += '</ul></div>';
        html += '<div class="sp-ig-kart-kapanis">';
        html += '<p class="sp-ig-kart-orta">' + esc(MARKA_ORTA) + '</p>';
        html += '<p class="sp-ig-kart-alt">' + esc(MARKA_ALT) + '</p>';
        html += '<p class="sp-ig-kart-marka">gunde<span>5</span>.com</p>';
        html += '<p class="sp-ig-kart-x">' + esc(MARKA_X) + '</p>';
        html += '</div>';
        return html;
    }

    function ensureIgHost() {
        var host = document.getElementById('spIgHost');
        if (host) return host;
        host = document.createElement('div');
        host.id = 'spIgHost';
        host.className = 'sp-ig-kart-host';
        host.setAttribute('aria-hidden', 'true');
        document.body.appendChild(host);
        return host;
    }

    function igKartSinifi() {
        return 'sp-ig-kart sp-ig-kart--' + (igFormat === 'hikaye' ? 'hikaye' : 'kare');
    }

    function igKartlariGuncelle(rows) {
        var host = ensureIgHost();
        host.innerHTML =
            '<div class="' + igKartSinifi() + '" id="spIgKartExport">' +
            igKartIcerikHtml(rows) +
            '</div>';
        var oniz = document.getElementById('spIgOnizlemeIcerik');
        if (oniz) {
            oniz.innerHTML =
                '<div class="' + igKartSinifi() + '" id="spIgKartOnizleme">' +
                igKartIcerikHtml(rows) +
                '</div>';
        }
        igOnizlemeBoyutUygula();
    }

    function igOnizlemeBoyutUygula() {
        var olcek = document.getElementById('spIgOnizlemeOlcek');
        var kart = document.getElementById('spIgKartOnizleme');
        if (!olcek || !kart) return;
        var kareMi = igFormat !== 'hikaye';
        olcek.className = 'sp-ig-onizleme-olcek sp-ig-onizleme-olcek--' + (kareMi ? 'kare' : 'hikaye');
        var scale = 280 / 1080;
        var yukseklik = Math.round((kareMi ? 1080 : 1920) * scale);
        olcek.style.height = yukseklik + 'px';
        kart.style.transform = 'scale(' + scale + ')';
        kart.style.transformOrigin = 'top left';
    }

    function igFormatSec(format) {
        igFormat = format === 'hikaye' ? 'hikaye' : 'kare';
        document.querySelectorAll('[data-sp-ig-format]').forEach(function (btn) {
            var aktif = btn.getAttribute('data-sp-ig-format') === igFormat;
            btn.classList.toggle('sp-sekme-btn--aktif', aktif);
            btn.setAttribute('aria-pressed', aktif ? 'true' : 'false');
        });
        igKartlariGuncelle(sonSatirlar);
    }

    function igExportBoyutlari() {
        var hikaye = igFormat === 'hikaye';
        return { w: 1080, h: hikaye ? 1920 : 1080 };
    }

    function canvasBosMu(canvas) {
        if (!canvas || !canvas.width) return true;
        try {
            var ctx = canvas.getContext('2d');
            var w = Math.min(48, canvas.width);
            var h = Math.min(48, canvas.height);
            var d = ctx.getImageData(0, 0, w, h).data;
            var i;
            var renkli = 0;
            for (i = 0; i < d.length; i += 4) {
                if (d[i] > 12 || d[i + 1] > 12 || d[i + 2] > 12) renkli += 1;
            }
            return renkli < 8;
        } catch (e) {
            return false;
        }
    }

    function igHostGeciciBoyali(fn) {
        var host = document.getElementById('spIgHost');
        if (!host) return fn();
        var onceki = host.style.cssText;
        host.style.cssText =
            'position:fixed;left:0;top:0;width:1080px;opacity:0.01;z-index:-1;pointer-events:none;visibility:visible;';
        void host.offsetHeight;
        return Promise.resolve(fn()).finally(function () {
            host.style.cssText = onceki;
        });
    }

    async function html2canvasIgKart(kart, boyut) {
        var secenek = {
            scale: 1,
            width: boyut.w,
            height: boyut.h,
            useCORS: true,
            backgroundColor: '#1d9bf0',
            logging: false,
            foreignObjectRendering: false
        };
        var host = document.getElementById('spIgHost');
        if (host) void host.offsetHeight;
        var canvas = await global.html2canvas(kart, secenek);
        if (!canvasBosMu(canvas)) return canvas;
        var yedek = null;
        await igHostGeciciBoyali(async function () {
            yedek = await global.html2canvas(kart, secenek);
        });
        return yedek || canvas;
    }

    async function igPngIndir() {
        var kart = document.getElementById('spIgKartExport');
        if (!kart) {
            if (ui() && ui().showToast) ui().showToast('Görsel henüz hazır değil', 'hata');
            return;
        }
        if (!global.html2canvas) {
            if (ui() && ui().showToast) ui().showToast('Görsel aracı yüklenemedi — sayfayı yenileyin', 'hata');
            return;
        }
        var dosya = igFormat === 'hikaye' ? 'gunde5-bugunun-5-hikaye-9x16.png' : 'gunde5-bugunun-5-kare.png';
        var boyut = igExportBoyutlari();
        var indirBtn = document.getElementById('spIgIndirBtn');
        if (indirBtn) indirBtn.disabled = true;
        try {
            var canvas = await html2canvasIgKart(kart, boyut);
            var url = canvas.toDataURL('image/png');
            var a = document.createElement('a');
            a.href = url;
            a.download = dosya;
            a.click();
            if (ui() && ui().showToast) ui().showToast('Instagram görseli indirildi');
        } catch (e) {
            if (ui() && ui().showToast) {
                ui().showToast('PNG oluşturulamadı: ' + (e && e.message ? e.message : String(e)), 'hata');
            }
        } finally {
            if (indirBtn) indirBtn.disabled = false;
        }
    }

    function yukleniyor(acik) {
        var el = document.getElementById('sosyalPaylasYukleniyor');
        if (el) el.hidden = !acik;
    }

    function yetkisizGoster(mesaj, girisGoster) {
        var y = document.getElementById('sosyalPaylasYetkisiz');
        var i = document.getElementById('sosyalPaylasIcerik');
        var a = document.getElementById('sosyalPaylasAraclar');
        var l = document.getElementById('sosyalPaylasYukleniyor');
        if (l) l.hidden = true;
        if (a) a.hidden = true;
        if (i) i.hidden = true;
        if (y) {
            y.hidden = false;
            var p = y.querySelector('.istat-yetkisiz-metin');
            if (p) p.textContent = mesaj || 'Bu sayfaya yalnızca site yöneticisi erişebilir.';
            var g = document.getElementById('sosyalPaylasGirisBtn');
            if (g) g.hidden = !girisGoster;
        }
    }

    function icerikGoster() {
        var y = document.getElementById('sosyalPaylasYetkisiz');
        var i = document.getElementById('sosyalPaylasIcerik');
        var a = document.getElementById('sosyalPaylasAraclar');
        if (y) y.hidden = true;
        if (a) a.hidden = false;
        if (i) i.hidden = false;
    }

    function render(rows, uyari, hata) {
        var kok = document.getElementById('sosyalPaylasIcerik');
        if (!kok) return;
        if (hata) {
            kok.innerHTML = '<p class="istat-hata">' + esc(hata) + '</p>';
            return;
        }
        var metin = paylasMetniOlustur(rows);
        var html = '';
        if (uyari) {
            html += '<p class="sp-uyari" role="status">' + esc(uyari) + '</p>';
        }
        html += '<div class="sp-grid">';
        html += '<section class="sp-kart">';
        html += '<h2 class="sp-kart-baslik">X — metin</h2>';
        html += '<p class="sp-bolum-etiket">Günlük ritüel duyurusu · Instagram görseliyle aynı dil</p>';
        html += '<textarea id="spPaylasMetin" class="sp-metin" rows="12" readonly spellcheck="false"></textarea>';
        html += '<p class="sp-x-kar" id="spXKarSay" aria-live="polite"></p>';
        html += '<div class="sp-aksiyonlar">';
        html += '<button type="button" class="istat-gun-btn sp-btn--birincil" id="spKopyalaBtn">Metni kopyala</button>';
        html += '<button type="button" class="istat-gun-btn" id="spTwitterBtn">X\'te paylaş</button>';
        html += '</div></section>';

        html += '<section class="sp-kart">';
        html += '<h2 class="sp-kart-baslik">Instagram — görsel</h2>';
        html += '<p class="sp-bolum-etiket">Önizleme · telefonda gönderi veya hikâyeye bu PNG\'yi yükleyin</p>';
        html += '<div class="sp-sekme" role="tablist" aria-label="Görsel biçimi">';
        html += '<button type="button" class="sp-sekme-btn sp-sekme-btn--aktif" data-sp-ig-format="kare" aria-pressed="true">Kare 1:1 (gönderi)</button>';
        html += '<button type="button" class="sp-sekme-btn" data-sp-ig-format="hikaye" aria-pressed="false">Dikey 9:16 (hikâye)</button>';
        html += '</div>';
        html += '<div class="sp-ig-onizleme-kutu"><div class="sp-ig-onizleme-olcek sp-ig-onizleme-olcek--kare" id="spIgOnizlemeOlcek">';
        html += '<div id="spIgOnizlemeIcerik"></div></div></div>';
        html += '<div class="sp-aksiyonlar">';
        html += '<button type="button" class="istat-gun-btn sp-btn--ig" id="spIgIndirBtn">PNG indir</button>';
        html += '<button type="button" class="istat-gun-btn" id="spIgMetinKopyalaBtn">Açıklama metnini kopyala</button>';
        html += '</div></section></div>';
        if (arr(rows).length) {
            html += '<section class="sp-kart"><h2 class="sp-kart-baslik">Bugünkü liste (yayın sırası)</h2>';
            html += '<ol class="sp-liste">';
            arr(rows).forEach(function (r, idx) {
                var b = paylasBaslik(r, PAYLAS_SATIR_MAX);
                html += '<li><span class="sp-sira">' + esc(PAYLAS_SIRA_EMOJI[idx] || '') + '</span> ';
                html += '<strong>' + esc(baslikEmoji(b) + b) + '</strong>';
                html += ' <span class="sp-saat">(' + esc(fmtTarih(r.created_at)) + ')</span></li>';
            });
            html += '</ol></section>';
        }
        kok.innerHTML = html;
        var alan = document.getElementById('spPaylasMetin');
        if (alan) alan.value = metin;
        xKarakterGuncelle(metin);
        sonSatirlar = arr(rows);
        igFormatSec(igFormat);
    }

    async function metinYenile() {
        yukleniyor(true);
        try {
            var rows = await bugununBesHikayeleriGetir();
            var uyari = '';
            if (!rows.length) {
                uyari = 'Bugün (İstanbul saati) için henüz yayında hikaye yok. Planlı yayınlar saati gelince burada görünür.';
            } else if (rows.length < 5) {
                uyari = 'Bugün için ' + rows.length + ' hikaye yayında (5 bekleniyor). Metin mevcut başlıklarla oluşturuldu.';
            }
            render(rows, uyari, '');
        } catch (e) {
            var D = db();
            render([], '', D && D.hataMesaji ? D.hataMesaji(e) : String(e));
        } finally {
            yukleniyor(false);
        }
    }

    async function kopyala() {
        var alan = document.getElementById('spPaylasMetin');
        var metin = alan ? alan.value : '';
        if (!metin) return;
        try {
            if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
                await global.navigator.clipboard.writeText(metin);
            } else if (alan) {
                alan.removeAttribute('readonly');
                alan.focus();
                alan.select();
                global.document.execCommand('copy');
                alan.setAttribute('readonly', 'readonly');
            }
            if (ui() && ui().showToast) ui().showToast('Paylaşım metni kopyalandı');
        } catch (e2) {
            if (ui() && ui().showToast) ui().showToast('Kopyalanamadı — metni seçip elle kopyalayın', 'hata');
        }
    }

    function xPaylas() {
        var alan = document.getElementById('spPaylasMetin');
        var metin = alan ? alan.value : '';
        if (!metin) return;
        global.open(twitterIntentUrl(metin), '_blank', 'noopener,noreferrer');
    }

    function olaylariBagla() {
        if (hazir) return;
        hazir = true;
        var yenile = document.getElementById('sosyalPaylasYenile');
        if (yenile) yenile.addEventListener('click', metinYenile);
        var giris = document.getElementById('sosyalPaylasGirisBtn');
        if (giris) {
            giris.addEventListener('click', function () {
                global.location.href = '/bulut';
            });
        }
        var kok = document.getElementById('sosyalPaylasIcerik');
        if (kok) {
            kok.addEventListener('click', function (e) {
                if (e.target.closest('#spKopyalaBtn')) kopyala();
                if (e.target.closest('#spTwitterBtn')) xPaylas();
                if (e.target.closest('#spIgIndirBtn')) igPngIndir();
                if (e.target.closest('#spIgMetinKopyalaBtn')) kopyala();
                var igSekme = e.target.closest('[data-sp-ig-format]');
                if (igSekme) igFormatSec(igSekme.getAttribute('data-sp-ig-format'));
            });
        }
    }

    async function init(yeniden) {
        var D = db();
        var U = ui();
        if (!D) return;
        if (!yeniden) {
            try { await D.init(); } catch (eInit) { /* */ }
        }
        if (U && U.guncelleHeaderOturum) U.guncelleHeaderOturum();
        if (global.Gunde5Master && global.Gunde5Master.durumYenile) {
            try { await global.Gunde5Master.durumYenile(); } catch (e2) { /* */ }
        }
        olaylariBagla();
        var oturum = D.getGunde5User && D.getGunde5User();
        if (!oturum || !oturum.id) {
            yetkisizGoster('Sosyal medya paylaşımı için site yöneticisi hesabıyla giriş yapın.', true);
            return;
        }
        var durum;
        try { durum = await D.masterDurum(); } catch (e3) { durum = { master: false }; }
        if (!durum || !durum.master) {
            yetkisizGoster('Bu sayfa yalnızca site yöneticisi (master) hesabı içindir.', false);
            return;
        }
        icerikGoster();
        await metinYenile();
    }

    global.Gunde5SosyalPaylas = { init: init, yenile: metinYenile };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
