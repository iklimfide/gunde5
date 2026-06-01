/**
 * Footer — hikaye/itiraf ve mesaj gönderimi (modal)
 */
(function (global) {
    'use strict';

    var VISITOR_KEY = 'g5_visitor_id';
    var gonderimKilit = false;

    function db() {
        return global.Gunde5DB;
    }

    function ui() {
        return global.Gunde5UI;
    }

    function toast(mesaj, tur) {
        if (ui() && ui().showToast) {
            ui().showToast(mesaj, tur);
            return;
        }
        var t = document.getElementById('toast');
        if (!t) return;
        t.textContent = mesaj;
        t.classList.add('show');
        setTimeout(function () {
            t.classList.remove('show');
        }, 3200);
    }

    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function visitorIdAl() {
        try {
            var v = global.localStorage.getItem(VISITOR_KEY);
            if (v && v.length >= 8) return v;
            if (global.crypto && global.crypto.randomUUID) {
                v = 'v:' + global.crypto.randomUUID();
            } else {
                v = 'v:' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
            }
            global.localStorage.setItem(VISITOR_KEY, v);
            return v;
        } catch (e) {
            return 'v:anon-' + Date.now();
        }
    }

    function injectStyles() {
        if (document.getElementById('gunde5-gonder-styles')) return;
        var s = document.createElement('style');
        s.id = 'gunde5-gonder-styles';
        s.textContent =
            '.gonder-modal{position:fixed;inset:0;z-index:400;display:none;align-items:flex-end;justify-content:center;padding:0;background:rgba(15,20,25,.55);backdrop-filter:blur(4px)}' +
            '.gonder-modal.acik{display:flex}' +
            '@media(min-width:520px){.gonder-modal{align-items:center;padding:16px}}' +
            '.gonder-panel{width:100%;max-width:440px;max-height:min(92vh,720px);background:#fff;border-radius:20px 20px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,.2);display:flex;flex-direction:column;overflow:hidden;animation:gonderSlide .28s ease}' +
            '@media(min-width:520px){.gonder-panel{border-radius:20px;max-height:min(88vh,680px)}}' +
            'body.dark-mode .gonder-panel{background:var(--bg-card,#0b0f14);color:var(--text-main,#e7e9ea)}' +
            '@keyframes gonderSlide{from{transform:translateY(24px);opacity:.6}to{transform:translateY(0);opacity:1}}' +
            '.gonder-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e5e7eb;flex-shrink:0}' +
            'body.dark-mode .gonder-head{border-color:rgba(255,255,255,.1)}' +
            '.gonder-head h2{margin:0;font-size:18px;font-weight:800;line-height:1.3}' +
            '.gonder-kapat{width:36px;height:36px;border:none;background:#f3f4f6;border-radius:10px;font-size:18px;cursor:pointer;line-height:1}' +
            'body.dark-mode .gonder-kapat{background:#2f3336;color:#e7e9ea}' +
            '.gonder-body{padding:16px;overflow-y:auto;flex:1}' +
            '.gonder-secim-btn{display:block;width:100%;text-align:left;padding:16px 14px;margin-bottom:10px;border:2px solid #e5e7eb;border-radius:14px;background:#fafafa;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;color:inherit;line-height:1.4}' +
            '.gonder-secim-btn:hover{border-color:#1d9bf0;background:#eff6ff}' +
            'body.dark-mode .gonder-secim-btn{border-color:rgba(255,255,255,.12);background:#161b22}' +
            'body.dark-mode .gonder-secim-btn:hover{border-color:#1d9bf0}' +
            '.gonder-label{display:block;font-size:12px;font-weight:700;color:#6b7280;margin:12px 0 6px}' +
            'body.dark-mode .gonder-label{color:var(--text-muted,#9ca3af)}' +
            '.gonder-input,.gonder-textarea{width:100%;padding:12px 14px;border:1px solid #d1d5db;border-radius:12px;font-size:15px;font-family:inherit;background:#fff;color:inherit}' +
            'body.dark-mode .gonder-input,body.dark-mode .gonder-textarea{background:#0f1419;border-color:rgba(255,255,255,.15)}' +
            '.gonder-textarea{min-height:140px;resize:vertical;line-height:1.5}' +
            '.gonder-rad-grup{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}' +
            '.gonder-rad{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;cursor:pointer;padding:8px 10px;border:1px solid #e5e7eb;border-radius:999px}' +
            'body.dark-mode .gonder-rad{border-color:rgba(255,255,255,.12)}' +
            '.gonder-rad input{accent-color:#1d9bf0}' +
            '.gonder-gonder{width:100%;margin-top:16px;padding:14px;border:none;border-radius:14px;background:#1d9bf0;color:#fff;font-size:16px;font-weight:800;cursor:pointer;font-family:inherit}' +
            '.gonder-gonder:disabled{opacity:.55;cursor:not-allowed}' +
            '.gonder-alt{font-size:12px;color:#6b7280;text-align:center;margin-top:10px;line-height:1.45}' +
            'body.dark-mode .gonder-alt{color:var(--text-muted)}' +
            '.gonder-basari{text-align:center;padding:24px 8px}' +
            '.gonder-basari p{font-size:16px;font-weight:700;line-height:1.5;margin:0 0 10px}' +
            '.gonder-basari p:last-child{margin-bottom:0}' +
            '.gonder-geri{display:inline-block;margin-bottom:12px;padding:0;border:none;background:none;color:#1d9bf0;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}' +
            '.page-tail-cta{display:block;width:100%;max-width:320px;margin:4px auto 0;padding:14px 20px;border:none;border-radius:999px;background:linear-gradient(135deg,#1d9bf0,#0ea5e9);color:#fff;font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(29,155,240,.35)}' +
            '.page-tail-cta:hover{filter:brightness(1.05)}' +
            '.page-tail-iletisim{font-size:12px;font-weight:500;color:var(--text-muted);margin-top:4px}' +
            '.page-tail-iletisim .mail-link{font-size:inherit}';
        document.head.appendChild(s);
    }

    function modalEl() {
        return document.getElementById('gonderModal');
    }

    function panelIcerik(html) {
        var body = document.getElementById('gonderBody');
        if (body) body.innerHTML = html;
    }

    function baslikMetin(t) {
        var h = document.getElementById('gonderBaslik');
        if (h) h.textContent = t;
    }

    function modalAc() {
        injectStyles();
        var m = modalEl();
        if (!m) return;
        gonderimKilit = false;
        m.classList.add('acik');
        document.body.style.overflow = 'hidden';
        ekranSecim();
    }

    function modalKapat() {
        var m = modalEl();
        if (!m) return;
        m.classList.remove('acik');
        document.body.style.overflow = '';
    }

    function ekranSecim() {
        baslikMetin('Kahveni al, anlat ☕');
        panelIcerik(
            '<button type="button" class="gonder-secim-btn" data-gonder="hikaye">' +
            '✍️ Hikayemi / itirafımı anlatmak istiyorum</button>' +
            '<button type="button" class="gonder-secim-btn" data-gonder="mesaj">' +
            '💬 Günde5\'e mesaj bırakmak istiyorum</button>'
        );
    }

    function ekranHikaye() {
        baslikMetin('Hikayeni anlat ☕');
        panelIcerik(
            '<button type="button" class="gonder-geri" data-gonder="geri">← Geri</button>' +
            '<form id="gonderHikayeForm" novalidate>' +
            '<label class="gonder-label" for="gonderBaslikInput">Başlık (istersen boş bırak, biz buluruz)</label>' +
            '<input class="gonder-input" id="gonderBaslikInput" name="title" maxlength="120" autocomplete="off" placeholder="Örn: Gece vardiyası">' +
            '<label class="gonder-label" for="gonderIcerik">Hikayen veya itirafın *</label>' +
            '<textarea class="gonder-textarea" id="gonderIcerik" name="content" required minlength="50" maxlength="12000" placeholder="Anlat…"></textarea>' +
            '<label class="gonder-label" for="gonderYas">Yaş (isteğe bağlı)</label>' +
            '<input class="gonder-input" id="gonderYas" name="age" type="number" min="13" max="120" inputmode="numeric" placeholder="Örn: 28">' +
            '<label class="gonder-label" for="gonderSehir">Şehir (isteğe bağlı)</label>' +
            '<input class="gonder-input" id="gonderSehir" name="city" maxlength="80" autocomplete="address-level2" placeholder="Örn: İzmir">' +
            '<span class="gonder-label">Cinsiyet</span>' +
            '<div class="gonder-rad-grup" role="radiogroup">' +
            '<label class="gonder-rad"><input type="radio" name="gender" value="Kadın"> Kadın</label>' +
            '<label class="gonder-rad"><input type="radio" name="gender" value="Erkek"> Erkek</label>' +
            '<label class="gonder-rad"><input type="radio" name="gender" value="Belirtmek istemiyorum"> Belirtmek istemiyorum</label>' +
            '</div>' +
            '<button type="submit" class="gonder-gonder" id="gonderHikayeBtn">Anonim gönder ☕</button>' +
            '<p class="gonder-alt">Kim olduğunu kimse bilmez. Yayınlanacak hikayeler editör tarafından seçilir.</p>' +
            '</form>'
        );
    }

    function ekranMesaj() {
        baslikMetin('Mesaj bırak ☕');
        panelIcerik(
            '<button type="button" class="gonder-geri" data-gonder="geri">← Geri</button>' +
            '<form id="gonderMesajForm" novalidate>' +
            '<label class="gonder-label" for="gonderMesajMetin">Mesajın *</label>' +
            '<textarea class="gonder-textarea" id="gonderMesajMetin" name="message" required minlength="10" maxlength="4000" placeholder="Yazmak istediklerin…"></textarea>' +
            '<label class="gonder-label" for="gonderEmail">Mail adresin (isteğe bağlı)</label>' +
            '<input class="gonder-input" id="gonderEmail" name="email" type="email" maxlength="200" autocomplete="email" placeholder="sen@ornek.com">' +
            '<button type="submit" class="gonder-gonder" id="gonderMesajBtn">Günde5\'e gönder</button>' +
            '<p class="gonder-alt">Her mesaj okunur ☕</p>' +
            '</form>'
        );
    }

    function ekranBasari(satir1, satir2) {
        baslikMetin('Teşekkürler ☕');
        var html = '<div class="gonder-basari"><p>' + esc(satir1) + '</p>';
        if (satir2) {
            html += '<p>' + esc(satir2) + '</p>';
        }
        html += '</div><button type="button" class="gonder-gonder" data-gonder="kapat">Kapat</button>';
        panelIcerik(html);
    }

    function btnKilit(btn, kilit) {
        if (!btn) return;
        btn.disabled = !!kilit;
    }

    async function apiVeyaRpc(endpoint, rpcAdi, payload) {
        var D = db();
        try {
            var res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                return res.json();
            }
            var errJson = null;
            try {
                errJson = await res.json();
            } catch (e2) { /* */ }
            if (errJson && errJson.hata) {
                return errJson;
            }
        } catch (e) { /* yerel dev: API yok */ }

        if (D && D.footerGonderRpc) {
            return D.footerGonderRpc(rpcAdi, payload);
        }
        return { ok: false, hata: 'Gönderim şu an kullanılamıyor. Biraz sonra tekrar dene.' };
    }

    async function hikayeGonder(ev) {
        ev.preventDefault();
        if (gonderimKilit) return;
        var form = ev.target;
        var btn = document.getElementById('gonderHikayeBtn');
        var icerik = (form.content && form.content.value || '').trim();
        if (icerik.length < 50) {
            toast('Hikaye en az 50 karakter olmalı.', 'hata');
            return;
        }
        var genderEl = form.querySelector('input[name="gender"]:checked');
        var payload = {
            type: 'story',
            title: (form.title && form.title.value || '').trim(),
            content: icerik,
            city: (form.city && form.city.value || '').trim(),
            gender: genderEl ? genderEl.value : '',
            visitor_id: visitorIdAl()
        };
        if (form.age && form.age.value) {
            payload.age = parseInt(form.age.value, 10);
        }

        gonderimKilit = true;
        btnKilit(btn, true);
        if (btn) btn.textContent = 'Gönderiliyor…';

        var sonuc = await apiVeyaRpc('/api/footer-story', 'footer_gonder_hikaye', payload);

        if (sonuc && sonuc.ok) {
            ekranBasari(
                'Hikayen kahve sırasına alındı ☕',
                'Seçilirse bir sabah Günde5\'te yerini alacak.'
            );
            return;
        }
        gonderimKilit = false;
        btnKilit(btn, false);
        if (btn) btn.textContent = 'Anonim gönder ☕';
        toast((sonuc && sonuc.hata) || 'Gönderilemedi.', 'hata');
    }

    async function mesajGonder(ev) {
        ev.preventDefault();
        if (gonderimKilit) return;
        var form = ev.target;
        var btn = document.getElementById('gonderMesajBtn');
        var mesaj = (form.message && form.message.value || '').trim();
        if (mesaj.length < 10) {
            toast('Mesaj en az 10 karakter olmalı.', 'hata');
            return;
        }
        var payload = {
            message: mesaj,
            email: (form.email && form.email.value || '').trim(),
            visitor_id: visitorIdAl()
        };

        gonderimKilit = true;
        btnKilit(btn, true);
        if (btn) btn.textContent = 'Gönderiliyor…';

        var sonuc = await apiVeyaRpc('/api/footer-message', 'footer_gonder_mesaj', payload);

        if (sonuc && sonuc.ok) {
            ekranBasari('Mesajın bize ulaştı. Her mesaj okunur ☕', null);
            return;
        }
        gonderimKilit = false;
        btnKilit(btn, false);
        if (btn) btn.textContent = 'Günde5\'e gönder';
        toast((sonuc && sonuc.hata) || 'Gönderilemedi.', 'hata');
    }

    function mountModal() {
        if (document.getElementById('gonderModal')) return;
        injectStyles();
        var wrap = document.createElement('div');
        wrap.className = 'gonder-modal';
        wrap.id = 'gonderModal';
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'true');
        wrap.setAttribute('aria-labelledby', 'gonderBaslik');
        wrap.innerHTML =
            '<div class="gonder-panel" onclick="event.stopPropagation()">' +
            '<div class="gonder-head">' +
            '<h2 id="gonderBaslik">Kahveni al, anlat ☕</h2>' +
            '<button type="button" class="gonder-kapat" id="gonderKapatBtn" aria-label="Kapat">✕</button>' +
            '</div>' +
            '<div class="gonder-body" id="gonderBody"></div>' +
            '</div>';
        document.body.appendChild(wrap);

        wrap.addEventListener('click', function () {
            modalKapat();
        });
        document.getElementById('gonderKapatBtn').addEventListener('click', modalKapat);

        document.getElementById('gonderBody').addEventListener('click', function (e) {
            var secim = e.target.closest('[data-gonder]');
            if (!secim) return;
            var tip = secim.getAttribute('data-gonder');
            if (tip === 'hikaye') ekranHikaye();
            else if (tip === 'mesaj') ekranMesaj();
            else if (tip === 'geri') ekranSecim();
            else if (tip === 'kapat') modalKapat();
        });

        document.addEventListener('submit', function (e) {
            if (e.target.id === 'gonderHikayeForm') hikayeGonder(e);
            if (e.target.id === 'gonderMesajForm') mesajGonder(e);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modalEl() && modalEl().classList.contains('acik')) {
                modalKapat();
            }
        });
    }

    function footerBagla() {
        var cta = document.getElementById('pageTailGonderBtn');
        if (cta) {
            cta.addEventListener('click', function () {
                modalAc();
            });
        }
        var faqBtn = document.getElementById('faqGonderBtn');
        if (faqBtn) {
            faqBtn.addEventListener('click', function (e) {
                e.preventDefault();
                var about = document.getElementById('aboutModal');
                if (about) about.style.display = 'none';
                modalAc();
            });
        }
    }

    function init() {
        mountModal();
        footerBagla();
        ekranSecim();
    }

    global.Gunde5Gonder = {
        ac: modalAc,
        kapat: modalKapat,
        init: init
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
