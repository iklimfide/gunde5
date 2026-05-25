/* gunde5 — master Kamikaze paneli */
(function (global) {
    'use strict';

    var filtreHazir = false;
    var aktifFiltre = 'hepsi';
    var panelData = null;
    var aramaData = null;
    var aramaMetni = '';
    var tabloDurum = Object.create(null);
    var aramaZamanlayici = null;
    var aramaIstekNo = 0;
    var modalState = {
        type: '',
        title: '',
        data: null,
        error: '',
        voteUserQuery: '',
        voteUserResults: [],
        highlightCommentId: null
    };

    function db() {
        return global.Gunde5DB;
    }

    function ui() {
        return global.Gunde5UI;
    }

    function profil() {
        return global.Gunde5Profil;
    }

    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function arr(v) {
        return Array.isArray(v) ? v : [];
    }

    function num(v, fallback) {
        var n = Number(v);
        return isFinite(n) ? n : (fallback != null ? fallback : 0);
    }

    function strNorm(v) {
        return String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function fmtSayi(n) {
        var x = Number(n);
        if (!isFinite(x)) return '0';
        try {
            return Math.round(x).toLocaleString('tr-TR');
        } catch (e) {
            return String(Math.round(x));
        }
    }

    function fmtTarih(iso) {
        if (!iso) return '—';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return esc(iso);
            return d.toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return esc(iso);
        }
    }

    function fmtGun(gun) {
        if (!gun) return '';
        var p = String(gun).split('-');
        if (p.length === 3) return p[2] + '/' + p[1];
        return String(gun);
    }

    function kisaMetin(s, max) {
        var t = String(s || '').trim();
        if (!t) return '—';
        if (t.length <= max) return esc(t);
        return esc(t.slice(0, max - 1)) + '…';
    }

    function ayarDegeri(anahtar, deger) {
        if (anahtar && /token|secret|key/i.test(anahtar)) return '••••••••';
        return deger || '—';
    }

    function hikayeDurumKodu(row) {
        if (!row) return '';
        if (row.silindi_at) return 'silindi';
        if (row.status === 'podyum') return 'podyum';
        return 'kulis';
    }

    function hikayeDurumText(row) {
        var kod = hikayeDurumKodu(row);
        if (kod === 'silindi') return 'silindi';
        if (kod === 'podyum') return 'podyum';
        return 'kulis';
    }

    function statusBadge(status, silindi) {
        if (silindi) return '<span class="kamikaze-badge kamikaze-badge--silindi">silindi</span>';
        if (status === 'podyum') return '<span class="kamikaze-badge kamikaze-badge--podyum">podyum</span>';
        return '<span class="kamikaze-badge kamikaze-badge--kulis">kulis</span>';
    }

    function yorumDurumBadge(row) {
        if (row && row.itiraf_silindi) return '<span class="kamikaze-badge kamikaze-badge--silindi">hikaye silindi</span>';
        if (row && row.itiraf_status === 'podyum') return '<span class="kamikaze-badge kamikaze-badge--podyum">podyum</span>';
        return '<span class="kamikaze-badge kamikaze-badge--kulis">kulis</span>';
    }

    function userDurumText(row) {
        var d = strNorm(row && row.durum);
        if (d === 'ban') return 'ban';
        if (d === 'askida') return 'askıda';
        return 'aktif';
    }

    function userDurumBadge(row) {
        var d = strNorm(row && row.durum);
        var cls = 'kamikaze-badge--aktif';
        var label = 'aktif';
        if (d === 'ban') {
            cls = 'kamikaze-badge--silindi';
            label = 'ban';
        } else if (d === 'askida') {
            cls = 'kamikaze-badge--warn';
            label = 'askıda';
        }
        return '<span class="kamikaze-badge ' + cls + '">' + esc(label) + '</span>';
    }

    function genderLabel(gender) {
        return gender === 'male' ? 'Erkek' : 'Kadın';
    }

    function shortUuid(v) {
        return String(v || '').slice(0, 8) + '…';
    }

    function yerGoster(row) {
        var P = profil();
        if (P && P.yasadigiYerGosterim) {
            return P.yasadigiYerGosterim({
                yasadigiYer: row && row.yasadigi_yer,
                yurtdisiSehir: row && row.yurtdisi_sehir
            }) || '—';
        }
        if (row && row.yasadigi_yer === 'yurtdisi' && row.yurtdisi_sehir) {
            return 'Yurtdışı · ' + row.yurtdisi_sehir;
        }
        return (row && row.yasadigi_yer) || '—';
    }

    function hikayeleriFiltrele(rows, filter) {
        var liste = arr(rows);
        if (!filter || filter === 'hepsi') return liste;
        return liste.filter(function (r) {
            if (filter === 'silindi') return !!r.silindi_at;
            if (filter === 'gizli') return !!r.is_gizli && !r.silindi_at;
            return r.status === filter && !r.silindi_at;
        });
    }

    function tabloState(id) {
        if (!tabloDurum[id]) {
            tabloDurum[id] = {
                sortKey: '',
                sortDir: 'asc',
                filters: {}
            };
        }
        return tabloDurum[id];
    }

    function tabloFilterValue(kolon, row) {
        if (!kolon) return '';
        if (typeof kolon.filterValue === 'function') return kolon.filterValue(row);
        if (typeof kolon.sortValue === 'function') return kolon.sortValue(row);
        if (typeof kolon.valueText === 'function') return kolon.valueText(row);
        if (kolon.alan) return row ? row[kolon.alan] : '';
        return '';
    }

    function tabloSortValue(kolon, row) {
        if (!kolon) return '';
        if (typeof kolon.sortValue === 'function') return kolon.sortValue(row);
        return tabloFilterValue(kolon, row);
    }

    function tabloFiltreleVeSirala(id, kolonlar, satirlar) {
        var durum = tabloState(id);
        var liste = arr(satirlar).slice();

        kolonlar.forEach(function (kolon) {
            var filtre = strNorm(durum.filters[kolon.key]);
            if (!filtre || !kolon.filter) return;
            liste = liste.filter(function (row) {
                var deger = strNorm(tabloFilterValue(kolon, row));
                if (kolon.filter === 'select') return deger === filtre;
                return deger.indexOf(filtre) >= 0;
            });
        });

        if (durum.sortKey) {
            var hedef = null;
            kolonlar.some(function (kolon) {
                if (kolon.key === durum.sortKey) {
                    hedef = kolon;
                    return true;
                }
                return false;
            });
            if (hedef && hedef.sortable !== false) {
                liste.sort(function (a, b) {
                    var av = tabloSortValue(hedef, a);
                    var bv = tabloSortValue(hedef, b);
                    if (av == null) av = '';
                    if (bv == null) bv = '';
                    if (typeof av === 'number' && typeof bv === 'number') {
                        return durum.sortDir === 'desc' ? bv - av : av - bv;
                    }
                    av = strNorm(av);
                    bv = strNorm(bv);
                    if (av === bv) return 0;
                    if (durum.sortDir === 'desc') return av < bv ? 1 : -1;
                    return av > bv ? 1 : -1;
                });
            }
        }
        return liste;
    }

    function headerSortIcon(state, kolon) {
        if (state.sortKey !== kolon.key) return '↕';
        return state.sortDir === 'desc' ? '↓' : '↑';
    }

    function renderHeaderControl(tableId, kolon, state) {
        var html = '';
        if (kolon.sortable !== false) {
            html +=
                '<button type="button" class="kamikaze-th-btn" data-km-sort="' + esc(tableId) +
                '" data-key="' + esc(kolon.key) + '">' +
                '<span>' + esc(kolon.etiket) + '</span><span>' + headerSortIcon(state, kolon) + '</span></button>';
        } else {
            html += '<div class="kamikaze-th-label">' + esc(kolon.etiket) + '</div>';
        }

        if (!kolon.filter) return html;

        if (kolon.filter === 'select') {
            html += '<select class="kamikaze-th-input kamikaze-th-select" data-km-filter="' + esc(tableId) +
                '" data-key="' + esc(kolon.key) + '"><option value="">Hepsi</option>';
            arr(kolon.options).forEach(function (opt) {
                var sec = strNorm(state.filters[kolon.key]) === strNorm(opt.value) ? ' selected' : '';
                html += '<option value="' + esc(opt.value) + '"' + sec + '>' + esc(opt.label) + '</option>';
            });
            html += '</select>';
            return html;
        }

        html += '<input type="search" class="kamikaze-th-input" data-km-filter="' + esc(tableId) +
            '" data-key="' + esc(kolon.key) + '" value="' + esc(state.filters[kolon.key] || '') +
            '" placeholder="Filtrele">';
        return html;
    }

    function renderTableSection(opts) {
        var id = opts.id;
        var kolonlar = arr(opts.columns);
        var tumSatirlar = arr(opts.rows);
        var filtreli = tabloFiltreleVeSirala(id, kolonlar, tumSatirlar);
        var state = tabloState(id);
        var html = '';
        html += '<section class="kamikaze-section">';
        html += '<div class="kamikaze-section-head">';
        html += '<h2>' + esc(opts.title) + '</h2>';
        html += '<div class="kamikaze-section-meta">' + esc(fmtSayi(filtreli.length)) + ' / ' + esc(fmtSayi(tumSatirlar.length)) + '</div>';
        html += '</div>';
        if (opts.note) {
            html += '<p class="kamikaze-note">' + esc(opts.note) + '</p>';
        }
        if (!filtreli.length) {
            html += '<p class="kamikaze-empty">' + esc(opts.empty || 'Veri yok.') + '</p></section>';
            return html;
        }

        html += '<div class="kamikaze-table-wrap"><table class="kamikaze-table kamikaze-table--interactive"><thead><tr>';
        kolonlar.forEach(function (kolon) {
            html += '<th scope="col">' + renderHeaderControl(id, kolon, state) + '</th>';
        });
        html += '</tr></thead><tbody>';
        filtreli.forEach(function (row) {
            html += '<tr>';
            kolonlar.forEach(function (kolon) {
                var deger = typeof kolon.value === 'function' ? kolon.value(row) : row[kolon.alan];
                html += '<td>' + (kolon.raw ? deger : esc(deger == null ? '—' : deger)) + '</td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table></div></section>';
        return html;
    }

    function injectStyles() {
        if (document.getElementById('gunde5-kamikaze-enhanced-style')) return;
        var style = document.createElement('style');
        style.id = 'gunde5-kamikaze-enhanced-style';
        style.textContent =
            '[hidden]{display:none!important}' +
            '.kamikaze-input{min-width:220px;flex:1 1 240px}' +
            '.kamikaze-toolbar .kamikaze-btn--ikincil{background:transparent;color:var(--text-main);border-color:var(--border-color);box-shadow:none}' +
            '.kamikaze-toolbar .kamikaze-btn--ikincil:hover{background:rgba(29,155,240,.08)}' +
            '.kamikaze-section-meta{font-size:12px;font-weight:800;color:#0f5fa8;padding:6px 10px;border-radius:999px;background:rgba(29,155,240,.10);border:1px solid rgba(29,155,240,.16)}' +
            'body.dark-mode .kamikaze-section-meta{color:#7dc5ff;background:rgba(29,155,240,.14);border-color:rgba(29,155,240,.26)}' +
            '.kamikaze-table--interactive th{min-width:110px}' +
            '.kamikaze-th-btn{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;border:none;background:none;color:inherit;font:inherit;font-size:10px;text-transform:uppercase;letter-spacing:.04em;padding:0;cursor:pointer}' +
            '.kamikaze-th-label{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:inherit;font-weight:900}' +
            '.kamikaze-th-input{margin-top:6px;width:100%;border:1px solid var(--border-color);border-radius:8px;padding:6px 8px;background:var(--bg-card);color:var(--text-main);font-size:11px;font-weight:600}' +
            '.kamikaze-th-select{padding-right:22px}' +
            '.kamikaze-actions{display:flex;flex-wrap:wrap;gap:6px}' +
            '.kamikaze-action-btn{border:1px solid rgba(29,155,240,.28);background:rgba(29,155,240,.10);color:#0f5fa8;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer;transition:transform .14s ease,box-shadow .14s ease,background-color .14s ease}' +
            '.kamikaze-action-btn:hover{transform:translateY(-1px);box-shadow:0 8px 18px rgba(29,155,240,.18);background:rgba(29,155,240,.16)}' +
            '.kamikaze-action-btn:active{transform:translateY(0)}' +
            '.kamikaze-action-btn--tehlike{color:#b91c1c;border-color:rgba(185,28,28,.26);background:rgba(239,68,68,.08)}' +
            '.kamikaze-action-btn--tehlike:hover{background:rgba(239,68,68,.14);box-shadow:0 8px 18px rgba(239,68,68,.12)}' +
            'body.dark-mode .kamikaze-action-btn{color:#7dc5ff;background:rgba(29,155,240,.14);border-color:rgba(29,155,240,.36)}' +
            'body.dark-mode .kamikaze-action-btn--tehlike{color:#fca5a5;border-color:rgba(248,113,113,.35);background:rgba(248,113,113,.10)}' +
            '.kamikaze-action-btn--warn{color:#b45309;border-color:rgba(180,83,9,.24);background:rgba(245,158,11,.10)}' +
            '.kamikaze-action-btn--warn:hover{background:rgba(245,158,11,.16);box-shadow:0 8px 18px rgba(245,158,11,.14)}' +
            'body.dark-mode .kamikaze-action-btn--warn{color:#fbbf24;border-color:rgba(251,191,36,.35);background:rgba(251,191,36,.10)}' +
            '.kamikaze-search-summary{display:flex;flex-wrap:wrap;gap:10px;color:var(--text-muted);font-size:12px;font-weight:800}' +
            '.kamikaze-search-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid rgba(29,155,240,.18);border-radius:999px;background:linear-gradient(180deg, rgba(29,155,240,.14) 0%, rgba(29,155,240,.08) 100%);color:#0f5fa8}' +
            'body.dark-mode .kamikaze-search-pill{color:#7dc5ff;border-color:rgba(29,155,240,.26);background:linear-gradient(180deg, rgba(29,155,240,.20) 0%, rgba(29,155,240,.12) 100%)}' +
            '.kamikaze-badge--aktif{background:linear-gradient(180deg, rgba(34,197,94,.18) 0%, rgba(34,197,94,.10) 100%);color:#15803d;border-color:rgba(21,128,61,.18)}' +
            '.kamikaze-badge--warn{background:linear-gradient(180deg, rgba(245,158,11,.18) 0%, rgba(245,158,11,.10) 100%);color:#b45309;border-color:rgba(180,83,9,.18)}' +
            '.kamikaze-inline{display:flex;flex-wrap:wrap;gap:12px}' +
            '.kamikaze-inline label{display:grid;gap:6px;font-size:12px;font-weight:700;color:var(--text-muted)}' +
            '.kamikaze-inline input,.kamikaze-inline select,.kamikaze-inline textarea,.kamikaze-modal-body input,.kamikaze-modal-body select,.kamikaze-modal-body textarea{border:1px solid var(--border-color);border-radius:12px;padding:10px 12px;background:var(--bg-card);color:var(--text-main);font:inherit}' +
            '.kamikaze-inline textarea,.kamikaze-modal-body textarea{width:100%;resize:vertical;line-height:1.45}' +
            '.kamikaze-modal{position:fixed;inset:0;z-index:1200;display:flex;align-items:stretch;justify-content:flex-end}' +
            '.kamikaze-modal[hidden]{display:none!important}' +
            '.kamikaze-modal-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.45)}' +
            '.kamikaze-modal-panel{position:relative;width:min(920px,100vw);height:100%;background:var(--bg-main);border-left:1px solid var(--border-color);display:flex;flex-direction:column;box-shadow:-12px 0 32px rgba(0,0,0,.22)}' +
            '.kamikaze-modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 18px;border-bottom:1px solid rgba(29,155,240,.18);background:linear-gradient(180deg, rgba(29,155,240,.12) 0%, rgba(29,155,240,.04) 100%)}' +
            '.kamikaze-modal-head h2{font-size:18px;font-weight:900;letter-spacing:-.03em;color:#0f5fa8}' +
            'body.dark-mode .kamikaze-modal-head{border-bottom-color:rgba(29,155,240,.28);background:linear-gradient(180deg, rgba(29,155,240,.18) 0%, rgba(29,155,240,.08) 100%)}' +
            'body.dark-mode .kamikaze-modal-head h2{color:#8fd2ff}' +
            '.kamikaze-modal-close{border:none;background:transparent;color:var(--text-main);font-size:28px;line-height:1;cursor:pointer}' +
            '.kamikaze-modal-body{flex:1;overflow:auto;padding:18px;display:grid;gap:14px}' +
            '.kamikaze-modal-section{background:var(--bg-card);border:1px solid var(--border-color);border-radius:18px;padding:16px;display:grid;gap:12px}' +
            '.kamikaze-modal-section h3{font-size:15px;font-weight:900;letter-spacing:-.02em}' +
            '.kamikaze-modal-meta{display:flex;flex-wrap:wrap;gap:8px;font-size:12px;color:var(--text-muted);font-weight:700}' +
            '.kamikaze-modal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}' +
            '.kamikaze-modal-grid--tek{grid-template-columns:1fr}' +
            '.kamikaze-modal-grid label{display:grid;gap:6px;font-size:12px;font-weight:800;color:var(--text-muted)}' +
            '.kamikaze-modal-actions{display:flex;flex-wrap:wrap;gap:8px}' +
            '.kamikaze-modal-btn{border:1px solid rgba(29,155,240,.22);background:linear-gradient(180deg, rgba(29,155,240,.12) 0%, rgba(29,155,240,.08) 100%);color:#0f5fa8;border-radius:12px;padding:9px 12px;font-size:12px;font-weight:800;cursor:pointer;transition:transform .14s ease,box-shadow .14s ease,filter .14s ease}' +
            '.kamikaze-modal-btn:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(29,155,240,.16);filter:brightness(1.02)}' +
            '.kamikaze-modal-btn:active{transform:translateY(0)}' +
            '.kamikaze-modal-btn--primary{background:linear-gradient(180deg, #33a4f5 0%, #1d9bf0 100%);border-color:#1d9bf0;color:#fff;box-shadow:0 12px 24px rgba(29,155,240,.24)}' +
            '.kamikaze-modal-btn--primary:hover{box-shadow:0 14px 28px rgba(29,155,240,.28)}' +
            '.kamikaze-modal-btn--tehlike{color:#b91c1c;border-color:rgba(185,28,28,.25);background:linear-gradient(180deg, rgba(239,68,68,.10) 0%, rgba(239,68,68,.06) 100%)}' +
            '.kamikaze-modal-btn--tehlike:hover{box-shadow:0 10px 22px rgba(239,68,68,.12);background:linear-gradient(180deg, rgba(239,68,68,.14) 0%, rgba(239,68,68,.09) 100%)}' +
            'body.dark-mode .kamikaze-modal-btn{color:#7dc5ff;background:linear-gradient(180deg, rgba(29,155,240,.18) 0%, rgba(29,155,240,.12) 100%);border-color:rgba(29,155,240,.30)}' +
            'body.dark-mode .kamikaze-modal-btn--tehlike{color:#fca5a5;border-color:rgba(248,113,113,.32);background:linear-gradient(180deg, rgba(248,113,113,.16) 0%, rgba(248,113,113,.10) 100%)}' +
            '.kamikaze-mini-card{border:1px solid rgba(29,155,240,.14);border-radius:14px;padding:12px;background:linear-gradient(180deg, rgba(29,155,240,.08) 0%, rgba(29,155,240,.03) 100%);display:grid;gap:10px}' +
            '.kamikaze-mini-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:800;color:#0f5fa8}' +
            'body.dark-mode .kamikaze-mini-card{border-color:rgba(29,155,240,.22);background:linear-gradient(180deg, rgba(29,155,240,.14) 0%, rgba(29,155,240,.06) 100%)}' +
            'body.dark-mode .kamikaze-mini-head{color:#8fd2ff}' +
            '.kamikaze-mini-actions{display:flex;flex-wrap:wrap;gap:8px}' +
            '.kamikaze-user-header{display:flex;gap:14px;align-items:center;flex-wrap:wrap}' +
            '.kamikaze-avatar{width:64px;height:64px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1px solid var(--border-color);background:rgba(29,155,240,.08)}' +
            '.kamikaze-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}' +
            '.kamikaze-form-grid .kamikaze-form-span{grid-column:1/-1}' +
            '.kamikaze-vote-results{display:grid;gap:8px}' +
            '.kamikaze-vote-result{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--border-color);border-radius:12px}' +
            '.kamikaze-vote-row-actions{display:flex;gap:6px;flex-wrap:wrap}' +
            '.kamikaze-highlight{box-shadow:0 0 0 2px rgba(29,155,240,.45)}' +
            '.kamikaze-note code{font-size:inherit}' +
            '@media (max-width: 900px){.kamikaze-modal-grid,.kamikaze-form-grid{grid-template-columns:1fr}}' +
            '@media (max-width: 720px){.kamikaze-modal-panel{width:100%}.kamikaze-toolbar{align-items:stretch}.kamikaze-input{min-width:0;flex-basis:100%}}';
        document.head.appendChild(style);
    }

    function ensureToolbar() {
        var toolbar = document.getElementById('kamikazeAraclar');
        var yenile = document.getElementById('kamikazeYenile');
        if (!toolbar || !yenile || document.getElementById('kamikazeAra')) return;

        var input = document.createElement('input');
        input.type = 'search';
        input.id = 'kamikazeAra';
        input.className = 'kamikaze-select kamikaze-input';
        input.placeholder = 'Üye, hikaye veya yorum ara…';
        input.autocomplete = 'off';

        var araBtn = document.createElement('button');
        araBtn.type = 'button';
        araBtn.id = 'kamikazeAraBtn';
        araBtn.className = 'kamikaze-btn';
        araBtn.textContent = 'Ara';

        var temizleBtn = document.createElement('button');
        temizleBtn.type = 'button';
        temizleBtn.id = 'kamikazeAraTemizle';
        temizleBtn.className = 'kamikaze-btn kamikaze-btn--ikincil';
        temizleBtn.textContent = 'Temizle';
        temizleBtn.hidden = true;

        toolbar.insertBefore(input, yenile);
        toolbar.insertBefore(araBtn, yenile);
        toolbar.insertBefore(temizleBtn, yenile);
    }

    function toolbarAramaGuncelle() {
        var input = document.getElementById('kamikazeAra');
        var temizle = document.getElementById('kamikazeAraTemizle');
        if (input && input.value !== aramaMetni) input.value = aramaMetni;
        if (temizle) temizle.hidden = !aramaMetni;
    }

    function ensureModalRoot() {
        if (document.getElementById('kamikazeModal')) return;
        var wrap = document.createElement('div');
        wrap.id = 'kamikazeModal';
        wrap.className = 'kamikaze-modal';
        wrap.hidden = true;
        wrap.innerHTML =
            '<div class="kamikaze-modal-backdrop" data-km-modal-close></div>' +
            '<div class="kamikaze-modal-panel" role="dialog" aria-modal="true" aria-labelledby="kamikazeModalTitle">' +
            '<div class="kamikaze-modal-head">' +
            '<h2 id="kamikazeModalTitle">Kamikaze</h2>' +
            '<button type="button" class="kamikaze-modal-close" aria-label="Kapat" data-km-modal-close>&times;</button>' +
            '</div>' +
            '<div class="kamikaze-modal-body" id="kamikazeModalBody"></div>' +
            '</div>';
        document.body.appendChild(wrap);
    }

    function modalKapat() {
        var modal = document.getElementById('kamikazeModal');
        if (modal) modal.hidden = true;
        modalState = {
            type: '',
            title: '',
            data: null,
            error: '',
            voteUserQuery: '',
            voteUserResults: [],
            highlightCommentId: null
        };
    }

    function modalGuncelle() {
        ensureModalRoot();
        var modal = document.getElementById('kamikazeModal');
        var title = document.getElementById('kamikazeModalTitle');
        var body = document.getElementById('kamikazeModalBody');
        if (!modal || !title || !body) return;
        if (!modalState.type) {
            modal.hidden = true;
            return;
        }
        modal.hidden = false;
        title.textContent = modalState.title || 'Kamikaze';
        if (modalState.type === 'loading') {
            body.innerHTML = '<p class="kamikaze-loading">Yükleniyor…</p>';
            return;
        }
        if (modalState.type === 'error') {
            body.innerHTML = '<p class="kamikaze-error">' + esc(modalState.error || 'Bir hata oluştu.') + '</p>';
            return;
        }
        if (modalState.type === 'story') {
            body.innerHTML = hikayeModalHtml(modalState.data);
            hikayeModalSonrasi();
            return;
        }
        if (modalState.type === 'user') {
            body.innerHTML = uyeModalHtml(modalState.data);
            uyeModalSonrasi();
            return;
        }
        if (modalState.type === 'comment') {
            body.innerHTML = yorumModalHtml(modalState.data);
        }
    }

    function yilSecenekleriHtml(secili) {
        var html = '<option value="">Yıl</option>';
        var yil = new Date().getFullYear();
        var i;
        for (i = yil - 18; i >= yil - 100; i--) {
            html += '<option value="' + i + '"' + (String(secili) === String(i) ? ' selected' : '') + '>' + i + '</option>';
        }
        return html;
    }

    function selectYerHtml(secili) {
        var P = profil();
        var html = '<option value="">—</option>';
        arr(P && P.YER_SECENEKLERI).forEach(function (s) {
            html += '<option value="' + esc(s.value) + '"' + (secili === s.value ? ' selected' : '') + '>' + esc(s.label) + '</option>';
        });
        return html;
    }

    function selectMeslekHtml(secili) {
        var P = profil();
        var html = '<option value="">—</option>';
        arr(P && P.MESLEK_SECENEKLERI).forEach(function (s) {
            html += '<option value="' + esc(s.value) + '"' + (secili === s.value ? ' selected' : '') + '>' + esc(s.label) + '</option>';
        });
        return html;
    }

    function selectMedeniHtml(secili) {
        var P = profil();
        var html = '<option value="">—</option>';
        arr(P && P.MEDENI_SECENEKLERI).forEach(function (s) {
            html += '<option value="' + esc(s.value) + '"' + (secili === s.value ? ' selected' : '') + '>' + esc(s.label) + '</option>';
        });
        return html;
    }

    function avatarGuncelle(root, uye) {
        var el = root && root.querySelector('#kmUserAvatar');
        var kaldir = root && root.querySelector('#kmUserAvatarKaldir');
        if (!el || !uye) return;
        if (ui() && ui().uygulaAvatarElement) {
            ui().uygulaAvatarElement(el, {
                gender: uye.gender,
                avatarUrl: uye.avatar_url || null
            });
        } else if (uye.avatar_url) {
            el.innerHTML = '<img src="' + esc(uye.avatar_url) + '" alt="">';
        } else {
            el.textContent = uye.gender === 'male' ? '♂' : '♀';
        }
        if (kaldir) kaldir.hidden = !uye.avatar_url;
    }

    function kpiHtml(ozet) {
        if (!ozet) return '';
        var items = [
            { etiket: 'Üye', deger: ozet.uye },
            { etiket: 'Aktif hikaye', deger: ozet.itiraf_aktif },
            { etiket: 'Kulis', deger: ozet.kulis, cls: 'warn' },
            { etiket: 'Podyum', deger: ozet.podyum, cls: 'ok' },
            { etiket: 'Silinen', deger: ozet.silindi },
            { etiket: 'Gizli', deger: ozet.gizli },
            { etiket: 'Oy', deger: ozet.oy, cls: 'blue' },
            { etiket: 'Yorum', deger: ozet.cevap, cls: 'blue' },
            { etiket: 'Şikayet', deger: ozet.sikayet },
            { etiket: 'Sayfa gör.', deger: ozet.sayfa_goruntulenme },
            { etiket: 'Tekil gör.', deger: ozet.tekil_goruntulenme },
            { etiket: '↑ oy', deger: ozet.up_toplam, cls: 'ok' },
            { etiket: '↓ oy', deger: ozet.down_toplam }
        ];
        return (
            '<section class="kamikaze-section">' +
            '<div class="kamikaze-section-head"><h2>Genel bakış</h2></div>' +
            '<div class="kamikaze-kpi-grid">' +
            items.map(function (it) {
                return (
                    '<article class="kamikaze-kpi' + (it.cls ? ' kamikaze-kpi--' + esc(it.cls) : '') + '">' +
                    '<div class="kamikaze-kpi-label">' + esc(it.etiket) + '</div>' +
                    '<div class="kamikaze-kpi-value">' + esc(fmtSayi(it.deger)) + '</div>' +
                    '</article>'
                );
            }).join('') +
            '</div></section>'
        );
    }

    function barChartHtml(baslik, rows, cls) {
        var liste = arr(rows);
        var max = 1;
        liste.forEach(function (r) {
            var adet = parseInt(r && r.adet, 10) || 0;
            if (adet > max) max = adet;
        });
        return (
            '<section class="kamikaze-section kamikaze-chart-box">' +
            '<div class="kamikaze-section-head"><h2>' + esc(baslik) + '</h2></div>' +
            (
                !liste.length
                    ? '<p class="kamikaze-empty">Veri yok.</p>'
                    : '<div class="kamikaze-bars">' +
                    liste.map(function (r) {
                        var adet = parseInt(r && r.adet, 10) || 0;
                        var h = Math.max(12, Math.round((adet / max) * 120));
                        return (
                            '<div class="kamikaze-bar-col">' +
                            '<div class="kamikaze-bar ' + esc(cls || '') + '" style="height:' + h + 'px" title="' + esc(fmtSayi(adet)) + '"></div>' +
                            '<span>' + esc(fmtGun(r.gun)) + '</span>' +
                            '</div>'
                        );
                    }).join('') +
                    '</div>'
            ) +
            '</section>'
        );
    }

    function hikayeActionHtml(r) {
        return (
            '<div class="kamikaze-actions">' +
            '<button type="button" class="kamikaze-action-btn" data-km-act="story-open" data-story-id="' + esc(r.id) + '">Yönet</button>' +
            (r.user_id
                ? '<button type="button" class="kamikaze-action-btn" data-km-act="user-open" data-user-id="' + esc(r.user_id) + '">Üye</button>'
                : '') +
            '</div>'
        );
    }

    function yorumActionHtml(r) {
        return (
            '<div class="kamikaze-actions">' +
            '<button type="button" class="kamikaze-action-btn" data-km-act="comment-open" data-comment-id="' + esc(r.id) + '">Yorum</button>' +
            '<button type="button" class="kamikaze-action-btn" data-km-act="story-open" data-story-id="' + esc(r.itiraf_id) + '" data-comment-focus="' + esc(r.id) + '">Hikaye</button>' +
            (r.user_id
                ? '<button type="button" class="kamikaze-action-btn" data-km-act="user-open" data-user-id="' + esc(r.user_id) + '">Üye</button>'
                : '') +
            '</div>'
        );
    }

    function uyeActionHtml(r) {
        return '<div class="kamikaze-actions"><button type="button" class="kamikaze-action-btn" data-km-act="user-open" data-user-id="' + esc(r.id) + '">Yönet</button></div>';
    }

    function hikayeKolonlari() {
        return [
            {
                key: 'id',
                etiket: 'ID',
                value: function (r) { return '#' + r.id; },
                sortValue: function (r) { return num(r.id, 0); },
                filterValue: function (r) { return r.id; },
                filter: 'text'
            },
            {
                key: 'durum',
                etiket: 'Durum',
                value: function (r) { return statusBadge(r.status, r.silindi_at); },
                raw: true,
                filter: 'select',
                options: [
                    { value: 'kulis', label: 'Kulis' },
                    { value: 'podyum', label: 'Podyum' },
                    { value: 'silindi', label: 'Silindi' }
                ],
                filterValue: hikayeDurumText,
                sortValue: hikayeDurumText
            },
            {
                key: 'kullanici',
                etiket: 'Kullanıcı',
                value: function (r) { return esc(r.username || '—') + (r.is_gizli ? ' 🔒' : ''); },
                raw: true,
                filter: 'text',
                filterValue: function (r) { return (r.username || '') + ' ' + (r.user_email || ''); },
                sortValue: function (r) { return r.username || ''; }
            },
            {
                key: 'oy',
                etiket: 'Oy',
                value: function (r) { return fmtSayi(r.up_votes) + '/' + fmtSayi(r.down_votes); },
                filter: 'text',
                filterValue: function (r) { return String(num(r.up_votes, 0)) + ' ' + String(num(r.down_votes, 0)); },
                sortValue: function (r) { return num(r.up_votes, 0) - num(r.down_votes, 0); }
            },
            {
                key: 'icerik',
                etiket: 'İçerik',
                value: function (r) { return kisaMetin(r.content_full || r.onizleme, 120); },
                raw: true,
                filter: 'text',
                filterValue: function (r) { return r.content_full || r.onizleme || ''; },
                sortable: false
            },
            {
                key: 'tarih',
                etiket: 'Tarih',
                value: function (r) { return fmtTarih(r.created_at); },
                sortValue: function (r) { return new Date(r.created_at || 0).getTime(); },
                filterValue: function (r) { return fmtTarih(r.created_at); },
                filter: 'text'
            },
            {
                key: 'aksiyon',
                etiket: 'İşlem',
                value: hikayeActionHtml,
                raw: true,
                sortable: false
            }
        ];
    }

    function uyeKolonlari() {
        return [
            {
                key: 'id',
                etiket: 'ID',
                value: function (r) { return '<code>' + esc(shortUuid(r.id)) + '</code>'; },
                raw: true,
                filter: 'text',
                filterValue: function (r) { return r.id; },
                sortValue: function (r) { return r.id || ''; }
            },
            {
                key: 'rumuz',
                etiket: 'Rumuz',
                value: function (r) { return esc(r.username || '—') + (r.zorunlu_gizli ? ' <span class="kamikaze-badge kamikaze-badge--warn">gizli</span>' : ''); },
                raw: true,
                filter: 'text',
                filterValue: function (r) { return r.username; },
                sortValue: function (r) { return r.username || ''; }
            },
            {
                key: 'durum',
                etiket: 'Durum',
                value: userDurumBadge,
                raw: true,
                filter: 'select',
                options: [
                    { value: 'aktif', label: 'Aktif' },
                    { value: 'askıda', label: 'Askıda' },
                    { value: 'ban', label: 'Ban' }
                ],
                filterValue: userDurumText,
                sortValue: userDurumText
            },
            {
                key: 'eposta',
                etiket: 'E-posta',
                value: function (r) { return kisaMetin(r.email, 48); },
                raw: true,
                filter: 'text',
                filterValue: function (r) { return r.email; },
                sortValue: function (r) { return r.email || ''; }
            },
            {
                key: 'icerik',
                etiket: 'İçerik',
                value: function (r) {
                    return fmtSayi(r.itiraf_sayisi != null ? r.itiraf_sayisi : (r.istatistik && r.istatistik.hikaye) || 0) +
                        ' hikaye / ' +
                        fmtSayi(r.yorum_sayisi != null ? r.yorum_sayisi : (r.istatistik && r.istatistik.yorum) || 0) +
                        ' yorum';
                },
                filter: 'text',
                filterValue: function (r) {
                    return String(r.itiraf_sayisi != null ? r.itiraf_sayisi : 0) + ' ' +
                        String(r.yorum_sayisi != null ? r.yorum_sayisi : 0);
                },
                sortValue: function (r) { return num(r.itiraf_sayisi, 0) + num(r.yorum_sayisi, 0); }
            },
            {
                key: 'kayit',
                etiket: 'Kayıt',
                value: function (r) { return fmtTarih(r.created_at); },
                filter: 'text',
                filterValue: function (r) { return fmtTarih(r.created_at); },
                sortValue: function (r) { return new Date(r.created_at || 0).getTime(); }
            },
            {
                key: 'aksiyon',
                etiket: 'İşlem',
                value: uyeActionHtml,
                raw: true,
                sortable: false
            }
        ];
    }

    function yorumKolonlari() {
        return [
            {
                key: 'id',
                etiket: 'ID',
                value: function (r) { return '#' + r.id; },
                filter: 'text',
                filterValue: function (r) { return String(r.id) + ' ' + String(r.itiraf_id); },
                sortValue: function (r) { return num(r.id, 0); }
            },
            {
                key: 'hikaye',
                etiket: 'Hikaye',
                value: function (r) { return '#' + r.itiraf_id + ' ' + yorumDurumBadge(r); },
                raw: true,
                filter: 'text',
                filterValue: function (r) { return String(r.itiraf_id) + ' ' + (r.itiraf_status || ''); },
                sortValue: function (r) { return num(r.itiraf_id, 0); }
            },
            {
                key: 'kullanici',
                etiket: 'Kullanıcı',
                value: function (r) { return r.username || '—'; },
                filter: 'text',
                filterValue: function (r) { return (r.username || '') + ' ' + (r.email || ''); },
                sortValue: function (r) { return r.username || ''; }
            },
            {
                key: 'yorum',
                etiket: 'Yorum',
                value: function (r) { return kisaMetin(r.content, 140); },
                raw: true,
                filter: 'text',
                filterValue: function (r) { return r.content || ''; },
                sortable: false
            },
            {
                key: 'tarih',
                etiket: 'Tarih',
                value: function (r) { return fmtTarih(r.created_at); },
                filter: 'text',
                filterValue: function (r) { return fmtTarih(r.created_at); },
                sortValue: function (r) { return new Date(r.created_at || 0).getTime(); }
            },
            {
                key: 'aksiyon',
                etiket: 'İşlem',
                value: yorumActionHtml,
                raw: true,
                sortable: false
            }
        ];
    }

    function renderAramaBolumu() {
        if (!aramaMetni) return '';
        var sayilar = (aramaData && aramaData.sayilar) || {};
        var html = '<section class="kamikaze-section"><div class="kamikaze-section-head"><h2>Arama sonuçları</h2></div>';
        html += '<div class="kamikaze-search-summary">';
        html += '<span class="kamikaze-search-pill">Sorgu: <strong>' + esc(aramaMetni) + '</strong></span>';
        html += '<span class="kamikaze-search-pill">Üye: ' + esc(fmtSayi(sayilar.uyeler)) + '</span>';
        html += '<span class="kamikaze-search-pill">Hikaye: ' + esc(fmtSayi(sayilar.hikayeler)) + '</span>';
        html += '<span class="kamikaze-search-pill">Yorum: ' + esc(fmtSayi(sayilar.yorumlar)) + '</span>';
        html += '</div>';
        if (!aramaData || !aramaData.ok) {
            html += '<p class="kamikaze-error">' + esc((aramaData && aramaData.hata) || 'Arama yapılamadı.') + '</p></section>';
            return html;
        }
        if (!arr(aramaData.uyeler).length && !arr(aramaData.hikayeler).length && !arr(aramaData.yorumlar).length) {
            html += '<p class="kamikaze-empty">Sonuç bulunamadı.</p></section>';
            return html;
        }
        html += '</section>';
        html += renderTableSection({
            id: 'arama-hikayeler',
            title: 'Aranan hikayeler',
            rows: arr(aramaData.hikayeler),
            columns: hikayeKolonlari(),
            empty: 'Hikaye sonucu yok.'
        });
        html += renderTableSection({
            id: 'arama-uyeler',
            title: 'Aranan üyeler',
            rows: arr(aramaData.uyeler),
            columns: uyeKolonlari(),
            empty: 'Üye sonucu yok.'
        });
        html += renderTableSection({
            id: 'arama-yorumlar',
            title: 'Aranan yorumlar',
            rows: arr(aramaData.yorumlar),
            columns: yorumKolonlari(),
            empty: 'Yorum sonucu yok.'
        });
        return html;
    }

    function render(veri) {
        var kok = document.getElementById('kamikazeIcerik');
        var meta = document.getElementById('kamikazeSonMeta');
        if (!kok) return;

        toolbarAramaGuncelle();

        if (!veri || !veri.ok) {
            kok.innerHTML = '<p class="kamikaze-error">' + esc((veri && veri.hata) || 'Veri alınamadı.') + '</p>';
            if (meta) meta.textContent = '—';
            return;
        }

        var itiraflar = hikayeleriFiltrele(veri.son_itiraflar, aktifFiltre);
        var html = '';
        html += renderAramaBolumu();
        html += kpiHtml(veri.ozet);
        html += '<div class="kamikaze-chart-grid">';
        html += barChartHtml('Son 14 gün — yeni hikaye', veri.gunluk_itiraf, 'kamikaze-bar--amber');
        html += barChartHtml('Son 14 gün — yeni üye', veri.gunluk_uye, 'kamikaze-bar--green');
        html += '</div>';
        html += renderTableSection({
            id: 'hikayeler',
            title: 'Hikayeler',
            rows: itiraflar,
            columns: hikayeKolonlari(),
            note: 'Durum filtresi üst çubuktan; sütun başlıkları ayrıca filtrelenebilir.',
            empty: 'Bu filtrede hikaye yok.'
        });
        html += renderTableSection({
            id: 'yorumlar',
            title: 'Son yorumlar',
            rows: arr(veri.son_yorumlar),
            columns: yorumKolonlari(),
            empty: 'Yorum yok.'
        });
        html += renderTableSection({
            id: 'uyeler',
            title: 'Son üyeler',
            rows: arr(veri.son_uyeler),
            columns: uyeKolonlari(),
            empty: 'Üye yok.'
        });
        html += renderTableSection({
            id: 'podyum',
            title: 'Podyum dönemleri',
            rows: arr(veri.podyum_donemler),
            columns: [
                { key: 'donem', etiket: 'Dönem', alan: 'donem', filter: 'text', sortValue: function (r) { return r.donem || ''; } },
                { key: 'adet', etiket: 'Kart', value: function (r) { return fmtSayi(r.adet); }, filter: 'text', sortValue: function (r) { return num(r.adet, 0); } },
                { key: 'sira', etiket: 'Max sıra', value: function (r) { return r.max_sira || '—'; }, filter: 'text', sortValue: function (r) { return num(r.max_sira, 0); } }
            ],
            empty: 'Podyum dönemi yok.'
        });
        html += renderTableSection({
            id: 'kulis-lider',
            title: 'Kulis liderlik',
            rows: arr(veri.kulis_lider),
            columns: hikayeKolonlari(),
            empty: 'Kulis boş.'
        });
        html += renderTableSection({
            id: 'sikayetler',
            title: 'Şikayetler',
            rows: arr(veri.sikayetler),
            columns: [
                { key: 'id', etiket: 'ID', value: function (r) { return '#' + r.id; }, filter: 'text', sortValue: function (r) { return num(r.id, 0); } },
                { key: 'hikaye', etiket: 'Hikaye', value: function (r) { return '#' + r.itiraf_id + ' ' + statusBadge(r.itiraf_status, false); }, raw: true, filter: 'text', filterValue: function (r) { return String(r.itiraf_id) + ' ' + (r.itiraf_status || ''); }, sortValue: function (r) { return num(r.itiraf_id, 0); } },
                { key: 'sebep', etiket: 'Sebep', alan: 'sebep', filter: 'text' },
                { key: 'aciklama', etiket: 'Açıklama', value: function (r) { return kisaMetin(r.aciklama, 120); }, raw: true, filter: 'text', filterValue: function (r) { return r.aciklama || ''; }, sortable: false },
                { key: 'tarih', etiket: 'Tarih', value: function (r) { return fmtTarih(r.created_at); }, filter: 'text', sortValue: function (r) { return new Date(r.created_at || 0).getTime(); } },
                { key: 'aksiyon', etiket: 'İşlem', value: function (r) { return '<div class="kamikaze-actions"><button type="button" class="kamikaze-action-btn" data-km-act="story-open" data-story-id="' + esc(r.itiraf_id) + '">Hikaye</button></div>'; }, raw: true, sortable: false }
            ],
            empty: 'Şikayet yok.'
        });
        html += renderTableSection({
            id: 'site-ayar',
            title: 'Site ayarları',
            rows: arr(veri.site_ayar),
            columns: [
                { key: 'anahtar', etiket: 'Anahtar', value: function (r) { return '<code>' + esc(r.anahtar) + '</code>'; }, raw: true, filter: 'text', filterValue: function (r) { return r.anahtar; }, sortValue: function (r) { return r.anahtar || ''; } },
                { key: 'deger', etiket: 'Değer', value: function (r) { return kisaMetin(ayarDegeri(r.anahtar, r.deger), 140); }, raw: true, filter: 'text', filterValue: function (r) { return ayarDegeri(r.anahtar, r.deger); }, sortable: false },
                { key: 'guncelleme', etiket: 'Güncelleme', value: function (r) { return fmtTarih(r.updated_at); }, filter: 'text', sortValue: function (r) { return new Date(r.updated_at || 0).getTime(); } }
            ],
            empty: 'Site ayarı yok.'
        });
        html += '<p class="kamikaze-note">Kamikaze artık arama, sütun bazlı filtreleme ve master düzenleme akışlarını tek panelde toplar. Hikaye, yorum, üye ve oy kayıtları modal üzerinden yönetilebilir.</p>';

        kok.innerHTML = html;
        if (meta) meta.textContent = 'Son güncelleme: ' + fmtTarih(veri.zaman);
    }

    function renderCurrent() {
        if (panelData) render(panelData);
    }

    function yukleniyor(goster) {
        var el = document.getElementById('kamikazeYukleniyor');
        if (el) el.hidden = !goster;
    }

    function yetkisizGoster(mesaj, girisGoster) {
        var y = document.getElementById('kamikazeYetkisiz');
        var i = document.getElementById('kamikazeIcerik');
        var a = document.getElementById('kamikazeAraclar');
        var l = document.getElementById('kamikazeYukleniyor');
        if (l) l.hidden = true;
        if (a) a.hidden = true;
        if (i) i.hidden = true;
        if (y) {
            y.hidden = false;
            var p = document.getElementById('kamikazeYetkisizMetin');
            if (p) p.textContent = mesaj || 'Bu sayfaya yalnızca site yöneticisi erişebilir.';
            var g = document.getElementById('kamikazeGirisBtn');
            if (g) g.hidden = !girisGoster;
        }
    }

    function icerikGoster() {
        var y = document.getElementById('kamikazeYetkisiz');
        var i = document.getElementById('kamikazeIcerik');
        var a = document.getElementById('kamikazeAraclar');
        if (y) y.hidden = true;
        if (a) a.hidden = false;
        if (i) i.hidden = false;
    }

    async function veriYukle() {
        var D = db();
        if (!D || !D.masterKamikazePanel) return;
        yukleniyor(true);
        try {
            panelData = await D.masterKamikazePanel();
            render(panelData);
        } catch (e) {
            render({ ok: false, hata: D.hataMesaji ? D.hataMesaji(e) : String(e) });
        } finally {
            yukleniyor(false);
        }
    }

    async function panelVeAramaYenile() {
        var D = db();
        var q = aramaMetni;
        await veriYukle();
        if (!D || !q || !D.masterKamikazeAra) return;
        try {
            aramaData = await D.masterKamikazeAra(q, 40);
        } catch (e) {
            aramaData = { ok: false, hata: D.hataMesaji ? D.hataMesaji(e) : String(e) };
        }
        renderCurrent();
    }

    function aramaGecerliMi(q) {
        var metin = String(q || '').trim();
        return !metin || /^[0-9]+$/.test(metin) || metin.length >= 2;
    }

    async function aramaYap(mevcutMetinKullan) {
        var D = db();
        var input = document.getElementById('kamikazeAra');
        var istekNo;
        if (!D || !D.masterKamikazeAra) return;
        aramaMetni = mevcutMetinKullan ? aramaMetni : String(input && input.value || '').trim();
        toolbarAramaGuncelle();
        if (!aramaMetni) {
            aramaData = null;
            renderCurrent();
            return;
        }
        if (!aramaGecerliMi(aramaMetni)) {
            aramaData = null;
            renderCurrent();
            return;
        }
        istekNo = ++aramaIstekNo;
        yukleniyor(true);
        try {
            var sonuc = await D.masterKamikazeAra(aramaMetni, 40);
            if (istekNo !== aramaIstekNo) return;
            aramaData = sonuc;
        } catch (e) {
            if (istekNo !== aramaIstekNo) return;
            aramaData = { ok: false, hata: D.hataMesaji ? D.hataMesaji(e) : String(e) };
        } finally {
            if (istekNo !== aramaIstekNo) return;
            yukleniyor(false);
            renderCurrent();
        }
    }

    function aramaTemizle() {
        aramaIstekNo += 1;
        if (aramaZamanlayici) {
            clearTimeout(aramaZamanlayici);
            aramaZamanlayici = null;
        }
        aramaMetni = '';
        aramaData = null;
        toolbarAramaGuncelle();
        renderCurrent();
    }

    function aramaCanliTetikle() {
        if (aramaZamanlayici) clearTimeout(aramaZamanlayici);
        aramaZamanlayici = setTimeout(function () {
            aramaYap(false);
        }, 250);
    }

    function hikayeModalHtml(veri) {
        var hikaye = (veri && veri.hikaye) || {};
        var yorumlar = arr(veri && veri.yorumlar);
        var oylar = arr(veri && veri.oylar);
        var yerSecili = hikaye.yasadigi_yer || '';
        var yurtdisiAcik = yerSecili === 'yurtdisi';
        var sonucHtml = '';

        if (modalState.voteUserQuery && modalState.voteUserResults.length) {
            sonucHtml += '<div class="kamikaze-vote-results">';
            modalState.voteUserResults.forEach(function (u) {
                sonucHtml +=
                    '<div class="kamikaze-vote-result">' +
                    '<div><strong>' + esc(u.username || '—') + '</strong><div class="kamikaze-note">' + esc(u.email || '—') + '</div></div>' +
                    '<div class="kamikaze-vote-row-actions">' +
                    '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="story-vote-add" data-user-id="' + esc(u.id) + '" data-vote="1">Like</button>' +
                    '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="story-vote-add" data-user-id="' + esc(u.id) + '" data-vote="-1">Dislike</button>' +
                    '</div></div>';
            });
            sonucHtml += '</div>';
        } else if (modalState.voteUserQuery && !modalState.voteUserResults.length) {
            sonucHtml = '<p class="kamikaze-note">Bu aramada üye bulunamadı.</p>';
        }

        return (
            '<section class="kamikaze-modal-section">' +
            '<div class="kamikaze-modal-meta">' +
            '<span>#' + esc(hikaye.id) + '</span>' +
            '<span>' + statusBadge(hikaye.status, hikaye.silindi_at) + '</span>' +
            '<span>' + esc(fmtTarih(hikaye.created_at)) + '</span>' +
            '<span>👍 ' + esc(fmtSayi(hikaye.up_votes)) + ' · 👎 ' + esc(fmtSayi(hikaye.down_votes)) + '</span>' +
            '</div>' +
            '<div class="kamikaze-modal-actions">' +
            (hikaye.user_id
                ? '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="open-user" data-user-id="' + esc(hikaye.user_id) + '">Üye profilini aç</button>'
                : '') +
            '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="refresh-story">Yenile</button>' +
            '</div>' +
            '</section>' +

            '<section class="kamikaze-modal-section">' +
            '<h3>Hikaye yönetimi</h3>' +
            '<textarea id="kmStoryText" rows="8">' + esc(hikaye.content_full || '') + '</textarea>' +
            '<div class="kamikaze-modal-actions">' +
            '<button type="button" class="kamikaze-modal-btn kamikaze-modal-btn--primary" data-km-modal-act="story-save-text">Metni kaydet</button>' +
            '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="story-toggle-visibility">' + (hikaye.is_gizli ? 'Gizliyi kaldır' : 'Gizle') + '</button>' +
            (hikaye.silindi_at
                ? '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="story-restore">Geri al</button>'
                : '<button type="button" class="kamikaze-modal-btn kamikaze-modal-btn--tehlike" data-km-modal-act="story-delete">Sil</button>') +
            '</div>' +
            '<div class="kamikaze-modal-grid">' +
            '<label>Durum<select id="kmStoryStatus"><option value="kulis"' + (hikaye.status === 'kulis' ? ' selected' : '') + '>Kulis</option><option value="podyum"' + (hikaye.status === 'podyum' ? ' selected' : '') + '>Podyum</option></select></label>' +
            '<label>Like/Dislike<input id="kmStoryVoteSummary" value="👍 ' + esc(fmtSayi(hikaye.up_votes)) + ' · 👎 ' + esc(fmtSayi(hikaye.down_votes)) + '" disabled></label>' +
            '</div>' +
            '<div class="kamikaze-modal-actions"><button type="button" class="kamikaze-modal-btn" data-km-modal-act="story-save-status">Durumu uygula</button></div>' +
            '</section>' +

            '<section class="kamikaze-modal-section">' +
            '<h3>Kart meta</h3>' +
            '<div class="kamikaze-modal-grid">' +
            '<label>Yaş<input type="number" min="18" max="120" id="kmStoryAge" value="' + esc(hikaye.age != null ? hikaye.age : '') + '"></label>' +
            '<label>Cinsiyet<select id="kmStoryGender"><option value="female"' + (hikaye.gender === 'female' ? ' selected' : '') + '>Kadın</option><option value="male"' + (hikaye.gender === 'male' ? ' selected' : '') + '>Erkek</option></select></label>' +
            '<label>Yaşadığı yer<select id="kmStoryYer">' + selectYerHtml(yerSecili) + '</select></label>' +
            '<label id="kmStoryYurtdisiWrap"' + (yurtdisiAcik ? '' : ' hidden') + '>Yurtdışı şehir<input type="text" id="kmStoryYurtdisi" maxlength="80" value="' + esc(hikaye.yurtdisi_sehir || '') + '"></label>' +
            '</div>' +
            '<div class="kamikaze-modal-actions"><button type="button" class="kamikaze-modal-btn" data-km-modal-act="story-save-meta">Meta kaydet</button></div>' +
            '</section>' +

            '<section class="kamikaze-modal-section">' +
            '<h3>Oy sayaçları</h3>' +
            '<div class="kamikaze-modal-grid">' +
            '<label>Like<input type="number" min="0" id="kmStoryUpVotes" value="' + esc(num(hikaye.up_votes, 0)) + '"></label>' +
            '<label>Dislike<input type="number" min="0" id="kmStoryDownVotes" value="' + esc(num(hikaye.down_votes, 0)) + '"></label>' +
            '</div>' +
            '<div class="kamikaze-modal-actions"><button type="button" class="kamikaze-modal-btn" data-km-modal-act="story-save-counts">Sayaçları kaydet</button></div>' +
            '</section>' +

            '<section class="kamikaze-modal-section">' +
            '<h3>Yorumlar</h3>' +
            (yorumlar.length
                ? yorumlar.map(function (y) {
                    var highlight = String(modalState.highlightCommentId || '') === String(y.id) ? ' kamikaze-highlight' : '';
                    return (
                        '<article class="kamikaze-mini-card' + highlight + '">' +
                        '<div class="kamikaze-mini-head"><span>#' + esc(y.id) + ' · ' + esc(y.username || '—') + '</span><span>' + esc(fmtTarih(y.created_at)) + '</span></div>' +
                        '<textarea rows="4" data-km-comment-text="' + esc(y.id) + '">' + esc(y.content || '') + '</textarea>' +
                        '<div class="kamikaze-mini-actions">' +
                        '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="comment-save" data-comment-id="' + esc(y.id) + '">Kaydet</button>' +
                        '<button type="button" class="kamikaze-modal-btn kamikaze-modal-btn--tehlike" data-km-modal-act="comment-delete" data-comment-id="' + esc(y.id) + '">Sil</button>' +
                        (y.user_id ? '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="open-user" data-user-id="' + esc(y.user_id) + '">Üye</button>' : '') +
                        '</div></article>'
                    );
                }).join('')
                : '<p class="kamikaze-empty">Bu hikayede yorum yok.</p>') +
            '</section>' +

            '<section class="kamikaze-modal-section">' +
            '<h3>Oy kayıtları</h3>' +
            '<div class="kamikaze-modal-grid kamikaze-modal-grid--tek">' +
            '<label>Üye ara<input type="search" id="kmVoteUserQuery" value="' + esc(modalState.voteUserQuery || '') + '" placeholder="Rumuz veya e-posta"></label>' +
            '</div>' +
            '<div class="kamikaze-modal-actions"><button type="button" class="kamikaze-modal-btn" data-km-modal-act="story-vote-search">Üye ara</button></div>' +
            sonucHtml +
            (oylar.length
                ? '<div class="kamikaze-table-wrap"><table class="kamikaze-table"><thead><tr><th>Üye</th><th>Oy</th><th>Tarih</th><th>İşlem</th></tr></thead><tbody>' +
                oylar.map(function (o) {
                    return (
                        '<tr>' +
                        '<td>' + esc(o.username || '—') + '<div class="kamikaze-note">' + esc(o.email || '') + '</div></td>' +
                        '<td><select data-km-vote-select="' + esc(o.id) + '">' +
                        '<option value="1"' + (num(o.oy, 0) === 1 ? ' selected' : '') + '>Like</option>' +
                        '<option value="-1"' + (num(o.oy, 0) === -1 ? ' selected' : '') + '>Dislike</option>' +
                        '</select></td>' +
                        '<td>' + esc(fmtTarih(o.created_at)) + '</td>' +
                        '<td><div class="kamikaze-actions">' +
                        '<button type="button" class="kamikaze-action-btn" data-km-modal-act="vote-save" data-vote-id="' + esc(o.id) + '">Kaydet</button>' +
                        '<button type="button" class="kamikaze-action-btn kamikaze-action-btn--tehlike" data-km-modal-act="vote-delete" data-vote-id="' + esc(o.id) + '">Sil</button>' +
                        '</div></td>' +
                        '</tr>'
                    );
                }).join('') + '</tbody></table></div>'
                : '<p class="kamikaze-empty">Bu hikayede oy kaydı yok.</p>') +
            '</section>'
        );
    }

    function hikayeModalSonrasi() {
        var yer = document.getElementById('kmStoryYer');
        var wrap = document.getElementById('kmStoryYurtdisiWrap');
        if (yer && wrap) {
            yer.addEventListener('change', function () {
                wrap.hidden = yer.value !== 'yurtdisi';
            });
        }
    }

    function kullaniciAktiviteHtml(u) {
        var a = (u && u.aktivite) || {};
        return (
            '<div class="kamikaze-note">' +
            'Son aktif: ' + esc(fmtTarih(a.son_aktif_at)) +
            ' · Son IP: ' + esc(a.son_ip || '—') +
            ' · Son sayfa: ' + esc(a.son_sayfa || '—') +
            '</div>'
        );
    }

    function uyeIcerikKartlari(icerik) {
        var hikayeler = arr(icerik && icerik.hikayeler);
        var yorumlar = arr(icerik && icerik.yorumlar);
        return (
            '<section class="kamikaze-modal-section">' +
            '<h3>Üyenin hikayeleri</h3>' +
            (hikayeler.length
                ? hikayeler.map(function (h) {
                    return (
                        '<article class="kamikaze-mini-card">' +
                        '<div class="kamikaze-mini-head"><span>#' + esc(h.id) + ' · ' + esc(hikayeDurumText(h)) + '</span><span>' + esc(fmtTarih(h.created_at)) + '</span></div>' +
                        '<textarea rows="4" data-km-user-story-text="' + esc(h.id) + '">' + esc(h.content_full || '') + '</textarea>' +
                        '<div class="kamikaze-mini-actions">' +
                        '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="user-story-save" data-story-id="' + esc(h.id) + '">Kaydet</button>' +
                        '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="user-story-toggle" data-story-id="' + esc(h.id) + '" data-hidden="' + (h.is_gizli ? '1' : '0') + '">' + (h.is_gizli ? 'Göster' : 'Gizle') + '</button>' +
                        (h.silindi_at
                            ? '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="user-story-restore" data-story-id="' + esc(h.id) + '">Geri al</button>'
                            : '<button type="button" class="kamikaze-modal-btn kamikaze-modal-btn--tehlike" data-km-modal-act="user-story-delete" data-story-id="' + esc(h.id) + '">Sil</button>') +
                        '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="open-story" data-story-id="' + esc(h.id) + '">Detay</button>' +
                        '</div></article>'
                    );
                }).join('')
                : '<p class="kamikaze-empty">Hikaye yok.</p>') +
            '</section>' +
            '<section class="kamikaze-modal-section">' +
            '<h3>Üyenin yorumları</h3>' +
            (yorumlar.length
                ? yorumlar.map(function (y) {
                    return (
                        '<article class="kamikaze-mini-card">' +
                        '<div class="kamikaze-mini-head"><span>Yorum #' + esc(y.id) + ' · Hikaye #' + esc(y.itiraf_id) + '</span><span>' + esc(fmtTarih(y.created_at)) + '</span></div>' +
                        '<textarea rows="3" data-km-user-comment-text="' + esc(y.id) + '">' + esc(y.content || '') + '</textarea>' +
                        '<div class="kamikaze-mini-actions">' +
                        '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="user-comment-save" data-comment-id="' + esc(y.id) + '">Kaydet</button>' +
                        '<button type="button" class="kamikaze-modal-btn kamikaze-modal-btn--tehlike" data-km-modal-act="user-comment-delete" data-comment-id="' + esc(y.id) + '">Sil</button>' +
                        '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="open-story" data-story-id="' + esc(y.itiraf_id) + '" data-comment-focus="' + esc(y.id) + '">Hikaye</button>' +
                        '</div></article>'
                    );
                }).join('')
                : '<p class="kamikaze-empty">Yorum yok.</p>') +
            '</section>'
        );
    }

    function uyeModalHtml(veri) {
        var uye = (veri && veri.uye) || {};
        var icerik = (veri && veri.icerik) || {};
        var yurtdisi = uye.yasadigi_yer === 'yurtdisi';
        return (
            '<section class="kamikaze-modal-section">' +
            '<div class="kamikaze-user-header">' +
            '<div class="kamikaze-avatar" id="kmUserAvatar" aria-label="Profil fotoğrafı"></div>' +
            '<div><strong>' + esc(uye.username || '—') + '</strong><div class="kamikaze-note">' + esc(uye.email || '—') + '</div>' +
            userDurumBadge(uye) + '</div>' +
            '</div>' +
            kullaniciAktiviteHtml(uye) +
            '</section>' +

            '<section class="kamikaze-modal-section">' +
            '<h3>Üye bilgileri</h3>' +
            '<form id="kmUserForm">' +
            '<input type="hidden" name="uye_id" value="' + esc(uye.id || '') + '">' +
            '<div class="kamikaze-form-grid">' +
            '<label><span>Rumuz</span><input name="username" maxlength="15" value="' + esc(uye.username || '') + '"></label>' +
            '<label><span>E-posta</span><input type="email" name="email" maxlength="80" value="' + esc(uye.email || '') + '"></label>' +
            '<label><span>Cinsiyet</span><select name="gender"><option value="female"' + (uye.gender === 'female' ? ' selected' : '') + '>Kadın</option><option value="male"' + (uye.gender === 'male' ? ' selected' : '') + '>Erkek</option></select></label>' +
            '<label><span>Doğum yılı</span><select name="dogum_yili">' + yilSecenekleriHtml(uye.dogum_yili) + '</select></label>' +
            '<label><span>Yaşadığı yer</span><select id="kmUserYer" name="yasadigi_yer">' + selectYerHtml(uye.yasadigi_yer || '') + '</select></label>' +
            '<label id="kmUserYurtdisiWrap"' + (yurtdisi ? '' : ' hidden') + '><span>Yurtdışı şehir</span><input name="yurtdisi_sehir" maxlength="80" value="' + esc(uye.yurtdisi_sehir || '') + '"></label>' +
            '<label><span>Meslek</span><select name="meslek">' + selectMeslekHtml(uye.meslek || '') + '</select></label>' +
            '<label><span>Medeni durum</span><select name="medeni_durum">' + selectMedeniHtml(uye.medeni_durum || '') + '</select></label>' +
            '<label class="kamikaze-form-span"><span>Durum notu</span><textarea name="durum_notu" rows="2" maxlength="500">' + esc(uye.durum_notu || '') + '</textarea></label>' +
            '</div>' +
            '</form>' +
            '<div class="kamikaze-modal-actions">' +
            '<button type="button" class="kamikaze-modal-btn kamikaze-modal-btn--primary" data-km-modal-act="user-save">Profili kaydet</button>' +
            '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="user-action" data-user-action="aktif">Aktif</button>' +
            '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="user-action" data-user-action="askida">Askıya al</button>' +
            '<button type="button" class="kamikaze-modal-btn kamikaze-modal-btn--tehlike" data-km-modal-act="user-action" data-user-action="ban">Banla</button>' +
            '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="user-action" data-user-action="gizli_uye">Gizli üye</button>' +
            '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="user-action" data-user-action="gizli_kaldir">Rumuz göster</button>' +
            '<button type="button" class="kamikaze-modal-btn kamikaze-modal-btn--tehlike" data-km-modal-act="user-action" data-user-action="sil">Hesabı sil</button>' +
            '</div>' +
            '<div class="kamikaze-modal-actions">' +
            '<button type="button" class="kamikaze-modal-btn" id="kmUserAvatarDegistir" data-km-modal-act="user-avatar-pick">Fotoğraf değiştir</button>' +
            '<button type="button" class="kamikaze-modal-btn kamikaze-modal-btn--tehlike" id="kmUserAvatarKaldir" data-km-modal-act="user-avatar-remove"' + (uye.avatar_url ? '' : ' hidden') + '>Fotoğraf kaldır</button>' +
            '<input type="file" id="kmUserAvatarInput" accept="image/jpeg,image/png,image/webp,image/gif" hidden>' +
            '</div>' +
            '</section>' +
            uyeIcerikKartlari(icerik)
        );
    }

    function uyeModalSonrasi() {
        var body = document.getElementById('kamikazeModalBody');
        var yer = document.getElementById('kmUserYer');
        var wrap = document.getElementById('kmUserYurtdisiWrap');
        if (yer && wrap) {
            yer.addEventListener('change', function () {
                wrap.hidden = yer.value !== 'yurtdisi';
            });
        }
        avatarGuncelle(body, modalState.data && modalState.data.uye);
    }

    function yorumModalHtml(veri) {
        var yorum = veri || {};
        return (
            '<section class="kamikaze-modal-section">' +
            '<div class="kamikaze-modal-meta"><span>Yorum #' + esc(yorum.id) + '</span><span>Hikaye #' + esc(yorum.itiraf_id) + '</span><span>' + yorumDurumBadge(yorum) + '</span><span>' + esc(fmtTarih(yorum.created_at)) + '</span></div>' +
            '<textarea id="kmCommentText" rows="8">' + esc(yorum.content || '') + '</textarea>' +
            '<div class="kamikaze-modal-actions">' +
            '<button type="button" class="kamikaze-modal-btn kamikaze-modal-btn--primary" data-km-modal-act="comment-quick-save">Yorumu kaydet</button>' +
            '<button type="button" class="kamikaze-modal-btn kamikaze-modal-btn--tehlike" data-km-modal-act="comment-quick-delete">Sil</button>' +
            '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="open-story" data-story-id="' + esc(yorum.itiraf_id) + '" data-comment-focus="' + esc(yorum.id) + '">Hikayeyi aç</button>' +
            (yorum.user_id ? '<button type="button" class="kamikaze-modal-btn" data-km-modal-act="open-user" data-user-id="' + esc(yorum.user_id) + '">Üye</button>' : '') +
            '</div>' +
            '</section>'
        );
    }

    function yorumSatiriBul(cevapId) {
        var kaynaklar = [arr(aramaData && aramaData.yorumlar), arr(panelData && panelData.son_yorumlar)];
        var bulunan = null;
        kaynaklar.some(function (liste) {
            return liste.some(function (item) {
                if (String(item.id) === String(cevapId)) {
                    bulunan = item;
                    return true;
                }
                return false;
            });
        });
        return bulunan;
    }

    async function hikayeDetayAc(itirafId, focusCommentId) {
        var D = db();
        if (!D || !D.masterKamikazeHikayeDetay) return;
        modalState.type = 'loading';
        modalState.title = 'Hikaye #' + itirafId;
        modalState.highlightCommentId = focusCommentId || null;
        modalGuncelle();
        try {
            var sonuc = await D.masterKamikazeHikayeDetay(itirafId);
            if (!sonuc || !sonuc.ok) throw new Error((sonuc && sonuc.hata) || 'Hikaye yüklenemedi');
            modalState.type = 'story';
            modalState.title = 'Hikaye #' + itirafId;
            modalState.data = sonuc;
            modalGuncelle();
        } catch (e) {
            modalState.type = 'error';
            modalState.title = 'Hata';
            modalState.error = D.hataMesaji ? D.hataMesaji(e) : String(e);
            modalGuncelle();
        }
    }

    async function uyeDetayAc(uyeId) {
        var D = db();
        if (!D || !D.masterUyeDetay) return;
        modalState.type = 'loading';
        modalState.title = 'Üye';
        modalGuncelle();
        try {
            var detay = await D.masterUyeDetay(uyeId);
            if (!detay || !detay.ok || !detay.uye) throw new Error((detay && detay.hata) || 'Üye yüklenemedi');
            var icerik = { ok: false };
            if (D.masterUyeIcerik) {
                try {
                    icerik = await D.masterUyeIcerik(uyeId);
                } catch (e2) {
                    icerik = { ok: false };
                }
            }
            modalState.type = 'user';
            modalState.title = detay.uye.username || 'Üye';
            modalState.data = {
                uye: detay.uye,
                icerik: icerik && icerik.ok ? icerik : { hikayeler: [], yorumlar: [] }
            };
            modalGuncelle();
        } catch (e) {
            modalState.type = 'error';
            modalState.title = 'Hata';
            modalState.error = D.hataMesaji ? D.hataMesaji(e) : String(e);
            modalGuncelle();
        }
    }

    function yorumDetayAc(cevapId) {
        var yorum = yorumSatiriBul(cevapId);
        if (!yorum) return;
        modalState.type = 'comment';
        modalState.title = 'Yorum #' + cevapId;
        modalState.data = yorum;
        modalGuncelle();
    }

    async function hikayeIslemUygula(body) {
        var D = db();
        if (!D || !D.masterHikayeIslem) return false;
        try {
            var sonuc = await D.masterHikayeIslem(body);
            if (!sonuc || !sonuc.ok) throw new Error((sonuc && sonuc.hata) || 'İşlem başarısız');
            if (ui() && ui().showToast) ui().showToast('Hikaye güncellendi');
            await panelVeAramaYenile();
            return true;
        } catch (e) {
            if (ui() && ui().showToast) ui().showToast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
            return false;
        }
    }

    async function yorumIslemUygula(body, siliniyor) {
        var D = db();
        if (!D || !D.masterCevapIslem) return false;
        try {
            var sonuc = await D.masterCevapIslem(body);
            if (!sonuc || !sonuc.ok) throw new Error((sonuc && sonuc.hata) || 'İşlem başarısız');
            if (ui() && ui().showToast) ui().showToast(siliniyor ? 'Yorum silindi' : 'Yorum güncellendi');
            await panelVeAramaYenile();
            return true;
        } catch (e) {
            if (ui() && ui().showToast) ui().showToast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
            return false;
        }
    }

    async function oyIslemUygula(body, siliniyor) {
        var D = db();
        if (!D || !D.masterOyIslem) return false;
        try {
            var sonuc = await D.masterOyIslem(body);
            if (!sonuc || !sonuc.ok) throw new Error((sonuc && sonuc.hata) || 'Oy işlemi başarısız');
            if (ui() && ui().showToast) ui().showToast(siliniyor ? 'Oy silindi' : 'Oy güncellendi');
            await panelVeAramaYenile();
            return true;
        } catch (e) {
            if (ui() && ui().showToast) ui().showToast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
            return false;
        }
    }

    async function storyModalAction(act, btn) {
        var veri = modalState.data || {};
        var hikaye = veri.hikaye || {};
        var id = hikaye.id;
        var success = false;
        if (!id) return;

        if (act === 'refresh-story') {
            await hikayeDetayAc(id, modalState.highlightCommentId);
            return;
        }
        if (act === 'open-user') {
            await uyeDetayAc(btn.getAttribute('data-user-id'));
            return;
        }
        if (act === 'story-save-text') {
            success = await hikayeIslemUygula({
                itiraf_id: id,
                islem: 'guncelle',
                content_full: document.getElementById('kmStoryText').value
            });
            if (success) await hikayeDetayAc(id, modalState.highlightCommentId);
            return;
        }
        if (act === 'story-toggle-visibility') {
            success = await hikayeIslemUygula({
                itiraf_id: id,
                islem: hikaye.is_gizli ? 'goster' : 'gizle'
            });
            if (success) await hikayeDetayAc(id, modalState.highlightCommentId);
            return;
        }
        if (act === 'story-delete') {
            if (!global.confirm('Bu hikayeyi silmek istiyor musun?')) return;
            success = await hikayeIslemUygula({ itiraf_id: id, islem: 'sil' });
            if (success) await hikayeDetayAc(id, modalState.highlightCommentId);
            return;
        }
        if (act === 'story-restore') {
            success = await hikayeIslemUygula({ itiraf_id: id, islem: 'geri_al' });
            if (success) await hikayeDetayAc(id, modalState.highlightCommentId);
            return;
        }
        if (act === 'story-save-status') {
            success = await hikayeIslemUygula({
                itiraf_id: id,
                islem: 'status',
                status: document.getElementById('kmStoryStatus').value
            });
            if (success) await hikayeDetayAc(id, modalState.highlightCommentId);
            return;
        }
        if (act === 'story-save-counts') {
            success = await hikayeIslemUygula({
                itiraf_id: id,
                islem: 'oylar',
                up_votes: parseInt(document.getElementById('kmStoryUpVotes').value, 10) || 0,
                down_votes: parseInt(document.getElementById('kmStoryDownVotes').value, 10) || 0
            });
            if (success) await hikayeDetayAc(id, modalState.highlightCommentId);
            return;
        }
        if (act === 'story-save-meta') {
            var yer = document.getElementById('kmStoryYer').value;
            success = await hikayeIslemUygula({
                itiraf_id: id,
                islem: 'meta',
                age: parseInt(document.getElementById('kmStoryAge').value, 10),
                gender: document.getElementById('kmStoryGender').value,
                yasadigi_yer: yer || null,
                yurtdisi_sehir: yer === 'yurtdisi' ? String(document.getElementById('kmStoryYurtdisi').value || '').trim() || null : null
            });
            if (success) await hikayeDetayAc(id, modalState.highlightCommentId);
            return;
        }
        if (act === 'comment-save') {
            var commentId = btn.getAttribute('data-comment-id');
            var area = document.querySelector('[data-km-comment-text="' + commentId + '"]');
            success = await yorumIslemUygula({
                cevap_id: commentId,
                islem: 'guncelle',
                content: area ? area.value : ''
            }, false);
            if (success) await hikayeDetayAc(id, commentId);
            return;
        }
        if (act === 'comment-delete') {
            if (!global.confirm('Bu yorumu silmek istiyor musun?')) return;
            success = await yorumIslemUygula({
                cevap_id: btn.getAttribute('data-comment-id'),
                islem: 'sil'
            }, true);
            if (success) await hikayeDetayAc(id, null);
            return;
        }
        if (act === 'story-vote-search') {
            var q = String(document.getElementById('kmVoteUserQuery').value || '').trim();
            modalState.voteUserQuery = q;
            modalState.voteUserResults = [];
            if (!q) {
                modalGuncelle();
                return;
            }
            try {
                var sonuc = await db().masterUyeAra(q, 10);
                modalState.voteUserResults = sonuc && sonuc.ok ? arr(sonuc.sonuc) : [];
                modalGuncelle();
            } catch (e) {
                if (ui() && ui().showToast) ui().showToast(db().hataMesaji ? db().hataMesaji(e) : String(e), 'hata');
            }
            return;
        }
        if (act === 'story-vote-add') {
            success = await oyIslemUygula({
                itiraf_id: id,
                uye_id: btn.getAttribute('data-user-id'),
                islem: 'ekle',
                oy: parseInt(btn.getAttribute('data-vote'), 10) || 1
            }, false);
            if (success) {
                modalState.voteUserResults = [];
                modalState.voteUserQuery = '';
                await hikayeDetayAc(id, modalState.highlightCommentId);
            }
            return;
        }
        if (act === 'vote-save') {
            var voteId = btn.getAttribute('data-vote-id');
            var select = document.querySelector('[data-km-vote-select="' + voteId + '"]');
            success = await oyIslemUygula({
                oy_id: voteId,
                islem: 'guncelle',
                oy: parseInt(select && select.value, 10) || 1
            }, false);
            if (success) await hikayeDetayAc(id, modalState.highlightCommentId);
            return;
        }
        if (act === 'vote-delete') {
            if (!global.confirm('Bu oy kaydını silmek istiyor musun?')) return;
            success = await oyIslemUygula({
                oy_id: btn.getAttribute('data-vote-id'),
                islem: 'sil'
            }, true);
            if (success) await hikayeDetayAc(id, modalState.highlightCommentId);
            return;
        }
    }

    async function userModalAction(act, btn) {
        var D = db();
        var veri = modalState.data || {};
        var uye = veri.uye || {};
        var form = document.getElementById('kmUserForm');
        var success = false;
        if (!uye.id || !D) return;

        if (act === 'user-save') {
            var fd = new FormData(form);
            try {
                var sonuc = await D.masterUyeGuncelle({
                    uye_id: uye.id,
                    username: String(fd.get('username') || '').trim(),
                    email: String(fd.get('email') || '').trim(),
                    gender: fd.get('gender'),
                    dogum_yili: parseInt(fd.get('dogum_yili'), 10),
                    yasadigi_yer: fd.get('yasadigi_yer') || null,
                    yurtdisi_sehir: fd.get('yurtdisi_sehir') || null,
                    meslek: fd.get('meslek') || null,
                    medeni_durum: fd.get('medeni_durum') || null,
                    durum_notu: String(fd.get('durum_notu') || '').trim() || null
                });
                if (!sonuc || !sonuc.ok) throw new Error((sonuc && sonuc.hata) || 'Kaydedilemedi');
                if (ui() && ui().showToast) ui().showToast('Üye kaydedildi');
                await panelVeAramaYenile();
                await uyeDetayAc(uye.id);
            } catch (e) {
                if (ui() && ui().showToast) ui().showToast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
            }
            return;
        }
        if (act === 'user-action') {
            var islem = btn.getAttribute('data-user-action');
            if (islem === 'ban' && !global.confirm('Bu üyeyi banlamak istediğine emin misin?')) return;
            if (islem === 'sil' && !global.confirm('Hesap kalıcı silinecek. Emin misin?')) return;
            var not = '';
            if (islem === 'ban' || islem === 'askida') {
                not = global.prompt('İsteğe bağlı not:', '') || '';
            }
            try {
                var cevap = await D.masterUyeIslem({ uye_id: uye.id, islem: islem, not: not });
                if (!cevap || !cevap.ok) throw new Error((cevap && cevap.hata) || 'İşlem başarısız');
                if (ui() && ui().showToast) ui().showToast(islem === 'sil' ? 'Üye silindi' : 'Üye güncellendi');
                await panelVeAramaYenile();
                if (islem === 'sil') {
                    modalKapat();
                    return;
                }
                await uyeDetayAc(uye.id);
            } catch (e2) {
                if (ui() && ui().showToast) ui().showToast(D.hataMesaji ? D.hataMesaji(e2) : String(e2), 'hata');
            }
            return;
        }
        if (act === 'user-avatar-pick') {
            var input = document.getElementById('kmUserAvatarInput');
            if (input) input.click();
            return;
        }
        if (act === 'user-avatar-remove') {
            if (!global.confirm('Bu profil fotoğrafını kaldırmak istiyor musun?')) return;
            try {
                await D.masterUyeAvatarKaldir(uye.id);
                if (ui() && ui().showToast) ui().showToast('Profil fotoğrafı kaldırıldı');
                await panelVeAramaYenile();
                await uyeDetayAc(uye.id);
            } catch (e3) {
                if (ui() && ui().showToast) ui().showToast(D.hataMesaji ? D.hataMesaji(e3) : String(e3), 'hata');
            }
            return;
        }
        if (act === 'user-story-save') {
            success = await hikayeIslemUygula({
                itiraf_id: btn.getAttribute('data-story-id'),
                islem: 'guncelle',
                content_full: (document.querySelector('[data-km-user-story-text="' + btn.getAttribute('data-story-id') + '"]') || {}).value || ''
            });
            if (success) await uyeDetayAc(uye.id);
            return;
        }
        if (act === 'user-story-toggle') {
            success = await hikayeIslemUygula({
                itiraf_id: btn.getAttribute('data-story-id'),
                islem: btn.getAttribute('data-hidden') === '1' ? 'goster' : 'gizle'
            });
            if (success) await uyeDetayAc(uye.id);
            return;
        }
        if (act === 'user-story-delete') {
            if (!global.confirm('Bu hikayeyi silmek istiyor musun?')) return;
            success = await hikayeIslemUygula({
                itiraf_id: btn.getAttribute('data-story-id'),
                islem: 'sil'
            });
            if (success) await uyeDetayAc(uye.id);
            return;
        }
        if (act === 'user-story-restore') {
            success = await hikayeIslemUygula({
                itiraf_id: btn.getAttribute('data-story-id'),
                islem: 'geri_al'
            });
            if (success) await uyeDetayAc(uye.id);
            return;
        }
        if (act === 'user-comment-save') {
            success = await yorumIslemUygula({
                cevap_id: btn.getAttribute('data-comment-id'),
                islem: 'guncelle',
                content: (document.querySelector('[data-km-user-comment-text="' + btn.getAttribute('data-comment-id') + '"]') || {}).value || ''
            }, false);
            if (success) await uyeDetayAc(uye.id);
            return;
        }
        if (act === 'user-comment-delete') {
            if (!global.confirm('Bu yorumu silmek istiyor musun?')) return;
            success = await yorumIslemUygula({
                cevap_id: btn.getAttribute('data-comment-id'),
                islem: 'sil'
            }, true);
            if (success) await uyeDetayAc(uye.id);
            return;
        }
        if (act === 'open-story') {
            await hikayeDetayAc(btn.getAttribute('data-story-id'), btn.getAttribute('data-comment-focus'));
        }
    }

    async function yorumModalAction(act) {
        var yorum = modalState.data || {};
        var success = false;
        if (act === 'comment-quick-save') {
            success = await yorumIslemUygula({
                cevap_id: yorum.id,
                islem: 'guncelle',
                content: document.getElementById('kmCommentText').value
            }, false);
            if (success) {
                var yeni = yorumSatiriBul(yorum.id);
                if (yeni) {
                    modalState.data = yeni;
                    modalGuncelle();
                } else {
                    modalKapat();
                }
            }
            return;
        }
        if (act === 'comment-quick-delete') {
            if (!global.confirm('Bu yorumu silmek istiyor musun?')) return;
            success = await yorumIslemUygula({
                cevap_id: yorum.id,
                islem: 'sil'
            }, true);
            if (success) modalKapat();
            return;
        }
    }

    async function avatarYukle(file) {
        var D = db();
        var uye = modalState.data && modalState.data.uye;
        if (!D || !D.masterUyeAvatarYukle || !uye || !uye.id) return;
        try {
            await D.masterUyeAvatarYukle(uye.id, file);
            if (ui() && ui().showToast) ui().showToast('Profil fotoğrafı güncellendi');
            await panelVeAramaYenile();
            await uyeDetayAc(uye.id);
        } catch (e) {
            if (ui() && ui().showToast) ui().showToast(D.hataMesaji ? D.hataMesaji(e) : String(e), 'hata');
        }
    }

    function filtreBagla() {
        if (filtreHazir) return;
        filtreHazir = true;

        injectStyles();
        ensureToolbar();
        ensureModalRoot();

        var sec = document.getElementById('kamikazeItirafFilter');
        if (sec) {
            sec.addEventListener('change', function () {
                aktifFiltre = sec.value || 'hepsi';
                renderCurrent();
            });
        }

        var yenile = document.getElementById('kamikazeYenile');
        if (yenile) {
            yenile.addEventListener('click', function () {
                panelVeAramaYenile();
            });
        }

        var araBtn = document.getElementById('kamikazeAraBtn');
        var araInp = document.getElementById('kamikazeAra');
        var araTemizle = document.getElementById('kamikazeAraTemizle');
        if (araBtn) araBtn.addEventListener('click', function () { aramaYap(false); });
        if (araTemizle) araTemizle.addEventListener('click', aramaTemizle);
        if (araInp) {
            araInp.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (aramaZamanlayici) {
                        clearTimeout(aramaZamanlayici);
                        aramaZamanlayici = null;
                    }
                    aramaYap(false);
                }
            });
            araInp.addEventListener('input', function () {
                var yeniMetin = String(araInp.value || '').trim();
                if (!yeniMetin) {
                    aramaTemizle();
                    return;
                }
                aramaCanliTetikle();
            });
        }

        var giris = document.getElementById('kamikazeGirisBtn');
        if (giris) {
            giris.addEventListener('click', function () {
                if (typeof global.openAuthModal === 'function') global.openAuthModal('login');
                else global.location.href = '/kulis';
            });
        }

        var icerik = document.getElementById('kamikazeIcerik');
        if (icerik) {
            icerik.addEventListener('click', function (e) {
                var sortBtn = e.target.closest('[data-km-sort]');
                if (sortBtn) {
                    var tablo = sortBtn.getAttribute('data-km-sort');
                    var key = sortBtn.getAttribute('data-key');
                    var durum = tabloState(tablo);
                    if (durum.sortKey === key) {
                        durum.sortDir = durum.sortDir === 'asc' ? 'desc' : 'asc';
                    } else {
                        durum.sortKey = key;
                        durum.sortDir = 'asc';
                    }
                    renderCurrent();
                    return;
                }

                var actBtn = e.target.closest('[data-km-act]');
                if (!actBtn) return;
                var act = actBtn.getAttribute('data-km-act');
                if (act === 'story-open') {
                    hikayeDetayAc(actBtn.getAttribute('data-story-id'), actBtn.getAttribute('data-comment-focus'));
                } else if (act === 'user-open') {
                    uyeDetayAc(actBtn.getAttribute('data-user-id'));
                } else if (act === 'comment-open') {
                    yorumDetayAc(actBtn.getAttribute('data-comment-id'));
                }
            });

            icerik.addEventListener('input', function (e) {
                var filtre = e.target.closest('[data-km-filter]');
                if (!filtre) return;
                var tablo = filtre.getAttribute('data-km-filter');
                var key = filtre.getAttribute('data-key');
                tabloState(tablo).filters[key] = filtre.value || '';
                renderCurrent();
            });

            icerik.addEventListener('change', function (e) {
                var filtre = e.target.closest('[data-km-filter]');
                if (!filtre) return;
                var tablo = filtre.getAttribute('data-km-filter');
                var key = filtre.getAttribute('data-key');
                tabloState(tablo).filters[key] = filtre.value || '';
                renderCurrent();
            });
        }

        var modal = document.getElementById('kamikazeModal');
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target.closest('[data-km-modal-close]')) {
                    modalKapat();
                    return;
                }
                var btn = e.target.closest('[data-km-modal-act]');
                if (!btn) return;
                var act = btn.getAttribute('data-km-modal-act');
                if (modalState.type === 'story') {
                    storyModalAction(act, btn);
                } else if (modalState.type === 'user') {
                    userModalAction(act, btn);
                } else if (modalState.type === 'comment') {
                    if (act === 'open-story') {
                        hikayeDetayAc(btn.getAttribute('data-story-id'), btn.getAttribute('data-comment-focus'));
                    } else if (act === 'open-user') {
                        uyeDetayAc(btn.getAttribute('data-user-id'));
                    } else {
                        yorumModalAction(act);
                    }
                }
            });

            modal.addEventListener('change', function (e) {
                if (e.target && e.target.id === 'kmUserAvatarInput') {
                    var file = e.target.files && e.target.files[0];
                    e.target.value = '';
                    if (file) avatarYukle(file);
                }
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modalState.type) modalKapat();
        });
    }

    async function init(yeniden) {
        var D = db();
        var U = ui();
        if (!D) return;

        if (!yeniden) {
            try {
                await D.init();
            } catch (e) { /* sessiz */ }
        }

        if (U && U.guncelleHeaderOturum) {
            U.guncelleHeaderOturum();
        }
        if (global.Gunde5Master && global.Gunde5Master.durumYenile) {
            try {
                await global.Gunde5Master.durumYenile();
            } catch (e2) { /* sessiz */ }
        }

        filtreBagla();

        var oturum = D.getGunde5User && D.getGunde5User();
        if (!oturum || !oturum.id) {
            yetkisizGoster('Kamikaze panelini görmek için site yöneticisi hesabıyla giriş yapın.', true);
            return;
        }

        var durum;
        try {
            durum = await D.masterDurum();
        } catch (e3) {
            durum = { master: false };
        }

        if (!durum || !durum.master) {
            yetkisizGoster('Bu sayfa yalnızca site yöneticisi (master) hesabı içindir.', false);
            return;
        }

        icerikGoster();
        await veriYukle();
    }

    global.Gunde5Kamikaze = {
        init: init,
        yenile: veriYukle
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
