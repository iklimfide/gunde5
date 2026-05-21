-- =============================================================================
-- GÜNDE5 — Her gün saat 13:12 (Türkiye, Europe/Istanbul)
-- =============================================================================
-- Ne olur?
--   1) Aktif kulis kayıtlarında r puanı güncellenir.
--   2) r en yüksek 5 hikaye → status = 'podyum', podyum_donem = bugün, podyum_sira 1–5.
--   3) Mevcut podyum satırlarına dokunulmaz (podyum-koruma.sql).
--   4) Kulis’te kalanlar soft-delete (silindi_at); siteden kaybolur.
--
-- Önkoşul: itiraf-puan.sql (r sütunu), podyum-koruma.sql
-- Supabase SQL Editor’da BU DOSYANIN TAMAMINI bir kez çalıştır.
-- =============================================================================

create or replace function public.podyum_gunluk_gecis()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_donem text;
    v_baslik text;
begin
    v_donem := to_char(now() at time zone 'Europe/Istanbul', 'YYYY-MM-DD');
    v_baslik := to_char(now() at time zone 'Europe/Istanbul', 'DD/MM/YYYY')
        || ' Şampiyonları — Top 5';

    -- Kulis’teki r değerlerini seçimden önce tazele
    update public.itiraflar i
    set
        b = sub.b,
        r = sub.r
    from (
        select
            k.id,
            (coalesce(k.up_votes, 0) - coalesce(k.down_votes, 0)) as b,
            (coalesce(k.up_votes, 0) - coalesce(k.down_votes, 0))
                + coalesce((
                    select count(*)::int
                    from public.itiraf_cevaplar c
                    where c.itiraf_id = k.id
                ), 0) * 5 as r
        from public.itiraflar k
        where k.status = 'kulis'
          and k.silindi_at is null
    ) sub
    where i.id = sub.id;

    -- r en yüksek 5 → podyum (yalnızca kulis adayları)
    with sirali as (
        select
            i.id,
            row_number() over (
                order by
                    coalesce(i.r, 0) desc,
                    (case when i.user_id is not null then 1 else 0 end) desc,
                    i.created_at desc
            ) as sira
        from public.itiraflar i
        where i.status = 'kulis'
          and i.silindi_at is null
    )
    update public.itiraflar i
    set
        status = 'podyum',
        podyum_sira = s.sira::smallint,
        podyum_donem = v_donem,
        silindi_at = null
    from sirali s
    where i.id = s.id
      and s.sira <= 5;

    -- Giyotin: kuliste kalanlar (top 5 dışı) soft-delete
    update public.itiraflar
    set silindi_at = now()
    where status = 'kulis'
      and silindi_at is null;

    insert into public.site_ayar (anahtar, deger)
    values ('podyum_baslik', v_baslik)
    on conflict (anahtar) do update
        set deger = excluded.deger,
            updated_at = now();
end;
$$;

revoke all on function public.podyum_gunluk_gecis() from public;
revoke all on function public.podyum_gunluk_gecis() from anon, authenticated;

create extension if not exists pg_cron;

do $$
begin
    perform cron.unschedule('gunde5_podyum_1312_tr');
exception
    when others then null;
end;
$$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'gunde5_podyum_1312_tr';

-- 13:12 Europe/Istanbul ≈ 10:12 UTC (pg_cron sunucu saati UTC kabul edilir)
select cron.schedule(
    'gunde5_podyum_1312_tr',
    '12 10 * * *',
    $$select public.podyum_gunluk_gecis();$$
);
