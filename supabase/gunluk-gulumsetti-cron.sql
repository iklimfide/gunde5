-- Günlük yapay gülümsetti: bugünün 5'i +5–10 (yayın günü bir kez), dünün 5'i +10–50 (her gün).
-- Supabase SQL Editor'da bir kez Run. pg_cron: her sabah 09:30 Europe/Istanbul (06:30 UTC).

create extension if not exists pg_cron;

create table if not exists public.gunde5_gulumsetti_boost_log (
    tur text not null check (tur in ('bugun', 'dun')),
    hikaye_id bigint not null,
    calistirma_gunu date not null,
    hedef_gun date not null,
    eklenen int not null check (eklenen > 0),
    created_at timestamptz not null default now(),
    primary key (tur, hikaye_id, calistirma_gunu)
);

alter table public.gunde5_gulumsetti_boost_log enable row level security;
revoke all on public.gunde5_gulumsetti_boost_log from public, anon, authenticated;

create or replace function public.gunde5_baski_gun5_ids(p_gun date)
returns bigint[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_ids bigint[];
    v_result bigint[];
begin
    if p_gun is null then
        return '{}';
    end if;

    select s.hikaye_ids
    into v_ids
    from public.index_bugun5_sira s
    where s.gun = p_gun;

    if coalesce(array_length(v_ids, 1), 0) > 0 then
        select coalesce(array_agg(i.id order by array_position(v_ids, i.id)), '{}')
        into v_result
        from public.itiraflar i
        where i.id = any(v_ids)
          and i.silindi_at is null
          and i.created_at <= now()
          and (i.created_at at time zone 'Europe/Istanbul')::date = p_gun;
        return coalesce(v_result, '{}');
    end if;

    select coalesce(array_agg(t.id order by t.sira), '{}')
    into v_result
    from (
        select i.id, row_number() over (order by i.created_at asc) as sira
        from public.itiraflar i
        where i.silindi_at is null
          and i.created_at <= now()
          and (i.created_at at time zone 'Europe/Istanbul')::date = p_gun
        order by i.created_at asc
        limit 5
    ) t;

    return coalesce(v_result, '{}');
end;
$$;

create or replace function public.gunde5_puan_guncelle_guvenli(p_hikaye_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_hikaye_id is null then
        return;
    end if;
    if to_regprocedure('public.itiraf_puan_guncelle(bigint)') is not null then
        perform public.itiraf_puan_guncelle(p_hikaye_id);
    elsif to_regprocedure('public.hikaye_puan_guncelle(bigint)') is not null then
        perform public.hikaye_puan_guncelle(p_hikaye_id);
    end if;
end;
$$;

create or replace function public.gunde5_gulumsetti_tur_uygula(
    p_tur text,
    p_hedef_gun date,
    p_calistirma_gunu date,
    p_min int,
    p_max int
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id bigint;
    v_ek int;
    v_adet int := 0;
begin
    if p_hedef_gun is null or p_calistirma_gunu is null then
        return 0;
    end if;
    if p_min is null or p_max is null or p_max < p_min then
        return 0;
    end if;

    foreach v_id in array public.gunde5_baski_gun5_ids(p_hedef_gun)
    loop
        if exists (
            select 1
            from public.gunde5_gulumsetti_boost_log l
            where l.tur = p_tur
              and l.hikaye_id = v_id
              and l.calistirma_gunu = p_calistirma_gunu
        ) then
            continue;
        end if;

        v_ek := p_min + floor(random() * (p_max - p_min + 1))::int;

        update public.itiraflar i
        set up_votes = coalesce(i.up_votes, 0) + v_ek
        where i.id = v_id
          and i.silindi_at is null;

        if not found then
            continue;
        end if;

        insert into public.gunde5_gulumsetti_boost_log (
            tur, hikaye_id, calistirma_gunu, hedef_gun, eklenen
        ) values (
            p_tur, v_id, p_calistirma_gunu, p_hedef_gun, v_ek
        );

        perform public.gunde5_puan_guncelle_guvenli(v_id);
        v_adet := v_adet + 1;
    end loop;

    return v_adet;
end;
$$;

create or replace function public.gunde5_gunluk_gulumsetti_uygula()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_takvim date;
    v_aktif date;
    v_dun date;
    v_bugun_adet int := 0;
    v_dun_adet int := 0;
begin
    perform set_config('gunde5.master_bypass', '1', true);

    v_takvim := (now() at time zone 'Europe/Istanbul')::date;
    v_aktif := public.gunde5_aktif_baski_gunu();
    v_dun := public.gunde5_onceki_baski_gunu(v_aktif);

    -- Yeni günün 5'i yayına girdiyse (aktif baskı = bugün): +5–10, o gün bir kez.
    if v_aktif is not null and v_aktif = v_takvim then
        v_bugun_adet := public.gunde5_gulumsetti_tur_uygula(
            'bugun', v_aktif, v_aktif, 5, 10
        );
    end if;

    -- Dünün 5'i: her gün +10–50.
    if v_dun is not null then
        v_dun_adet := public.gunde5_gulumsetti_tur_uygula(
            'dun', v_dun, v_takvim, 10, 50
        );
    end if;

    return jsonb_build_object(
        'ok', true,
        'takvim', v_takvim,
        'aktif_baski', v_aktif,
        'dun_baski', v_dun,
        'bugun_guncellenen', v_bugun_adet,
        'dun_guncellenen', v_dun_adet
    );
end;
$$;

revoke all on function public.gunde5_baski_gun5_ids(date) from public, anon, authenticated;
revoke all on function public.gunde5_puan_guncelle_guvenli(bigint) from public, anon, authenticated;
revoke all on function public.gunde5_gulumsetti_tur_uygula(text, date, date, int, int) from public, anon, authenticated;
revoke all on function public.gunde5_gunluk_gulumsetti_uygula() from public, anon, authenticated;
grant execute on function public.gunde5_gunluk_gulumsetti_uygula() to service_role;

do $$
begin
    perform cron.unschedule('gunde5_gunluk_gulumsetti_tr');
exception
    when others then null;
end;
$$;

do $$
declare
    v_jobid bigint;
begin
    select jobid into v_jobid
    from cron.job
    where jobname = 'gunde5_gunluk_gulumsetti_tr'
    limit 1;
    if v_jobid is not null then
        perform cron.unschedule(v_jobid);
    end if;
exception
    when undefined_table then null;
    when others then null;
end;
$$;

select cron.schedule(
    'gunde5_gunluk_gulumsetti_tr',
    '30 6 * * *',
    $$select public.gunde5_gunluk_gulumsetti_uygula()$$
);

notify pgrst, 'reload schema';
