/* gunde5 — kart ekranda görününce sayfa görüntülenmesi (+1), tekil ziyaret (ilk kez) */
(function (global) {
    var DB = global.Gunde5DB;
    var UI = global.Gunde5UI;
    var gozlemciler = new WeakMap();

    function kartSayacGuncelle(kart, veri) {
        if (!kart || !veri) return;
        var el = kart.querySelector('.v-num');
        if (el && veri.sayfa_goruntulenme != null && UI && UI.formatSayac) {
            el.textContent = UI.formatSayac(veri.sayfa_goruntulenme);
        }
    }

    function goruntulenmeKaydet(kart) {
        if (!DB || !DB.goruntulenmeKaydet) return;
        var id = kart.getAttribute('data-id');
        if (!id) return;
        DB.goruntulenmeKaydet(id).then(function (veri) {
            kartSayacGuncelle(kart, veri);
        });
    }

    function bagla(kart) {
        if (!kart || !kart.getAttribute || kart.getAttribute('data-id') == null) return;
        if (gozlemciler.has(kart)) return;

        var io = new IntersectionObserver(
            function (entries) {
                var i;
                for (i = 0; i < entries.length; i++) {
                    if (entries[i].isIntersecting) {
                        goruntulenmeKaydet(entries[i].target);
                    }
                }
            },
            { root: null, rootMargin: '0px', threshold: 0.2 }
        );
        io.observe(kart);
        gozlemciler.set(kart, io);
    }

    function initSayfa() {
        document.querySelectorAll('.card[data-id]').forEach(bagla);
    }

    global.Gunde5Goruntulenme = {
        bagla: bagla,
        initSayfa: initSayfa,
        kartSayacGuncelle: kartSayacGuncelle
    };
})(window);
