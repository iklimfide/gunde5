-- Eski dosya: asıl kurulum supabase/saat-1312-podyum.sql içinde (fonksiyon + cron birlikte).
-- Sadece cron’u yeniden kurmak istersen:

create extension if not exists pg_cron;
-- select cron.unschedule('gunde5_podyum_1312_tr');
select cron.schedule(
    'gunde5_podyum_1312_tr',
    '12 10 * * *',
    $$select public.podyum_gunluk_gecis();$$
);
