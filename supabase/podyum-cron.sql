-- Eski dosya: asıl kurulum supabase/saat-1312-podyum.sql içinde (fonksiyon + cron birlikte).
-- Bu dosyayı yalnızca cron satırını ayrı çalıştırmak istersen kullan.

create extension if not exists pg_cron;

select cron.schedule(
    'gunde5_podyum_1312_tr',
    '12 10 * * *',
    $$select public.podyum_gunluk_gecis();$$
);
