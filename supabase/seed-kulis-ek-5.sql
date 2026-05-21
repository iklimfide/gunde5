-- Kulis seed (5 hikaye): KanlıDudak, CentilmenZede, StajyerDoktor, KavgacıReis, CodcuGamer
-- Bot/seed: user_id NULL. content_short <= 140.
-- Supabase SQL Editor'da bir kez çalıştır.

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
) values
(
  null,
  'KanlıDudak',
  25,
  'male',
  'adana',
  'Twitter''da "Türkler öpüşürken neden ısırıyor" postunu gösterdim. Adana baraj kenarında iddia patladı; dudağım patladı, acile...',
  'Twitter''da "Türkler öpüşürken neden ısırıyor, çünkü yeterince et yiyemiyoruz" postunu görüp kız arkadaşıma gösterdim. "Harbiden doğru mu lan bu?" diye makarasına girdiğimiz iddia, Adana baraj kenarında arabada takılırken patladı. Kız iddiayı kanıtlamak için beni öyle bir hırsla ısırdı ki, alt dudağım patladı, tişört leş gibi kan oldu. Gecenin bir yarısı hastane acilinde bulduk kendimizi. Doktor dudağıma dikiş atarken, kız arkada hala "Gördün mü bak, et yemeyen Adanalı herif, asıl Türk benim" diye vizyon yarıştırıyordu.',
  'kulis',
  false
),
(
  null,
  'CentilmenZede',
  23,
  'male',
  'eskisehir',
  'Üniversite ev partisinde sarhoş kıza dokunmadım; centilmenlik sandım. Ertesi gün "pas vermedi, kesin top" diye adımı çıkardı...',
  'Üniversitede ev partisinde bir kızla tam yakınlaştık ama kız acayip sarhoş. Sırf "alkollü, sağlıklı karar veremez, centilmenlik bende kalsın" diye kibarca geri çekildim, kıza dokunmadım bile. Ertesi gün kız ayılınca dürüstlüğüme teşekkür edeceğine, sağda solda "Bana pas vermedi, kesin top" diye adımı çıkardı. O günden beri kulaklarıma küpedir; bu hayatta iyiniyet adamı top yapar, net top yapar.',
  'kulis',
  false
),
(
  null,
  'StajyerDoktor',
  26,
  'male',
  'izmir',
  'Acilde "Allah''ın izniyle iyi olacak" deyince anne "şeyhe getirirdim" diye bağırdı. Bahçede çim yoluyorum, meslekten soğudum.',
  'Acilde nöbetteyim, yüksek ateşle çırpınan bir çocuğu getirdiler. Annesi panikten ağlıyor, kadını biraz olsun yatıştırmak için o mesleki şefkatle "Sakin olun hanımefendi, Allah''ın izniyle çocuğunuz gayet iyi olacak" dedim. Kadın gözlerini belertti, bana döndü ve "Dualarla iş yürüyecek olsa size değil şeyhe getirirdim, hadi kendi işinizi yapın!" diye kükredi. Şu an hastane bahçesinde çimleri yoluyorum, meslekten soğudum.',
  'kulis',
  false
),
(
  null,
  'KavgacıReis',
  28,
  'male',
  'ankara',
  'Küflü peynir için Migros''ta kavga provası yaptım; özür deyip yenisini verdiler. Kavga kalmadı, peyniri alıp kıl bir şekilde çıktım.',
  'Migros''tan aldığım peynir küflü çıktı. Sabahtan beri "Gideceğim, ortalığı birbirine katacağım, tüketici hakları diyeceğim, o müdürü buraya getirteceğim" diye kuruyor, edeceğim kavganın provasını yapıyorum. Adrenalin tavan dükkana girdim, peyniri masaya koydum. Adamlar peynire baktı, "Çok özür dileriz beyefendi, kusura bakmayın" deyip saniyesinde yenisini verdiler. Kavga falan kalmadı, hiçbir şey yapamadan peyniri alıp çıktım, inanılmaz kıl oldum şu an.',
  'kulis',
  false
),
(
  null,
  'CodcuGamer',
  25,
  'male',
  'bursa',
  'CoD2 oynarken omza dürttüler, dönmeden küf ettim — babamdı. Kafede rencide etmedi; evde 3 gün okula gidemedim.',
  'Lisedeyken okulu ekip internet kafeye kaçtım, kulaklığı takmışım son ses efsane huzurlu şekilde CoD2 oynuyorum. Arkamdan biri omzumu dürttü. Bizim arkadaştır diye hırsla kulaklığı çıkardım, arkama bile dönmeden "Elin ayağın rahat dursun orospu çocuğu" diye bağırdım. Kafayı bir çevirdim, babam dikilmiş bana bakıyor. Adam beni orada, milletin içinde hiç rencide etmedi. Ama eve bir geçtik; ağzıma öyle bir sıçtı ki acıdan 3 gün okula gidemedim.',
  'kulis',
  false
);
