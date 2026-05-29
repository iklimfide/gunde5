-- Podyum/kulis kart sayıları + puan senkronu (bir kez çalıştır)

create or replace function public.hikaye_oy_sayaclarini_yenile(p_ids bigint[] default null)
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
        from public.hikayeler i
        where (p_ids is null or i.id = any (p_ids))
          and i.silindi_at is null
    loop
        perform public.hikaye_puan_guncelle(v_id);
    end loop;
end;
$$;

revoke all on function public.hikaye_oy_sayaclarini_yenile(bigint[]) from public, anon, authenticated;
grant execute on function public.hikaye_oy_sayaclarini_yenile(bigint[]) to service_role;

create or replace function public.hikaye_cevap_sayilari(p_ids bigint[])
returns table (hikaye_id bigint, adet int)
language sql
stable
security invoker
set search_path = public
as $$
    select
        c.hikaye_id,
        count(*)::int as adet
    from public.hikaye_cevaplar c
    where c.hikaye_id = any (p_ids)
    group by c.hikaye_id;
$$;

revoke all on function public.hikaye_cevap_sayilari(bigint[]) from public;
grant execute on function public.hikaye_cevap_sayilari(bigint[]) to anon, authenticated;
