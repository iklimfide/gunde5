-- updated_at migration düzeltmesi — sitemap lastmod için
-- Sorun: ADD COLUMN ... NOT NULL DEFAULT now() tüm mevcut satırlara migration anını yazar;
--        "WHERE updated_at IS NULL" güncellemesi hiç çalışmaz.
-- Bu dosyayı backfill öncesi veya sonrası bir kez çalıştırın.

-- Önce kontrol
select
    count(*) filter (where updated_at::date = '2026-06-09'::date) as gun_2026_06_09,
    count(*) filter (where updated_at > created_at + interval '1 hour') as gercek_duzenleme
from public.itiraflar
where silindi_at is null;

-- Bilinen migration zaman damgası (diagnostikten doğrulayın; farklıysa sorguyu güncelleyin)
update public.itiraflar
set updated_at = created_at
where updated_at = timestamptz '2026-06-09 14:19:25.401036+00';

-- Gelecekteki insert'ler: updated_at = created_at
create or replace function public.itiraf_updated_at_tetik()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' then
        new.updated_at := coalesce(new.created_at, now());
    elsif tg_op = 'UPDATE' then
        if new.slug_hint is distinct from old.slug_hint
            or new.content_full is distinct from old.content_full
            or new.content_short is distinct from old.content_short
            or new.baslik is distinct from old.baslik
            or new.status is distinct from old.status
            or new.is_gizli is distinct from old.is_gizli
            or new.silindi_at is distinct from old.silindi_at
        then
            new.updated_at := now();
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_itiraf_updated_at on public.itiraflar;
create trigger trg_itiraf_updated_at
    before insert or update on public.itiraflar
    for each row
    execute function public.itiraf_updated_at_tetik();

-- itiraf-slug-kelime-sinir.sql içindeki hatalı satırı düzelt (yeniden çalıştırılırsa)
-- update public.itiraflar set updated_at = coalesce(created_at, now()) where updated_at is null;
-- yerine:
-- update public.itiraflar set updated_at = created_at where updated_at > created_at and ...;

select id, created_at::date, updated_at::date
from public.itiraflar
where silindi_at is null
order by id desc
limit 20;
