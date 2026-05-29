-- Üyeliksiz oy: giriş gerekmez; viewer_key veya (girişliyse) user_id ile hikaye başına tek oy.
-- Anonim + üye oy: tek RPC (SECURITY DEFINER). Index ve diğer sayfalar için.
-- Canlı şema: itiraflar / itiraf_oylar. SQL Editor'da bir kez Run.

alter table public.itiraf_oylar
    add column if not exists viewer_key text;

alter table public.itiraf_oylar
    alter column user_id drop not null;

alter table public.itiraf_oylar
    drop constraint if exists itiraf_oylar_itiraf_id_user_id_key;

alter table public.itiraf_oylar
    drop constraint if exists hikaye_oylar_hikaye_id_user_id_key;

alter table public.itiraf_oylar
    drop constraint if exists itiraf_oylar_kimlik_check;

alter table public.itiraf_oylar
    add constraint itiraf_oylar_kimlik_check check (
        (user_id is not null and viewer_key is null)
        or (user_id is null and viewer_key is not null and char_length(viewer_key) >= 8)
    );

create unique index if not exists itiraf_oylar_user_uniq
    on public.itiraf_oylar (itiraf_id, user_id)
    where user_id is not null;

create unique index if not exists itiraf_oylar_viewer_uniq
    on public.itiraf_oylar (itiraf_id, viewer_key)
    where viewer_key is not null;

create or replace function public.itiraf_oy_ver(
    p_itiraf_id bigint,
    p_oy smallint,
    p_viewer_key text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid;
    v_key text;
    v_oy smallint;
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
        if exists (
            select 1 from public.itiraf_oylar o
            where o.itiraf_id = p_itiraf_id and o.user_id = v_uid
        ) then
            raise exception 'zaten_oyladin' using errcode = 'P0001';
        end if;

        insert into public.itiraf_oylar (itiraf_id, user_id, oy)
        values (p_itiraf_id, v_uid, v_oy);
    else
        v_key := left(trim(coalesce(p_viewer_key, '')), 128);
        if char_length(v_key) < 8 then
            raise exception 'gecersiz izleyici' using errcode = 'P0001';
        end if;

        if exists (
            select 1 from public.itiraf_oylar o
            where o.itiraf_id = p_itiraf_id and o.viewer_key = v_key
        ) then
            raise exception 'zaten_oyladin' using errcode = 'P0001';
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

-- Eski istemci adı
create or replace function public.oy_ver(
    p_hikaye_id bigint,
    p_oy integer,
    p_viewer_key text default null
)
returns json
language sql
security definer
set search_path = public
as $$
    select public.itiraf_oy_ver(p_hikaye_id, p_oy::smallint, p_viewer_key);
$$;

revoke all on function public.oy_ver(bigint, integer, text) from public;
grant execute on function public.oy_ver(bigint, integer, text) to anon, authenticated;

notify pgrst, 'reload schema';
