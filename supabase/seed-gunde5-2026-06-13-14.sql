-- 10 planlı hikaye — arşiv: 2026-05-24 07:00–07:04 (eski plan 2026-06-13 … 14)
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
      'Alttan Alan Öğrenci',
      23,
      'male',
      'erzurum',
      null::varchar,
      'Akademik Kapak Tuzağı',
      'Üniversitede geçilmesi imkansız bir dersin amfisindeyiz.

Hoca kürsüde kasılıp sınıfa döndü:

"Bu fakülteye eşeği bağlasan 4 yılda mezun olur!"

Sınıf buz kesmişken arkalardan bir ses yükseldi:

"Hocam, 2 yıl daha bağlayınca da akademisyen oluyor herhalde?"

Net hayatımda gördüğüm en kral hareketti.

Dün sınav sonuçları açıklandı.

Arkadaş o dersi hâlâ geçememiş, okul uzadı.

Dersten geçemedi ama okul tarihine geçti 😂',
      timestamptz '2026-05-24 07:00:00+03'
    ),
    (
      'Kete Mağduru',
      29,
      'female',
      'erzurum',
      null::varchar,
      'Yerli Malı Dürüstlüğü',
      'İlkokulda öğretmenlik yapıyorum, geçen hafta sınıfta Yerli Malı Haftası kutlaması yaptık.

Öğrencilerimden birinin getirdiği kete o kadar lezzetliydi ki tadı damağımda kaldı.

Çocuğu yanıma çağırıp:

"Annene çok teşekkür et, müsait bir zamanda yine yapabilir mi?" diye rica ettim.

Ertesi sabah çocuk koşa koşa yanıma geldi, gözlerinin içi parlıyordu.

"Öğretmenim, anneme söyledim, dedi ki bunu bile yapana kadar canım çıktı, öğretmenlerin zıkkım yesin." 

Tüm sınıfın önünde ne diyeceğimi bilemeden öylece kalakaldım.

Çocukların o aşırı dürüst filtresiz dünyası bazen insanı hayattan soğutuyor. 😂',
      timestamptz '2026-05-24 07:01:00+03'
    ),
    (
      'Rehber Faciası',
      25,
      'male',
      'izmir',
      null::varchar,
      'Uruguaylı Lugano',
      'Geçen yaz otelde tatil yaparken Uruguaylı bir kızla tanıştım, acayip iyi anlaştık.

Gece ayrılırken numarasını verdi ama gürültüden ismini tam anlayamadım.

Ben de rehbere Fenerbahçeli olduğum için ordan hatırlarım diye eski futbolcumuz Lugano''nun adı ile kaydettim. 

Ertesi gün sahilde yan yana otururken kıza bir şey göstermek için telefonumu uzattım.

Kız rehbere kendi numararasını girince karşısına "Lugano" çıktı.

Kaşlarını çatıp: "Benim adım Maria, Lugano da kim?" dedi.

Fenerbahçe''nin eski defans oyuncusunu ve ofsayt taktiğini kıza anlatmaya çalışırken iyice rezil oldum.

Kız iki gün sonra otelden ayrıldı, arkasına bile bakmadı. 😂',
      timestamptz '2026-05-24 07:02:00+03'
    ),
    (
      'Kod Parçası',
      31,
      'male',
      'istanbul_avrupa',
      null::varchar,
      'Kendi İpini Çekenler',
      'Yazılımcı olarak bir teknoloji şirketinde harıl harıl yapay zeka projeleri üzerinde çalışıyoruz.

Geçen gün matematikçi bir arkadaşla gece geç saatlere kadar kod yazdık, algoritmayı geliştirdik.

Kahve molası verdiğimizde ekranlara bakıp derin bir tebrik seansı gerçekleştirdik.

Sonra birden fark ettim; biz bu teknolojiyi o kadar hevesli ve kusursuz geliştiriyoruz ki...

Çok değil, birkaç yıla kalmaz sistem bizi tamamen işsiz bırakacak seviyeye gelecek.

Kendi ellerimizle kendi yerimize geçecek dijital işçiyi yaratıp üstüne bir de mesaiye kalıyoruz.

Geleceğe doğru koşarken altımızdaki dalı kesmek tam olarak bu olsa gerek. 😂',
      timestamptz '2026-05-24 07:03:00+03'
    ),
    (
      'Gurme Komşu',
      34,
      'male',
      'ankara',
      null::varchar,
      'Arta Kalan Sevgi',
      'Üst kat komşumuz olan abla haftalardır durmadan kapımı çalıp bana tabak tabak yemek getiriyor.

Ana yemekten tutun, zeytinyağlılara, oradan en kral ev tatlılarına kadar her şeyi tattım.

Dün akşam yine elinde kocaman bir tepsiyle gelince biraz mahcup hissettim:

"Abla valla çok zahmet ediyorsun, tek başınasın evde, bizim için bu kadar uğraşma" dedim.

Abla gayet rahat bir tavırla gülümsedi:

"Ay yok ne uğraşması, ben büyük bir yemek şirketinde çalışıyorum, arta kalanları getiriyorum" dedi.

Kendimi bir an mahallenin şanslı sokak hayvanı gibi hissetsem de tabağı boş çeviremedim. 😂',
      timestamptz '2026-05-24 07:04:00+03'
    ),
    (
      'Fantastik Gece',
      28,
      'female',
      'mersin',
      null::varchar,
      'Yataktaki Gizli Taktik',
      'Eşimle evliliğimize biraz heyecan katalım dedik ve internetten fantezi ürünleri sipariş ettik.

Gelen paketin içinden çıkan kelepçeleri yatağın başlığına takıp denemelere başladık.

Maksat ortam şenlensin, rutin kırılsın.

Tam şehvetin ve aksiyonun ortasındayken kelepçenin anahtarını bazanın arkasına düşürdüm.

Eşim yatağa bağlı şekilde kaldı, ben de yerde emekleyerek karanlıkta anahtar arıyorum.

Gecenin sonu çilingirin yatak odamıza girip "Golayyy gele yenge" demesiyle bitti.

Romantizm bitti, adli vaka tadında bir gece hafızalara kazındı. 😂',
      timestamptz '2026-05-24 07:00:00+03'
    ),
    (
      'Kıskançlık Savaşları',
      30,
      'female',
      'bursa',
      null::varchar,
      'İş Yeri Çiçek Savaşı',
      'İş yerindekilere hava atmak, "kocam beni el üstünde tutuyor" demek istedim.

Nasılsa eşim hayatta çiçek göndermez deyip kendi kendime dev bir buket sipariş ettim.

Üzerine de "Seni çok seven biricik aşkın" diye not yazdırdım.

Tam çiçek ofise geldi, ben kızlara hava atarken kapı açıldı.

Eşim elinde başka bir buketle bana sürpriz ziyarete gelmiş.

Masadaki dev çiçeği ve notu görünce adamın gözleri döndü.

"Ben sana göndermedim, bu kimden?" diye esip gürlüyor.

Kendi kendime gönderdiğimi, faturayı, kredi kartı ekstresini gösterdim ama nafile.

Hava atalım derken evlilik krizinin tam ortasına düştük. 😂',
      timestamptz '2026-05-24 07:01:00+03'
    ),
    (
      'Yalnızlık Seviyem',
      26,
      'male',
      'samsun',
      null::varchar,
      'Bakkal Musa Romantizmi',
      'Geçen ay sıkı bir diyete girip bayağı kilo verdim, üstüne bir de sakalları kısalttım.

Annem dahil evdeki kimse bendeki bu büyük değişimi fark etmedi.

Dün akşam mahallenin bakkalı Musa abiden sigara almaya gittim.

Yüzüme baktı: "Ooo zayıflamışsın, sakallar da gitmiş" dedi.

Sonra ekledi: "Kendine dikkat et, az sigara iç, biraz da uyu, çökmüşsün."

O an durup düşündüm.

Hayatımda beni onun kadar dikkatli izleyen ve sağlüğımı düşünen başka kimse yok.

Galiba bu hayatta beni gerçekten hak eden tek kişi bakkal Musa.

Gidip ciddi ciddi konuşacağım, ne olacaksa olsun artık. 😂',
      timestamptz '2026-05-24 07:02:00+03'
    ),
    (
      'Adalet Savaşçısı',
      29,
      'female',
      'ankara',
      null::varchar,
      'Avukatın Çek İmtihanı',
      'Ağır ceza mahkemesinde davası olan bir sanık savunmasını yapmam için ofisime geldi.

Ücreti konuşup anlaştık, "Tamam avukat hanım, sıkıntı yok" dedi.

Ardından elini cebine attı, bir koçan çıkardı:

"Şimdi nakit zor, iki ay vadeli bir çek yazayım sana" diye uzattı.

Şöyle bir durdum ve adamın elimdeki ağır ceza dosyasının konusuna baktım.

"Sahte çek düzenleme yoluyla nitelikli dolandırıcılık."

Adam mesleki uzmanlık alanını direkt benim üzerimde test etmeye çalışıyordu.

Adalete güveniyorum ama bu esnaflık kafasına güvencem kalmadı. 😂',
      timestamptz '2026-05-24 07:03:00+03'
    ),
    (
      'Genç Hukukçu',
      25,
      'female',
      'istanbul_avrupa',
      null::varchar,
      'Kıdemli Teveccühü',
      'Hukuk fakültesinden yeni mezun oldum, ofiste harıl harıl dosya inceliyorum.

Yaşlı ve oldukça zengin bir müvekkilimiz davasının gidişatı için ziyarete geldi.

2007 esaslı dosyasının durmunu detaylı şekilde anlattım. 

"Kızım, bu dosyayla keşke baştan beri siz ilgilenseydiniz" dedi.

Çok duygulandım ama 2007 yılında henüz ilkokula gidiyordum diyemedim.

"Tabii efendim, önlükle adliyeye koşardım" diyecek halim yoktu ya.

Müvekkil gözünde kıdemli görünmek isterken yaş engeline takılmak da mesleğin ilk cilvesi oldu. 😂',
      timestamptz '2026-05-24 07:04:00+03'
    )
) as v(username, age, gender, yasadigi_yer, yurtdisi_sehir, baslik, hikaye, yayin_at)
where not exists (
  select 1
  from public.itiraflar i
  where i.baslik = v.baslik
    and i.created_at = v.yayin_at
    and i.silindi_at is null
);
