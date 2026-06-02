-- 403 on /rpc/itiraf_goruntulenme_kaydet → EXECUTE yetkisi + güvenli DEFINER
-- Canlı: public.itiraflar — SQL Editor'da bir kez Run.

grant usage on schema public to anon, authenticated;

grant update (sayfa_goruntulenme, tekil_goruntulenme) on public.itiraflar to anon, authenticated;
grant insert on public.itiraf_goruntulenmeler to anon, authenticated;

create or replace function public.itiraf_goruntulenme_kaydet(
    p_itiraf_id bigint,
    p_viewer_key text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    v_key text;
    v_tekil_artis int;
begin
    if p_itiraf_id is null then
        return null;
    end if;

    v_key := left(trim(coalesce(p_viewer_key, '')), 128);
    if length(v_key) < 8 then
        return null;
    end if;

    if not exists (
        select 1 from public.itiraflar i
        where i.id = p_itiraf_id and i.silindi_at is null
    ) then
        return null;
    end if;

    update public.itiraflar
    set sayfa_goruntulenme = sayfa_goruntulenme + 1
    where id = p_itiraf_id and silindi_at is null;

    with ins as (
        insert into public.itiraf_goruntulenmeler (itiraf_id, viewer_key)
        values (p_itiraf_id, v_key)
        on conflict (itiraf_id, viewer_key) do nothing
        returning 1
    )
    select count(*)::int into v_tekil_artis from ins;

    if v_tekil_artis > 0 then
        update public.itiraflar
        set tekil_goruntulenme = tekil_goruntulenme + v_tekil_artis
        where id = p_itiraf_id and silindi_at is null;
    end if;

    return (
        select json_build_object(
            'sayfa_goruntulenme', i.sayfa_goruntulenme,
            'tekil_goruntulenme', i.tekil_goruntulenme
        )
        from public.itiraflar i
        where i.id = p_itiraf_id
    );
end;
$$;

revoke all on function public.itiraf_goruntulenme_kaydet(bigint, text) from public;
grant execute on function public.itiraf_goruntulenme_kaydet(bigint, text) to anon, authenticated;

create or replace function public.hikaye_goruntulenme_kaydet(
    p_hikaye_id bigint,
    p_viewer_key text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
    return public.itiraf_goruntulenme_kaydet(p_hikaye_id, p_viewer_key);
end;
$$;

revoke all on function public.hikaye_goruntulenme_kaydet(bigint, text) from public;
grant execute on function public.hikaye_goruntulenme_kaydet(bigint, text) to anon, authenticated;

notify pgrst, 'reload schema';
