-- 16 planlı hikaye — gunde5.txt — 2026-06-06 … 2026-06-08 (dosya TARİH / 07:00–07:04)
-- created_at gelene kadar anasayfada görünmez. Supabase SQL Editor'da bir kez Run.

insert into public.itiraflar (
  user_id,
  username,
  age,
  gender,
  yasadigi_yer,
  yurtdisi_sehir,
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
  v.yurtdisi_sehir,
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
      'Karşı Komşu Travması',
      34,
      'female',
      'mersin',
      null::varchar,
      'Perdeyi Kapatmayı Unutmuşuz',
      'Yeni taşındığımız evde eşimle romantik bir akşam geçirelim dedik.

Ev yeni.

Manzara güzel.

Ortam güzel.

Biz de biraz fazla rahat davranmışız.

Ertesi sabah apartmandan çıkarken karşı komşu teyzeyle karşılaştım.

Bana gülümsedi:

"Kızım perdeleriniz çok güzelmiş."

dedi.

Tam teşekkür edecekken ekledi:

"Özellikle gece ışık açıkken daha net belli oluyor."

O günden beri perdeyi değil...

Perdenin arkasındaki hayatımı kontrol ediyorum. 😂',
      timestamptz '2026-06-06 07:04:00+03'
    ),
    (
      'Kulaklık Mağduru',
      27,
      'female',
      'samsun',
      null::varchar,
      'Annemin Sesli Mesajları',
      'Annem sesli mesaj atmayı keşfetti.

Başta çok mutlu oldum.

Sonra fark ettim.

10 saniyelik konuyu 4 dakikada anlatıyor.

Arada kapı çalıyor.

Komşuyla konuşuyor.

Yemeği kontrol ediyor.

Sonra geri dönüp:

"Nerede kalmıştım?"

diyor.

Artık annemin mesajlarını dinlemiyorum.

Podcast takip ediyorum. 😂',
      timestamptz '2026-06-06 07:03:00+03'
    ),
    (
      'Çocuk Aklı',
      36,
      'male',
      'gaziantep',
      null::varchar,
      'Gizli Zenginlik Testi',
      'Küçükken otellerde kalan herkesin zengin olduğunu sanırdım.

Hele odada küçük buzdolabı varsa tamam.

Kraliyet ailesi gibiydik.

İçindeki çikolatalara bakıp:

"Hepsi bizim."

derdim.

Babamın:

"Sakın dokunma."

cümlesiyle gerçek hayata dönerdim.

Meğer zenginlik göstergesi değilmiş.

En pahalı tuzakmış. 😂',
      timestamptz '2026-06-06 07:02:00+03'
    ),
    (
      'Çanta Dedektifi',
      31,
      'female',
      'mugla',
      null::varchar,
      'Kadınların Çanta Evreni',
      'Çantamı temizlemeye karar verdim.

İçinden çıkanlar:

Rujlar.

Fişler.

Tokalar.

Ne zaman koyduğumu bilmediğim çikolata.

Ve küçük bir çanta.

Evet.

Çantamın içinde çanta taşıyormuşum.

Kadın çantaları eşya değil.

Paralel evren kapısı. 😂',
      timestamptz '2026-06-06 07:01:00+03'
    ),
    (
      'Fazla Kilo',
      44,
      'female',
      'yurtdisi',
      'Berlin',
      'Gurbetçi Bavulu',
      'Türkiye''ye gelirken bavulum 30 kilo.

Dönerken yine 30 kilo.

Ama içindekiler tamamen değişiyor.

Gelirken hediye getiriyorum.

Dönerken:

Salça.

Çay.

Baharat.

Annemin gizemli poşetleri.

Almanya''da yaşıyorum.

Almanya''da yaşıyorum ama mutfağım sanki küçük Anadolu şubesi 😂',
      timestamptz '2026-06-06 07:00:00+03'
    ),
    (
      'Navigasyon Kurbanı',
      28,
      'female',
      'kayseri',
      null::varchar,
      'Konum Attım Kayboldum',
      'Arkadaşımla buluşacağız.

Bana konum attı.

Teknoloji var diye çok rahattım.

Navigasyonu açtım.

Yürümeye başladım.

15 dakika sonra fark ettim.

Ben konuma gitmiyorum.

Konum benden uzaklaşıyor.

Meğer arkadaşım canlı konum atmış.

İki kişi şehir içinde birbirimizi takip ederek kaçırma kovalamaca oynamışız.

Teknoloji gelişti.

Biz aynı kaldık. 😂',
      timestamptz '2026-06-07 07:04:00+03'
    ),
    (
      'Son Lokma',
      34,
      'male',
      'adana',
      null::varchar,
      'Restoran Hesap Oyunu',
      'Arkadaşlarla yemeğe çıktık.

Hesap geldi.

Herkes telefonunu çıkardı.

Sandım ki hesap makinesi açıyorlar.

Meğer herkes:

"Ben ne yemiştim?"

diye fotoğraflara bakıyormuş.

Eskiden anılar için fotoğraf çekerdik.

Şimdi hesabı bölmek için delil topluyoruz. 😂',
      timestamptz '2026-06-07 07:02:00+03'
    ),
    (
      'Gerçek Hayat',
      39,
      'female',
      'yurtdisi',
      'Londra',
      'Romantik Film Tuzağı',
      'Filmlerde çiftler sabah uyanınca birbirine sarılır.

Saçlar mükemmel.

Işık mükemmel.

Romantizm zirvede.

Gerçek hayatta sabah ilk cümlemiz:

"Sen mi horladın ben mi?"

oluyor.

Hollywood bize aşkı öğretti.

Ama kimse sabah nefesini anlatmadı. 😂',
      timestamptz '2026-06-08 07:00:00+03'
    ),
    (
      'Romantik Kazazede',
      29,
      'female',
      'mardin',
      null::varchar,
      'İlk Gece Panik Butonu',
      'Erkek arkadaşımla ilk kez beraber kalacağız.

Her şeyi düşünmüşüm.

Güzel kıyafet.

Güzel koku.

Romantik ortam.

Tek düşünmediğim şey:

Midem.

Tam film sahnesi gibi bir gece olacak derken karnımdan öyle bir ses geldi ki...

Romantizm sustu.

Sindirim sistemi konuştu.

O gün öğrendim.

Vücut bazen en yanlış zamanda toplantıya katılıyor. 😂',
      timestamptz '2026-06-07 07:03:00+03'
    ),
    (
      'Eski Küçük',
      35,
      'male',
      'konya',
      null::varchar,
      'Çocukken Büyük Olmak',
      'Çocukken büyük olmak dünyanın en güzel şeyi sanıyordum.

Kimse sana karışmayacak.

İstediğin saatte yatacaksın.

İstediğini alacaksın.

"Keşke hemen büyüsem."

derdim.

Sonra büyüdüm.

Gerçekten istediğim saatte yatabiliyorum.

Ama artık beni yatağa gönderen annem değil...

Sabah çalacak alarm, ödenecek faturalar ve bitmeyen işler.

Küçükken kaçtığım erken yatma cezası...

Büyüyünce ödül olmuş. 😂',
      timestamptz '2026-06-07 07:02:00+03'
    ),
    (
      'Poz Mağduru',
      24,
      'female',
      'canakkale',
      null::varchar,
      'Fotoğraf Çekme Savaşı',
      'Arkadaşlarla fotoğraf çekilince hep aynı şey oluyor.

İlk fotoğraf:

Birinin gözü kapalı.

İkinci:

Biri beğenmiyor.

Üçüncü:

Birinin saçı kötü.

Sonunda 80 fotoğraf çekiyoruz.

Paylaşılan?

İlk çekilen.

Demek ki sorun fotoğrafta değilmiş.

Kabullenme sürecimiz uzunmuş. 😂',
      timestamptz '2026-06-07 07:01:00+03'
    ),
    (
      'Unuttum Gitti',
      33,
      'male',
      'yurtdisi',
      'Amsterdam',
      'Şifreyi Hatırladım Yalanı',
      'Artık bazı sitelerde şifremi hatırlamaya çalışmıyorum bile.

Direkt:

"Şifremi unuttum"

diyorum.

Mail geliyor.

Yenisini yapıyorum.

2 ay sonra tekrar unutuyorum.

Sanırım benim gerçek şifrem şifre değil.

Şifre yenileme linki. 😂',
      timestamptz '2026-06-07 07:00:00+03'
    ),
    (
      'Sporcu Sandım',
      32,
      'male',
      'rize',
      null::varchar,
      'Aynadaki Kas Yanılgısı',
      'Spor yapmaya başlayınca özgüvenim arttı.

Aynaya bakıyorum.

Işık güzel.

Açı güzel.

Kendimi film karakteri gibi hissediyorum.

Sonra biri habersiz fotoğrafımı çekti.

O fotoğraftaki adamla aynadaki adam aynı kişi olamaz.

Spor salonundaki en güçlü kas...

Hayal gücüymüş. 😂',
      timestamptz '2026-06-08 07:04:00+03'
    ),
    (
      'Sepet Diplomatiği',
      41,
      'female',
      'edirne',
      null::varchar,
      'Sessiz Alışveriş Anlaşması',
      'Eşimle alışverişe gidince fark ettim.

Ben sepete bir şey atıyorum.

O fark etmeden geri bırakıyor.

O bir şey atıyor.

Ben pahalı diye çıkarıyorum.

Yarım saat geziyoruz.

Sonunda başladığımız ürünlerle kasaya gidiyoruz.

Biz alışveriş yapmıyoruz.

Sepet üzerinden satranç oynuyoruz. 😂',
      timestamptz '2026-06-08 07:03:00+03'
    ),
    (
      'Tatil Modu',
      37,
      'female',
      'yurtdisi',
      'Milano',
      'Otel Banyosu Cesareti',
      'Normalde evde aynaya bakıp kusur bulurum.

Ama nedense otel banyosunda durum değişiyor.

Bornoz.

Güzel ışık.

Büyük ayna.

Bir anda kendimi ünlü gibi hissediyorum.

Demek ki özgüven eksikliği değilmiş.

Evde ışıklandırma problemi varmış. 😂',
      timestamptz '2026-06-08 07:02:00+03'
    ),
    (
      'Gizli Kasa',
      30,
      'male',
      'kars',
      null::varchar,
      'Babamın Para Saklama Yerleri',
      'Babam hâlâ evin farklı yerlerine para saklıyor.

Kitap arası.

Çekmece.

Eski ceket.

Sorunca:

"Lazım olur."

diyor.

Ama sorun şu:

Nereye koyduğunu kendi de unutuyor.

Biz ev temizlemiyoruz.

Define avına çıkıyoruz. 😂


--------------------------',
      timestamptz '2026-06-08 07:01:00+03'
    )
) as v(username, age, gender, yasadigi_yer, yurtdisi_sehir, baslik, hikaye, yayin_at)
where not exists (
  select 1
  from public.itiraflar i
  where i.baslik = v.baslik
    and i.created_at = v.yayin_at
    and i.silindi_at is null
);
