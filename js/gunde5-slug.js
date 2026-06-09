/* gunde5 — slug üretimi (api/_lib/slug.js ile aynı mantık; Kamikaze önizleme) */
(function (global) {
    'use strict';

    var SLUG_MAX_KELIME = 7;
    var SLUG_MAX_UZUNLUK = 60;

    var STOP_KELIMELER = {
        bir: 1, bu: 1, su: 1, ben: 1, bana: 1, beni: 1, benim: 1, biz: 1, bizim: 1, siz: 1, sizin: 1,
        gecen: 1, guncen: 1, gun: 1, gunde: 1, birkac: 1, once: 1, sonra: 1, aslinda: 1, falan: 1, yani: 1,
        diye: 1, gibi: 1, kadar: 1, beri: 1, cok: 1, daha: 1, yine: 1, sey: 1, hicbir: 1, hic: 1,
        ya: 1, o: 1, da: 1, de: 1, ki: 1, mi: 1, mu: 1, icin: 1, ile: 1, ve: 1, ama: 1, hem: 1,
        ne: 1, var: 1, yok: 1, en: 1, her: 1, ise: 1, olan: 1, olur: 1, kendi: 1, onun: 1, ona: 1, onu: 1,
        sen: 1, sana: 1, seni: 1, bize: 1, onlar: 1, nasil: 1, neden: 1, boyle: 1, simdi: 1, bile: 1,
        sadece: 1, artik: 1, zaten: 1, hala: 1, hep: 1, bazi: 1, butun: 1, tum: 1, cunku: 1, eger: 1,
        olarak: 1, degil: 1, uzerine: 1, gore: 1, arada: 1, arasinda: 1, hani: 1, iste: 1, tabi: 1,
        tabii: 1, yoksa: 1, belki: 1, keske: 1, baya: 1, bayagi: 1, filan: 1, sanki: 1, galiba: 1
    };

    function slugNormalize(metin) {
        return String(metin || '')
            .toLowerCase()
            .replace(/ç/g, 'c')
            .replace(/ğ/g, 'g')
            .replace(/ı/g, 'i')
            .replace(/ö/g, 'o')
            .replace(/ş/g, 's')
            .replace(/ü/g, 'u')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    function slugKelimeGecerli(kelime, stopFiltre) {
        var w = String(kelime || '').trim();
        if (!w) return false;
        if (stopFiltre && STOP_KELIMELER[w]) return false;
        if (/^[0-9]+$/.test(w)) return true;
        if (w.length === 1 && /^[a-z]$/.test(w)) return false;
        return /^[a-z0-9]+$/.test(w);
    }

    function slugKelimelerdenBase(kelimeler, opts) {
        var maxK = (opts && opts.maxKelimeler) || SLUG_MAX_KELIME;
        var maxLen = (opts && opts.maxUzunluk) || SLUG_MAX_UZUNLUK;
        var stopFiltre = !opts || opts.stopFiltre !== false;
        var liste = Array.isArray(kelimeler) ? kelimeler : [];
        var secilen = [];
        var i;

        for (i = 0; i < liste.length && secilen.length < maxK; i++) {
            if (slugKelimeGecerli(liste[i], stopFiltre)) secilen.push(liste[i]);
        }

        if (!secilen.length) {
            for (i = 0; i < liste.length && secilen.length < Math.min(3, maxK); i++) {
                var w = String(liste[i] || '').trim();
                if (w && /^[a-z0-9]{2,}$/.test(w)) secilen.push(w);
            }
        }

        if (!secilen.length) return 'hikaye';

        var parcalar = [];
        for (i = 0; i < secilen.length; i++) {
            var deneme = parcalar.length ? parcalar.join('-') + '-' + secilen[i] : secilen[i];
            if (deneme.length > maxLen) break;
            parcalar.push(secilen[i]);
        }

        if (parcalar.length) return parcalar.join('-');
        if (secilen[0].length <= maxLen) return secilen[0];
        return 'hikaye';
    }

    function slugUret(hint, content, id) {
        var hintTrim = String(hint || '').trim();
        var base;

        if (hintTrim) {
            base = slugKelimelerdenBase(
                slugNormalize(hintTrim).split('-').filter(Boolean),
                { stopFiltre: false }
            );
        } else {
            var raw = String(content || '').slice(0, 400).toLowerCase();
            raw = raw
                .replace(/ç/g, 'c')
                .replace(/ğ/g, 'g')
                .replace(/ı/g, 'i')
                .replace(/ö/g, 'o')
                .replace(/ş/g, 's')
                .replace(/ü/g, 'u')
                .replace(/[^a-z0-9\s]+/g, ' ');
            base = slugKelimelerdenBase(raw.split(/\s+/).filter(Boolean));
        }

        if (!base) base = 'hikaye';
        return base + '-' + String(id);
    }

    global.Gunde5Slug = {
        slugNormalize: slugNormalize,
        slugUret: slugUret,
        slugKelimeGecerli: slugKelimeGecerli,
        slugKelimelerdenBase: slugKelimelerdenBase,
        SLUG_MAX_KELIME: SLUG_MAX_KELIME,
        SLUG_MAX_UZUNLUK: SLUG_MAX_UZUNLUK
    };
})(typeof window !== 'undefined' ? window : globalThis);
