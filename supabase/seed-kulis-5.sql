-- gunde5.com — Kulis seed (5 hikaye)
-- Bot/seed içerik: user_id NULL (anon). UI'da ekstra rozet yok.
-- Not: content_short <= 140.

insert into public.hikayeler (
  user_id,
  username,
  age,
  gender,
  yasadigi_yer,
  content_short,
  content_full,
  status,
  is_gizli
) values
(
  null,
  'LazerMağduru',
  26,
  'female',
  'istanbul_avrupa',
  'Flörtümle akşam ilk defa baş başa yemeğe çıkacağız diye öğlen acil randevuyla kuaförde tüm vücut lazere girdim...',
  'Flörtümle akşam ilk defa baş başa yemeğe çıkacağız diye gaza gelip öğlen acil randevuyla kuaförde tüm vücut lazere girdim. Seanstan sonra bacaklarım ve hassas bölgelerim kıpkırmızı, cayır cayır yanıyor. Akşam çocuk beni arabayla aldı, lüks bir restorana geçtik ama sandalyeye her oturduğumda acıdan gözümden yaş geliyor. En son çocuk elimi tutup "Gözlerin neden nemli, benden etkilendin mi?" diye sordu. Ben de bozuntuya vermemek için "Evet, senin yanındayken içim alev alev yanıyor" dedim. Çocuk kendini aşk doktoru sanıyor ama alt taraf bildiğin Adana dürüm gibi közlenmişti.',
  'kulis',
  false
),
(
  null,
  'BagajMağduru',
  27,
  'female',
  'izmir',
  'Yeni tanıştığım aşırı zengin çocuk beni ilk randevumuzda şehirden uzak lüks bir restorana götürdü; dönüşte araba arıza yaptı...',
  'Yeni tanıştığım o aşırı zengin, altındaki spor arabayla vizyon kasan çocuk beni ilk randevumuzda şehirden uzak lüks bir restorana götürdü. Dönüşte otobanda araba arıza yaptı, bu kaputu açıp anlamayan gözlerle bakarken ben "Bagajda üçgen reflektör var mı?" diye arkaya yürüdüm. Bagajı bir açtım, içeride çocuğun annesinin memleketten yolladığı çuvalla tarhana ve plastik bidonla turşu duruyor. O günden beri lüks mekan hikayesi attığında altına "Tarhana çorbası fiyakayı bozar" yazıyorum.',
  'kulis',
  false
),
(
  null,
  'ProtezKrizi',
  24,
  'female',
  'ankara',
  'Düğün var diye kuaförde takma kirpik, porselen makyaj ve upuzun protez tırnak yaptırdım; tuvalette fermuarı indiremedim...',
  'Görümcemin düğünü var diye kuaförde takma kirpik, porselen makyaj ve o upuzun protez tırnaklardan yaptırdım, resmen afet oldum. Düğün salonunda tam takıları takacağız, acayip sıkıştım, tuvalete koştum. O upuzun tırnaklar yüzünden abiye elbisenin arkadaki gizli fermuarını bir türlü indiremedim. En son çare yan kabindeki hiç tanımadığım kadına "Abla kurban olayım arkadan bir el at" diye yalvarmak zorunda kaldım. Kadın fermuarı indirdi ama "Kızım alt tarafa kilit vurmuşsun resmen" diye dalga geçti.',
  'kulis',
  false
),
(
  null,
  'SinyalYok',
  29,
  'male',
  'bursa',
  'Genel müdürle kritik Teams toplantısındayız; peder elinde penseyle odaya dalıp internet kablosunu “mor masaj aleti”ne bağladın mı dedi...',
  'Şirketin o acayip kasıntı, her şeye sinirlenen genel müdürüyle Teams üzerinden çok kritik bir online toplantıdayız. Tam müdür hararetli bir sunum yaparken bizim peder odaya elinde kargaburun penseyle daldı, "Oğlum internetin kablosunu sanayideki mor masaj aletine mi bağladın, aşağıda çekmiyor!" diye bağırdı. Kamerayı kapatmaya vaktim kalmadı, genel müdür sunumu durdurup "Arif, pederin masaj aleti bizim çeyrek raporundan daha önemli galiba" dedi. Şirketteki adım ''Mor Sinyal'' kaldı.',
  'kulis',
  false
),
(
  null,
  'ValeMağduru',
  32,
  'male',
  'antalya',
  'Lüks mekana havalı giriş yaparken vale geri vitese taktı; arabanın kronik kornası “Daaat” diye takılı kaldı, bütün caddeyi inletti...',
  'Yeni aldığım, ikinci el ama jilet gibi duran arabamla Ankara''nın en lüks mekanlarından birinin önüne yanaştım. Valeye anahtarı uzatırken havamdan geçilmiyor, mekandaki kızlar falan bana bakıyor. Ben tam kapıdan içeri adım atacakken vale arabayı geri vitese taktı ve arabanın o kronik arızalı kornası "Daaat" diye takılı kaldı. Çocuk otoparka gidene kadar araba bütün caddeyi düğün konvoyu gibi inletti, kapıdaki kızlar arkamdan kahkahayı bastı. Karizma sıfırlandı.',
  'kulis',
  false
);

