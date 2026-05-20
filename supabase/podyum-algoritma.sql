-- Podyum algoritması (gizli): kulis → podyum top 5
-- Puan: P = up_votes - down_votes + (yorum_sayisi * 5)
-- Yorum sayısı: itiraf_cevaplar tablosunda itiraf_id eşleşen tüm satırlar (kök + yanıt) sayılır.
--
-- Not: Bu puan UI'da gösterilmez; yalnızca seçim için kullanılır.

-- Eski podyuma dokunulmaz.

with ranked as (
    select
        i.id,
        row_number() over (
            order by (
                (i.up_votes - i.down_votes) +
                ((select count(*)::int from public.itiraf_cevaplar c where c.itiraf_id = i.id) * 5)
            ) desc,
            i.created_at desc
        ) as sira
    from public.itiraflar i
    where i.status = 'kulis'
)
update public.itiraflar i
set
    status = 'podyum',
    podyum_sira = r.sira::smallint,
    -- Dönemi istersen elle ver, istersen otomasyonda tarih string'i üret.
    podyum_donem = to_char(now() at time zone 'Europe/Istanbul', 'YYYY-MM-DD')
from ranked r
where i.id = r.id
  and r.sira <= 5;

