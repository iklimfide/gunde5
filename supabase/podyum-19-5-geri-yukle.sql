-- 19/05/2026 şampiyonlarını GERİ GETİR (Supabase SQL Editor → Run)
-- 20/05 podyumuna dokunmaz. Eski cron kulise/sildiği 5’i tekrar podyum yapar.

-- 1) Zaten 19/05 işaretli ama kuliste kalmışsa düzelt
update public.itiraflar
set
    status = 'podyum',
    silindi_at = null
where podyum_donem = '2026-05-19'
  and (status <> 'podyum' or silindi_at is not null);

-- 2) 20/05 şampiyonları hariç, eksik kadarını 19/05 podyuma al (hedef: 5 adet)
with podyum_20 as (
    select id
    from public.itiraflar
    where status = 'podyum'
      and podyum_donem = '2026-05-20'
      and silindi_at is null
),
podyum_19 as (
    select id
    from public.itiraflar
    where status = 'podyum'
      and podyum_donem = '2026-05-19'
      and silindi_at is null
),
eksik as (
    select greatest(0, 5 - (select count(*)::int from podyum_19)) as adet
),
aday as (
    select
        i.id,
        row_number() over (
            order by
                (i.up_votes - i.down_votes)
                + coalesce((
                    select count(*)::int
                    from public.itiraf_cevaplar c
                    where c.itiraf_id = i.id
                ), 0) * 5 desc,
                i.created_at asc
        ) as sira
    from public.itiraflar i
    where i.id not in (select id from podyum_20)
      and i.id not in (select id from podyum_19)
),
top5 as (
    select a.id, a.sira
    from aday a
    cross join eksik e
    where a.sira <= e.adet
)
update public.itiraflar i
set
    status = 'podyum',
    podyum_sira = t.sira::smallint,
    podyum_donem = '2026-05-19',
    silindi_at = null
from top5 t
where i.id = t.id;

-- Kontrol (2 satır görmelisin: 2026-05-20 → 5, 2026-05-19 → 5)
select podyum_donem, count(*) as adet
from public.itiraflar
where status = 'podyum' and silindi_at is null
group by podyum_donem
order by podyum_donem desc;
