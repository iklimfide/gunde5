-- 10 planlı hikaye — gunde5.txt — 2026-06-04 … 2026-06-05 (07:00–07:04)
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
      'Taht Kavgası',
      39,
      'male',
      'ankara',
      'Kumandanın Gerçek Sahibi',
      'Eskiden babam televizyon kumandasını kimseye vermezdi.

Evde resmen küçük bir krallık vardı.

Adam aynı anda hem uyurdu hem de kanal değiştirmemize izin vermezdi.

"Baba uyuyorsun zaten."

derdim.

"Ben dinliyorum."

derdi.

Yıllar geçti, şimdi aynı şeyi ben yapıyorum.

Geçen gün çocuğum:

"Baba uyuyorsun."

dedi.

Ağzımdan istemsizce çıktı:

"Ben dinliyorum."

O an anladım.

Taht bana geçmiş. 😂',
      timestamptz '2026-06-04 07:00:00+03'
    ),
    (
      'Bildirim Mağduru',
      31,
      'female',
      'izmir',
      'Sessize Alınan Aşk',
      'Sevgilimle ilk zamanlarımızda telefonuma mesaj gelince kalbim hızlanırdı.

Ekranda adını görmek bile mutlu ederdi.

5 yıl geçti.

Geçen gün fark ettim.

Bildirimlerini sessize almışım.

Sevmediğimden değil.

Sadece aynı anda 14 tane market fotoğrafı atıp:

"Hangisini alayım?"

diye sormasından.

Aşk bitmiyor.

Sadece bildirim ayarları değişiyor galiba. 😂',
      timestamptz '2026-06-04 07:01:00+03'
    ),
    (
      'Minik Hesap Makinesi',
      28,
      'male',
      'bursa',
      'Çocukluk Matematiği',
      'Küçükken 2000 yılında doğanların yaş hesaplamasının çok kolay olduğunu düşünürdüm.

"Ne güzel ya direkt yıldan çıkarıyorsun."

derdim.

Sonra büyüdüm.

Fark ettim ki asıl sorun hesaplamak değilmiş.

Sorun hesapladığın sayının bu kadar hızlı büyümesiymiş.

Artık yaşımı bulmak kolay.

Kabullenmek zor. 😂',
      timestamptz '2026-06-04 07:02:00+03'
    ),
    (
      'Ev Temizlik Ekibi',
      26,
      'female',
      'istanbul_avrupa',
      'Annemin Misafir Alarmı',
      'Çocukken eve misafir geleceği zaman annem başka bir insana dönüşürdü.

Normalde yaşadığımız ev bir anda müze oluyordu.

"Oraya oturma."

"Bunu elleme."

"Yastığı bozma."

Misafir gelmeden önce evde yaşayan biz değilmişiz gibi bütün izlerimizi yok ederdik.

Sanırım çocukluğumun yarısı kendi evimde delil saklamakla geçti. 😂',
      timestamptz '2026-06-04 07:03:00+03'
    ),
    (
      'Yüzde Bir Umut',
      34,
      'female',
      'antalya',
      'Şarj Yüzdesi Psikolojisi',
      'Telefonum %80 iken hiç umursamıyorum.

%50 iken hâlâ rahatım.

Ama %9 olunca hayatım değişiyor.

Parlaklığı kısıyorum.

Uygulamaları kapatıyorum.

Telefonu neredeyse yoğun bakıma alıyorum.

Keşke bazı insanlara da değerini kaybetmeden önce böyle özen göstersek. 😂',
      timestamptz '2026-06-04 07:04:00+03'
    ),
    (
      'Tamamcı Baba',
      33,
      'male',
      'eskisehir',
      'Babamın Kısa Cevapları',
      'Babama uzun uzun mesaj yazıyorum.

5 paragraf açıklama yapıyorum.

Plan anlatıyorum.

Fikir soruyorum.

10 dakika sonra cevap geliyor:

"Tamam"

Bazen de heyecan yapıp:

"Ok"

yazıyor.

Adam yıllardır bütün duygularını iki kelimeye sıkıştırmayı başardı.

Minimalizmi babalar bulmuş olabilir. 😂',
      timestamptz '2026-06-05 07:00:00+03'
    ),
    (
      'Sepette Bekleyen',
      29,
      'female',
      'istanbul_avrupa',
      'Alışveriş Sepeti Hayalleri',
      'İnternetten alışveriş yaparken sepete her şeyi atıyorum.

Kıyafetler.

Elektronikler.

Gereksiz ama güzel duran şeyler.

Sonra toplam tutara bakıyorum.

Sessizce sekmeyi kapatıyorum.

Bence benim alışveriş sepetim alışveriş yeri değil.

Hayallerimin bekleme odası. 😂',
      timestamptz '2026-06-05 07:01:00+03'
    ),
    (
      'Bardak Dibi',
      45,
      'male',
      'trabzon',
      'Çayın Son Yudumu',
      'Fark ettim ki herkes çayın son yudumunu bırakıyor.

O küçücük kalan kısmı kimse içmek istemiyor.

Neden bilmiyoruz.

Ama millet olarak bardakta kalan son 1 santim çaya güvenmiyoruz.

Sanki bütün kötülükler orada toplanmış gibi.

Çayın karanlık tarafı. 😂',
      timestamptz '2026-06-05 07:02:00+03'
    ),
    (
      'Albüm Yolcusu',
      37,
      'female',
      'ankara',
      'Eski Fotoğraf Gerçeği',
      'Eski fotoğraflarıma bakarken hep aynı şeyi yaşıyorum.

O zaman çekildiğimde beğenmediğim fotoğrafa şimdi bakıp:

"Ne güzelmişim."

diyorum.

Büyük ihtimalle bugün beğenmediğim fotoğraflara da 10 yıl sonra aynı şeyi diyeceğim.

İnsan kendi değerini hep geç fark ediyor galiba.',
      timestamptz '2026-06-05 07:03:00+03'
    ),
    (
      'Cep Taşıyıcısı',
      30,
      'male',
      'izmir',
      'Erkeklerin Çanta Mantığı',
      'Yıllarca kadınların neden büyük çanta taşıdığını anlamadım.

Sonra kendi ceplerime baktım.

Telefon.

Cüzdan.

Anahtar.

Kulaklık.

Bozuk para.

Fişler.

Bir de "lazım olur" diye taşıdığım şeyler.

Fark ettim ki erkekler çanta kullanmıyor.

Pantolonlarını çantaya çeviriyor. 😂',
      timestamptz '2026-06-05 07:04:00+03'
    )
) as v(username, age, gender, yasadigi_yer, baslik, hikaye, yayin_at)
where not exists (
  select 1
  from public.itiraflar i
  where i.baslik = v.baslik
    and i.created_at = v.yayin_at
    and i.silindi_at is null
);
