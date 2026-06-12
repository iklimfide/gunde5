/* gunde5 — Argo / küfür / müstehcen kelimelerde sesli harf → * */
(function (global) {
    'use strict';

    var SESLI_RE = /[aeıioöuüAEIİOÖUÜ]/g;
    var HARF_SINIFI = 'a-zçğıöşüA-ZÇĞİÖŞÜ';

    var KELIMELER = [
        'pornografi', 'pornografik', 'masturbasyon', 'mastürbasyon', 'sikimsonik', 'siktirgit',
        'orospunun', 'orospusunun', 'pezevenk', 'kahpenin', 'sürtüğün',
        'amcığını', 'amcigini', 'götveren', 'götüne', 'götünü', 'yarragini', 'yarrağını',
        'sikişme', 'sikisme', 'sikişen', 'sikisen', 'pornocular', 'pornocu',
        'porno', 'pornosu', 'pornoya', 'pornoda', 'pornolar',
        'sikiş', 'sikis', 'sikerim', 'sikeriz', 'sikersin', 'sikiyor', 'sikiyorum', 'sikilir',
        'sikiyorlar', 'sikiyoruz', 'sikiyorsun', 'sikiyorsunuz',
        'sikmiş', 'sikmis', 'sikmişim', 'sikmisim', 'sikmişsin', 'sikmissin',
        'siktiğim', 'siktigim', 'siktiğin', 'siktigin', 'siktiğimiz', 'siktigimiz',
        'siktiğiniz', 'siktiginiz', 'siktirir', 'siktiriyor', 'siktiririm', 'siktiririz',
        'sikilmiş', 'sikilmis', 'sikilen', 'sikileni',
        'siksin', 'siksın', 'siksinler', 'siksiniz', 'siksene',
        'sikeyim', 'sikeyiz', 'sikeysin',
        'sikimde', 'sikimden', 'sikime', 'sikimi', 'sikimin', 'sikimiz', 'sikimizin', 'sikimize',
        'sikinde', 'sikinden', 'sikini', 'sikinin', 'sikine',
        'sikte', 'sikten', 'sikler', 'sikleri', 'siklerin', 'siklerde',
        'sikim', 'sikti', 'sikik', 'sikiksin', 'sikiksiniz', 'siktir', 'sikhead',
        'sik', 'sikem', 'siken', 'sike',
        'orospu', 'orospusu', 'orospular',
        'amcık', 'amcik', 'amına', 'amina', 'amını', 'amini',
        'amk', 'amq', 'aq',
        'göt', 'got', 'götü', 'gotu', 'götün', 'gotun',
        'yarrak', 'yarak', 'yarrağı', 'yaragi',
        'taşak', 'tasak', 'taşşağ', 'tassak',
        'piç', 'pic', 'piçin', 'picin',
        'kahpe', 'kahpenin', 'sürtük', 'surtuk',
        'ibne', 'ibnenin',
        'malafat', 'döl', 'dol',
        'sakso', 'saksocu',
        'tecavüz', 'tecavuz', 'tecavüze',
        'fahişe', 'fahise',
        'vajina', 'penis', 'meme ucu',
        'boşal', 'bosal', 'boşaldı', 'bosaldi',
        'seks', 'sex', 'gangbang',
        'fuck', 'fucking', 'fucker', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'cock',
        'anal', 'oral', 'orgazm', 'orgasm',
        'onlyfans',
        'ananı', 'anani', 'bacını', 'bacini',
        'götlek', 'gotlek', 'oç', 'oc',
        'sıçmak', 'sicmak', 'sıçmış', 'sicmis', 'sıçtım', 'sictim', 'sıçtı', 'sicti',
        'sıçıyor', 'siciyor', 'sıçan', 'sican', 'sıçar', 'sicar', 'sıç', 'sic'
    ];

    KELIMELER.sort(function (a, b) {
        return b.length - a.length;
    });

    function regexKac(s) {
        return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function sesliPerdele(kelime) {
        return String(kelime).replace(SESLI_RE, '*');
    }

    function metinPerdele(metin) {
        if (metin == null) return metin;
        var s = String(metin);
        if (!s) return s;
        var i, w, re;
        for (i = 0; i < KELIMELER.length; i++) {
            w = KELIMELER[i];
            re = new RegExp(
                '(^|[^' + HARF_SINIFI + '])(' + regexKac(w) + ')([^' + HARF_SINIFI + ']|$)',
                'giu'
            );
            s = s.replace(re, function (_, on, kelime, son) {
                return on + sesliPerdele(kelime) + son;
            });
        }
        return s;
    }

    global.Gunde5Perde = {
        metinPerdele: metinPerdele,
        sesliPerdele: sesliPerdele
    };
})(window);
