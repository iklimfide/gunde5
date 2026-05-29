-- gunde5.com — 5 yeni hikaye (index + kulis)
-- Canlı şema: public.itiraflar
-- content_short: DB sütunu varchar(140) — kart/liste önizlemesi; tam metin content_full.
-- Supabase SQL Editor'da bir kez Run. Tekrar çalıştırmayın.

insert into public.itiraflar (
  user_id,
  username,
  age,
  gender,
  yasadigi_yer,
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
      'KaktüsAvcısı',
      29,
      'male',
      'istanbul_avrupa',
      'Şirketteki ilk ayımdı, genel müdürün odasına imza için girdim. Adam çok havalı, masasında devasa bir kaktüs var. Heyecandan evrakları uzatırken dosya klasörü elimden kaydı, küt diye kaktüsün üstüne devrildi. Adam şok oldu, ben panikle kaktüsü çıplak elle havada yakalamaya çalıştım! Avcumun içi resmen iğne yastığına döndü. Acıdan çığlık atmamak için dişlerimi sıkıyorum, gözümden yaşlar boşanıyor. Genel müdür ayağa kalktı, "Oğlum ne yapıyorsun, manyak mısın?" diye bağırıyor. Adam imza atmayı unuttu, şirketin revirindeki hemşireyle birlikte cımbızla el imalatı iğne ayıkladık iki saat. Ertesi gün tüm plaza bana "Kaktüs Avcısı" demeye başladı. Kariyerim başlamadan bitti.'
    ),
    (
      'YanlışCc',
      31,
      'male',
      'ankara',
      'Bizim holdingde İK müdürüne feci gıcığım. WhatsApp''tan kankama "Bu kadın yine sabah sabah terör estiriyor, kesin evde kocasıyla kavga etti, hırsını bizden çıkarıyor" diye mesaj attım. Mavi tık oldu ama kankamdan ses yok. Meğer mesajı kankama değil, kadının bizzat kendisine, hem de "Maaş İyileştirmesi Talebi" mailinin hemen ardından WhatsApp''tan fırlatmışım! Yukarıda numarasını görünce beynimden aşağı kaynar sular döküldü. Mesajı herkesten silmeye çalıştım ama "Bu mesaj silindi" yazısı ibret vesikası gibi kaldı. Beş dakika sonra odasına çağırdı. İçeri girdim, kahvesinden bir yudum aldı, "Kocamla gayet mutluyuz, zam talebiniz de reddedilmiştir" dedi. O günden beri kadının önünde ceket ilikliyorum.'
    ),
    (
      'TuzluKahve',
      27,
      'male',
      'izmir',
      'Kız arkadaşımı istemeye gittik, babası eski usul, sert bir emniyet müdürü emeklisi. Hanım heyecanla kahveleri getirdi, bana o meşhur bol tuzlu ve isotlu kahveyi uzattı. Ben de o heyecanla kahveyi içeceğime, tepsiden alıp yanlışlıkla yanımda oturan kendi öz babama verdim. Babam ilk yudumu aldı, gözleri büyüdü, tükürmemek için resmen gırtlak kası yaptı, yüzü mosmor oldu. Kızın babası da ortam yumuşasın diye "Maşallah dünür, damat kahvesini bile tek dikişte içiyorsun" diyerek bizimkini gazladı. Babam bana öyle bir ters bakış attı ki, evlatlıktan reddedileceğimi anladım. Tören bitti, arabaya bindik, babamın bana ilk cümlesi şu oldu: "Oğlum, eğer o kızla evlenirsen benden sana tek kuruş miras düşmez, beni zehirlemeye çalıştınız." Neyse ki evlendik ama babam hâlâ hanımın elinden su bile içmiyor.'
    ),
    (
      'OnNumaraYağ',
      41,
      'male',
      'bursa',
      'Sanayide rot-balans dükkânım var. Geçen gün dükkâna altına sıfır çekmiş, hani şu sosyal medyada "Girişimcilik, mindset, başarı" videoları çeken tiplerden biri geldi. "Usta, arabadan bir ses geliyor ama sizin dillerden anlamam, entelektüel bir dille açıkla" dedi. Ben de çırağa döndüm, "Oğlum, arkadaşın seküler vibrasyonlarında bir optimizasyon problemi var, hemen amortisörün varoluşsal sancısını dindir" dedim. Çırak çırak değil ki, bizim Fiko. Anladı mevzuyu, aldı eline 19 numara anahtarı, "Usta, bu arabanın dingil felsefesi kaymış" dedi. Adama alt takımı komple indirdik, rot başlarını sıfırladık. Teslim ederken de "Aracınızın makroekonomik dengesi kurulmuştur" dedim. Adam feci etkilendi, sosyal medyasında "Sanayide gizli bir dahi buldum" diye video paylaşmış. Dükkânın önü şimdi o gruptan geçilmiyor.'
    ),
    (
      'BoşMetrobüs',
      24,
      'male',
      'istanbul_avrupa',
      'Üniversite vizesine geç kalmıştım, metrobüse kendimi nasıl attığımı bilmiyorum. İçerisi hınca hınç dolu, ben de kapının kenarındaki o demire sıkıca tutundum. Yanımda da yaşlı bir teyze var, dik dik bana bakıyor. Ben de "Gençlik işte, yer vermedi" diye kızıyor sandım. Meğer ben aceleyle metrobüs demiri yerine, teyzenin elindeki o kalın, tahta bastonun üst kısmını sımsıkı kavramışım! Teyze en son dayanamadı, "Evladım, metrobüsü ben sürmüyorum, bastonumu serbest bırakırsan sonraki durakta ineceğim" dedi. Bütün metrobüs bana bakıp gülmeye başladı. Utançtan sonraki durakta değil, metrobüsten inip Zincirlikuyu mezarlığına doğru koşasım geldi. Vizeyi de kaçırdım zaten.'
    )
) as v(username, age, gender, yasadigi_yer, hikaye);
