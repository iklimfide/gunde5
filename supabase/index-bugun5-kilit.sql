-- Bugünün 5'i: 12:00 öncesi 30 dk karışık sıra; 12:00'da gülümseme−dislike ile kilit
-- SQL Editor'da bir kez Run.

create table if not exists public.index_bugun5_kilit (
    gun date primary key,
    hikaye_ids bigint[] not null,
    kilit_at timestamptz not null default now()
);

alter table public.index_bugun5_kilit enable row level security;

revoke all on public.index_bugun5_kilit from public, anon, authenticated;

create or replace function public.index_bugunun5_getir()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_bugun date;
    v_saat int;
    v_epoch bigint;
    v_ids bigint[];
    v_rows jsonb;
begin
    v_bugun := (now() at time zone 'Europe/Istanbul')::date;
    v_saat := extract(hour from now() at time zone 'Europe/Istanbul')::int;
    v_epoch := floor(extract(epoch from now()) / 1800)::bigint;

    if v_saat >= 12 then
        select k.hikaye_ids
        into v_ids
        from public.index_bugun5_kilit k
        where k.gun = v_bugun;

        if v_ids is null then
            with bugun as (
                select i.id
                from public.itiraflar i
                where i.silindi_at is null
                  and i.created_at <= now()
                  and (i.created_at at time zone 'Europe/Istanbul')::date = v_bugun
                order by
                    (coalesce(i.up_votes, 0) - coalesce(i.down_votes, 0)) desc,
                    coalesce(i.up_votes, 0) desc,
                    i.created_at asc
                limit 5
            )
            select coalesce(array_agg(id), '{}')
            into v_ids
            from bugun;

            if coalesce(array_length(v_ids, 1), 0) > 0 then
                insert into public.index_bugun5_kilit (gun, hikaye_ids)
                values (v_bugun, v_ids)
                on conflict (gun) do nothing;

                select k.hikaye_ids
                into v_ids
                from public.index_bugun5_kilit k
                where k.gun = v_bugun;
            end if;
        end if;

        if coalesce(array_length(v_ids, 1), 0) = 0 then
            return '[]'::jsonb;
        end if;

        select coalesce(jsonb_agg(
            jsonb_build_object(
                'id', i.id,
                'baslik', i.baslik,
                'username', i.username,
                'age', i.age,
                'gender', i.gender,
                'city', i.city,
                'yasadigi_yer', i.yasadigi_yer,
                'content_short', i.content_short,
                'content_full', i.content_full,
                'up_votes', i.up_votes,
                'down_votes', i.down_votes,
                'created_at', i.created_at
            )
            order by array_position(v_ids, i.id)
        ), '[]'::jsonb)
        into v_rows
        from public.itiraflar i
        where i.id = any(v_ids)
          and i.silindi_at is null;

        return coalesce(v_rows, '[]'::jsonb);
    end if;

    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id', t.id,
            'baslik', t.baslik,
            'username', t.username,
            'age', t.age,
            'gender', t.gender,
            'city', t.city,
            'yasadigi_yer', t.yasadigi_yer,
            'content_short', t.content_short,
            'content_full', t.content_full,
            'up_votes', t.up_votes,
            'down_votes', t.down_votes,
            'created_at', t.created_at
        )
        order by md5(t.id::text || v_bugun::text || v_epoch::text)
    ), '[]'::jsonb)
    into v_rows
    from (
        select i.*
        from public.itiraflar i
        where i.silindi_at is null
          and i.created_at <= now()
          and (i.created_at at time zone 'Europe/Istanbul')::date = v_bugun
        order by i.created_at asc
        limit 5
    ) t;

    return coalesce(v_rows, '[]'::jsonb);
end;
$$;

revoke all on function public.index_bugunun5_getir() from public;
grant execute on function public.index_bugunun5_getir() to anon, authenticated;

notify pgrst, 'reload schema';
