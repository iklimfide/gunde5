-- Anasayfa arama önerileri: site_analytics_events içindeki geçmiş index_search sorguları.
-- SQL Editor'da bir kez Run.

create or replace function public.index_arama_oneri_getir(
    p_onek text,
    p_limit int default 6
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_onek text;
    v_lim int;
    v_rows jsonb;
begin
    v_onek := lower(trim(coalesce(p_onek, '')));
    v_lim := least(greatest(coalesce(p_limit, 6), 1), 8);

    if length(v_onek) < 3 then
        return '[]'::jsonb;
    end if;

    select coalesce(jsonb_agg(s.terim order by s.adet desc, s.son desc, s.terim asc), '[]'::jsonb)
    into v_rows
    from (
        select
            trim(e.payload->>'query') as terim,
            count(*)::int as adet,
            max(e.created_at) as son
        from public.site_analytics_events e
        where e.event_type = 'index_search'
          and length(trim(coalesce(e.payload->>'query', ''))) >= 3
          and lower(trim(e.payload->>'query')) like v_onek || '%'
        group by 1
        having length(trim(e.payload->>'query')) >= 3
        order by adet desc, son desc, terim asc
        limit v_lim
    ) s;

    return coalesce(v_rows, '[]'::jsonb);
end;
$$;

revoke all on function public.index_arama_oneri_getir(text, int) from public;
grant execute on function public.index_arama_oneri_getir(text, int) to anon, authenticated;

notify pgrst, 'reload schema';
