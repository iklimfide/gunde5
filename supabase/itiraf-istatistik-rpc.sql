-- Podyum/kulis kart sayıları + oy sayacı senkronu (bir kez çalıştır)

create or replace function public.itiraf_oy_sayaclarini_yenile(p_ids bigint[] default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id bigint;
begin
    for v_id in
        select i.id
        from public.itiraflar i
        where (p_ids is null or i.id = any (p_ids))
          and i.silindi_at is null
    loop
        update public.itiraflar i
        set
            up_votes = coalesce((
                select count(*)::int
                from public.itiraf_oylar o
                where o.itiraf_id = v_id and o.oy = 1
            ), 0),
            down_votes = coalesce((
                select count(*)::int
                from public.itiraf_oylar o
                where o.itiraf_id = v_id and o.oy = -1
            ), 0)
        where i.id = v_id;

        perform public.itiraf_puan_guncelle(v_id);
    end loop;
end;
$$;

revoke all on function public.itiraf_oy_sayaclarini_yenile(bigint[]) from public;
grant execute on function public.itiraf_oy_sayaclarini_yenile(bigint[]) to anon, authenticated;

create or replace function public.itiraf_cevap_sayilari(p_ids bigint[])
returns table (itiraf_id bigint, adet int)
language sql
security definer
stable
set search_path = public
as $$
    select
        c.itiraf_id,
        count(*)::int as adet
    from public.itiraf_cevaplar c
    where c.itiraf_id = any (p_ids)
    group by c.itiraf_id;
$$;

revoke all on function public.itiraf_cevap_sayilari(bigint[]) from public;
grant execute on function public.itiraf_cevap_sayilari(bigint[]) to anon, authenticated;
