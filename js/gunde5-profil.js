/* gunde5 — profil seçenekleri (yaşadığı yer, meslek, medeni durum) */
(function (global) {
    var ONCELIKLI_YER = [
        { value: 'yurtdisi', label: 'Yurtdışı' },
        { value: 'istanbul_avrupa', label: 'İstanbul Avrupa' },
        { value: 'istanbul_anadolu', label: 'İstanbul Anadolu' },
        { value: 'ankara', label: 'Ankara' },
        { value: 'izmir', label: 'İzmir' }
    ];

    var DIGER_ILLER = [
        'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Antalya', 'Ardahan',
        'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis',
        'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce',
        'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane',
        'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars',
        'Kastamonu', 'Kayseri', 'Kilis', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya',
        'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde',
        'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa',
        'Şırnak', 'Tekirdağ', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'
    ];

    var MESLEK_SECENEKLERI = [
        { value: '', label: 'Belirtmek istemiyorum', grup: null },
        { value: 'yazilim_gelistirici', label: '💻 Yazılım Geliştirici', grup: 'Standart' },
        { value: 'ogrenci', label: '🎓 Öğrenci', grup: 'Standart' },
        { value: 'muhendis', label: '👷 Mühendis', grup: 'Standart' },
        { value: 'doktor', label: 'Doktor', grup: 'Standart' },
        { value: 'ogretmen', label: 'Öğretmen', grup: 'Standart' },
        { value: 'avukat', label: 'Avukat', grup: 'Standart' },
        { value: 'tasarimci', label: '🎨 Tasarımcı', grup: 'Standart' },
        { value: 'serbest_meslek', label: '💼 Serbest Meslek', grup: 'Standart' },
        { value: 'profesyonel_uykucu', label: '🛌 Profesyonel Uykucu', grup: 'Gunde5 Mood' },
        { value: 'kahve_tadimcisi', label: '☕ Kahve Tadımcısı', grup: 'Gunde5 Mood' },
        { value: 'hayalperest', label: '🦄 Hayalperest', grup: 'Gunde5 Mood' },
        { value: 'kedi_ebeveyni', label: '🐈 Kedi Ebeveyni', grup: 'Gunde5 Mood' },
        { value: 'oyun_bagimlisi', label: '🎮 Oyun Bağımlısı', grup: 'Gunde5 Mood' },
        { value: 'dizi_film_gurmesi', label: '🎬 Dizi/Film Gurmesi', grup: 'Gunde5 Mood' }
    ];

    var MEDENI_SECENEKLERI = [
        { value: '', label: 'Belirtmek istemiyorum', grup: null },
        { value: 'bekar', label: 'Bekar', grup: 'Standart' },
        { value: 'iliskisi_var', label: 'İlişkisi Var', grup: 'Standart' },
        { value: 'nisanli', label: 'Nişanlı', grup: 'Standart' },
        { value: 'evli', label: 'Evli', grup: 'Standart' },
        { value: 'karmasik', label: '🧩 Karmaşık', grup: 'Gunde5 Mood' },
        { value: 'nadasa_biraktim', label: '🧘 Nadasa Bıraktım', grup: 'Gunde5 Mood' },
        { value: 'yalnizlik_sultanligi', label: '👑 Yalnızlık Sultanlıktır', grup: 'Gunde5 Mood' },
        { value: 'kronik_bekar', label: '❄️ Kronik Bekar', grup: 'Gunde5 Mood' },
        { value: 'adaylara_kapali', label: '🔒 Adaylara Kapalı', grup: 'Gunde5 Mood' },
        { value: 'kimin_sorduguna_bagli', label: '🧐 Kimin sorduğuna bağlı', grup: 'Gunde5 Mood' }
    ];

    var yerEtiketMap = {};
    var meslekEtiketMap = {};
    var medeniEtiketMap = {};

    function ilSlug(ad) {
        return String(ad)
            .toLowerCase()
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/İ/g, 'i')
            .replace(/\s+/g, '_');
    }

    function tumYerSecenekleri() {
        var liste = ONCELIKLI_YER.slice();
        var i, slug;
        for (i = 0; i < DIGER_ILLER.length; i++) {
            slug = ilSlug(DIGER_ILLER[i]);
            liste.push({ value: slug, label: DIGER_ILLER[i] });
            yerEtiketMap[slug] = DIGER_ILLER[i];
        }
        for (i = 0; i < ONCELIKLI_YER.length; i++) {
            yerEtiketMap[ONCELIKLI_YER[i].value] = ONCELIKLI_YER[i].label;
        }
        return liste;
    }

    var YER_SECENEKLERI = tumYerSecenekleri();

    function etiketMapOlustur(secenekler, map) {
        var i;
        for (i = 0; i < secenekler.length; i++) {
            if (secenekler[i].value) {
                map[secenekler[i].value] = secenekler[i].label;
            }
        }
    }
    etiketMapOlustur(MESLEK_SECENEKLERI, meslekEtiketMap);
    etiketMapOlustur(MEDENI_SECENEKLERI, medeniEtiketMap);

    function yerEtiketi(value) {
        return yerEtiketMap[value] || value || '';
    }

    function meslekEtiketi(value) {
        return meslekEtiketMap[value] || '';
    }

    function medeniEtiketi(value) {
        return medeniEtiketMap[value] || '';
    }

    function yasadigiYerGosterim(u) {
        if (!u || !u.yasadigiYer) return '';
        if (u.yasadigiYer === 'yurtdisi') {
            var sehir = u.yurtdisiSehir ? String(u.yurtdisiSehir).trim() : '';
            return sehir ? 'Yurtdışı · ' + sehir : 'Yurtdışı';
        }
        return yerEtiketi(u.yasadigiYer);
    }

    function yasadigiYerSatirdan(row) {
        if (!row) return '';
        if (row.yasadigi_yer) {
            if (row.yasadigi_yer === 'yurtdisi') {
                var sehir = row.yurtdisi_sehir ? String(row.yurtdisi_sehir).trim() : '';
                return sehir ? 'Yurtdışı · ' + sehir : 'Yurtdışı';
            }
            return yerEtiketi(row.yasadigi_yer);
        }
        if (row.city) return String(row.city).trim();
        return '';
    }

    /** Kulis/Podyum kartı — güncel profil (uye) alanları; gizlide yalnızca yaş. */
    function kartMetaSatir(row) {
        if (!row) return '';
        if (row.is_gizli) {
            return row.age ? row.age + ' Yaş' : '';
        }
        var parcalar = [];
        if (row.age) parcalar.push(row.age + ' Yaş');
        var yer = yasadigiYerSatirdan(row);
        if (yer) parcalar.push(yer);
        if (row.meslek) {
            var m = meslekEtiketi(row.meslek);
            if (m) parcalar.push(m);
        }
        return parcalar.join(' • ');
    }

    function selectDoldur(selectEl, secenekler, seciliDeger) {
        if (!selectEl) return;
        var html = '';
        var gruplar = {};
        var gruplarSirasi = [];
        var i, s, g;

        for (i = 0; i < secenekler.length; i++) {
            s = secenekler[i];
            if (!s.grup) {
                html += '<option value="' + escapeAttr(s.value) + '">' + escapeHtml(s.label) + '</option>';
                continue;
            }
            if (!gruplar[s.grup]) {
                gruplar[s.grup] = [];
                gruplarSirasi.push(s.grup);
            }
            gruplar[s.grup].push(s);
        }

        for (i = 0; i < gruplarSirasi.length; i++) {
            g = gruplarSirasi[i];
            html += '<optgroup label="' + escapeHtml(g) + '">';
            for (var j = 0; j < gruplar[g].length; j += 1) {
                s = gruplar[g][j];
                html += '<option value="' + escapeAttr(s.value) + '">' + escapeHtml(s.label) + '</option>';
            }
            html += '</optgroup>';
        }

        selectEl.innerHTML = html;
        if (seciliDeger != null) {
            selectEl.value = seciliDeger;
        }
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escapeAttr(s) {
        return escapeHtml(s);
    }

    global.Gunde5Profil = {
        YER_SECENEKLERI: YER_SECENEKLERI,
        MESLEK_SECENEKLERI: MESLEK_SECENEKLERI,
        MEDENI_SECENEKLERI: MEDENI_SECENEKLERI,
        yerEtiketi: yerEtiketi,
        meslekEtiketi: meslekEtiketi,
        medeniEtiketi: medeniEtiketi,
        yasadigiYerGosterim: yasadigiYerGosterim,
        kartMetaSatir: kartMetaSatir,
        selectDoldur: selectDoldur
    };
})(window);
