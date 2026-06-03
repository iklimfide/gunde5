-- 14 planlı hikaye — gunde5-2026-06-09-11.txt — 2026-06-09 … 2026-06-11 (dosya TARİH / 07:00–07:04)
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
      'Romantizm Katili',
      27,
      'male',
      'eskisehir',
      null::varchar,
      'İlk Gece ve Çorap Rezaleti',
      'Kız arkadaşımla ilk kez benim evimde baş başa kalacağız.

Ortamı hazırladım.

Mumlar, hafif bir müzik, her şey harika gidiyor.

Yatak odasına geçtik, ceketleri çıkardık, tam birbirimize odaklanmışken ayakkabılarımı ayağımdan fırlattım.

O an odadaki bütün büyü bozuldu.

Çorabımın baş parmak kısmı tamamen yırtıkmış ve parmağım dışarı fırlamış.

Yetmezmiş gibi çorabın üzerinde kocaman bir "SüngerBob" resmi var.

Kız arkadaşım romantik bir bakış atmaya çalışırken bir anda çorabıma bakıp kahkahayı bastı.

O gece şehvet değil, animasyon karakterleri konuşuldu.

Bir daha asla pazardan çorap almam. 😂',
      timestamptz '2026-06-09 07:04:00+03'
    ),
    (
      'Sesim Geliyor mu',
      33,
      'female',
      'istanbul_avrupa',
      null::varchar,
      'Toplantıda Kalan Mikrofon',
      'Evden çalışıyorum, şirketin çok önemli bir bölge toplantısı var.

Kamerayı kapattım ama kulaklık kulağımda.

Müdür konuşurken canım sıkıldı, mutfağa gidip kendime kahve yapayım dedim.

O sırada evdeki kedim tezgahtaki bardağı aşağı fırlattı.

Ben de gayriihtiyari avazım çıktığı kadar bağırdım:

"Lan pislik hayvan, sıçtın her yerin içine!"

Kulaklığın mikrofonunu sessize almayı unutmuşum.

Müdür bir an durdu:

"Esra Hanım, stratejik planımız için biraz ağır bir yorum olmadı mı?"

dedi.

Şu an kedimle beraber yeni iş ilanlarına bakıyoruz. 😂',
      timestamptz '2026-06-09 07:03:00+03'
    ),
    (
      'Yağ Lekesi',
      41,
      'male',
      'adana',
      null::varchar,
      'Sanayi Sitesi Esnafı',
      'Arabanın motorundan garip bir ses geliyordu, sanayiye götürdüm.

Usta kaputu açtı, elini motorun üstüne koyup gözlerini kapattı.

Sanki arabayla ruhani bir bağ kuruyordu.

Sonra bana döndü:

"Abi bunun ciğeri solmuş, bırak kurcalayalım."

dedi.

"Fiyat ne olur usta?"

dedim.

"Bizde yanlış olmaz abi, hallederiz."

dedi.

Akşam arabayı almaya gittiğimde gelen hesapla arabanın piyasa değeri neredeyse kafa kafayaydı.

Meğer yanlış bana değil, ustanın matematik hesabındaymış. 😂',
      timestamptz '2026-06-09 07:02:00+03'
    ),
    (
      'Çay Tiryakisi',
      25,
      'female',
      'izmir',
      null::varchar,
      'Filtre Kahve Kültürü',
      'Yeni başladığım iş yerinde herkes çok havalı.

Sabahları herkes elinde "Columbia bilmem ne çekirdeği" filtre kahvelerle geziyor.

Gruptan geri kalmamak için ben de bir tane aldım.

Mutfakta kahve demlenirken yanıma şirketin kıdemli müdürü geldi.

"Nasıl, aroması sert değil mi?"

diye sordu.

Ben de cool görünmek için:

"Evet, gövdesi çok yüksek, arkadan gelen fındık notaları harika."

dedim.

Müdür bardağıma baktı:

"Yalnız o içtiğin kahve değil, dünden kalan bitki çayı."

dedi.

Gurmelik kariyerim başlamadan bitti. 😂',
      timestamptz '2026-06-09 07:01:00+03'
    ),
    (
      'Kas Kasılma',
      29,
      'female',
      'ankara',
      null::varchar,
      'Spor Salonu Aynası',
      'Gaza gelip yıllık spor salonu üyeliği yaptırdım.

İlk gün taytımı giydim, saçımı topladım, aynanın karşısına geçtim.

Yanımdaki kadın 15 kiloluk dambıllarla squat yapıyor, bana bakıp gülümsedi.

Ben de geri kalmamak için en hafif ağırlığı aldım.

Tam kaldırırken ağırlık elimden kaydı ve direkt ayağımın baş parmağına düştü.

Acıdan bağıramadım bile, sadece solungaçları açılmış balık gibi havayı soludum.

Salondaki ilk günümde spor değil, acıyı sessizce yaşama antrenmanı yaptım. 😂',
      timestamptz '2026-06-09 07:00:00+03'
    ),
    (
      'Titreşim Kurbanı',
      35,
      'female',
      'bursa',
      null::varchar,
      'Sessiz Mod Faciasi',
      'Eşimle yatakta biraz ateşli ve gürültülü anlar yaşıyoruz.

Telefonumu da ne olur ne olmaz diye yatağın kenarındaki komodinin üstüne koymuştum, sessizdeydi.

Tam konsantrasyon zirvedeyken telefonun ekranı sürekli yanıp sönmeye başladı.

Gözümün ucuyla baktım: "Annem Arıyor."

Açmadım tabii ki, bıraktım.

İki dakika sonra tekrar yandı: "Babam Arıyor."

Bir şey oldu sandım, panikle telefonu açtım:

"Kızım iyi misiniz, görüntülü arama tuşuna basmışsın yanındaki adam kim?!"

Meğer ceketimi çıkarırken yanlışlıkla aile grubuna görüntülü arama başlatmışım.

O günden beri yatak odasına telefon sokmuyorum. 😂',
      timestamptz '2026-06-10 07:04:00+03'
    ),
    (
      'Yanlar Kalsın',
      31,
      'male',
      'kocaeli',
      null::varchar,
      'Berber Koltuğu Korkusu',
      'Yıllardır gittiğim berberim askere gidince mahalledeki yeni berbere girmek zorunda kaldım.

Koltuğa oturdum, adama kibarca:

"Usta sadece yanlardan hafif al, üstler kalsın."

dedi.

Adam kafasını salladı, arkasını döndü ve eline direkt sıfır numara tıraş makinesini aldı.

O an müdahale etmem gerekiyordu.

Ama berber koltuğunun getirdiği o garip teslimiyet duygusu yüzünden sesimi çıkaramadım.

"Herhalde bir bildiği var" diye izledim.

Sonuç?

Şu an kafam askere giden eski berberimden daha kısa. 😂',
      timestamptz '2026-06-10 07:03:00+03'
    ),
    (
      'Teknoloji Kölesi',
      38,
      'male',
      'antalya',
      null::varchar,
      'Akıllı Ev Sistemi',
      'Eve her şeyi sesle kontrol edebilen akıllı sistem kurdurdum.

"Işıkları kapat", "Klimayı aç" diyorum, tık diye yapıyor. Kendimi sarayda gibi hissediyorum.

Dün akşam eve yorgun geldim, koltuğa uzandım.

"Lambaları söndür" dedim.

Sistem: "Anlaşılamadı" dedi.

Bir daha söyledim, yine anlamadı. En son sinirlenip bağırdım.

Duvara monte edilen sistem bir anda evdeki yangın alarmlarını ve fıskiyeleri çalıştırdı.

Salonda sırılsıklam otururken düşündüm.

Eskiden kalkıp düğmeye basmak zor geliyordu, şimdi evde şemsiyeyle oturuyorum. 😂',
      timestamptz '2026-06-10 07:02:00+03'
    ),
    (
      'Ördek Adımı',
      24,
      'female',
      'trabzon',
      null::varchar,
      'Topuklu Ayakkabı Yürüyüşü',
      'Arkadaşımın düğünü için hayatımda ilk kez 12 santimlik topuklu ayakkabı aldım.

Evde aynanın karşısında yürürken her şey mükemmeldi, kendimi podyumda sandım.

Düğün salonunun kapısından içeri girdim. Zemin tamamen mermer ve kaygandı.

İlk adımımı atmamla birlikte dizlerim içe doğru büküldü.

Masaya ulaşana kadar geçen o 10 metre, hayatımın en uzun yolculuğuydu.

Herkes bana bakarken ben robot dansı yapan bir ördek gibi ilerliyordum.

Düğünün geri kalanını masanın altında babetlerimi giyerek geçirdim. 😂',
      timestamptz '2026-06-10 07:01:00+03'
    ),
    (
      'Yeşil Nokta',
      43,
      'female',
      'yurtdisi',
      'Köln',
      'Annemin WhatsApp Durumları',
      'Annem akıllı telefon kullanmayı iyice öğrendi ama WhatsApp durum özelliğini yanlış anladı.

Hafta sonu kızımla parka gittik, bana bir fotoğraf attı.

Ben de durumuna koysun diye ona güzel bir manzara fotoğrafı gönderdim.

Akşam bir baktım, durum kısmına benim ona yazdığım:

"Anne çorbanın altını kapatmayı unutma, ev yanacak"

mesajının ekran görüntüsünü koymuş.

Üstüne de gül emojisi eklemiş.

Almanya''daki bütün akrabalar beni arayıp evde yangın mı çıktı diye soruyor. 😂',
      timestamptz '2026-06-10 07:00:00+03'
    ),
    (
      'Gizli Bahçe',
      36,
      'male',
      'samsun',
      null::varchar,
      'Yanlış Cepten Çıkanlar',
      'Eşimle sinemaya gittik, karanlıkta elimi onun montunun cebine atıp elini tutmak istedim.

Cebin içinde garip, lateks bir doku hissettim.

"Herhalde balon falan aldı çocuklara" diye düşünerek dışarı çıkardım.

Meğer o mont eşimin değil, yan koltukta oturan tanımadığımız bir kadının montuymuş.

Ve elimdeki şey de kadının çantasından düşüp cebine giren prezervatif paketinden başka bir şey değilmiş.

Kadın bana baktı, ben kadına baktım, eşim ikimize baktı.

"Vallahi sinema bileti arıyordum" dedim ama filmin kalanını koridorda izlemek zorunda kaldım. 😂',
      timestamptz '2026-06-11 07:03:00+03'
    ),
    (
      'Yolun Sonu',
      29,
      'female',
      'mugla',
      null::varchar,
      'Navigasyon Güveni',
      'Arabayla bilmediğim bir adrese gidiyorum, navigasyon sesine teslim oldum.

Kadın "200 metre sonra sağa dönün" diyor, dönüyorum.

En son "Rotadan çıkıldı" uyarısı verdi ama yol düzgün görünüyor diye devam ettim.

Birkaç dakika sonra yol bitti, kendimi bir köyün inek otlatma alanında buldum.

Arabanın etrafını 10 tane inek sardı.

Navigasyon hala arkadan sakin bir sesle:

"Mümkünse U dönüşü yapın"

diyor.

Etrafım ineklerle çevrilmiş, daracık tarlada U dönüşü yapmaya çalışırken teknolojinin sınırlarını anladım. 😂',
      timestamptz '2026-06-11 07:02:00+03'
    ),
    (
      'Plaza Kölesi',
      32,
      'male',
      'istanbul_avrupa',
      null::varchar,
      'Kurumsal Dil Çevirisi',
      'Plazada çalışmaya başlayınca yeni bir dil öğrendim.

E-postada birine "Bilginize sunarım" yazıyorsan bunun Türkçe meali:

"Sana bin kere anlattım, hala anlamadın, al bak da öğren." demekmiş.

Dün sinirle genel müdüre "Konuyu deşmek istemiyorum ama bilginize sunarım" yazdım.

Adam beni odasına çağırdı.

"Kaan Bey, mailinizdeki o kibar tehdidi aldım" dedi.

Plaza dili göründüğü kadar masum değilmiş, resmen diplomatik kriz çıkarıyordum. 😂',
      timestamptz '2026-06-11 07:01:00+03'
    ),
    (
      'Yanlış Tabak',
      26,
      'female',
      'mersin',
      null::varchar,
      'Kedi Maması Gurmesi',
      'Gece çok acıktım, mutfakta ışığı açmadan tezgahtaki cips kasesinden bir şeyler atıştırayım dedim.

Karanlıkta ağzıma bir tane attım, biraz sertti ama kurutulmuş et aroması çok yoğundu.

"Vay be, ne güzel cips yapmışlar" diye iki üç tane daha yedim.

Işığı bir açtım ki, yediklerim cips değil, kedim Çiko''nun somonlu ödül mamasıymış.

Çiko da tezgahın köşesinden bana "Benim rızkımı niye yiyorsun" der gibi bakıyordu.

Tadı fena değildi ama insan gururlanıyor işte. 😂',
      timestamptz '2026-06-11 07:00:00+03'
    )
) as v(username, age, gender, yasadigi_yer, yurtdisi_sehir, baslik, hikaye, yayin_at)
where not exists (
  select 1
  from public.itiraflar i
  where i.baslik = v.baslik
    and i.created_at = v.yayin_at
    and i.silindi_at is null
);
