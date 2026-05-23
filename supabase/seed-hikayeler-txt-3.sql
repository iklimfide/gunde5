-- 3 hikaye (hikayeler.txt) — Supabase SQL Editor'da bir kez Run.
-- Aynı rumuz + metin zaten varsa tekrar eklemez.

insert into public.itiraflar (
  user_id,
  username,
  age,
  gender,
  yasadigi_yer,
  yurtdisi_sehir,
  content_short,
  content_full,
  status,
  is_gizli
)
select
  null,
  v.username,
  v.age,
  v.gender,
  v.yasadigi_yer,
  v.yurtdisi_sehir,
  case
    when char_length(v.hikaye) <= 140 then v.hikaye
    else left(v.hikaye, 137) || '...'
  end,
  v.hikaye,
  'kulis',
  false
from (
  values
    (
      'SigortacıFırlama',
      46,
      'male',
      'istanbul_avrupa',
      null::varchar,
      'Sene 2002, üniversitede meteliğe kurşun atarken bizim arkadaş bir sigorta firmasında işe girdi. Öğrenci haliyle deli gibi para kazanınca beni de bölge müdürüyle mülakata çağırdılar. Jilet gibi giyinip erkenden ofise gittim.

Bekleme salonunda çayımı içerken içeri fıstık gibi bir hatun girdi. Kapıdaki büyük pirinç çanı eline alıp şıngır şıngır sallayarak, "Yatarak verdiiimmm!" diye bağırdı. İçeriden müdür dahil herkes fırlayıp kızı alkışlarla tebrik etmeye başladı. Şaşkınlıktan ağzım açık kaldı.

Aradan beş dakika geçmeden bu sefer esmer bir kadınla bir adam girdi. Kadın çanı kapıp "Yatarak artı ayakta verdimmmm!" diye çığlık attı. Oğlan da arkasından "Yatarak artı ayaktaaaa!" diye bas bas bağırdı. Ofis yine yıkıldı. İçimden "Ulan arkadaş, senin kazandığın paranın kaynağı belli oldu" dedim.

Müdürün odasına girince dayanamayıp, "Müdürüm mülakata başlamadan sorayım; içeri her giren çan çalıp yatarak verdim, ayakta verdim diyor. Ne veriyor bu arkadaşlar?" dedim.

Adam bir kahkaha patlattı, 10 dakika gülmekten konuşamadı. En son gözünden yaşlar akarken, "Seni işe aldım, pazartesi gel sen de vermeye başlarsın" dedi. Meğerse sağlık sigortası satıp yatarak ve ayakta tedavi teminatlarını bağırıyorlarmış.'
    ),
    (
      'BorsaKraliçesi',
      34,
      'female',
      'adana',
      null::varchar,
      'Geçen gün aile meclisinde bir dedikodu patladı, şoktan kahve fincanını düşürüyordum. Meğer benim kayınvalide sinsi sinsi büyücüye gitmiş. Oğluyla ben ayrılalım diye kadına tam iki tane burma bilezik parası bayılmış.

Buradan o derin operasyonlar çeviren tüm kayınvalidelere seslenmek istiyorum; ablacım madem gözden iki bileziği çıkaracak bütçeniz var, o sermayeyi büyücülere kaptırıp haram yollara sapacağınıza, önce gelip o miktarı bizzat gelininize teklif edin.

Önüme o iki bileziği koyup "Al bunları, oğlumun yakasını bırak" deseniz valizi saniyesinde toplar, arkama bile bakmadan giderim. Boşuna aracıya komisyon ödemeyin.

Çünkü o el üstünde tuttuğunuz oğullarınız, inanın serbest piyasada o düşündüğünüz maliyet kadar etmiyor. İki bilezik o herifin değerinin çok üzerinde bir teklif, gelinleriniz bu fırsatı asla kaçırmaz.'
    ),
    (
      'FişiÇekenKuzen',
      28,
      'male',
      'ankara',
      null::varchar,
      'Kuzenime görücü usulü kız istemeye gitmiştik. Ev jilet gibi temiz, ilk tanışma ortamı olduğu için de salonda herkes aşırı resmi ve gergin bir havada oturuyor.

Kızın annesi başladı anlatmaya, "Kızımız çok hanım hanımcıktır" diyor. Babası oradan giriyor "Çok terbiyelidir maşallah", teyzesi eksik kalmıyor "Bir de çok hassastır bizim kız" diye sırayla övüyorlar.

Bizim kuzen de kibarca sohbete katılacak sandık, çocuk kahvesinden bir yudum alıp bir anda, "Evet evet hassastır, bacağına dokununca huylanıyor zaten" deyiverdi. O an salonda zaman durdu, komple buz kestik. Ben şoktan elimdeki çayı tabağa fırlattım.

Kızın babası o ölümcül sessizlikte yavaşça kuzene dönüp, "Sen bunu nereden biliyorsun evladım?" diye sordu. Kız utançtan kıpkırmızı olmuş yerine çökmüşken bizimki durumu toparlayacağını sanıp daha beter battı: "Yani şey... Tahmin ettim..." Bazı insanlar heyecanlanınca gerçekten kendi fişini kendi eliyle çekiyor.'
    )
) as v(username, age, gender, yasadigi_yer, yurtdisi_sehir, hikaye)
where not exists (
  select 1 from public.itiraflar i
  where i.username = v.username
    and i.content_full = v.hikaye
    and i.silindi_at is null
);
