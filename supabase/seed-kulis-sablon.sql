-- Yeni kulis bot hikayeleri — hikayeyi bir kez yazın (hikaye sütunu); content_short otomatik.
-- İsteğe bağlı: hikaye-content-short-trigger.sql (INSERT’te short’u DB de üretir).

insert into public.hikayeler (
  user_id,
  username,
  age,
  gender,
  yasadigi_yer,
  yurtdisi_sehir,
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
  v.yurtdisi_sehir,
  case
    when char_length(v.hikaye) <= 140 then v.hikaye
    else left(v.hikaye, 137) || '...'
  end,
  v.hikaye,
  'kulis',
  false
from (
  values
    -- (rumuz, yaş, cinsiyet, yer, yurtdisi_sehir veya null, tam metin)
    ('OrnekRumuz', 25, 'male', 'ankara', null::varchar, 'Buraya tam hikaye metni...')
) as v(username, age, gender, yasadigi_yer, yurtdisi_sehir, hikaye);
