-- 3 planlı hikaye — 30 Mayıs 2026 (Europe/Istanbul): 13:00, 15:00, 17:00
-- created_at gelene kadar anasayfada görünmez. Supabase SQL Editor'da bir kez Run.
-- RLS: insert SQL Editor (postgres/service_role) ile yapılır; yayın sonrası okuma mevcut
--      itiraflar_select_all (anon/authenticated) politikasına tabidir.

insert into public.itiraflar (
  user_id,
  username,
  age,
  gender,
  yasadigi_yer,
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
      'AnneAriyor',
      26,
      'male',
      'istanbul_avrupa',
      'Romantizmin Çamaşırları',
      'İlk buluşmada çok havalı görünmeye çalışıyordum. Telefonum masadaydı. Tam romantik bir şey söyleyecekken annem aradı. Telefon ekranında kocaman "Anne Arıyor" yazısı belirdi. Açınca ilk cümlesi bütün kafede yankılandı: "Oğlum, çamaşırları astın mı?"',
      timestamptz '2026-05-30 13:00:00+03'
    ),
    (
      'BalayiPaketi',
      32,
      'male',
      'izmir',
      'Otel Rezervasyonu',
      'İş seyahati için otel rezervasyonu yaptırdım. Resepsiyondaki görevli göz kırpıp "Çiftlere özel paketiniz hazır." dedi. Meğer rezervasyonu yapan arkadaşım şaka olsun diye balayı odası seçmiş.',
      timestamptz '2026-05-30 15:00:00+03'
    ),
    (
      'YanlisSekme',
      24,
      'male',
      'ankara',
      'Yanlış Sekme',
      'Kafede otururken hoşlandığım kıza yazacaktım. Google''da ilişki tavsiyeleri arıyordum. Telefonu ona uzatıp fotoğraf gösterecekken ekran açık kaldı. Kız fotoğrafa değil, Google''da ilişki tavsiyesi aradığımı gördü.',
      timestamptz '2026-05-30 17:00:00+03'
    )
) as v(username, age, gender, yasadigi_yer, baslik, hikaye, yayin_at)
where not exists (
  select 1
  from public.itiraflar i
  where i.baslik = v.baslik
    and i.created_at = v.yayin_at
    and i.silindi_at is null
);
