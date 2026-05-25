/* gunde5 — hikaye iç linki: /?itiraf=id (podyum) veya /kulis?itiraf=id (kulis) */
(function (global) {
    'use strict';

    var UI = global.Gunde5UI;
    var DB = global.Gunde5DB;
    var HEDEF_ITIRAF_ANAHTAR = 'gunde5_hedef_itiraf';

    function injectPaylasStyles() {
        if (document.getElementById('gunde5-paylas-styles')) return;
        var s = document.createElement('style');
        s.id = 'gunde5-paylas-styles';
        s.textContent =
            '.card.card--paylas-hedef{animation:g5-paylas-vurgu 1.6s ease}' +
            '@keyframes g5-paylas-vurgu{0%,100%{box-shadow:none}35%{box-shadow:0 0 0 3px rgba(29,155,240,0.45)}}';
        document.head.appendChild(s);
    }

    function kokUrl(path) {
        if (/^https?:\/\//i.test(path)) return path;
        if (global.location.protocol === 'file:') {
            var base = global.location.href.split('?')[0].split('#')[0];
            base = base.slice(0, base.lastIndexOf('/') + 1);
            return new URL(path, base).href;
        }
        return new URL(path, global.location.origin).href;
    }

    function itirafHedefIdKaydet(id) {
        try {
            global.sessionStorage.setItem(HEDEF_ITIRAF_ANAHTAR, String(id));
        } catch (e) { /* sessiz */ }
    }

    /** URL ?itiraf= veya bildirimden sessionStorage */
    function itirafHedefIdOku() {
        var p = new URLSearchParams(global.location.search);
        var q = p.get('itiraf');
        if (q && /^\d+$/.test(q)) {
            return q;
        }
        try {
            var s = global.sessionStorage.getItem(HEDEF_ITIRAF_ANAHTAR);
            if (s && /^\d+$/.test(s)) {
                global.sessionStorage.removeItem(HEDEF_ITIRAF_ANAHTAR);
                return s;
            }
        } catch (e) { /* sessiz */ }
        return null;
    }

    /** Site içi yol — http(s): kökten; file://: göreli (Live Server / dosyadan açılış) */
    function itirafIcLink(id, status) {
        var sid = encodeURIComponent(String(id));
        var dosya = global.location.protocol === 'file:';
        if (status === 'podyum') {
            return (dosya ? '' : '/') + '?itiraf=' + sid;
        }
        return (dosya ? '' : '/') + 'kulis?itiraf=' + sid;
    }

    function itirafIcLinkTam(id, status) {
        return kokUrl(itirafIcLink(id, status));
    }

    function itirafPaylasUrl(id, status) {
        return itirafIcLinkTam(id, status || 'kulis');
    }

    function itirafSayfayaGit(id, status) {
        var st = status === 'podyum' ? 'podyum' : 'kulis';
        itirafHedefIdKaydet(id);
        global.location.href = itirafIcLinkTam(id, st);
    }

    function yonlendirItiraf404(itirafId) {
        var hedef = kokUrl('/404');
        if (itirafId) {
            hedef += '?itiraf=' + encodeURIComponent(itirafId);
        }
        global.location.replace(hedef);
    }

    function paylasItirafFromCard(btn) {
        var card = btn && btn.closest ? btn.closest('.card') : null;
        if (!card) return;
        var id = card.getAttribute('data-id');
        var status = card.getAttribute('data-status') || 'kulis';
        if (!id) return;
        paylasItiraf(id, status);
    }

    async function paylasItiraf(id, status) {
        injectPaylasStyles();
        var url = itirafPaylasUrl(id, status);
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
                if (UI) UI.showToast('Link kopyalandı!');
                return;
            }
        } catch (e) { /* fallback */ }
        if (UI) {
            UI.showToast('Kopyalanamadı — link: ' + url);
        }
    }

    function kartAcVeKaydir(cardId, focusCevap) {
        var card = document.querySelector('.card[data-id="' + cardId + '"]');
        if (!card) return;
        card.classList.add('card--paylas-hedef');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (global.Gunde5KartCevap) {
            global.Gunde5KartCevap.toggle(cardId, !!focusCevap);
        } else if (typeof global.expandCard === 'function') {
            global.expandCard(cardId);
        }
    }

    async function kartEkleVeyaBul(row, sayfa, listeId) {
        var id = String(row.id);
        var mevcut = document.querySelector('.card[data-id="' + id + '"]');
        if (mevcut) return mevcut;

        var liste = document.getElementById(listeId);
        if (!liste || !UI) return null;

        var sayilar = await DB.kokCevapSayilari([row.id]);
        row.cevap_sayisi = sayilar[String(row.id)] != null ? sayilar[String(row.id)] : 0;

        var kart = sayfa === 'podyum' ? UI.renderPodyumCard(row, 4) : UI.renderKulisCard(row);
        kart.classList.add('card--paylas-hedef');
        if (sayfa === 'kulis') {
            var giyotin = document.getElementById('kulisGiyotinBaraj');
            if (giyotin) giyotin.remove();
        } else if (
            liste.firstChild &&
            liste.firstChild.classList &&
            liste.firstChild.classList.contains('liste-bos')
        ) {
            liste.innerHTML = '';
        }
        var ilk = liste.firstChild;
        if (ilk && ilk.id === 'kulisLazySentinel') {
            liste.insertBefore(kart, ilk);
        } else {
            liste.insertBefore(kart, liste.firstChild);
        }
        if (global.Gunde5KartCevap && global.Gunde5KartCevap.baglaKart) {
            global.Gunde5KartCevap.baglaKart(kart);
        } else if (global.Gunde5KartCevap) {
            global.Gunde5KartCevap.initSayfa();
        }
        if (sayfa === 'kulis' && UI.kulisBarajGuncelle) {
            UI.kulisBarajGuncelle(liste);
        }
        return kart;
    }

    async function paylasLinkiKontrolEt(sayfa) {
        var id = itirafHedefIdOku();
        if (!id || !DB) return true;

        var row;
        try {
            row = await DB.itirafGetir(id);
        } catch (err) {
            yonlendirItiraf404(id);
            return false;
        }
        if (!row) {
            yonlendirItiraf404(id);
            return false;
        }

        var hedefSayfa = row.status === 'podyum' ? 'podyum' : 'kulis';
        if (hedefSayfa !== sayfa) {
            global.location.replace(itirafIcLinkTam(id, row.status));
            return false;
        }
        return true;
    }

    async function isleDerinBaglanti(sayfa) {
        if (!DB || !UI) return;
        injectPaylasStyles();

        var id = itirafHedefIdOku();
        if (!id) return;

        var row;
        try {
            row = await DB.itirafGetir(id);
        } catch (err) {
            yonlendirItiraf404(id);
            return;
        }
        if (!row) {
            yonlendirItiraf404(id);
            return;
        }

        var hedefSayfa = row.status === 'podyum' ? 'podyum' : 'kulis';
        if (hedefSayfa !== sayfa) {
            global.location.replace(itirafIcLinkTam(id, row.status));
            return;
        }

        var listeId = sayfa === 'podyum' ? 'podyumListe' : 'kulisListe';
        await kartEkleVeyaBul(row, sayfa, listeId);
        if (global.Gunde5SEO && Gunde5SEO.itirafUygula) {
            Gunde5SEO.itirafUygula(row, sayfa);
        }

        setTimeout(function () {
            kartAcVeKaydir(id, false);
        }, 80);
    }

    global.paylasItiraf = paylasItiraf;
    global.paylasItirafFromCard = paylasItirafFromCard;
    global.Gunde5Paylas = {
        itirafIcLink: itirafIcLink,
        itirafIcLinkTam: itirafIcLinkTam,
        itirafPaylasUrl: itirafPaylasUrl,
        itirafSayfayaGit: itirafSayfayaGit,
        itirafHedefIdOku: itirafHedefIdOku,
        paylasItiraf: paylasItiraf,
        isleDerinBaglanti: isleDerinBaglanti,
        paylasLinkiKontrolEt: paylasLinkiKontrolEt,
        yonlendirItiraf404: yonlendirItiraf404
    };
})(window);
