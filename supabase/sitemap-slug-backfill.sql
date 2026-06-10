-- Slug backfill — yalnızca diagnostik sonrası, bilinçli olarak çalıştırın.
--
-- UYARI: slug değişen her hikâyenin eski /h/{eski-slug} URL'si kırılır.
-- itiraf_slug_gecmisi + /h/{id} → 301 ile yönlendirme devam eder.
-- Paylaşılmış tam slug URL'leri 301 alır (itiraf-share + gecmisi tablosu).

begin;

-- ---------------------------------------------------------------------------
-- 1) Yedek tablo
-- ---------------------------------------------------------------------------
create table if not exists public.itiraf_slug_yedek (
    yedek_at timestamptz not null default now(),
    id bigint not null,
    slug text,
    slug_hint text,
    primary key (yedek_at, id)
);

insert into public.itiraf_slug_yedek (id, slug, slug_hint)
select id, slug, slug_hint
from public.itiraflar
where silindi_at is null
  and slug is not null;

-- ---------------------------------------------------------------------------
-- 2) Eski slug → yeni slug geçmişi (301 için)
-- ---------------------------------------------------------------------------
create table if not exists public.itiraf_slug_gecmisi (
    eski_slug text primary key,
    itiraf_id bigint not null references public.itiraflar(id) on delete cascade,
    yeni_slug text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_itiraf_slug_gecmisi_itiraf
    on public.itiraf_slug_gecmisi (itiraf_id);

alter table public.itiraf_slug_gecmisi enable row level security;

drop policy if exists itiraf_slug_gecmisi_okuma on public.itiraf_slug_gecmisi;
create policy itiraf_slug_gecmisi_okuma
    on public.itiraf_slug_gecmisi
    for select
    to anon, authenticated
    using (true);

-- ---------------------------------------------------------------------------
-- 3) Değişecek kayıtları listele (COMMIT öncesi gözden geçirin)
-- ---------------------------------------------------------------------------
select
    i.id,
    i.slug as eski_slug,
    public.itiraf_slug_uret(i.slug_hint, i.content_full, i.id) as yeni_slug
from public.itiraflar i
where i.silindi_at is null
  and i.slug is not null
  and i.slug is distinct from public.itiraf_slug_uret(i.slug_hint, i.content_full, i.id)
order by i.id;

-- ---------------------------------------------------------------------------
-- 4) Geçmişe yaz + slug güncelle (yalnızca farklı olanlar)
-- ---------------------------------------------------------------------------
insert into public.itiraf_slug_gecmisi (eski_slug, itiraf_id, yeni_slug)
select
    i.slug,
    i.id,
    public.itiraf_slug_uret(i.slug_hint, i.content_full, i.id)
from public.itiraflar i
where i.silindi_at is null
  and i.slug is not null
  and i.slug is distinct from public.itiraf_slug_uret(i.slug_hint, i.content_full, i.id)
on conflict (eski_slug) do update
    set yeni_slug = excluded.yeni_slug,
        itiraf_id = excluded.itiraf_id;

update public.itiraflar i
set slug = public.itiraf_slug_uret(i.slug_hint, i.content_full, i.id)
where i.silindi_at is null
  and i.slug is not null
  and i.slug is distinct from public.itiraf_slug_uret(i.slug_hint, i.content_full, i.id);

-- content_full değişince slug tetiklenmez (itiraf_slug_tetik yalnızca slug_hint)

-- ---------------------------------------------------------------------------
-- 5) Doğrulama
-- ---------------------------------------------------------------------------
select count(*) as bozuk_kalan
from public.itiraflar
where silindi_at is null
  and slug is not null
  and (
    slug ~ '-h-[0-9]+$'
    or slug ~ '-l-[0-9]+$'
    or slug ~ '-bas-[0-9]+$'
    or slug like '%-bjr-%'
    or slug like '%dukk-nim%'
    or slug like '%dukk-na%'
  );

commit;

notify pgrst, 'reload schema';
