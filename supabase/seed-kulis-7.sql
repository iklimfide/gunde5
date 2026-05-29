-- gunde5.com — Kulis seed (7 hikaye)
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
  'SahneTozu',
  29,
  'female',
  'istanbul_avrupa',
  'Kurumsal galada arkası açık elbise giydim; yönetim kurulu başkanı konuşurken elbisedeki kopça patladı, yengeç gibi tuvalete kaçtım...',
  'Kurumsal şirketin o aşırı ciddiyet kasan yıl sonu galasındayız. Herkes smokinli, abiyeli, jilet gibi. Ben de gaza gelip hayatımda ilk kez o arkası tamamen açık, derin sırt dekolteli tasarım bir elbise giydim. Gecenin ilerleyen saatlerinde, tam yönetim kurulu başkanı sahneye çıkmış konuşma yaparken, benim elbisenin arkasındaki o tek tutan kopça pat diye koptu. Elbise önüme doğru çuval gibi düşmesin diye iki elimle göğsüme bastırıp, sahnede konuşan adama doğru baka baka, yengeç gibi yan yan tuvalete doğru kaçtım. CEO beni o halde görüp "Performansınız çok dinamikti" diye mail attı.',
  'kulis',
  false
),
(
  null,
  'DetoksKurbanı',
  27,
  'female',
  'izmir',
  'Detoks kürünü bir litre içtim; erkek arkadaşımın ailesiyle tanışma yemeğinde masada evlilik konuşulurken alt taraf çernobil patladı...',
  'Sosyal medyadaki o zayıflama gurularına uyup evde kendime ''kereviz sapı ve zencefilli'' acayip bir detoks kürü hazırladım. Tadı berbattı ama şifa niyetine bir dikişte bir litre içtim. Yarım saat sonra erkek arkadaşımın ailesiyle ilk defa tanışmak üzere lüks bir balık restoranında masaya oturduk. Masada tam o ''evlilik ne zaman'' muhabbeti döndüğü an, içerideki o detoks kürü nükleer reaksiyona geçti. Lavaboya gitmek için ayağa kalktığımda bacaklarım titriyordu. Müstakbel kayınvalidemin elini sıkarken gözlerimden yaş geldi, kadın beni heyecandan ağlıyor sandı ama alt tarafta çernobil patlıyordu.',
  'kulis',
  false
),
(
  null,
  'MirasKrizi',
  31,
  'female',
  'kocaeli',
  'Zeytinlik miras toplantısında odadan salona Bluetooth ile bağlı tabletimden yetişkin film sesi patladı, dayım tapuyu bırakıp bağırdı...',
  'Bizim sülale tam bir Akdeniz köylüsü, herkes birbirinin arkasından iş çevirir. Geçen hafta büyük dededen kalan o eski zeytinliğin paylaşımı için tüm amcalar, dayılar bizim salonda toplandı. Ortam gergin, herkes birbirine hırsız muamelesi yapıyor. Tam o sırada benim odada açık kalan ve Bluetooth ile salondaki dev ses sistemine bağlı olan tabletimden, dün gece izlediğim o aşırı hararetli yetişkin filminin sesi şak diye salonda patladı. Ev inliyor resmen. Dayım elindeki tapuyu bırakıp "İşte aradığım adalet!" diye bağırdı, utançtan zeytinliği üstüme yapasım geldi.',
  'kulis',
  false
),
(
  null,
  'SınırÖtesi',
  24,
  'female',
  'edirne',
  'Edirne sınırında tarlada çişe gittim; Yunan karakolunun dronu tam tepemde durup kayda aldı, kaçarken asker selamı çaktım...',
  'Edirne''de sınıra yakın bir köyde tarım arazisinde staj yapıyorum. Öğlen sıcağında tarlanın ortasında çalışırken acayip çişim geldi. Dedim kim görecek, o sınır hattındaki devasa beton bariyerlerin arkasına geçip rahatça çömeldim. Tam o sırada yukarıdan bir ''pır pır'' sesi geldi. Kafamı bir kaldırdım, Yunanistan sınır karakolunun askeri gözetleme dronu tam tepemde sabit durmuş, kamerayı bana doğru netliyor. Adamlar resmen uluslararası kriz sebebi gibi beni izledi. Donu toplayıp kaçarken sınıra doğru uygun adım asker selamı çaktım.',
  'kulis',
  false
),
(
  null,
  'BetonDamat',
  30,
  'male',
  'ankara',
  'Kalça alçısıyla baldız nişanında halay çekiyordum; alçı pantolonu yırttı, mor boxerla kalçam tüm akrabaların önünde sahneye fırladı...',
  'Halı saha maçında kalecinin üzerine uçup kalçamı fena çatlatmıştım, doktor kalçadan bele kadar komple alçıya aldı. Ertesi hafta da şansıma baldızın nişanı var ve benim o alçı yüzünden düzgün pantolon giyme şansım yok. Eşofmanla gidemezsin dediler, pederin eski, o bol döküm şalvarımsı kumaş pantolonunun tek bacağını kesip alçının üstüne geçirdik. Nişanda tam pistte halay çekilirken, alçının o sert köşesi pantolonu içeriden yırttı ve o bembeyaz alçılı kalçam, üstündeki mor boxerla beraber tüm akrabaların önünde sahneye fırladı. Kayınpeder "Damat arkaya sağlam beton dökmüş" diye dalga geçiyor.',
  'kulis',
  false
),
(
  null,
  'SanayiGülü',
  34,
  'male',
  'bursa',
  'Torna dükkanında balata sökerken kurumsal abi nutuk atıyordu; hidrolik borusu patlayıp jilet takım elbisesini simsiyah yağa boyadı...',
  'Sanayideki torna dükkanında usta kalfa takılıyoruz. Bizim dükkana o her şeyi çok bilen, sürekli ''vizyon, misyon'' diye kafa açan kurumsal bir abi cipini getirdi. Balatalardan ses geliyor dedi. Bizim çırakla bunu lifte kaldırdık, ben arabanın altına yatıp balatayı sökerken bu abi yukarıdan "Arif usta, işçilikteki sinerjiyi kaybetmeyelim" diye nutuk atıyor. Tam o esnada hidrolik borusu bir patladı, abinin o jilet gibi pahalı takım elbisesinin tam ön tarafına simsiyah şanzıman yağı ''şırıl şırıl'' fışkırdı. Adamın vizyonu kapkara oldu, bizim çırak da arkadan "Ustam sinerji fena patladı" diye fısıldıyor.',
  'kulis',
  false
),
(
  null,
  'JetLag',
  28,
  'male',
  'antalya',
  'Otel goril kostümüyle animasyon şovunda kuliste uyuya kalmışım; gece 03''te lobby''de polis çağırdılar...',
  'Antalya''da lüks bir otelde profesyonel animatörüm. Akşam havuz başındaki o büyük şovda dev bir goril kostümü giyip sahneye fırlamam, milleti kışkırtmam gerekiyor. Kostümün içi bildiğin fırın, nefes alınmıyor. Sahne arkasında sıramı beklerken o yorgunlukla kulisteki koltukta sızıp kalmışım. Ben içerde uyurken şov bitmiş, ışıklar sönmüş, otel sessizliğe bürünmüş. Gece yarısı 03:00''te uyanıp o dev goril kostümüyle, kafamda maskeyle lobby''e daldım. Resepsiyondaki çocuk beni görünce ''Ayııı!'' diye bağırıp tezgahın altına atladı, polis çağırdılar.',
  'kulis',
  false
);
