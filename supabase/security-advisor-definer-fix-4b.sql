-- Adim 2/3 — oy RLS + RPC
set statement_timeout = '0';
set lock_timeout = '60s';

-- ---------------------------------------------------------------------------
-- itiraf_oylar â€” insert + select (oy ver / oy durum INVOKER)
-- ---------------------------------------------------------------------------
grant insert, select on public.itiraf_oylar to anon, authenticated;

drop policy if exists itiraf_oylar_insert_uye on public.itiraf_oylar;
create policy itiraf_oylar_insert_uye on public.itiraf_oylar
    for insert to authenticated
    with check (
        user_id = (select auth.uid())
        and viewer_key is null
        and oy in (1, -1)
        and exists (
            select 1 from public.itiraflar i
            where i.id = itiraf_id
        )
    );

drop policy if exists itiraf_oylar_insert_anon on public.itiraf_oylar;
create policy itiraf_oylar_insert_anon on public.itiraf_oylar
    for insert to anon
    with check (
        user_id is null
        and viewer_key is not null
        and char_length(viewer_key) >= 8
        and oy in (1, -1)
        and exists (
            select 1 from public.itiraflar i
            where i.id = itiraf_id
        )
    );

drop policy if exists itiraf_oylar_select_uye on public.itiraf_oylar;
create policy itiraf_oylar_select_uye on public.itiraf_oylar
    for select to authenticated
    using (user_id = (select auth.uid()));

drop policy if exists itiraf_oylar_select_anon on public.itiraf_oylar;
create policy itiraf_oylar_select_anon on public.itiraf_oylar
    for select to anon
    using (
        user_id is null
        and viewer_key is not null
        and viewer_key = coalesce(nullif(current_setting('g5.viewer_key', true), ''), '___none___')
    );

-- ---------------------------------------------------------------------------
-- itiraf_oy_ver + oy_ver (INVOKER, zaten_oyladin JSON)
-- ---------------------------------------------------------------------------
create or replace function public.itiraf_oy_ver(
    p_itiraf_id bigint,
    p_oy smallint,
    p_viewer_key text default null
)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_uid uuid;
    v_key text;
    v_oy smallint;
    v_mevcut smallint;
begin
    if p_itiraf_id is null then
        return null;
    end if;

    v_oy := case when p_oy = 1 then 1 else -1 end;

    if not exists (select 1 from public.itiraflar i where i.id = p_itiraf_id) then
        raise exception 'itiraf bulunamadi' using errcode = 'P0002';
    end if;

    v_uid := auth.uid();

    if v_uid is not null then
        select o.oy into v_mevcut
        from public.itiraf_oylar o
        where o.itiraf_id = p_itiraf_id and o.user_id = v_uid
        limit 1;

        if v_mevcut is not null then
            return (
                select json_build_object(
                    'up_votes', coalesce(i.up_votes, 0),
                    'down_votes', coalesce(i.down_votes, 0),
                    'oy', v_mevcut,
                    'zaten_oyladin', true
                )
                from public.itiraflar i
                where i.id = p_itiraf_id
            );
        end if;

        insert into public.itiraf_oylar (itiraf_id, user_id, oy)
        values (p_itiraf_id, v_uid, v_oy);
    else
        v_key := left(trim(coalesce(p_viewer_key, '')), 128);
        if char_length(v_key) < 8 then
            raise exception 'gecersiz izleyici' using errcode = 'P0001';
        end if;

        perform set_config('g5.viewer_key', v_key, true);

        select o.oy into v_mevcut
        from public.itiraf_oylar o
        where o.itiraf_id = p_itiraf_id and o.viewer_key = v_key
        limit 1;

        if v_mevcut is not null then
            return (
                select json_build_object(
                    'up_votes', coalesce(i.up_votes, 0),
                    'down_votes', coalesce(i.down_votes, 0),
                    'oy', v_mevcut,
                    'zaten_oyladin', true
                )
                from public.itiraflar i
                where i.id = p_itiraf_id
            );
        end if;

        insert into public.itiraf_oylar (itiraf_id, viewer_key, oy)
        values (p_itiraf_id, v_key, v_oy);
    end if;

    return (
        select json_build_object(
            'up_votes', coalesce(i.up_votes, 0),
            'down_votes', coalesce(i.down_votes, 0),
            'oy', v_oy
        )
        from public.itiraflar i
        where i.id = p_itiraf_id
    );
end;
$$;

revoke all on function public.itiraf_oy_ver(bigint, smallint, text) from public;
grant execute on function public.itiraf_oy_ver(bigint, smallint, text) to anon, authenticated;

create or replace function public.oy_ver(
    p_hikaye_id bigint,
    p_oy integer,
    p_viewer_key text default null
)
returns json
language sql
security invoker
set search_path = public
as $$
    select public.itiraf_oy_ver(p_hikaye_id, p_oy::smallint, p_viewer_key);
$$;

revoke all on function public.oy_ver(bigint, integer, text) from public;
grant execute on function public.oy_ver(bigint, integer, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- itiraf_oy_durum (INVOKER + g5.viewer_key oturum anahtarÄ±)
-- ---------------------------------------------------------------------------
create or replace function public.itiraf_oy_durum(
    p_itiraf_id bigint,
    p_viewer_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_uid uuid;
    v_key text;
    v_oy smallint;
begin
    if p_itiraf_id is null then
        return jsonb_build_object('oy', null);
    end if;

    v_uid := auth.uid();

    if v_uid is not null then
        select o.oy into v_oy
        from public.itiraf_oylar o
        where o.itiraf_id = p_itiraf_id and o.user_id = v_uid
        limit 1;

        if v_oy is null then
            v_key := left(trim(coalesce(p_viewer_key, '')), 128);
            if char_length(v_key) >= 8 then
                perform set_config('g5.viewer_key', v_key, true);
                select o.oy into v_oy
                from public.itiraf_oylar o
                where o.itiraf_id = p_itiraf_id and o.viewer_key = v_key
                limit 1;
            end if;
        end if;
    else
        v_key := left(trim(coalesce(p_viewer_key, '')), 128);
        if char_length(v_key) < 8 then
            return jsonb_build_object('oy', null);
        end if;

        perform set_config('g5.viewer_key', v_key, true);

        select o.oy into v_oy
        from public.itiraf_oylar o
        where o.itiraf_id = p_itiraf_id and o.viewer_key = v_key
        limit 1;
    end if;

    return jsonb_build_object('oy', v_oy);
end;
$$;

revoke all on function public.itiraf_oy_durum(bigint, text) from public;
grant execute on function public.itiraf_oy_durum(bigint, text) to anon, authenticated;

notify pgrst, 'reload schema';

