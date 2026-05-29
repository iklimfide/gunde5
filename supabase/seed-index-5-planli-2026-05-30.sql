-- 5 planlı hikaye — 30 Mayıs 2026, 09:00 (Europe/Istanbul)
-- Anasayfada created_at gelene kadar görünmez. Supabase SQL Editor'da bir kez Run.

insert into public.itiraflar (
  user_id,
  username,
  age,
  gender,
  yasadigi_yer,
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
  case
    when char_length(v.hikaye) <= 140 then v.hikaye
    else left(v.hikaye, 137) || '...'
  end,
  v.hikaye,
  'kulis',
  false,
  timestamptz '2026-05-30 09:00:00+03'
from (
  values
    (
      'TopukluTıkırtısı',
      28,
      'female',
      'istanbul_avrupa',
      'Plazada terfi aldığım ilk gündü, feci havalı bir topuklu ayakkabı giymiştim. Elime kahvemi alıp o kurumsal edayla koridorda yürürken, yeni aldığımız o aşırı parlak zemin cilası yüzünden ayağım bir kaydı, bacağımdaki o jilet gibi file çorap boydan boya yırtıldı. İşin kötüsü panikle havaya savurduğum o sıcak latte, tam o sırada asansörden çıkan yönetim kurulu başkanının o bembeyaz pahalı gömleğine isabet etti. Adam üstü başı kahve içinde şokta bana bakıyor, ben yırtık çorapla yerde oturmuş "Aslında çok profesyonel biriyimdir" diye ağlamaklı bir sesle kendimi savunmaya çalışıyorum. Terfi kutlamam holdingin revirinde buz torbasıyla bitti.'
    ),
    (
      'MutfakCadısı',
      33,
      'female',
      'izmir',
      'Kayınvalidem evime ilk defa yemeğe gelecekti, kadın tam bir gurme, her şeyi eleştirir. Ben de havam olsun diye internetten bakıp "Beef Wellington" gibi fırında milföylü, feci zor bir et yemeği yapmaya çalıştım. Zamanlama sarksın istemedim ama heyecandan fırının derecesini son ayara getirmişim. Kapı çaldı, içeri girdiler, tam salona geçiyorduk ki mutfaktan simsiyah bir duman yükseldi. Fırını bir açtım, o havalı yemek resmen mangal kömürüne dönmüş, mutfaktaki yangın alarmı da cıyak cıyak ötmeye başladı. Kayınvalidem çantasından yelpazesini çıkardı, "Kızım bizi yakmaya niyetin yoksa dışarıdan pide söyleyelim, o daha az tehlikeli" dedi. O günden beri bana her geldiğinde eliyle yemek getiriyor.'
    ),
    (
      'GelinlikDüğümü',
      26,
      'female',
      'bursa',
      'Düğün günüm, gelin odasındayım, kuaför falan her şey bitti. Heyecandan sürekli su içtiğim için tuvalete gitmem gerekti ama o devasa kabarık gelinlikle tek başıma hareket etmem imkansız. Nedimem olan en yakın arkadaşımı yanıma çağırdım, o arkadan gelinliğin kuyruğunu ve tüllerini havaya kaldırdı, ben de tam işimi görecekken kapı şak diye açıldı. İçeri giren bizim damat değil, yanlış odaya dalan kameramandı! Adam elinde devasa ışıklı kamerayla bizi o pozisyonda gördü, kamerayı indirmeden "Pardon abi" deyip kaçtı. Düğün videosunu izlerken o odadan çıkış anındaki kırmızı yüzümü her gördüğümde adamı vurmak istiyorum.'
    ),
    (
      'KediAnası',
      30,
      'female',
      'ankara',
      'Bizim sitede feci yakışıklı, tam benim kafamda, sürekli köpeğini gezdiren bir çocuk var. Aylardır göz hapsindeyim ama bir türlü konuşma fırsatı bulamadım. Bir gün cesaretimi topladım, bizim kedinin taşıma çantasını elime aldım, çocuk bahçede köpeğiyle otururken yanına yanaştım. "Ay merhaba, veterinerden geliyoruz da bizimki biraz huysuz" diyerek muhabbeti açtım. Çocuk gülümsedi, "Aaa ne tatlı, cinsi ne?" diye çantaya doğru eğildi. Ben de gururla çantayı açtım ama içeride kedi falan yoktu! Aceleden kediyi evde unutup boş çantayı yüklenip gelmişim. Çocuk boş çantaya bakıyor, ben şoktayım. "Bizimki görünmez kedi" deyip koşarak eve kaçtım.'
    ),
    (
      'DiyetBozan',
      25,
      'male',
      'eskisehir',
      'Pazartesi günü iş yerinde feci katı bir diyete başladım, herkese "Artık şeker ve gluten hayatımda yok, irademe hayran kalacaksınız" diye nutuk çekiyorum. Çarşamba günü öğle arasında tansiyonum düştü, kimse görmesin diye mutfaktaki o kuytu köşeye geçip çantama sakladığım o devasa çikolatalı ekleri hunharca ağzıma tıkıştırmaya başladım. Tam o esnada şirketin dedikodu kazanı olan insan kaynakları kızı elinde kupayla içeri girdi. Ağzım o kadar doluydu ki yutamadım, yanaklarım hamster gibi şişmiş durumda kıza bakıyorum. Kız çikolata lekeli yüzüme baktı, "İradene gerçekten hayran kaldım canım" deyip arkasını döndü. Beş dakika sonra şirketin ortak grubunda adım "Ekler Canavarı"na çıktı.'
    )
) as v(username, age, gender, yasadigi_yer, hikaye);
