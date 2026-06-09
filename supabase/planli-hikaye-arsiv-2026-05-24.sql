-- 11 Haziran 2026 ve sonrası planlı hikayeler → arşiv: 24 Mayıs 2026 (İstanbul saati korunur)
-- Örnek: 2026-06-13 07:02+03 → 2026-05-24 07:02+03
-- Supabase SQL Editor'da bir kez Run.

do $$
declare
    v_adet int;
begin
    perform set_config('gunde5.master_bypass', '1', true);

    update public.itiraflar i
    set created_at = (
        ('2026-05-24'::date + (i.created_at at time zone 'Europe/Istanbul')::time)
        at time zone 'Europe/Istanbul'
    )
    where i.silindi_at is null
      and (i.created_at at time zone 'Europe/Istanbul')::date >= date '2026-06-11';

    get diagnostics v_adet = row_count;
    raise notice 'Arsivlendi: % hikaye → 2026-05-24 (saat korundu).', v_adet;
end;
$$;
