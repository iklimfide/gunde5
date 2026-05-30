/* gunde5 — sayfa ziyareti: referrer, UTM, yol (istatistik sayfası için veri toplar) */
(function (global) {
    'use strict';

    function db() {
        return global.Gunde5DB;
    }

    function sayfaAdi() {
        var path = (global.location && global.location.pathname) || '';
        var dosya = path.split('/').pop() || 'index.html';
        if (!dosya || dosya === '/') return 'index';
        return dosya.replace(/\.html$/i, '') || 'index';
    }

    function tamYol() {
        var loc = global.location;
        if (!loc) return '/';
        var yol = loc.pathname || '/';
        var q = loc.search || '';
        return (yol + q).slice(0, 500);
    }

    var UTM_ANAHTARLAR = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    var UTM_STORAGE = 'gunde5_utm_attribution';

    function utmBos(obj) {
        if (!obj) return true;
        for (var i = 0; i < UTM_ANAHTARLAR.length; i++) {
            if (obj[UTM_ANAHTARLAR[i]]) return false;
        }
        return true;
    }

    function utmOku() {
        var params;
        var urlde = {};
        try {
            params = new URLSearchParams(global.location.search || '');
        } catch (e) {
            params = null;
        }
        function al(anahtar) {
            if (!params) return '';
            var v = params.get(anahtar);
            return v ? String(v).trim().slice(0, 120) : '';
        }
        UTM_ANAHTARLAR.forEach(function (anahtar) {
            urlde[anahtar] = al(anahtar);
        });

        var birlesik = {};
        UTM_ANAHTARLAR.forEach(function (anahtar) {
            birlesik[anahtar] = urlde[anahtar] || '';
        });

        if (!utmBos(urlde)) {
            try {
                global.sessionStorage.setItem(UTM_STORAGE, JSON.stringify(urlde));
            } catch (e1) { /* */ }
        } else {
            try {
                var kayitli = global.sessionStorage.getItem(UTM_STORAGE);
                if (kayitli) {
                    var parsed = JSON.parse(kayitli);
                    UTM_ANAHTARLAR.forEach(function (anahtar) {
                        if (!birlesik[anahtar] && parsed[anahtar]) {
                            birlesik[anahtar] = String(parsed[anahtar]).slice(0, 120);
                        }
                    });
                }
            } catch (e2) { /* */ }
        }

        return birlesik;
    }

    function cihazTipi() {
        try {
            if (global.matchMedia && global.matchMedia('(max-width: 768px)').matches) {
                return 'mobile';
            }
        } catch (e) { /* */ }
        return 'desktop';
    }

    function referrerAl() {
        var ref = '';
        try {
            ref = String(global.document.referrer || '').trim();
        } catch (e) { /* */ }
        if (!ref) return '';
        try {
            var site = global.location.hostname || '';
            var r = new URL(ref);
            if (site && r.hostname === site) return '';
        } catch (e2) { /* */ }
        return ref.slice(0, 500);
    }

    function ipAdresiAl(cb) {
        try {
            var cached = global.sessionStorage.getItem('gunde5_ip');
            if (cached) {
                cb(cached);
                return;
            }
        } catch (e) { /* */ }
        if (!global.fetch) {
            cb('');
            return;
        }
        global.fetch('https://api.ipify.org?format=json', { cache: 'no-store' })
            .then(function (r) {
                return r.json();
            })
            .then(function (d) {
                var ip = d && d.ip ? String(d.ip).slice(0, 45) : '';
                try {
                    if (ip) global.sessionStorage.setItem('gunde5_ip', ip);
                } catch (e2) { /* */ }
                cb(ip);
            })
            .catch(function () {
                cb('');
            });
    }

    function kayitGonder() {
        var D = db();
        if (!D || !D.ziyaretKaydet || !D.isConfigured || !D.isConfigured()) return;

        var oturum = D.getViewerKey ? D.getViewerKey() : '';
        if (!oturum || oturum.length < 8) return;

        var utm = utmOku();
        var body = {
            oturum_key: oturum,
            sayfa: sayfaAdi(),
            yol: tamYol(),
            referrer: referrerAl(),
            cihaz: cihazTipi(),
            dil: (global.navigator && global.navigator.language) ? String(global.navigator.language).slice(0, 16) : ''
        };
        Object.keys(utm).forEach(function (k) {
            if (utm[k]) body[k] = utm[k];
        });

        ipAdresiAl(function (ip) {
            if (ip) body.ip_adresi = ip;
            D.ziyaretKaydet(body);
        });
    }

    function baslat() {
        if (!db() || !db().init) {
            kayitGonder();
            return;
        }
        db()
            .init()
            .then(function () {
                if (!db().masterDurum) {
                    kayitGonder();
                    return;
                }
                return db()
                    .masterDurum()
                    .then(function (durum) {
                        if (!durum || !durum.master) kayitGonder();
                    })
                    .catch(kayitGonder);
            })
            .catch(function () {
                kayitGonder();
            });
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', baslat);
    } else {
        baslat();
    }
})(window);
