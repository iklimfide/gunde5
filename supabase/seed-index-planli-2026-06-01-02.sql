-- 10 planlı hikaye — 2–3 Haziran 2026 (07:00–07:04, Europe/Istanbul)
-- created_at gelene kadar anasayfada görünmez. Supabase SQL Editor'da bir kez Run.

insert into public.itiraflar (
  user_id,
  username,
  age,
  gender,
  yasadigi_yer,
  baslik,
  content_short,
  content_full,
  status,
  is_gizli,
  created_at
)
select
  null,
  v.username,
  v.age,
  v.gender,
  v.yasadigi_yer,
  v.baslik,
  case
    when char_length(v.hikaye) <= 140 then v.hikaye
    else left(v.hikaye, 137) || '...'
  end,
  v.hikaye,
  'kulis',
  false,
  v.yayin_at
from (
  values
    (
      'Arama Motoru',
      25,
      'male',
      'bursa',
      'Annemin Google Kullanımı',
      'Annem Google''a soru sorarken hâlâ insanla konuşur gibi yazıyor.

"Merhaba Google, bugün Bursa’da hava nasıl acaba teşekkür ederim."

diye aratmış.

Dedim anne teşekkür yazmana gerek yok.

"Ayıp olur oğlum, bütün gün çalışıyor." dedi.

Annem yapay zekadan önce yapay zekaya saygı göstermeyi öğrendi. 😂',
      timestamptz '2026-06-02 07:00:00+03'
    ),
    (
      'Yeni Başlayan',
      30,
      'male',
      'istanbul_avrupa',
      'Spor Salonu Gerçeği',
      'Spor salonuna ilk başladığım gün herkes bana bakıyor sanıyordum.

Hareketleri yanlış yapıyorum diye utanıyordum.

3 ay sonra büyük gerçeği öğrendim:

Kimse kimseye bakmıyor.

Herkes aynada gizlice kendine bakıyor. 😂',
      timestamptz '2026-06-02 07:01:00+03'
    ),
    (
      'Eski Zengin',
      41,
      'male',
      'ankara',
      'Küçükken Zengin Sanıyordum',
      'Çocukken babam kredi kartıyla ödeme yapınca bizi çok zengin sanıyordum.

Adam cebinden sihirli plastik çıkarıyor, istediği şeyi alıyordu.

Arkadaşlarıma "Biz para kullanmıyoruz." diye hava bile atmıştım.

Yıllar sonra kendi kredi kartı ekstrem gelince anladım.

Babam zengin değilmiş.

Gelecekteki babamdan borç alıyormuş. 😂',
      timestamptz '2026-06-02 07:02:00+03'
    ),
    (
      'Son Görülme Mağduru',
      28,
      'male',
      'izmir',
      'Yanlış Mesaj Kurbanı',
      'Sevgilimle tartışmıştık.

Sinirle arkadaşıma mesaj atacaktım:

"Ya çok seviyorum ama bazen o kadar sinir ediyor ki anlatamam."

yazdım.

Tabii ki kime gönderdim?

Sevgilime.

2 dakika sessizlik oldu.

Sonra cevap geldi:

"Sinir ediyorum kısmını konuşacağız ama çok seviyorum kısmını ekran görüntüsü aldım."

Kavga böylece saçma bir şekilde bitmiş oldu. 😂',
      timestamptz '2026-06-02 07:03:00+03'
    ),
    (
      'Evdeki Teknik Servis',
      32,
      'male',
      'eskisehir',
      'Babamın Akıllı Telefonla İmtihanı',
      'Babama yıllarca akıllı telefon kullanmayı öğrettim.

"Ben anlamam böyle şeylerden" diye söylenirdi.

Geçen gün eve gittim, adam telefonunda bilmediğim özellikleri gösteriyor.

Fotoğraf düzenliyor, yapay zekaya soru soruyor, alışveriş karşılaştırıyor.

Sonra benim telefon elimde kasınca:

"Oğlum sen onu yanlış kullanıyorsun, ver bakayım." dedi.

Yıllarca teknoloji öğrettiğim adamdan teknoloji dersi aldım.

Evlatlık görevimi tamamlayıp öğrencime yenilmiş bulunuyorum. 😂',
      timestamptz '2026-06-02 07:04:00+03'
    ),
    (
      'Teknik Servis Evladı',
      29,
      'male',
      'izmir',
      'Babam ve Şifreleri',
      'Babama 50 kere güçlü şifre kullan dedim.

Geçen gün şifresini gördüm:

"yanlisgiriyorsun123"

Dedim baba bu ne?

"Biri çalmaya çalışırsa ona cevap veriyorum."

Mantığını yenemedim. 😂',
      timestamptz '2026-06-03 07:00:00+03'
    ),
    (
      'Eski Aşık',
      35,
      'male',
      'ankara',
      'Romantizm Bittiği An',
      'İlişkinin ilk zamanları:

"Sen kapat."

"Hayır sen kapat."

diye saatler geçirirdik.

8 yıl sonra:

"Tamam kapatıyorum."

"Tamam."

Sevginin şekli değişiyor sadece. 😂',
      timestamptz '2026-06-03 07:01:00+03'
    ),
    (
      'Minik Dedektif',
      33,
      'male',
      'adana',
      'Çocuk Aklı İşte',
      'Küçükken ATM’nin içinde çalışan insanlar olduğunu sanıyordum.

Babam para çekince içeride biri sayıp gönderiyor zannederdim.

Bir kere ATM’ye yaklaşıp:

"Kolay gelsin abi."

demişliğim var.

Umarım içeride biri duymuştur. 😂',
      timestamptz '2026-06-03 07:02:00+03'
    ),
    (
      'Sessiz Mod',
      46,
      'male',
      'istanbul_avrupa',
      'Yaşlanma Belirtisi',
      'Eskiden cuma akşamı planım iptal olunca üzülürdüm.

Şimdi biri:

"Bugün çıkmasak olur mu?"

deyince içimden havai fişek patlıyor.

İnsan büyüdükçe eğlence anlayışı değişmiyor.

Sadece pijamanın değeri artıyor galiba.',
      timestamptz '2026-06-03 07:03:00+03'
    ),
    (
      'Ev Diplomatı',
      38,
      'male',
      'antalya',
      'Kapıyı Kim Açacak Savaşı',
      'Evlilikte en büyük savaşın para veya kıskançlık olduğunu sanıyordum.

Değilmiş.

Asıl savaş:

Kapı çalınca kimin kalkacağıymış.

İki yetişkin insan 3 metre uzaktaki kapı için 15 dakika uyuyor taklidi yapabiliyor.',
      timestamptz '2026-06-03 07:04:00+03'
    )
) as v(username, age, gender, yasadigi_yer, baslik, hikaye, yayin_at)
where not exists (
  select 1
  from public.itiraflar i
  where i.baslik = v.baslik
    and i.created_at = v.yayin_at
    and i.silindi_at is null
);
