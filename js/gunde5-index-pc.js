/* gunde5 — index: PC yan kolonlar (mobil bozulmasın) */
(function () {
    'use strict';

    function qs(sel, root) { return (root || document).querySelector(sel); }
    function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    function pcAktifMi() {
        try { return window.matchMedia && window.matchMedia('(min-width: 1024px)').matches; }
        catch (e) { return false; }
    }

    function setSort(value) {
        var sel = qs('#indexSiralama');
        if (!sel) return;
        sel.value = value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function ilk5Kartlar() {
        var host = qs('#indexListe');
        if (!host) return [];
        return qsa('.story-card[data-id]', host).slice(0, 5);
    }

    function kartBasligi(card) {
        var id = card.getAttribute('data-id') || '';
        var h = qs('.kart-baslik', card);
        var title = (h && h.textContent || '').trim();
        return title || ('Hikâye #' + id);
    }

    function kartAlinti(card) {
        var t = qs('.short-text', card);
        var s = (t && t.textContent || '').trim();
        if (!s) return '';
        if (s.length > 140) s = s.slice(0, 139).trim() + '…';
        return s;
    }

    function kartLikeSayisi(card) {
        var el = qs('.vote-btn[data-vote="up"] .count', card);
        if (!el) return 0;
        var ham = el.getAttribute('data-oy-sayi');
        if (ham != null && ham !== '') {
            var d = parseInt(ham, 10);
            if (isFinite(d)) return d;
        }
        var n = parseInt(String(el.textContent || '').replace(/[^\d]/g, ''), 10);
        return isFinite(n) ? n : 0;
    }

    function rowLikeSayisi(row) {
        if (!row) return 0;
        if (row.like != null && row.like !== '') {
            return parseInt(row.like, 10) || 0;
        }
        return parseInt(row.up_votes, 10) || 0;
    }

    function saatDunTr(iso) {
        try {
            var t = new Date(iso);
            if (!iso || isNaN(t.getTime())) return 'dün';
            var saat = new Intl.DateTimeFormat('tr-TR', {
                timeZone: 'Europe/Istanbul',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).format(t);
            return 'dün ' + saat;
        } catch (e) {
            return 'dün';
        }
    }

    function ymdTr(isoOrDate) {
        try {
            var t = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
            if (!isoOrDate || isNaN(t.getTime())) return null;
            return new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Europe/Istanbul',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(t);
        } catch (e) {
            return null;
        }
    }

    function ymdDun() {
        var d = new Date();
        d.setDate(d.getDate() - 1);
        return ymdTr(d);
    }

    async function dunun5Getir() {
        var D = window.Gunde5DB;
        if (!D || !D.indexHikayeListeleSayfa) return [];
        var dun = ymdDun();
        if (!dun) return [];
        var rows = await D.indexHikayeListeleSayfa(0, 80, 'yeni');
        var dunRows = [];
        for (var i = 0; i < rows.length; i++) {
            if (ymdTr(rows[i].created_at) === dun) dunRows.push(rows[i]);
        }
        dunRows.sort(function (a, b) {
            return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        });
        return dunRows.slice(0, 5);
    }

    var dun5Cache = null;

    async function renderDunun5() {
        if (!pcAktifMi()) return;
        var list = qs('#pcDunun5List');
        if (!list) return;
        if (!dun5Cache) {
            list.innerHTML = '<li><span style="font-size:12px;font-weight:800;color:rgba(17,24,39,.62)">Yükleniyor…</span></li>';
            try {
                dun5Cache = await dunun5Getir();
            } catch (e) {
                dun5Cache = [];
            }
        }

        var rows = Array.isArray(dun5Cache) ? dun5Cache : [];
        if (!rows.length) {
            list.innerHTML = '<li><span style="font-size:12px;font-weight:800;color:rgba(17,24,39,.62)">Dün için kayıt bulunamadı.</span></li>';
            renderDununFavorisi();
            return;
        }

        var html = '';
        rows.slice().reverse().forEach(function (r, idx) {
            var id = String(r && r.id || '');
            var title = (r && r.baslik) ? String(r.baslik).trim() : ('Hikâye #' + id);
            html += '<li><a href="/itiraf/' + esc(id) + '">' + (idx + 1) + ' • ' + esc(title) + '</a></li>';
        });
        list.innerHTML = html;
        renderDununFavorisi();
    }

    async function renderDununFavorisi() {
        if (!pcAktifMi()) return;
        var link = qs('#pcDununFavorisiLink');
        var bas = qs('#pcDununFavorisiBaslik');
        var meta = qs('#pcDununFavorisiMeta');
        if (!link || !bas || !meta) return;

        if (!dun5Cache) {
            try {
                dun5Cache = await dunun5Getir();
            } catch (e) {
                dun5Cache = [];
            }
        }

        var rows = Array.isArray(dun5Cache) ? dun5Cache : [];
        if (!rows.length) {
            bas.textContent = 'Dün için kayıt yok';
            meta.textContent = '';
            link.href = '#';
            return;
        }

        var best = rows[0];
        var bestLike = rowLikeSayisi(best);
        rows.forEach(function (r) {
            var n = rowLikeSayisi(r);
            if (n > bestLike) {
                bestLike = n;
                best = r;
            }
        });

        var id = String(best && best.id || '');
        var title = (best && best.baslik) ? String(best.baslik).trim() : ('Hikâye #' + id);
        link.href = id ? ('/itiraf/' + id) : '#';
        bas.textContent = title;

        var yorumN = 0;
        var D = window.Gunde5DB;
        if (D && D.kokCevapSayilari && id) {
            try {
                var sayMap = await D.kokCevapSayilari([id]);
                if (sayMap && sayMap[id] != null) yorumN = parseInt(sayMap[id], 10) || 0;
            } catch (eC) { /* yorum sayısı opsiyonel */ }
        }

        meta.textContent = '👍 ' + bestLike + ' · 💬 ' + yorumN + ' · ' + saatDunTr(best.created_at);
    }

    function renderPills() {
        if (!pcAktifMi()) return;
        var host = qs('#pcPills');
        if (!host) return;
        var cards = ilk5Kartlar();
        if (!cards.length) {
            host.innerHTML = '';
            return;
        }
        var html = '';
        cards.forEach(function (c, idx) {
            var id = c.getAttribute('data-id') || '';
            var title = kartBasligi(c);
            html += '<button type="button" class="pc-pill" data-pc-pill="' + esc(id) + '">' + (idx + 1) + ' · ' + esc(title) + '</button>';
        });
        host.innerHTML = html;
    }

    var okunan = Object.create(null);
    function setIlerleme() {
        var bar = qs('#pcIlerlemeBar');
        var metin = qs('#pcIlerlemeMetin');
        var toplam = 5;
        var n = Object.keys(okunan).length;
        if (bar) bar.style.width = Math.round((n / toplam) * 100) + '%';
        if (metin) metin.textContent = "Bugünün 5'inden " + n + " tanesini okudun.";
        qsa('.pc-pill').forEach(function (b) {
            var id = b.getAttribute('data-pc-pill');
            b.classList.toggle('pc-pill--okundu', !!okunan[id]);
        });
    }

    function observerKur() {
        var cards = ilk5Kartlar();
        if (!cards.length || !window.IntersectionObserver) return;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                if (e.intersectionRatio < 0.62) return;
                var id = e.target && e.target.getAttribute && e.target.getAttribute('data-id');
                if (!id) return;
                okunan[id] = true;
                setIlerleme();
            });
        }, { threshold: [0.62] });
        cards.forEach(function (c) { io.observe(c); });
    }

    var rastgeleIdx = 0;
    function rastgeleYenile() {
        var metinEl = qs('#pcRastgeleMetin');
        var kaynakEl = qs('#pcRastgeleKaynak');
        var linkEl = qs('#pcRastgeleLink');
        var cards = ilk5Kartlar();
        if (!metinEl || !kaynakEl || !cards.length) return;
        rastgeleIdx = (rastgeleIdx + 1) % cards.length;
        var c = cards[rastgeleIdx];
        var id = c.getAttribute('data-id') || '';
        var alinti = kartAlinti(c) || '“…”';
        if (alinti.charAt(0) !== '“') alinti = '“' + alinti.replace(/^\"|\"$/g, '') + '”';
        metinEl.textContent = alinti;
        kaynakEl.textContent = '— ' + kartBasligi(c);
        if (linkEl && id) linkEl.href = '#h-' + id;
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function bagla() {
        var sol = qs('.pc-left');
        if (sol) {
            sol.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-pc-sort]');
                if (!btn) return;
                var v = btn.getAttribute('data-pc-sort');
                qsa('.pc-left-link').forEach(function (b) { b.classList.toggle('pc-left-link--aktif', b === btn); });
                setSort(v);
            });
        }

        var basla = qs('#pcBaslaBtn');
        if (basla) {
            basla.addEventListener('click', function () {
                var first = qs('#indexListe .story-card[data-id]');
                if (first && first.id) location.hash = '#' + first.id;
            });
        }

        var basla2 = qs('#pcHeroBaslaBtn');
        if (basla2) {
            basla2.addEventListener('click', function () {
                var first = qs('#indexListe .story-card[data-id]');
                if (first && first.id) location.hash = '#' + first.id;
            });
        }

        var pills = qs('#pcPills');
        if (pills) {
            pills.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-pc-pill]');
                if (!btn) return;
                qsa('.pc-pill').forEach(function (b) { b.classList.toggle('pc-pill--aktif', b === btn); });
                location.hash = '#h-' + btn.getAttribute('data-pc-pill');
            });
        }

        var rbtn = qs('#pcRastgeleBtn');
        if (rbtn) rbtn.addEventListener('click', rastgeleYenile);

        var dunBtn = qs('#pcDunun5OkuBtn');
        if (dunBtn) {
            dunBtn.addEventListener('click', function () {
                if (Array.isArray(dun5Cache) && dun5Cache.length) {
                    location.href = '/itiraf/' + String(dun5Cache[0].id);
                    return;
                }
                /* veri yoksa fallback: bugünün ilkine git */
                var first = qs('#indexListe .story-card[data-id]');
                if (first && first.id) location.hash = '#' + first.id;
            });
        }

        var host = qs('#indexListe');
        if (host && window.MutationObserver) {
            var mo = new MutationObserver(function () {
                /* bugünün blokları */
                renderPills();
                observerKur();
                rastgeleYenile();
            });
            mo.observe(host, { childList: true, subtree: true });
        }

        renderDunun5();
        renderPills();
        observerKur();
        rastgeleYenile();
        setIlerleme();
        if (window.matchMedia) {
            try {
                window.matchMedia('(min-width: 1024px)').addEventListener('change', function () {
                    renderDunun5();
                    renderPills();
                    observerKur();
                    rastgeleYenile();
                });
            } catch (e2) { /* safari */ }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bagla);
    } else {
        bagla();
    }
})();

