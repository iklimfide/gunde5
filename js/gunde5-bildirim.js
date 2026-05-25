/**
 * gunde5 — üst bar bildirim çanı (beğeni + yorum)
 */
(function (global) {
    'use strict';

    var rtKanal = null;
    var panelAcik = false;
    var sonListe = [];

    function db() {
        return global.Gunde5DB;
    }

    function ui() {
        return global.Gunde5UI;
    }

    function esc(s) {
        if (ui() && ui().htmlEsc) return ui().htmlEsc(s);
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function injectStyles() {
        if (document.getElementById('gunde5-bildirim-styles')) return;
        var s = document.createElement('style');
        s.id = 'gunde5-bildirim-styles';
        s.textContent =
            '.header-bildirim-wrap{position:relative;flex-shrink:0;display:none}' +
            '.header-bildirim-wrap.aktif{display:flex}' +
            '.header-bildirim-btn{position:relative;width:38px;height:38px;border:1px solid rgba(255,255,255,.45);background:rgba(255,255,255,.18);border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;font-size:18px;line-height:1}' +
            '.header-bildirim-btn:hover{background:rgba(255,255,255,.28)}' +
            '.header-bildirim-badge{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#ef4444;color:#fff;font-size:10px;font-weight:800;line-height:16px;text-align:center;display:none}' +
            '.header-bildirim-badge.goster{display:block}' +
            '.header-bildirim-panel{position:absolute;top:calc(100% + 8px);right:0;width:min(320px,calc(100vw - 24px));max-height:min(420px,70vh);background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.18);z-index:230;display:flex;flex-direction:column;overflow:hidden}' +
            'body.dark-mode .header-bildirim-panel{background:var(--bg-card);border-color:var(--border-color)}' +
            '.header-bildirim-panel[hidden]{display:none!important}' +
            '.header-bildirim-baslik{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:800}' +
            'body.dark-mode .header-bildirim-baslik{border-color:var(--border-color)}' +
            '.header-bildirim-tumunu{color:#1d9bf0;background:none;border:none;font-size:11px;font-weight:700;cursor:pointer;padding:4px 6px;border-radius:8px}' +
            '.header-bildirim-liste{overflow-y:auto;padding:6px}' +
            '.header-bildirim-oge{display:block;width:100%;text-align:left;padding:10px 10px;border:none;border-radius:10px;background:transparent;cursor:pointer;font-family:inherit;text-decoration:none;color:inherit}' +
            '.header-bildirim-oge:hover{background:#f3f4f6}' +
            'body.dark-mode .header-bildirim-oge:hover{background:#2f3336}' +
            '.header-bildirim-oge.okunmadi{background:#eff6ff}' +
            'body.dark-mode .header-bildirim-oge.okunmadi{background:rgba(29,155,240,.12)}' +
            '.header-bildirim-oge-metin{font-size:13px;font-weight:600;line-height:1.35;color:#111827}' +
            'body.dark-mode .header-bildirim-oge-metin{color:var(--text-main)}' +
            '.header-bildirim-oge-zaman{font-size:11px;color:#6b7280;margin-top:4px}' +
            'body.dark-mode .header-bildirim-oge-zaman{color:var(--text-muted)}' +
            '.header-bildirim-bos{padding:20px 12px;text-align:center;font-size:13px;color:#6b7280}';
        document.head.appendChild(s);
    }

    function zamanMetni(iso) {
        if (!iso) return '';
        var t = new Date(iso).getTime();
        if (!isFinite(t)) return '';
        var fark = Math.max(0, Date.now() - t);
        var dk = Math.floor(fark / 60000);
        if (dk < 1) return 'Az önce';
        if (dk < 60) return dk + ' dk önce';
        var sa = Math.floor(dk / 60);
        if (sa < 24) return sa + ' sa önce';
        var gun = Math.floor(sa / 24);
        if (gun < 7) return gun + ' gün önce';
        try {
            return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
        } catch (e) {
            return '';
        }
    }

    function metinSatir(b) {
        var ad = esc(b.yapan_username || 'Biri');
        if (b.tip === 'begeni') {
            return ad + ' hikayeni beğendi';
        }
        return ad + ' hikayene yorum yaptı';
    }

    function badgeGuncelle(sayi) {
        var badge = document.getElementById('headerBildirimBadge');
        if (!badge) return;
        var n = parseInt(sayi, 10) || 0;
        if (n < 1) {
            badge.classList.remove('goster');
            badge.textContent = '';
            return;
        }
        badge.classList.add('goster');
        badge.textContent = n > 99 ? '99+' : String(n);
    }

    function listeCiz(liste) {
        var el = document.getElementById('headerBildirimListe');
        if (!el) return;
        sonListe = liste || [];
        if (!sonListe.length) {
            el.innerHTML = '<div class="header-bildirim-bos">Henüz bildirim yok.</div>';
            return;
        }
        el.innerHTML = sonListe.map(function (b) {
            var cls = 'header-bildirim-oge' + (b.okundu ? '' : ' okunmadi');
            return (
                '<button type="button" class="' + cls + '" data-bid="' + esc(b.id) + '"' +
                ' data-iid="' + esc(b.itiraf_id) + '" data-istatus="' + esc(b.itiraf_status || '') + '">' +
                '<div class="header-bildirim-oge-metin">' + (b.tip === 'begeni' ? '👍 ' : '💬 ') + metinSatir(b) + '</div>' +
                '<div class="header-bildirim-oge-zaman">' + esc(zamanMetni(b.created_at)) + '</div>' +
                '</button>'
            );
        }).join('');
    }

    async function yenile() {
        var D = db();
        if (!D || !D.bildirimleriListele) return;
        try {
            var okunmamis = await D.bildirimOkunmamisSayisi();
            badgeGuncelle(okunmamis);
            if (panelAcik) {
                var liste = await D.bildirimleriListele(40);
                listeCiz(liste);
            }
        } catch (e) {
            /* sessiz */
        }
    }

    function panelKapat() {
        panelAcik = false;
        var panel = document.getElementById('headerBildirimPanel');
        if (panel) panel.hidden = true;
        var btn = document.getElementById('headerBildirimBtn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    function panelAc() {
        panelAcik = true;
        var panel = document.getElementById('headerBildirimPanel');
        var btn = document.getElementById('headerBildirimBtn');
        if (panel) panel.hidden = false;
        if (btn) btn.setAttribute('aria-expanded', 'true');
        if (ui() && ui().closeProfilMenu) ui().closeProfilMenu();
        if (ui() && ui().closeHeaderMenu) ui().closeHeaderMenu();
        yenile();
    }

    function panelToggle(ev) {
        if (ev) ev.stopPropagation();
        if (panelAcik) panelKapat();
        else panelAc();
    }

    async function ogeTikla(btn) {
        var bid = btn.getAttribute('data-bid');
        var iid = btn.getAttribute('data-iid');
        var status = btn.getAttribute('data-istatus') || '';
        var D = db();
        var Paylas = global.Gunde5Paylas;
        panelKapat();

        if (bid && D && D.bildirimOkunduIsaretle) {
            D.bildirimOkunduIsaretle(parseInt(bid, 10)).catch(function () { /* */ });
        }

        if (!iid) return;

        if (!status && D && D.itirafGetir) {
            try {
                var row = await D.itirafGetir(iid);
                if (row && row.status) status = row.status;
            } catch (e) { /* */ }
        }

        if (Paylas && Paylas.itirafSayfayaGit) {
            Paylas.itirafSayfayaGit(iid, status || 'kulis');
            return;
        }

        var sid = encodeURIComponent(String(iid));
        global.location.href = (status === 'podyum' ? '/?itiraf=' : '/kulis?itiraf=') + sid;
    }

    async function tumunuOkundu() {
        var D = db();
        if (!D || !D.bildirimTumunuOkundu) return;
        try {
            await D.bildirimTumunuOkundu();
            await yenile();
        } catch (e) {
            if (ui() && ui().showToast) ui().showToast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        }
    }

    function mount() {
        injectStyles();
        var sag = document.querySelector('.header-sag');
        if (!sag || document.getElementById('headerBildirimWrap')) return;

        var wrap = document.createElement('div');
        wrap.className = 'header-bildirim-wrap';
        wrap.id = 'headerBildirimWrap';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'header-bildirim-btn';
        btn.id = 'headerBildirimBtn';
        btn.setAttribute('aria-label', 'Bildirimler');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', 'headerBildirimPanel');
        btn.innerHTML = '🔔<span class="header-bildirim-badge" id="headerBildirimBadge"></span>';
        btn.addEventListener('click', panelToggle);

        var panel = document.createElement('div');
        panel.className = 'header-bildirim-panel';
        panel.id = 'headerBildirimPanel';
        panel.hidden = true;
        panel.innerHTML =
            '<div class="header-bildirim-baslik">' +
            '<span>Bildirimler</span>' +
            '<button type="button" class="header-bildirim-tumunu" id="headerBildirimTumunu">Tümünü okundu say</button>' +
            '</div>' +
            '<div class="header-bildirim-liste" id="headerBildirimListe"></div>';

        wrap.appendChild(btn);
        wrap.appendChild(panel);

        var profil = document.getElementById('headerProfilWrap') || document.getElementById('headerProfilLink');
        if (profil && profil.parentNode === sag) {
            sag.insertBefore(wrap, profil);
        } else {
            sag.appendChild(wrap);
        }

        var tumu = document.getElementById('headerBildirimTumunu');
        if (tumu) tumu.addEventListener('click', function (e) {
            e.stopPropagation();
            tumunuOkundu();
        });

        var liste = document.getElementById('headerBildirimListe');
        if (liste) {
            liste.addEventListener('click', function (e) {
                var b = e.target.closest('button[data-iid]');
                if (b) ogeTikla(b);
            });
        }

        document.addEventListener('click', function (e) {
            if (!panelAcik) return;
            if (wrap.contains(e.target)) return;
            panelKapat();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') panelKapat();
        });
    }

    function gorunurluk(ac) {
        var wrap = document.getElementById('headerBildirimWrap');
        if (!wrap) return;
        if (ac) wrap.classList.add('aktif');
        else {
            wrap.classList.remove('aktif');
            panelKapat();
            badgeGuncelle(0);
        }
    }

    function abonelikKapat() {
        if (rtKanal) {
            try {
                var sb = db() && db().getSupabaseClient ? db().getSupabaseClient() : null;
                if (sb) sb.removeChannel(rtKanal);
            } catch (e) { /* */ }
            rtKanal = null;
        }
    }

    function abonelikAc(userId) {
        abonelikKapat();
        var D = db();
        if (!D || !D.bildirimAboneligiBaslat || !userId) return;
        rtKanal = D.bildirimAboneligiBaslat(userId, function () {
            yenile();
        });
    }

    function baslat() {
        mount();
        var D = db();
        var u = D && D.getGunde5User ? D.getGunde5User() : null;
        if (!u || !u.id) {
            gorunurluk(false);
            abonelikKapat();
            return;
        }
        gorunurluk(true);
        yenile();
        abonelikAc(u.id);
    }

    function durdur() {
        gorunurluk(false);
        abonelikKapat();
    }

    function init() {
        function hazirla() {
            mount();
            if (document.documentElement.classList.contains('g5-oturum')) {
                var wrap = document.getElementById('headerBildirimWrap');
                if (wrap) wrap.classList.add('aktif');
            }
            baslat();
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', hazirla);
        } else {
            setTimeout(hazirla, 0);
        }
    }

    global.Gunde5Bildirim = {
        mount: mount,
        baslat: baslat,
        durdur: durdur,
        yenile: yenile,
        panelKapat: panelKapat
    };

    init();
})(window);
