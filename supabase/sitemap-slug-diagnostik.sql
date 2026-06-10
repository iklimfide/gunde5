-- Sitemap / slug diagnostik — yalnızca okuma (Supabase SQL Editor)
-- Çalıştırma sırası: önce bu dosya, sonra gerekirse backfill.

-- ---------------------------------------------------------------------------
-- 1) Genel liste
-- ---------------------------------------------------------------------------
select id, slug, slug_hint, created_at, updated_at
from public.itiraflar
where silindi_at is null
order by id desc;

-- ---------------------------------------------------------------------------
-- 2) updated_at migration artefaktı (tüm satırlar aynı saniye)
-- ---------------------------------------------------------------------------
select
    updated_at,
    count(*) as adet
from public.itiraflar
where silindi_at is null
group by updated_at
order by adet desc
limit 10;

select count(*) as migration_artefakt
from public.itiraflar
where silindi_at is null
  and updated_at > created_at
  and updated_at::date = '2026-06-09'::date;

-- ---------------------------------------------------------------------------
-- 3) Bozuk slug kalıpları
-- ---------------------------------------------------------------------------
select id, slug, slug_hint, created_at
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
    or slug ~ '-[a-z]-[0-9]+$'          -- tek harfli token (ör. -h-109)
    or slug ~ '-[a-z]{1,2}-[a-z]'      -- kesik kelime parçaları
  )
order by id;

-- ---------------------------------------------------------------------------
-- 4) Mevcut slug vs yeni algoritma (değişecek kayıtlar)
-- ---------------------------------------------------------------------------
select
    i.id,
    i.slug as eski_slug,
    public.itiraf_slug_uret(i.slug_hint, i.content_full, i.id) as yeni_slug,
    i.slug_hint,
    i.created_at
from public.itiraflar i
where i.silindi_at is null
  and i.slug is not null
  and i.slug is distinct from public.itiraf_slug_uret(i.slug_hint, i.content_full, i.id)
order by i.id;

-- ---------------------------------------------------------------------------
-- 5) Sitemap dışı kalması gereken kayıtlar
-- ---------------------------------------------------------------------------
-- Silinmiş
select count(*) as silinmis from public.itiraflar where silindi_at is not null;

-- Gizli
select count(*) as gizli from public.itiraflar where silindi_at is null and is_gizli = true;

-- Gelecek tarihli
select id, slug, created_at
from public.itiraflar
where silindi_at is null
  and created_at > now()
order by created_at desc;

-- Slug boş
select id, created_at, status
from public.itiraflar
where silindi_at is null
  and (slug is null or trim(slug) = '');

-- Yayında değil (status)
select status, count(*)
from public.itiraflar
where silindi_at is null
group by status
order by count desc;
