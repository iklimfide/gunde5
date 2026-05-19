-- 19/05/2026 podyum şampiyonları: top 5 kulis → podyum (SQL Editor'da bir kez çalıştırın)

alter table public.itiraflar
    add column if not exists podyum_sira smallint,
    add column if not exists podyum_donem varchar(32);

create table if not exists public.site_ayar (
    anahtar text primary key,
    deger text not null,
    updated_at timestamptz not null default now()
);

alter table public.site_ayar enable row level security;

drop policy if exists site_ayar_select_all on public.site_ayar;
create policy site_ayar_select_all on public.site_ayar
    for select using (true);

insert into public.site_ayar (anahtar, deger)
values ('podyum_baslik', '19/05/2026 Şampiyonları — Top 5')
on conflict (anahtar) do update
    set deger = excluded.deger,
        updated_at = now();

-- Önceki podyum itiraflarını kulise indir
update public.itiraflar
set status = 'kulis',
    podyum_sira = null,
    podyum_donem = null
where status = 'podyum';

-- Net oy (up - down) ile ilk 5 → podyum
with ranked as (
    select
        id,
        row_number() over (
            order by (up_votes - down_votes) desc, created_at desc
        ) as sira
    from public.itiraflar
    where status = 'kulis'
)
update public.itiraflar i
set
    status = 'podyum',
    podyum_sira = r.sira::smallint,
    podyum_donem = '2026-05-19'
from ranked r
where i.id = r.id
  and r.sira <= 5;
