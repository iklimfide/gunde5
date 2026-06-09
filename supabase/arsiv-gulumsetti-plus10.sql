-- Dün ve önceki arşiv: aktif baskı günü hariç tüm yayında kulis hikayelere +10 gülümsetti (up_votes).
-- Bugünün 5'i etkilenmez. Supabase SQL Editor'da bir kez Run.

do $$
declare
    v_aktif date;
    v_adet int;
    v_id bigint;
begin
    perform set_config('gunde5.master_bypass', '1', true);

    v_aktif := public.gunde5_aktif_baski_gunu();

    update public.itiraflar i
    set up_votes = coalesce(i.up_votes, 0) + 10
    where i.silindi_at is null
      and i.status = 'kulis'
      and i.created_at <= now()
      and (i.created_at at time zone 'Europe/Istanbul')::date < v_aktif;

    get diagnostics v_adet = row_count;

    for v_id in
        select i.id
        from public.itiraflar i
        where i.silindi_at is null
          and i.status = 'kulis'
          and i.created_at <= now()
          and (i.created_at at time zone 'Europe/Istanbul')::date < v_aktif
    loop
        if to_regprocedure('public.itiraf_puan_guncelle(bigint)') is not null then
            perform public.itiraf_puan_guncelle(v_id);
        elsif to_regprocedure('public.hikaye_puan_guncelle(bigint)') is not null then
            perform public.hikaye_puan_guncelle(v_id);
        end if;
    end loop;

    raise notice 'Arsiv gulumsetti +10: % hikaye (aktif baski % haric).', v_adet, v_aktif;
end;
$$;

select
    count(*)::int as hikaye_sayisi,
    min(up_votes) as min_up,
    max(up_votes) as max_up,
    round(avg(up_votes)::numeric, 1) as ort_up
from public.itiraflar i
where i.silindi_at is null
  and i.status = 'kulis'
  and i.created_at <= now()
  and (i.created_at at time zone 'Europe/Istanbul')::date < public.gunde5_aktif_baski_gunu();
