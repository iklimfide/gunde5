-- 5 planlı hikaye — 2026-06-10 07:00–07:04 (İstanbul +03)
-- created_at gelene kadar anasayfada görünmez. Supabase SQL Editor'da bir kez Run.
-- itiraf-slug.sql sonrası slug otomatik üretilir.

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
  null::varchar,
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
      'MaviMasa',
      24,
      'male',
      'istanbul_avrupa',
      null::varchar,
      'Benim doğum tarihim 10 Eylül.

Yani tam olarak dokuzuncu ayın onu.

Bunu ne zaman söylesem karşımdaki hemen "9. ayın 10''u yani?" diye sırıtıyor.

Evet abi, tam anladığın gibi işte.

Annemle babam 1978''e girilen yılbaşı gecesinde belli ki çok eğlenmişler. 😂',
      timestamptz '2026-06-10 07:00:00+03'
    ),
    (
      'KırıkLamba',
      21,
      'female',
      'istanbul_avrupa',
      null::varchar,
      'Altı ay önce acayip güzel bir düğünle evlendim.

Ama her şey o kadar aceleye geldi ki nikah tarihi alamadık, düğünden sonra hemen yaparız dedik.

Şu an herkes bizi evli sanıyor.

En tuhafı da eşim bana hiç "Artık şu resmi nikahı yapalım" demiyor.

Resmen düğün simülasyonundayız. 😂',
      timestamptz '2026-06-10 07:01:00+03'
    ),
    (
      'EskiBavul',
      26,
      'female',
      'adana',
      null::varchar,
      'Erkek arkadaşım öpüşürken ağzını inanılmaz derecede çok açıyor.

Ne kadar açarsa o kadar iyi öptüğünü sanıyor herhalde.

Bazen beni tamamen yutacakmış gibi geliyor.

Onu çok seviyorum ama büyük öpmesine hiç gerek yok, korkuyorum. 😂',
      timestamptz '2026-06-10 07:02:00+03'
    ),
    (
      'TozluKaset',
      26,
      'female',
      'eskisehir',
      null::varchar,
      'Pavlov''un köpeği deneyi benim üzerimde bizzat çalışıyor.

Ne zaman Barış Manço''nun Gülpembe şarkısını duysam gözlerim Sinan Çetin''i arıyor.

Eski televizyon programlarının bende bıraktığı hasarı beynimden silemiyorum. 😂',
      timestamptz '2026-06-10 07:03:00+03'
    ),
    (
      'KahveFincanı',
      26,
      'female',
      'ankara',
      null::varchar,
      'Birkaç gün önce parfümümü değiştirdim.

Sanki başka bir kadının kılığına bürünmüşüm, kimlik değiştirmişim gibi geliyor.

Altı üstü bir koku ama alışkanlıklarıma ne kadar bağlı olduğumu fark ettim.

Mutsuz giden evliliğimde boşanmaya neden bir türlü cesaret edemediğimi de böylece çok net anladım. 😂',
      timestamptz '2026-06-10 07:04:00+03'
    )
) as v(username, age, gender, yasadigi_yer, yurtdisi_sehir, hikaye, yayin_at)
where not exists (
  select 1
  from public.itiraflar i
  where i.username = v.username
    and i.created_at = v.yayin_at
    and i.silindi_at is null
);
