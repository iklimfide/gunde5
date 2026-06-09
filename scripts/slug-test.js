/**
 * Slug üretim testleri — node scripts/slug-test.js
 */

var gecen = 0;
var basarisiz = 0;

function assert(kosul, mesaj) {
    if (kosul) {
        gecen++;
        console.log('  OK: ' + mesaj);
    } else {
        basarisiz++;
        console.error('  FAIL: ' + mesaj);
    }
}

function runTests(slugUret, slugNormalize, slugKelimeGecerli, slugKelimelerdenBase) {
    console.log('=== Slug testleri ===\n');

    var uzunMetin =
        'Kiz arkadasimla ilk kez benim evimde bas basa kaldik. Telefonum 80 iken umursamiyorum 50 iken hic umursamiyorum.';
    var slug1 = slugUret(null, uzunMetin, 151);
    var slug1Base = slug1.replace(/-\d+$/, '');
    assert(!slug1.endsWith('-bas-151'), 'yarim "bas" ile bitmiyor: ' + slug1);
    assert(slug1Base.length <= 60, 'base max 60 karakter: ' + slug1Base.length);
    assert(!/-[a-z]-\d+$/.test(slug1), 'tek harf artigi yok: ' + slug1);

    var slug2 = slugUret(null, 'Telefonum 80 iken umursamiyorum 50 iken hic umursamiyorum', 117);
    assert(!slug2.match(/-[a-z]-\d+$/), 'telefon ornegi tek harf yok: ' + slug2);
    assert(slug2.indexOf('-80-') >= 0 || slug2.indexOf('80') >= 0, 'anlamli sayi korunuyor: ' + slug2);

    var tr = slugUret(null, 'Geçen gün şüpheli bir öğrenci üniversitede', 42);
    assert(/^[a-z0-9-]+$/.test(tr), 'yalnizca ascii slug: ' + tr);
    assert(!/-h-/.test(tr.replace(/-\d+$/, '')), 'tek harf artigi yok: ' + tr);

    var hintSlug = slugUret('Filtre Kahve Kültürü', 'farkli metin', 99);
    assert(hintSlug.startsWith('filtre-kahve-kulturu-'), 'hint kullanildi: ' + hintSlug);

    var metinSlug = slugUret('', 'Dun markette siraya girdim kasiyer cok guldu', 7);
    assert(metinSlug.endsWith('-7'), 'metinden slug: ' + metinSlug);
    assert(metinSlug !== 'hikaye-7', 'anlamli kelimeler var: ' + metinSlug);

    var a = slugUret('', 'Ayni hikaye metni burada', 1);
    var b = slugUret('', 'Ayni hikaye metni burada', 2);
    assert(a !== b, 'farkli id farkli slug');

    assert(
        slugUret('eski-hint', 'yeni metin tamamen farkli', 5) === slugUret('eski-hint', 'baska', 5),
        'ayni hint ayni slug (id sabit)'
    );

    assert(slugUret('', 'planli hikaye', 100).endsWith('-100'), 'slug uretimi calisiyor');

    var tekHarf = slugKelimelerdenBase(['h', 'l', 'market', 'listesi']);
    assert(tekHarf === 'market-listesi', 'tek harf filtrelendi: ' + tekHarf);
    assert(slugKelimeGecerli('80', true), 'sayi 80 gecerli');
    assert(slugKelimeGecerli('h', true) === false, 'tek harf h gecersiz');

    assert(slugNormalize('  Telefonsuz Market!  ') === 'telefonsuz-market', 'normalize');

    console.log('\n=== Sonuc: ' + gecen + ' gecti, ' + basarisiz + ' basarisiz ===');
    process.exit(basarisiz > 0 ? 1 : 0);
}

async function main() {
    var mod = await import('../api/_lib/slug.js');
    runTests(mod.slugUret, mod.slugNormalize, mod.slugKelimeGecerli, mod.slugKelimelerdenBase);
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
