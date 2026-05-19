/* gunde5 — Kulis itiraf listesi: sayfa sayfa lazy load (IntersectionObserver) */
(function (global) {
    var DB = global.Gunde5DB;
    var UI = global.Gunde5UI;
    var SENTINEL_ID = 'kulisLazySentinel';

    var state = {
        konteynerId: null,
        offset: 0,
        yukleniyor: false,
        bitti: false,
        observer: null
    };

    function injectStyles() {
        if (document.getElementById('gunde5-lazy-liste-styles')) return;
        var s = document.createElement('style');
        s.id = 'gunde5-lazy-liste-styles';
        s.textContent =
            '.lazy-sentinel{padding:20px 16px 32px;text-align:center;min-height:48px}' +
            '.lazy-durum{margin:0;font-size:13px;font-weight:600;color:var(--text-muted)}' +
            '.lazy-durum--hata{color:#dc2626}';
        document.head.appendChild(s);
    }

    function sentinelGuncelle(metin, hata) {
        var el = document.getElementById(SENTINEL_ID);
        if (!el) return;
        var p = el.querySelector('.lazy-durum');
        if (!p) {
            p = document.createElement('p');
            p.className = 'lazy-durum';
            el.appendChild(p);
        }
        p.textContent = metin || '';
        p.classList.toggle('lazy-durum--hata', !!hata);
        el.hidden = !metin;
    }

    function sentinelOlustur() {
        var el = document.getElementById(SENTINEL_ID);
        if (el) return el;
        el = document.createElement('div');
        el.id = SENTINEL_ID;
        el.className = 'lazy-sentinel';
        el.setAttribute('aria-hidden', 'true');
        var p = document.createElement('p');
        p.className = 'lazy-durum';
        el.appendChild(p);
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
                        sonrakiSayfa();
                        break;
                    }
                }
            },
            { root: null, rootMargin: '240px 0px', threshold: 0 }
        );
        state.observer.observe(sentinel);
    }

    function kartlariEkle(rows) {
        var el = document.getElementById(state.konteynerId);
        if (!el || !rows || !rows.length) return;
        var sentinel = document.getElementById(SENTINEL_ID);
        var KC = global.Gunde5KartCevap;
        var i;
        for (i = 0; i < rows.length; i++) {
            var kart = UI.renderKulisCard(rows[i]);
            if (sentinel) {
                el.insertBefore(kart, sentinel);
            } else {
                el.appendChild(kart);
            }
            if (KC && KC.baglaKart) {
                KC.baglaKart(kart);
            }
        }
        if (KC && KC.initSayfa && !KC.baglaKart) {
            KC.initSayfa();
        }
    }

    async function sonrakiSayfa() {
        if (state.yukleniyor || state.bitti || !DB || !DB.kulisSayfaHazirla) return;
        state.yukleniyor = true;
        sentinelGuncelle('Yükleniyor…');
        try {
            var boyut = DB.KULIS_SAYFA_BOYUT || 12;
            var ilkSayfa = state.offset === 0;
            var rows = await DB.kulisSayfaHazirla(state.offset, boyut);
            state.offset += rows.length;
            if (rows.length < boyut) {
                state.bitti = true;
            }
            if (ilkSayfa && !rows.length) {
                var bosEl = document.getElementById(state.konteynerId);
                if (bosEl) {
                    bosEl.innerHTML = UI.bosListe('Kulis şu an boş. İlk itirafı sen yaz!');
                }
                observerDurdur();
                return;
            }
            if (ilkSayfa) {
                var temiz = document.getElementById(state.konteynerId);
                if (temiz) temiz.innerHTML = '';
            }
            kartlariEkle(rows);
            state.ilkSayfaYuklendi = true;
            if (state.bitti) {
                sentinelGuncelle('');
                observerDurdur();
            } else {
                sentinelGuncelle('Aşağı kaydır, daha fazla itiraf yükle');
            }
        } catch (err) {
            if (state.offset === 0) {
                var hataEl = document.getElementById(state.konteynerId);
                if (hataEl) {
                    hataEl.innerHTML = UI.bosListe(DB.hataMesaji ? DB.hataMesaji(err) : 'İtiraflar yüklenemedi.');
                }
            }
            sentinelGuncelle(DB.hataMesaji ? DB.hataMesaji(err) : 'Yüklenemedi', true);
            if (UI && UI.showToast) {
                UI.showToast(DB.hataMesaji ? DB.hataMesaji(err) : String(err), 'hata');
            }
        } finally {
            state.yukleniyor = false;
        }
    }

    async function initKulis(konteynerId) {
        injectStyles();
        if (!DB || !DB.isConfigured || !DB.isConfigured()) {
            var el0 = document.getElementById(konteynerId);
            if (el0) {
                el0.innerHTML = UI.bosListe('Supabase bağlantısı kurulmadı. js/gunde5-config.js dosyasını doldurun.');
            }
            return;
        }

        observerDurdur();
        state.konteynerId = konteynerId;
        state.offset = 0;
        state.yukleniyor = false;
        state.bitti = false;
        state.ilkSayfaYuklendi = false;

        var el = document.getElementById(konteynerId);
        if (!el) return;
        el.innerHTML = '<p class="liste-bos">Yükleniyor…</p>';

        await sonrakiSayfa();

        var liste = document.getElementById(konteynerId);
        if (!liste || !state.ilkSayfaYuklendi) return;

        var sentinel = sentinelOlustur();
        if (!document.getElementById(SENTINEL_ID)) {
            liste.appendChild(sentinel);
        }
        sentinelGuncelle(state.bitti ? '' : 'Aşağı kaydır, daha fazla itiraf yükle');
        observerBaslat();
    }

    global.Gunde5LazyListe = {
        initKulis: initKulis,
        sonrakiSayfa: sonrakiSayfa
    };
})(window);
