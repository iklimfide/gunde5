/* gunde5 — index odaklı analitik (oturum, olay, heartbeat) */
(function (global) {
    'use strict';

    var VISITOR_KEY = 'g5_visitor_id';
    var SESSION_KEY = 'g5_session_id';
    var INDEX_ILK_YUK = 5;
    var HEARTBEAT_MS = 15000;
    var heartbeatTimer = null;
    var gorulenHikayeler = {};
    var olayKuyruk = [];
    var gonderimHazir = false;

    function db() {
        return global.Gunde5DB;
    }

    function uuidUret() {
        if (global.crypto && global.crypto.randomUUID) {
            return global.crypto.randomUUID();
        }
        return 'x-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
    }

    function visitorIdAl() {
        try {
            var v = global.localStorage.getItem(VISITOR_KEY);
            if (v && v.length >= 8) return v;
            v = 'v:' + uuidUret();
            global.localStorage.setItem(VISITOR_KEY, v);
            return v;
        } catch (e) {
            return 'v:anon-' + Date.now();
        }
    }

    function sessionIdAl() {
        try {
            var s = global.sessionStorage.getItem(SESSION_KEY);
            if (s && s.length >= 8) return s;
            s = 's:' + uuidUret();
            global.sessionStorage.setItem(SESSION_KEY, s);
            return s;
        } catch (e2) {
            return 's:tmp-' + Date.now();
        }
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
        return ((loc.pathname || '/') + (loc.search || '')).slice(0, 500);
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

    function sayfaGorunurMu() {
        try {
            return !global.document.hidden;
        } catch (e) {
            return true;
        }
    }

    function olayGonderSimdi(body) {
        var D = db();
        if (!D || !D.analyticsEventKaydet || !D.isConfigured || !D.isConfigured()) {
            return false;
        }
        D.analyticsEventKaydet(body)
            .then(function (sonuc) {
                if (sonuc && sonuc.ok === false && global.console && global.console.warn) {
                    global.console.warn('[Gunde5Analytics]', sonuc.hata || sonuc);
                }
            })
            .catch(function (err) {
                if (global.console && global.console.warn) {
                    global.console.warn('[Gunde5Analytics]', err);
                }
            });
        return true;
    }

    function olayGonder(govde) {
        var body = Object.assign(
            {
                session_id: sessionIdAl(),
                visitor_id: visitorIdAl()
            },
            govde || {}
        );
        if (!gonderimHazir) {
            olayKuyruk.push(body);
            return;
        }
        olayGonderSimdi(body);
    }

    function kuyrukBosalt() {
        gonderimHazir = true;
        while (olayKuyruk.length) {
            olayGonderSimdi(olayKuyruk.shift());
        }
    }

    function pageView() {
        var sayfa = sayfaAdi();
        olayGonder({
            event: 'page_view',
            sayfa: sayfa,
            path: tamYol(),
            referrer: referrerAl(),
            loaded_count: sayfa === 'index' ? INDEX_ILK_YUK : 0
        });
    }

    function heartbeatGonder() {
        if (!sayfaGorunurMu()) return;
        olayGonder({ event: 'heartbeat', active_delta: 15 });
    }

    function heartbeatBaslat() {
        if (heartbeatTimer) return;
        heartbeatTimer = global.setInterval(heartbeatGonder, HEARTBEAT_MS);
    }

    function heartbeatDurdur() {
        if (!heartbeatTimer) return;
        global.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }

    function gorunurlukBagla() {
        if (!global.document || !global.document.addEventListener) return;
        global.document.addEventListener('visibilitychange', function () {
            if (sayfaGorunurMu()) {
                heartbeatGonder();
                heartbeatBaslat();
            } else {
                heartbeatDurdur();
            }
        });
    }

    function loadMoreClick(loadedCount) {
        olayGonder({
            event: 'load_more_click',
            sayfa: 'index',
            loaded_count: loadedCount || INDEX_ILK_YUK
        });
    }

    function storyVote(storyId, score) {
        var id = parseInt(storyId, 10);
        if (!id) return;
        olayGonder({
            event: 'story_vote',
            sayfa: 'index',
            story_id: id,
            vote_type: score === 1 ? 'like' : 'dislike'
        });
    }

    function storyShare(storyId) {
        var id = parseInt(storyId, 10);
        if (!id) return;
        olayGonder({
            event: 'story_share',
            sayfa: 'index',
            story_id: id
        });
    }

    function storyImpression(storyId) {
        var id = parseInt(storyId, 10);
        if (!id || gorulenHikayeler[id]) return;
        gorulenHikayeler[id] = true;
        olayGonder({
            event: 'story_impression',
            sayfa: 'index',
            story_id: id
        });
    }

    function kartlariIzle(kok) {
        if (!kok || !global.IntersectionObserver) return;
        var obs = new global.IntersectionObserver(
            function (entries) {
                var i;
                for (i = 0; i < entries.length; i++) {
                    if (!entries[i].isIntersecting) continue;
                    var kart = entries[i].target;
                    var id = kart.getAttribute('data-id');
                    if (id) storyImpression(id);
                }
            },
            { root: null, rootMargin: '0px', threshold: 0.35 }
        );
        kok.querySelectorAll('.story-card[data-id]').forEach(function (el) {
            obs.observe(el);
        });
    }

    function initDbSonra() {
        var D = db();
        if (D && D.init && D.isConfigured && D.isConfigured()) {
            D.init()
                .then(function () {
                    kuyrukBosalt();
                    if (!D.masterDurum) return null;
                    return D.masterDurum();
                })
                .then(function (durum) {
                    if (durum && durum.master) {
                        heartbeatDurdur();
                    }
                })
                .catch(function () {
                    kuyrukBosalt();
                });
        } else {
            kuyrukBosalt();
        }
        baslatIcerik();
    }

    function baslatIcerik() {
        pageView();
        gorunurlukBagla();
        if (sayfaGorunurMu()) heartbeatBaslat();

        if (sayfaAdi() === 'index') {
            global.setTimeout(function () {
                var liste = global.document.getElementById('indexListe');
                if (liste) kartlariIzle(liste);
            }, 600);
        }
    }

    function baslat() {
        baslatIcerik();
    }

    global.Gunde5Analytics = {
        visitorIdAl: visitorIdAl,
        sessionIdAl: sessionIdAl,
        pageView: pageView,
        track: olayGonder,
        loadMoreClick: loadMoreClick,
        storyVote: storyVote,
        storyShare: storyShare,
        storyImpression: storyImpression,
        kartlariIzle: kartlariIzle,
        INDEX_ILK_YUK: INDEX_ILK_YUK
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initDbSonra);
    } else {
        initDbSonra();
    }
})(window);
