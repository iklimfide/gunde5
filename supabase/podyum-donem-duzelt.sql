-- Karışık podyum günlerini ayır (20/05 üst, 19/05 alt — site de böyle gösterir)
-- Önce: podyum-koruma.sql (isteğe bağlı). Sonra bu dosya.

-- 20/05 şampiyonları (zaten doğru etiketliyse dokunmaz)
update public.itiraflar
set podyum_sira = sub.sira
from (
    select
        id,
        row_number() over (
            order by podyum_sira asc nulls last, id asc
        ) as sira
    from public.itiraflar
    where status = 'podyum'
      and silindi_at is null
      and podyum_donem = '2026-05-20'
) sub
where public.itiraflar.id = sub.id;

-- 19/05: seed şampiyonları (20/05’te olan id hariç)
with p20 as (
    select id from public.itiraflar
    where status = 'podyum' and silindi_at is null and podyum_donem = '2026-05-20'
),
sirali as (
    select
        i.id,
        row_number() over (
            order by
                (i.up_votes - i.down_votes)
                + coalesce((
                    select count(*)::int from public.itiraf_cevaplar c where c.itiraf_id = i.id
                ), 0) * 5 desc,
                i.created_at asc
        ) as sira
    from public.itiraflar i
    where i.username in (
        'LazerMağduru', 'BagajMağduru', 'ProtezKrizi', 'SinyalYok', 'ValeMağduru'
    )
      and i.id not in (select id from p20)
)
update public.itiraflar i
set
    status = 'podyum',
    podyum_donem = '2026-05-19',
    podyum_sira = s.sira::smallint,
    silindi_at = null
from sirali s
where i.id = s.id
  and s.sira <= 5;

-- Hâlâ 19/05’te 5’ten azsa: 20/05 dışı en iyi puanlılarla tamamla
with p20 as (
    select id from public.itiraflar
    where status = 'podyum' and silindi_at is null and podyum_donem = '2026-05-20'
),
p19 as (
    select id from public.itiraflar
    where status = 'podyum' and silindi_at is null and podyum_donem = '2026-05-19'
),
eksik as (
    select greatest(0, 5 - (select count(*)::int from p19)) as adet
),
aday as (
    select
        i.id,
        row_number() over (
            order by
                (i.up_votes - i.down_votes)
                + coalesce((
                    select count(*)::int from public.itiraf_cevaplar c where c.itiraf_id = i.id
                ), 0) * 5 desc,
                i.created_at asc
        ) as sira
    from public.itiraflar i
    where i.id not in (select id from p20)
      and i.id not in (select id from p19)
),
top as (
    select a.id, (select count(*)::int from p19) + a.sira as sira
    from aday a
    cross join eksik e
    where a.sira <= e.adet
)
update public.itiraflar i
set
    status = 'podyum',
    podyum_donem = '2026-05-19',
    podyum_sira = t.sira::smallint,
    silindi_at = null
from top t
where i.id = t.id;

-- Kontrol
select podyum_donem, podyum_sira, username, id
from public.itiraflar
where status = 'podyum' and silindi_at is null
order by podyum_donem desc, podyum_sira asc;
