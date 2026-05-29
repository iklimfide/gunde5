-- Planlı yayın: created_at = gelecek tarih → anasayfada o saate kadar görünmez.
-- Tarihi düzenleyin (Europe/Istanbul), Supabase SQL Editor'da bir kez Run.
-- Örnek: yarın sabah 09:00

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
  v.yayin_at
from (
  values
    -- (rumuz, yaş, cinsiyet, yer, tam metin, yayın zamanı)
    (
      'OrnekRumuz',
      28,
      'male',
      'ankara',
      'Buraya tam hikaye metni...',
      timestamptz '2026-05-30 09:00:00+03'
    )
) as v(username, age, gender, yasadigi_yer, hikaye, yayin_at);
