/**
 * gunde5 — Kulis / Podyum: rumuz + hikaye + yorum arama (sayaç kutusunun altında)
 */
(function (global) {
    'use strict';

    var DB = global.Gunde5DB;
    var UI = global.Gunde5UI;
    var DEBOUNCE_MS = 320;
    var MIN_LEN = 2;

    var cfg = null;
    var timer = null;
    var sonSorgu = '';
    var aramaAktif = false;
    var istekNo = 0;

    function sayfaYapilandir() {
        var path = (global.location.pathname || '').toLowerCase();
        if (path.indexOf('kulis') >= 0) {
            return {
                status: 'kulis',
                listeId: 'kulisListe',
                render: function (row) { return UI.renderKulisCard(row); }
            };
        }
        if (path.indexOf('index') >= 0 || path === '/' || path.endsWith('/')) {
            return {
                status: 'podyum',
                listeId: 'podyumListe',
                render: function (row, i) {
                    return UI.renderPodyumCard(row, row.podyum_sira != null ? Math.max(0, parseInt(row.podyum_sira, 10) - 1) : i);
                }
            };
        }
        return null;
    }

    function injectStyles() {
        if (document.getElementById('gunde5-ara-styles')) return;
        var s = document.createElement('style');
        s.id = 'gunde5-ara-styles';
        s.textContent =
            '.gunde5-arama{margin-bottom:16px}' +
            '.gunde5-arama-kutu{position:relative;display:flex;align-items:center;gap:8px}' +
            '.gunde5-arama-input{flex:1;width:100%;padding:12px 40px 12px 14px;border:1px solid var(--border-color,#e5e7eb);border-radius:14px;font-size:15px;font-family:inherit;background:var(--bg-card,#fff);color:var(--text-main,#111);box-shadow:0 2px 8px rgba(0,0,0,.04)}' +
            '.gunde5-arama-input:focus{outline:none;border-color:#d97706;box-shadow:0 0 0 3px rgba(217,119,6,.2)}' +
            'body.dark-mode .gunde5-arama-input{background:var(--bg-card);border-color:var(--border-color);color:var(--text-main)}' +
            '.gunde5-arama-ikon{position:absolute;right:14px;font-size:18px;opacity:.55;pointer-events:none}' +
            '.gunde5-arama-durum{margin:8px 4px 0;font-size:12px;font-weight:600;color:var(--text-muted,#6b7280);min-height:18px}' +
            '.gunde5-arama-durum--hata{color:#dc2626}';
        document.head.appendChild(s);
    }

    function listeEl() {
        return cfg ? document.getElementById(cfg.listeId) : null;
    }

    function durumYaz(metin, hata) {
        var el = document.getElementById('gunde5AramaDurum');
        if (!el) return;
        el.textContent = metin || '';
        el.classList.toggle('gunde5-arama-durum--hata', !!hata);
    }

    function normalListeyiYukle() {
        aramaAktif = false;
        durumYaz('');
        if (!cfg || !DB) return;
        if (cfg.status === 'kulis') {
            if (global.Gunde5LazyListe && global.Gunde5LazyListe.initKulis) {
                global.Gunde5LazyListe.initKulis(cfg.listeId);
            } else if (DB.yukleKulisListe) {
                DB.yukleKulisListe(cfg.listeId);
            }
            return;
        }
        if (DB.podyumRealtimeKapat) DB.podyumRealtimeKapat();
        var samp = document.getElementById('podyumSampiyonlar');
        if (samp) samp.hidden = false;
        if (global.Gunde5PodyumLazy && global.Gunde5PodyumLazy.init) {
            global.Gunde5PodyumLazy.init(cfg.listeId);
        } else if (DB.yuklePodyumListe) {
            DB.yuklePodyumListe(cfg.listeId);
        }
    }

    function sonuclariCiz(rows) {
        var liste = listeEl();
        if (!liste || !cfg || !UI) return;
        aramaAktif = true;

        if (DB.podyumRealtimeKapat) DB.podyumRealtimeKapat();

        if (cfg.status === 'podyum') {
            var samp = document.getElementById('podyumSampiyonlar');
            if (samp) samp.hidden = false;
        }

        liste.innerHTML = '';
        var i;
        if (!rows.length) {
            liste.innerHTML = UI.bosListe('Eşleşen hikaye bulunamadı.');
            return;
        }
        for (i = 0; i < rows.length; i++) {
            var kart;
            try {
                kart = cfg.render(rows[i], i);
            } catch (eRender) {
                continue;
            }
            if (!kart) continue;
            liste.appendChild(kart);
            if (global.Gunde5KartCevap && global.Gunde5KartCevap.baglaKart) {
                global.Gunde5KartCevap.baglaKart(kart);
            } else if (global.Gunde5Goruntulenme && global.Gunde5Goruntulenme.bagla) {
                global.Gunde5Goruntulenme.bagla(kart);
            }
        }
        if (global.Gunde5KartCevap && global.Gunde5KartCevap.initSayfa) {
            global.Gunde5KartCevap.initSayfa();
        }
        if (cfg.status === 'podyum' && DB.podyumHibritCanlandir) {
            DB.podyumHibritCanlandir(liste, rows, true);
        }
        if (cfg.status === 'kulis' && UI.kulisBarajGuncelle) {
            UI.kulisBarajGuncelle(liste);
        }
        if (global.Gunde5Master && global.Gunde5Master.kartlariBagla) {
            global.Gunde5Master.kartlariBagla();
        }
    }

    function zamanAsimi(ms, etiket) {
        return new Promise(function (_, reject) {
            setTimeout(function () {
                reject(new Error(etiket || 'İstek zaman aşımı'));
            }, ms);
        });
    }

    async function araCalistir(q) {
        if (!DB || !DB.itirafAra || !cfg) return;
        var no = ++istekNo;
        durumYaz('Aranıyor…');
        try {
            var sonuc = await Promise.race([
                DB.itirafAra(q, cfg.status, 50),
                zamanAsimi(15000, 'Arama çok uzun sürdü')
            ]);
            if (no !== istekNo) return;

            var rows = sonuc.rows || [];
            var adet = sonuc.adet != null ? sonuc.adet : rows.length;
            var goster = sonuc.gosterilen != null ? sonuc.gosterilen : rows.length;

            if (!rows.length) {
                durumYaz(adet > 0 ? 'Sonuç listelenemedi' : 'Sonuç yok');
                sonuclariCiz([]);
                return;
            }
            if (adet > goster) {
                durumYaz(goster + ' sonuç (toplam ' + adet + ' eşleşme)');
            } else {
                durumYaz(adet + ' sonuç');
            }
            sonuclariCiz(rows);
        } catch (err) {
            if (no !== istekNo) return;
            var msg = DB.hataMesaji ? DB.hataMesaji(err) : String(err);
            durumYaz(msg, true);
            if (UI && UI.showToast) UI.showToast(msg, 'hata');
            var liste = listeEl();
            if (liste && aramaAktif) {
                liste.innerHTML = UI.bosListe(msg);
            }
        }
    }

    function girdiIsle(deger) {
        var q = String(deger || '').replace(/^\s+|\s+$/g, '');
        sonSorgu = q;
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        if (q.length < MIN_LEN) {
            istekNo += 1;
            if (aramaAktif) {
                normalListeyiYukle();
            } else {
                durumYaz(q.length ? 'En az 2 karakter yaz' : '');
            }
            return;
        }
        timer = setTimeout(function () {
            timer = null;
            araCalistir(q);
        }, DEBOUNCE_MS);
    }

    function mount() {
        injectStyles();
        var banner = document.querySelector('.info-banner');
        if (!banner || document.getElementById('gunde5AramaWrap')) return;

        var wrap = document.createElement('div');
        wrap.id = 'gunde5AramaWrap';
        wrap.className = 'gunde5-arama';
        wrap.innerHTML =
            '<label class="gunde5-arama-kutu" for="gunde5AramaInput">' +
            '<input type="search" class="gunde5-arama-input" id="gunde5AramaInput" ' +
            'placeholder="Ara" autocomplete="off" enterkeyhint="search">' +
            '<span class="gunde5-arama-ikon" aria-hidden="true">🔍</span>' +
            '</label>' +
            '<p class="gunde5-arama-durum" id="gunde5AramaDurum" aria-live="polite"></p>';

        banner.insertAdjacentElement('afterend', wrap);

        var inp = document.getElementById('gunde5AramaInput');
        if (inp) {
            inp.addEventListener('input', function () {
                girdiIsle(inp.value);
            });
            inp.addEventListener('search', function () {
                if (!inp.value) girdiIsle('');
            });
        }
    }

    function baslat() {
        cfg = sayfaYapilandir();
        if (!cfg || !DB) return;
        mount();
    }

    global.Gunde5Ara = {
        baslat: baslat,
        normalListeyiYukle: normalListeyiYukle,
        aramaAktifMi: function () { return aramaAktif; }
    };

    function hazir() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                setTimeout(baslat, 0);
            });
        } else {
            setTimeout(baslat, 0);
        }
    }

    hazir();
})(window);
