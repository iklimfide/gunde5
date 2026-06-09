-- 5 planlı hikaye — arşiv: 2026-05-24 07:00–07:04 (eski plan 2026-06-12)
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
      'Kırmızı Alarm',
      28,
      'male',
      'izmir',
      null::varchar,
      'Yanlış Kargo Yanlış Anlaşılma',
      'İnternetten eşimle heyecanımızı artırmak için biraz iddialı, dantelli ve kırmızı bir iç çamaşırı sipariş ettim.

Kargo adresi olarak da iş yerini seçmiştim ki evdekilere sürpriz olsun.

Siparişi verirken kargo adının üstüne "Gizli Paket" yazmayı unutmuşum.

Ertesi gün şirketin resepsiyonundaki stajyer kız elinde şeffaf poşete sarılı kutuyla yanıma geldi.

Kutunun üstünde dev gibi harflerle markanın fantezi giyim adı yazıyordu.

Kız paketi uzatırken kızardı, bozardı, yere baktı:

"Ahmet Bey, size acil bir... şey gelmiş."

dedi.

Tüm ofis bir anda bana döndü.

Şu an şirkette herkes beni gizli bir fantezi tutkunu sanıyor.

İşin kötü tarafı, eşim rengini beğenmedi. 😂',
      timestamptz '2026-05-24 07:04:00+03'
    ),
    (
      'Gece Kemirgeni',
      32,
      'male',
      'ankara',
      null::varchar,
      'Diyetin Gizli İttifakı',
      'Eşimle ortak karar aldık ve sıkı bir diyete başladık.

Evde şekerli, unlu ne varsa çöpe gitti.

Akşam sadece salata yedik.

Gece saat 03:00''te midemin kazınmasına dayanamayıp mutfağa sızdım.

Buzdolabının kapağını açmamla içerideki ışıkta eşimle göz göze geldik.

Onun elinde saklanmış bir paket çikolata, benim elimde dünden kalan soğuk köfte.

Hiç konuşmadık.

Birbirimizi görmemiş gibi yapıp sessizce odalarımıza döndük.

Biz evli değiliz.

Suç ortaklığı yapıyoruz. 😂',
      timestamptz '2026-05-24 07:03:00+03'
    ),
    (
      'Sepet Bekçisi',
      26,
      'female',
      'eskisehir',
      null::varchar,
      'İndirim Kuponu Çılgınlığı',
      'Online alışveriş sitesinde büyük bir indirim yakaladım.

Beğendiğim elbiseyi sepete attım.

Tam ödeme yapacakken ekranda bir yazı belirdi:

"50 TL daha harcarsanız kargo bedava!"

Sırf 40 liralık kargo ücretini ödememek için sepeti kurcalamaya başladım.

Hiç ihtiyacım olmayan bir kupa, iki çift çorap ve bir adet makyaj süngeri ekledim.

Toplamda fazladan 250 TL harcamış oldum.

Ama kargo bedavaya geldi.

Ekonomi profesörleri bu zekamı görse diplomalarını yırtardı. 😂',
      timestamptz '2026-05-24 07:02:00+03'
    ),
    (
      'Rezil Olduk',
      40,
      'male',
      'bursa',
      null::varchar,
      'Akıllı Televizyon İhaneti',
      'Eve yeni bir akıllı televizyon aldık, kurulumunu kendim yaptım.

Telefondaki ekranı televizyona yansıtma özelliğini test etmek istedim.

Salonda annem, babam ve eşim oturuyor.

Ben de mutfaktan bağlantıyı açtım.

Yanlışlıkla o sırada telefonuma gelen komik ama fazlasıyla küfürlü bir caps videosunu yansıtmışım.

Salondan bir sessizlik koptu.

Babamın öksürük sesi mutfağa kadar geldi.

Teknolojiyi seviyorum.

Ama teknolojinin beni aileme karşı bu kadar hızlı harcayacağını düşünmemiştim. 😂',
      timestamptz '2026-05-24 07:01:00+03'
    ),
    (
      'Hamlamış Vücut',
      35,
      'female',
      'antalya',
      null::varchar,
      'Spor Salonu Acemisi',
      'Pazartesi günü büyük bir motivasyonla spora başladım.

Salondaki aletlerin hepsini tek tek denedim.

Kendimi çok güçlü ve fit hissediyordum.

Salı sabahı yataktan kalkmaya çalıştım.

Kalkamadım.

Vücudumdaki bütün kaslar bana karşı grev ilan etmiş gibiydi.

Doğrulabilmek için yataktan yuvarlanarak yere düşmek zorunda kaldım.

Spor sağlıklı yaşam sunuyor diyorlar.

Ama bana daha çok hareket kabiliyetimi kaybettirdi. 😂',
      timestamptz '2026-05-24 07:00:00+03'
    )
) as v(username, age, gender, yasadigi_yer, yurtdisi_sehir, baslik, hikaye, yayin_at)
where not exists (
  select 1
  from public.itiraflar i
  where i.baslik = v.baslik
    and i.created_at = v.yayin_at
    and i.silindi_at is null
);
