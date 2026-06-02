/* Demo B — etkileşim (geçici) */
(function () {
    'use strict';

    var RASTGELE = [
        { metin: '“Üç durak boyunca açıklama yaptım.”', kaynak: 'Maltepe Avcısı' },
        { metin: '“Telve değil, kader mi bilemedim.”', kaynak: 'Türk Kahvesi Kazandı' },
        { metin: '“HR ciddiye aldı.”', kaynak: 'Pisuvar Paradoksu' },
        { metin: '“Akrabalar uçak bileti araştırdı.”', kaynak: 'Malezya diye bir yer' },
        { metin: '“İkimiz de yanlış kabı doldurmuşuz.”', kaynak: 'Malzeme Meselesi' }
    ];

    var okunan = {};
    var aktifChip = '';
    var rastgeleIdx = 0;

    function $(id) { return document.getElementById(id); }

    function kartlar() {
        return Array.prototype.slice.call(document.querySelectorAll('#demoFeed .demo-b-kart'));
    }

    function ilerlemeGuncelle() {
        var toplam = 5;
        var n = 0;
        var i;
        for (i = 1; i <= toplam; i++) {
            if (okunan[i]) n += 1;
        }
        var bar = $('demoIlerleme');
        var metin = $('demoIlerlemeMetin');
        if (bar) bar.style.width = Math.round((n / toplam) * 100) + '%';
        if (metin) metin.textContent = 'Bugünün 5\\'inden ' + n + ' tanesini okudun.';
    }

    function kartOkundu(id) {
        okunan[id] = true;
        var kart = document.querySelector('[data-demo-id="' + id + '"]');
        if (kart) kart.classList.add('okundu');
        var pill = document.querySelector('[data-demo-hikaye="' + id + '"]');
        if (pill) pill.classList.add('demo-b-pill--okundu');
        ilerlemeGuncelle();
    }

    function feedFiltrele() {
        var q = String(($('demoFeedArama') && $('demoFeedArama').value) || '').toLowerCase().trim();
        var siralama = $('demoSiralama') ? $('demoSiralama').value : 'yeni';
        var liste = kartlar();
        var gorunen = 0;

        liste.forEach(function (kart) {
            var metin = (kart.textContent || '').toLowerCase();
            var etiket = (kart.getAttribute('data-demo-etiket') || '').toLowerCase();
            var chipOk = !aktifChip || etiket.indexOf(aktifChip) >= 0;
            var aramaOk = !q || metin.indexOf(q) >= 0;
            var goster = chipOk && aramaOk;
            kart.classList.toggle('demo-b-kart-gizli', !goster);
            if (goster) gorunen += 1;
        });

        if (siralama === 'populer' || siralama === 'yorum') {
            var feed = $('demoFeed');
            if (!feed) return;
            var sirali = liste.filter(function (k) { return !k.classList.contains('demo-b-kart-gizli'); });
            sirali.sort(function (a, b) {
                var av = Number(a.getAttribute('data-demo-oy') || 0);
                var bv = Number(b.getAttribute('data-demo-oy') || 0);
                return bv - av;
            });
            sirali.forEach(function (k) { feed.appendChild(k); });
        }

        var bos = $('demoFeedBos');
        if (bos) bos.style.display = gorunen ? 'none' : 'block';
    }

    function scrollKarta(id) {
        var kart = document.querySelector('[data-demo-id="' + id + '"]');
        if (!kart) return;
        kart.scrollIntoView({ behavior: 'smooth', block: 'center' });
        kart.style.boxShadow = '0 0 0 3px rgba(29,155,240,0.45)';
        setTimeout(function () { kart.style.boxShadow = ''; }, 1200);
        document.querySelectorAll('#demoBesListe button').forEach(function (btn) {
            btn.classList.toggle('aktif', btn.getAttribute('data-demo-scroll') === String(id));
        });
        document.querySelectorAll('#demoPills .demo-b-pill').forEach(function (p) {
            p.classList.toggle('aktif', p.getAttribute('data-demo-hikaye') === String(id));
        });
    }

    function rastgeleGoster() {
        rastgeleIdx = (rastgeleIdx + 1) % RASTGELE.length;
        var o = RASTGELE[rastgeleIdx];
        var m = $('demoRastgeleMetin');
        var k = $('demoRastgeleKaynak');
        if (m) m.textContent = o.metin;
        if (k) k.textContent = '— ' + o.kaynak;
    }

    function temaBagla() {
        var btn = $('themeToggle');
        if (!btn) return;
        btn.addEventListener('click', function () {
            document.body.classList.toggle('demo-dark');
            btn.textContent = document.body.classList.contains('demo-dark') ? '☀️' : '🌙';
        });
    }

    function tarihGoster() { /* b-v2: hero metni statik */ }

    function bagla() {
        temaBagla();
        tarihGoster();
        ilerlemeGuncelle();

        /* b-v2: mouse tıklaması gerektirmeden “okundu” say. Kart görünür olunca işaretle. */
        if (globalThis.IntersectionObserver) {
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    if (entry.intersectionRatio < 0.62) return;
                    var el = entry.target;
                    var id = el && el.getAttribute && el.getAttribute('data-demo-id');
                    if (!id) return;
                    kartOkundu(id);
                });
            }, { threshold: [0.62] });
            document.querySelectorAll('#demoFeed .demo-b-kart').forEach(function (kart) { io.observe(kart); });
        }

        document.querySelectorAll('.demo-b-oy-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var kart = btn.closest('.demo-b-kart');
                if (!kart) return;
                var oyEl = kart.querySelector('.demo-oy-sayi');
                var n = Number(oyEl && oyEl.textContent) || 0;
                if (btn.getAttribute('data-demo-oy') === 'up') {
                    n += 1;
                    kart.setAttribute('data-demo-oy', String(n));
                    if (oyEl) oyEl.textContent = String(n);
                }
            });
        });

        var feedArama = $('demoFeedArama');
        var siralama = $('demoSiralama');
        var headerArama = $('demoArama');
        if (feedArama) feedArama.addEventListener('input', feedFiltrele);
        if (siralama) siralama.addEventListener('change', feedFiltrele);
        if (headerArama && feedArama) {
            headerArama.addEventListener('input', function () {
                feedArama.value = headerArama.value;
                feedFiltrele();
            });
        }

        /* b-v2: etiketler üst ekrandan kaldırıldı */

        document.querySelectorAll('#demoPills .demo-b-pill').forEach(function (pill) {
            pill.addEventListener('click', function () {
                scrollKarta(pill.getAttribute('data-demo-hikaye'));
            });
        });

        document.querySelectorAll('#demoBesListe button').forEach(function (btn) {
            btn.addEventListener('click', function () {
                scrollKarta(btn.getAttribute('data-demo-scroll'));
            });
        });

        var rastBtn = $('demoRastgeleBtn');
        if (rastBtn) rastBtn.addEventListener('click', rastgeleGoster);

        var basla = $('demoBaslaBtn');
        if (basla) basla.addEventListener('click', function () { scrollKarta('1'); });

        document.querySelectorAll('.demo-b-nav button[data-demo-nav]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.demo-b-nav button').forEach(function (b) {
                    b.classList.remove('aktif');
                });
                btn.classList.add('aktif');
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bagla);
    } else {
        bagla();
    }
})();
