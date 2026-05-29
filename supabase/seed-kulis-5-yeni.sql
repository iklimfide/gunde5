-- Kulis seed (5 hikaye) — KULİSE EKLENDİ, TEKRAR ÇALIŞTIRMAYIN (çift kayıt olur).
-- Yeni bot hikayeleri için: supabase/seed-kulis-sablon.sql

insert into public.hikayeler (
  user_id,
  username,
  age,
  gender,
  yasadigi_yer,
  yurtdisi_sehir,
  content_full,
  status,
  is_gizli
) values
(
  null,
  'CerrahMağduru',
  26,
  'male',
  'ankara',
  null,
  'Babam açık göğüs ameliyatı olacaktı, ameliyattan hemen önce doktor son kontroller için odasına çağırdı. Babam o sedye üstündeki gerginliği bozmak için "Hocam hazır göğsü açmışken şu ciğerleri de bi yıkayıverin, sigaradan simsiyah olmuştur" diye aklınca trollemek istedi. Bizim uzman doktor da espriyi öyle bir ciddiye aldı ki, tıbbi terimlerle tam 2 saat boyunca açık ameliyatta ciğer yıkamanın neden imkansız olduğunu, anatomik olarak bunu yapamayacaklarını anlattı. Doktor o aşırı iyi niyetiyle konuşurken babamın gözlerindeki fer söndü. Odadan çıktığımızda babam bana döndü, "İnşallah ameliyatı bu herif yapmaz, düz mantık adam neşteri içeride unutur" dedi.',
  'kulis',
  false
),
(
  null,
  'İstememeKrizi',
  24,
  'female',
  'sivas',
  null,
  'Kuzenime kız istemeye gittik, kız tarafı Alevi bir aileydi. Ev jilet gibi temiz, herkes aşırı kibar ve mesafeli oturuyor. Bizim halanın o meşhur, dünyadan bihaber kayınvalidesi de baş köşede oturuyor. Kadın etrafa bakınırken salondaki duvarda asılı duran büyük Hz. Ali fotoğrafını gördü. Herkesin sustuğu o ölümcül kahve ikramı saniyesinde, kızın annesine dönüp saf saf "Bu kim, beyin mi?" diye sordu. Salona öyle bir buz kütlesi çöktü ki, halam o utançla çay bardağını tabağına düşürdü. Toparlayana kadar canımız çıktı.',
  'kulis',
  false
),
(
  null,
  'MüfettişBey',
  30,
  'male',
  'ankara',
  null,
  'Bankanın Kahramanmaraş şubesinde teftişteyim. Emekli maaşını ATM''den çekmeye çalışan bir amca, makine kartı kabul etmeyince şubeyi birbirine kattı, güvenliğe falan bağırıyor. Gürültüyü duyunca amcayı sakinleştirmek için odama çağırıp çay söyledim. "Oğlum ne yaptıysam bu mendebur makineye kartı sokamadım" dedi. Kartı uzattı, bir baktım kart jilet gibi PVC kaplı! Meğer amcaya kartı ilk teslim ederken "Bunu iyi sakla, hep bununla maaş alacaksın" demişler. Amcam da karta bir şey olmasın diye nüfus cüzdanı gibi götürüp PVC kaplatmış, korumaya almış. Çayı püskürtmemek için odayı terk ettim.',
  'kulis',
  false
),
(
  null,
  'GurbetçiGarson',
  29,
  'male',
  'yurtdisi',
  'Amerika',
  'Amerika''da teyzemlerin Türk restoranında çalışıyorum. Mutfakla garsonlar arasındaki o koşturmacada, Amerikalı müşteriler Türkçe bilmediği için bizim çocuklar servis elemanları arasında bağıra çağıra tam bir kahvehane jargonuyla konuşuyor. Bir gün içeride servis dönerken bizim çocukların bağırışları aynen şöyleydi: "Bu medium pizzayı o kel kafalıya ver", "Şu kalzonu köşedeki yaşlı garının masasına fırlat." Bir gün de iki gay müşteri geldi, arkadan aşçı bağırdı: "İbnelerin salatalarını götürdün mü?" Amerikalılar da o sırada bize bakıp "Ne kadar samimi bir dil" diye gülümsüyor.',
  'kulis',
  false
),
(
  null,
  'Sır Küpü',
  27,
  'female',
  'izmir',
  null,
  'Call center''da kulaklığı takmışım, evden müşterilerle telefon üzerinden konuşuyorum. Geçen gün tesadüfen odadaki aynada kendimi izlerken fark ettim. Ne zaman müşteriye "Şimdi güvenlik adımları için anne kızlık soyadınızın iki harfini alacağım" desem, bilgisayar ekranına bakarak karşıdaki adama resmen göz kırpıyorum. Sanki telefondaki müşteri beni görüyormuş ve aramızda çok gizli bir operasyon çeviriyormuşuz gibi bir de kaşlarımı falan kaldırıyorum. Bunu günde yüz kere yaptığımdan beri kendime olan saygımı kaybettim.',
  'kulis',
  false
);
