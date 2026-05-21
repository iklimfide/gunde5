/* gunde5 — Podyum: en yeni gün üstte (orijinal banner), aşağı kaydırınca eski günler */
(function (global) {
    var DB = global.Gunde5DB;
    var UI = global.Gunde5UI;
    var SENTINEL_ID = 'podyumLazySentinel';

    var state = {
        konteynerId: null,
        donemler: [],
        donemIndex: 0,
        yukleniyor: false,
        bitti: false,
        observer: null,
        tumKartlar: []
    };

    function injectStyles() {
        if (document.getElementById('gunde5-podyum-lazy-styles')) return;
        var s = document.createElement('style');
        s.id = 'gunde5-podyum-lazy-styles';
        s.textContent =
            '.podyum-gun-aralik{margin-top:20px}' +
            '.podyum-lazy-sentinel{padding:16px 8px 24px;text-align:center;min-height:40px}' +
            '.podyum-lazy-durum{margin:0;font-size:16px;font-weight:600;color:#92400e}' +
            '.podyum-lazy-durum--hata{color:#dc2626}' +
            'body.dark-mode .podyum-lazy-durum{color:#fbbf24}';
        document.head.appendChild(s);
    }

    function donemBannerKaynak(donem) {
        var s = String(donem || '').trim();
        var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) {
            return iso[3] + '/' + iso[2] + '/' + iso[1];
        }
        return s;
    }

    function donemBannerBaslik(donem) {
        if (DB && DB.podyumDonemAltSatir) {
            return DB.podyumDonemAltSatir(donemBannerKaynak(donem));
        }
        return donemBannerKaynak(donem);
    }

    function sentinelGuncelle(metin, hata) {
        var el = document.getElementById(SENTINEL_ID);
        if (!el) return;
        var p = el.querySelector('.podyum-lazy-durum');
        if (!p) {
            p = document.createElement('p');
            p.className = 'podyum-lazy-durum';
            el.appendChild(p);
        }
        p.textContent = metin || '';
        p.classList.toggle('podyum-lazy-durum--hata', !!hata);
        el.hidden = !metin;
    }

    function sentinelOlustur(liste) {
        var el = document.getElementById(SENTINEL_ID);
        if (el) return el;
        el = document.createElement('div');
        el.id = SENTINEL_ID;
        el.className = 'podyum-lazy-sentinel';
        el.setAttribute('aria-hidden', 'true');
        var p = document.createElement('p');
        p.className = 'podyum-lazy-durum';
        el.appendChild(p);
        liste.appendChild(el);
        return el;
    }

    function observerDurdur() {
        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
        }
    }

    function observerBaslat() {
        observerDurdur();
        var sentinel = document.getElementById(SENTINEL_ID);
        if (!sentinel || state.bitti) return;
        state.observer = new IntersectionObserver(
            function (entries) {
                var i;
                for (i = 0; i < entries.length; i++) {
                    if (entries[i].isIntersecting) {
                        sonrakiGun();
                        break;
                    }
                }
            },
            { root: null, rootMargin: '280px 0px', threshold: 0 }
        );
        state.observer.observe(sentinel);
    }

    /** Üst altın bant: TOP 5 + 20/05/2026 şampiyonları (orijinal) */
    function ustBannerGuncelle(donem) {
        var baslikEl = document.getElementById('podyumDonemBaslik');
        var topEl = document.getElementById('podyumTopEtiket');
        var sampiyonlarEl = document.getElementById('podyumSampiyonlar');
        if (topEl) topEl.textContent = 'TOP 5';
        if (baslikEl) baslikEl.textContent = donemBannerBaslik(donem);
        if (sampiyonlarEl) sampiyonlarEl.hidden = false;
    }

    /** Üst bölümle aynı altın bant (🏆 TOP 5 + dönem başlığı). */
    function donemBannerHeaderOlustur(donem) {
        var header = document.createElement('header');
        header.className = 'podyum-sampiyonlar-banner';
        var trophy = document.createElement('span');
        trophy.className = 'podyum-sampiyonlar-trophy';
        trophy.setAttribute('aria-hidden', 'true');
        trophy.textContent = '🏆';
        var metin = document.createElement('div');
        metin.className = 'podyum-sampiyonlar-metin';
        var etiket = document.createElement('p');
        etiket.className = 'podyum-sampiyonlar-etiket';
        etiket.textContent = 'TOP 5';
        var baslik = document.createElement('h2');
        baslik.className = 'podyum-sampiyonlar-baslik';
        baslik.textContent = donemBannerBaslik(donem);
        metin.appendChild(etiket);
        metin.appendChild(baslik);
        header.appendChild(trophy);
        header.appendChild(metin);
        return header;
    }

    function eskiGunKutuOlustur(donem) {
        var kutu = document.createElement('section');
        kutu.className = 'podyum-sampiyonlar';
        kutu.setAttribute('aria-label', donemBannerBaslik(donem));
        kutu.appendChild(donemBannerHeaderOlustur(donem));
        var liste = document.createElement('div');
        liste.className = 'podyum-sampiyonlar-liste';
        kutu.appendChild(liste);
        return { kutu: kutu, liste: liste };
    }

    function kartlariEkle(rows, donem, ilkGun) {
        var liste = document.getElementById(state.konteynerId);
        if (!liste || !rows || !rows.length) return;
        var sentinel = document.getElementById(SENTINEL_ID);
        var hedef = liste;
        var KC = global.Gunde5KartCevap;
        var i;

        if (!ilkGun) {
            var blok = document.createElement('div');
            blok.className = 'podyum-gun-aralik';
            blok.setAttribute('data-podyum-donem', donem);
            var gunKutu = eskiGunKutuOlustur(donem);
            blok.appendChild(gunKutu.kutu);
            if (sentinel) {
                liste.insertBefore(blok, sentinel);
            } else {
                liste.appendChild(blok);
            }
            hedef = gunKutu.liste;
        }

        for (i = 0; i < rows.length; i++) {
            var kart = UI.renderPodyumCard(rows[i]);
            state.tumKartlar.push(rows[i]);
            if (sentinel && ilkGun) {
                liste.insertBefore(kart, sentinel);
            } else {
                hedef.appendChild(kart);
            }
            if (KC && KC.baglaKart) {
                KC.baglaKart(kart);
            } else if (global.Gunde5Goruntulenme && global.Gunde5Goruntulenme.bagla) {
                global.Gunde5Goruntulenme.bagla(kart);
            }
        }
    }

    function realtimeYenile() {
        var liste = document.getElementById(state.konteynerId);
        if (!liste || !state.tumKartlar.length || !DB.podyumHibritCanlandir) return;
        DB.podyumHibritCanlandir(liste, state.tumKartlar, true);
    }

    async function sonrakiGun() {
        if (state.yukleniyor || state.bitti) return;
        if (state.donemIndex >= state.donemler.length) {
            state.bitti = true;
            sentinelGuncelle('');
            observerDurdur();
            return;
        }

        state.yukleniyor = true;
        sentinelGuncelle('Yükleniyor…');
        var donem = state.donemler[state.donemIndex];
        var ilkGun = state.donemIndex === 0;

        try {
            var rows = await DB.podyumDonemKartlari(donem);
            state.donemIndex += 1;
            if (state.donemIndex >= state.donemler.length) {
                state.bitti = true;
            }

            if (ilkGun && !rows.length) {
                var sampiyonlarEl = document.getElementById('podyumSampiyonlar');
                if (sampiyonlarEl) sampiyonlarEl.hidden = true;
                var liste = document.getElementById(state.konteynerId);
                if (liste) {
                    liste.innerHTML = UI.podyumBosMesajiHtml();
                }
                observerDurdur();
                return;
            }

            if (ilkGun) {
                ustBannerGuncelle(donem);
            }

            kartlariEkle(rows, donem, ilkGun);

            if (global.Gunde5KartCevap && global.Gunde5KartCevap.initSayfa) {
                global.Gunde5KartCevap.initSayfa();
            }
            realtimeYenile();

            if (state.bitti) {
                sentinelGuncelle('');
                observerDurdur();
            } else {
                sentinelGuncelle('Aşağı kaydır, daha fazla şampiyon yükle');
            }
        } catch (err) {
            sentinelGuncelle(DB.hataMesaji ? DB.hataMesaji(err) : 'Yüklenemedi', true);
            if (UI && UI.showToast) {
                UI.showToast(DB.hataMesaji ? DB.hataMesaji(err) : String(err), 'hata');
            }
        } finally {
            state.yukleniyor = false;
        }
    }

    async function init(konteynerId) {
        injectStyles();
        if (!DB || !DB.isConfigured || !DB.isConfigured()) {
            var el0 = document.getElementById(konteynerId);
            if (el0) {
                el0.innerHTML = UI.bosListe('Supabase bağlantısı kurulmadı. js/gunde5-config.js dosyasını doldurun.');
            }
            return;
        }
        if (DB.podyumRealtimeKapat) DB.podyumRealtimeKapat();

        observerDurdur();
        state.konteynerId = konteynerId;
        state.donemIndex = 0;
        state.yukleniyor = false;
        state.bitti = false;
        state.tumKartlar = [];
        state.donemler = [];

        var el = document.getElementById(konteynerId);
        if (!el) return;
        el.innerHTML = '<p class="liste-bos">Yükleniyor…</p>';

        try {
            state.donemler = await DB.podyumDonemleriListele();
        } catch (err) {
            el.innerHTML = UI.bosListe(DB.hataMesaji ? DB.hataMesaji(err) : 'Podyum yüklenemedi.');
            return;
        }

        if (!state.donemler.length) {
            var sampiyonlarEl = document.getElementById('podyumSampiyonlar');
            if (sampiyonlarEl) sampiyonlarEl.hidden = true;
            el.innerHTML = UI.podyumBosMesajiHtml();
            return;
        }

        el.innerHTML = '';
        sentinelOlustur(el);
        await sonrakiGun();
        if (!state.bitti) {
            observerBaslat();
        }
    }

    global.Gunde5PodyumLazy = {
        init: init
    };
})(window);
