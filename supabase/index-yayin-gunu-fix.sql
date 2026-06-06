-- Aktif baskı: yeni hikâye yayınlanana kadar önceki 5 görünür (saat sınırı yok).
-- Supabase SQL Editor'da bir kez Run.

create or replace function public.gunde5_aktif_baski_gunu(p_ts timestamptz default now())
returns date
language sql
stable
set search_path = public
as $$
    with takvim as (
        select (p_ts at time zone 'Europe/Istanbul')::date as gun
    )
    select case
        when exists (
            select 1
            from public.itiraflar i, takvim t
            where i.silindi_at is null
              and i.created_at <= p_ts
              and (i.created_at at time zone 'Europe/Istanbul')::date = t.gun
        ) then (select gun from takvim)
        else (
            select max((i.created_at at time zone 'Europe/Istanbul')::date)
            from public.itiraflar i
            where i.silindi_at is null
              and i.created_at <= p_ts
        )
    end;
$$;

create or replace function public.gunde5_onceki_baski_gunu(
    p_aktif date,
    p_ts timestamptz default now()
)
returns date
language sql
stable
set search_path = public
as $$
    select max((i.created_at at time zone 'Europe/Istanbul')::date)
    from public.itiraflar i
    where i.silindi_at is null
      and i.created_at <= p_ts
      and (i.created_at at time zone 'Europe/Istanbul')::date < p_aktif;
$$;

create or replace function public.index_bugunun5_getir()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_bugun date;
    v_ids bigint[];
    v_rows jsonb;
begin
    v_bugun := public.gunde5_aktif_baski_gunu();

    select s.hikaye_ids
    into v_ids
    from public.index_bugun5_sira s
    where s.gun = v_bugun;

    if coalesce(array_length(v_ids, 1), 0) > 0 then
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
          and i.silindi_at is null
          and i.created_at <= now()
          and (i.created_at at time zone 'Europe/Istanbul')::date = v_bugun;

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
        order by t.created_at asc
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

create or replace function public.index_dunun5_getir()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_aktif date;
    v_dun date;
    v_rows jsonb;
begin
    v_aktif := public.gunde5_aktif_baski_gunu();
    v_dun := public.gunde5_onceki_baski_gunu(v_aktif);

    if v_dun is null then
        return '[]'::jsonb;
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
        order by t.created_at asc
    ), '[]'::jsonb)
    into v_rows
    from (
        select i.*
        from public.itiraflar i
        where i.silindi_at is null
          and i.created_at <= now()
          and (i.created_at at time zone 'Europe/Istanbul')::date = v_dun
        order by i.created_at asc
        limit 5
    ) t;

    return coalesce(v_rows, '[]'::jsonb);
end;
$$;

create or replace function public.master_bugun5_sira_kaydet(p_hikaye_ids bigint[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_bugun date;
    v_beklenen bigint[];
    v_gelen bigint[];
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_bugun := public.gunde5_aktif_baski_gunu();
    v_gelen := coalesce(p_hikaye_ids, '{}');

    select coalesce(array_agg(i.id order by i.created_at asc), '{}')
    into v_beklenen
    from public.itiraflar i
    where i.silindi_at is null
      and i.created_at <= now()
      and (i.created_at at time zone 'Europe/Istanbul')::date = v_bugun;

    if coalesce(array_length(v_beklenen, 1), 0) = 0 then
        return jsonb_build_object('ok', false, 'hata', 'Bugün yayınlanan hikâye yok.');
    end if;

    if coalesce(array_length(v_gelen, 1), 0) <> coalesce(array_length(v_beklenen, 1), 0)
       or not (v_gelen @> v_beklenen and v_beklenen @> v_gelen) then
        return jsonb_build_object('ok', false, 'hata', 'Sıra bugünün tüm hikâyelerini içermeli.');
    end if;

    insert into public.index_bugun5_sira (gun, hikaye_ids, updated_at)
    values (v_bugun, v_gelen, now())
    on conflict (gun) do update
        set hikaye_ids = excluded.hikaye_ids,
            updated_at = excluded.updated_at;

    return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.master_bugun5_sira_sifirla()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_bugun date;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_bugun := public.gunde5_aktif_baski_gunu();
    delete from public.index_bugun5_sira where gun = v_bugun;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.index_bugunun5_getir() from public;
grant execute on function public.index_bugunun5_getir() to anon, authenticated;

revoke all on function public.index_dunun5_getir() from public;
grant execute on function public.index_dunun5_getir() to anon, authenticated;

revoke all on function public.gunde5_aktif_baski_gunu(timestamptz) from public;
grant execute on function public.gunde5_aktif_baski_gunu(timestamptz) to anon, authenticated;

revoke all on function public.gunde5_onceki_baski_gunu(date, timestamptz) from public;
grant execute on function public.gunde5_onceki_baski_gunu(date, timestamptz) to anon, authenticated;

notify pgrst, 'reload schema';
