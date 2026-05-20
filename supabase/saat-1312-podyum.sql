-- =============================================================================
-- GÜNDE5 — Her gün saat 13:12 (Türkiye)
-- =============================================================================
-- Ne olur?
--   1) PODYUMDAN HİÇBİR ŞEY SİLİNMEZ / KULİSE İNMEZ (19/05, 20/05 … kalır).
--   2) Kulis’teki en iyi 5 yeni günün şampiyonu olur (podyum_donem = bugün).
--   3) Kulis’te kalanlar siteden kaybolur (soft delete).
--
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

    -- Kulis’ten bugünün top 5’i (dünkü podyuma dokunma)
    with sirali as (
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
-- select cron.unschedule('gunde5_podyum_1312_tr');
select cron.schedule(
    'gunde5_podyum_1312_tr',
    '12 10 * * *',
    $$select public.podyum_gunluk_gecis();$$
);
