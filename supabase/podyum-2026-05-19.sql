-- 19/05/2026 podyum şampiyonları: top 5 kulis → podyum (SQL Editor'da bir kez çalıştırın)

alter table public.hikayeler
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

-- Arayüz: üst satır TOP 5, alt satır dd/mm/yyyy şampiyonları (tarih bu metinden çıkarılır)
insert into public.site_ayar (anahtar, deger)
values ('podyum_baslik', '19/05/2026 Şampiyonları — Top 5')
on conflict (anahtar) do update
    set deger = excluded.deger,
        updated_at = now();

-- NOT: Eski podyum silinmez / kulise inmez. Sadece kulisten yeni top 5 eklenir.

-- Algoritma puanı ile ilk 5 → podyum (P = up - down + yorum*5)
with ranked as (
    select
        id,
        row_number() over (
            order by (
                (up_votes - down_votes) +
                ((select count(*)::int from public.hikaye_cevaplar c where c.hikaye_id = public.hikayeler.id) * 5)
            ) desc,
            created_at desc
        ) as sira
    from public.hikayeler
    where status = 'kulis'
)
update public.hikayeler i
set
    status = 'podyum',
    podyum_sira = r.sira::smallint,
    podyum_donem = '2026-05-19'
from ranked r
where i.id = r.id
  and r.sira <= 5;
