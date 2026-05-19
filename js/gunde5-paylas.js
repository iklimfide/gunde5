/* gunde5 — itiraf paylaş linki + ?itiraf= derin bağlantı */
(function (global) {
    var UI = global.Gunde5UI;
    var DB = global.Gunde5DB;

    function injectPaylasStyles() {
        if (document.getElementById('gunde5-paylas-styles')) return;
        var s = document.createElement('style');
        s.id = 'gunde5-paylas-styles';
        s.textContent =
            '.card.card--paylas-hedef{animation:g5-paylas-vurgu 1.6s ease}' +
            '@keyframes g5-paylas-vurgu{0%,100%{box-shadow:none}35%{box-shadow:0 0 0 3px rgba(29,155,240,0.45)}}';
        document.head.appendChild(s);
    }

    function sayfaDosyasi(status) {
        return status === 'podyum' ? 'index.html' : 'kulis.html';
    }

    function kokUrl(path) {
        return new URL(path, global.location.origin).href;
    }

    function itirafPaylasUrl(id) {
        return kokUrl('/itiraf/' + encodeURIComponent(String(id)));
    }

    function yonlendirItiraf404(itirafId) {
        var hedef = kokUrl('/404.html');
        if (itirafId) hedef += '?itiraf=' + encodeURIComponent(itirafId);
        global.location.replace(hedef);
    }

    function paylasItirafFromCard(btn) {
        var card = btn && btn.closest ? btn.closest('.card') : null;
        if (!card) return;
        var id = card.getAttribute('data-id');
        var status = card.getAttribute('data-status') || 'kulis';
        if (!id) return;
        paylasItiraf(id);
    }

    async function paylasItiraf(id) {
        injectPaylasStyles();
        var url = itirafPaylasUrl(id);
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
        if (liste.firstChild && liste.firstChild.classList && liste.firstChild.classList.contains('liste-bos')) {
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
        return kart;
    }

    async function paylasLinkiKontrolEt(sayfa) {
        var params = new URLSearchParams(global.location.search);
        var id = params.get('itiraf');
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
            global.location.replace(itirafPaylasUrl(id));
            return false;
        }
        return true;
    }

    async function isleDerinBaglanti(sayfa) {
        if (!DB || !UI) return;
        injectPaylasStyles();

        var params = new URLSearchParams(global.location.search);
        var id = params.get('itiraf');
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
            global.location.replace(itirafPaylasUrl(id));
            return;
        }

        var listeId = sayfa === 'podyum' ? 'podyumListe' : 'kulisListe';
        await kartEkleVeyaBul(row, sayfa, listeId);
        setTimeout(function () {
            kartAcVeKaydir(id, false);
        }, 80);
    }

    global.paylasItiraf = paylasItiraf;
    global.paylasItirafFromCard = paylasItirafFromCard;
    global.Gunde5Paylas = {
        itirafPaylasUrl: itirafPaylasUrl,
        paylasItiraf: paylasItiraf,
        isleDerinBaglanti: isleDerinBaglanti,
        paylasLinkiKontrolEt: paylasLinkiKontrolEt,
        yonlendirItiraf404: yonlendirItiraf404
    };
})(window);
