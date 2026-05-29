-- Security Advisor — 0028/0029 uyarıları (14 satır)
-- SQL Editor'da bu dosyanın TAMAMINI bir kez çalıştırın → Dashboard → Security Advisor → Rerun.
--
-- Public RPC: SECURITY INVOKER + RLS (anon oy, ziyaret, kart profili, profil kaydet).
-- Dahili puan/trigger fonksiyonları: DEFINER kalabilir; anon/authenticated EXECUTE kaldırılır.
-- master_kamikaze_* / master_oy_islem: INVOKER (master_email_eslesir + mevcut RLS).
--
-- Önce security-advisor-definer-fix.sql çalıştırılmış olmalı (master_email_eslesir).

-- ---------------------------------------------------------------------------
-- private yardımcılar (PostgREST dışı — linter RPC listesine girmez)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to postgres, service_role, anon, authenticated;

create or replace function private.gunde5_ziyaret_atlandi_mi(p_key text, p_yol text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1
        from public.site_ziyaretler z
        where z.oturum_key = p_key
          and z.yol = p_yol
          and z.created_at > now() - interval '5 minutes'
    );
$$;

revoke all on function private.gunde5_ziyaret_atlandi_mi(text, text) from public;
grant execute on function private.gunde5_ziyaret_atlandi_mi(text, text) to anon, authenticated;

create or replace function private.gunde5_profil_uye_ensure(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_email text;
    v_meta jsonb;
    v_rumuz text;
    v_gender text;
    v_yil int;
begin
    if p_uid is null then
        return;
    end if;

    if exists (select 1 from public.uye u where u.id = p_uid) then
        return;
    end if;

    select
        lower(coalesce(u.email, '')),
        coalesce(u.raw_user_meta_data, '{}'::jsonb)
    into v_email, v_meta
    from auth.users u
    where u.id = p_uid;

    if v_email is null or v_email = '' then
        return;
    end if;

    v_rumuz := trim(coalesce(v_meta->>'username', ''));
    if length(v_rumuz) < 5 then
        v_rumuz := 'uye_' || left(replace(p_uid::text, '-', ''), 8);
    end if;

    v_gender := case
        when v_meta->>'gender' in ('male', 'female') then v_meta->>'gender'
        else 'female'
    end;

    v_yil := coalesce(
        nullif(v_meta->>'dogum_yili', '')::int,
        extract(year from now())::int - 18
    );

    insert into public.uye (id, username, email, gender, dogum_yili)
    values (p_uid, left(v_rumuz, 15), v_email, v_gender, v_yil)
    on conflict (id) do nothing;
end;
$$;

revoke all on function private.gunde5_profil_uye_ensure(uuid) from public;
grant execute on function private.gunde5_profil_uye_ensure(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- site_ziyaretler + ziyaret_kaydet (INVOKER)
-- ---------------------------------------------------------------------------
grant insert on public.site_ziyaretler to anon, authenticated;

drop policy if exists site_ziyaretler_insert_ziyaret on public.site_ziyaretler;
create policy site_ziyaretler_insert_ziyaret on public.site_ziyaretler
    for insert to anon, authenticated
    with check (
        length(trim(oturum_key)) >= 8
        and length(trim(sayfa)) > 0
        and length(trim(yol)) > 0
    );

create or replace function public.ziyaret_kaydet(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_key text;
    v_sayfa text;
    v_yol text;
    v_ref text;
    v_uid uuid;
begin
    v_key := left(trim(coalesce(p_body->>'oturum_key', '')), 128);
    if length(v_key) < 8 then
        return jsonb_build_object('ok', false, 'hata', 'oturum_key gerekli');
    end if;

    v_sayfa := left(trim(coalesce(p_body->>'sayfa', '')), 40);
    v_yol := left(trim(coalesce(p_body->>'yol', '')), 500);
    if v_sayfa = '' or v_yol = '' then
        return jsonb_build_object('ok', false, 'hata', 'sayfa ve yol gerekli');
    end if;

    v_ref := nullif(left(trim(coalesce(p_body->>'referrer', '')), 500), '');

    if private.gunde5_ziyaret_atlandi_mi(v_key, v_yol) then
        return jsonb_build_object('ok', true, 'atlandi', true);
    end if;

    v_uid := auth.uid();

    insert into public.site_ziyaretler (
        oturum_key, user_id, sayfa, yol, referrer,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        cihaz, dil
    ) values (
        v_key, v_uid, v_sayfa, v_yol, v_ref,
        nullif(left(trim(coalesce(p_body->>'utm_source', '')), 120), ''),
        nullif(left(trim(coalesce(p_body->>'utm_medium', '')), 120), ''),
        nullif(left(trim(coalesce(p_body->>'utm_campaign', '')), 120), ''),
        nullif(left(trim(coalesce(p_body->>'utm_term', '')), 120), ''),
        nullif(left(trim(coalesce(p_body->>'utm_content', '')), 120), ''),
        nullif(left(trim(coalesce(p_body->>'cihaz', '')), 16), ''),
        nullif(left(trim(coalesce(p_body->>'dil', '')), 16), '')
    );

    if v_uid is not null then
        update public.uye
        set son_aktif_at = now()
        where id = v_uid;
    end if;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.ziyaret_kaydet(jsonb) from public;
grant execute on function public.ziyaret_kaydet(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Oy tablosu RLS (itiraf_oylar veya hikaye_oylar)
-- ---------------------------------------------------------------------------
do $oy$
begin
    if to_regclass('public.itiraf_oylar') is not null then
        grant insert on public.itiraf_oylar to anon, authenticated;

        execute $p$
            drop policy if exists itiraf_oylar_insert_uye on public.itiraf_oylar;
            create policy itiraf_oylar_insert_uye on public.itiraf_oylar
                for insert to authenticated
                with check (
                    user_id = (select auth.uid())
                    and viewer_key is null
                    and oy in (1, -1)
                    and exists (
                        select 1 from public.itiraflar i
                        where i.id = itiraf_id and i.silindi_at is null
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
                        where i.id = itiraf_id and i.silindi_at is null
                    )
                );
        $p$;
    end if;

    if to_regclass('public.hikaye_oylar') is not null then
        grant insert on public.hikaye_oylar to anon, authenticated;

        execute $p$
            drop policy if exists hikaye_oylar_insert_uye on public.hikaye_oylar;
            create policy hikaye_oylar_insert_uye on public.hikaye_oylar
                for insert to authenticated
                with check (
                    user_id = (select auth.uid())
                    and coalesce(viewer_key, '') = ''
                    and oy in (1, -1)
                    and exists (
                        select 1 from public.hikayeler i
                        where i.id = hikaye_id and i.silindi_at is null
                    )
                );

            drop policy if exists hikaye_oylar_insert_anon on public.hikaye_oylar;
            create policy hikaye_oylar_insert_anon on public.hikaye_oylar
                for insert to anon
                with check (
                    user_id is null
                    and viewer_key is not null
                    and char_length(viewer_key) >= 8
                    and oy in (1, -1)
                    and exists (
                        select 1 from public.hikayeler i
                        where i.id = hikaye_id and i.silindi_at is null
                    )
                );
        $p$;
    end if;
end;
$oy$;

-- ---------------------------------------------------------------------------
-- itiraf_oy_ver + oy_ver (INVOKER)
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
begin
    if p_itiraf_id is null then
        return null;
    end if;

    v_oy := case when p_oy = 1 then 1 else -1 end;

    if to_regclass('public.itiraflar') is not null then
        if not exists (select 1 from public.itiraflar i where i.id = p_itiraf_id) then
            raise exception 'itiraf bulunamadi' using errcode = 'P0002';
        end if;
    elsif to_regclass('public.hikayeler') is not null then
        if not exists (select 1 from public.hikayeler i where i.id = p_itiraf_id) then
            raise exception 'itiraf bulunamadi' using errcode = 'P0002';
        end if;
    else
        raise exception 'itiraf bulunamadi' using errcode = 'P0002';
    end if;

    v_uid := auth.uid();

    if v_uid is not null and to_regclass('public.itiraf_oylar') is not null then
        if exists (
            select 1 from public.itiraf_oylar o
            where o.itiraf_id = p_itiraf_id and o.user_id = v_uid
        ) then
            raise exception 'zaten_oyladin' using errcode = 'P0001';
        end if;
        insert into public.itiraf_oylar (itiraf_id, user_id, oy)
        values (p_itiraf_id, v_uid, v_oy);
    elsif v_uid is not null and to_regclass('public.hikaye_oylar') is not null then
        if exists (
            select 1 from public.hikaye_oylar o
            where o.hikaye_id = p_itiraf_id and o.user_id = v_uid
        ) then
            raise exception 'zaten_oyladin' using errcode = 'P0001';
        end if;
        insert into public.hikaye_oylar (hikaye_id, user_id, oy)
        values (p_itiraf_id, v_uid, v_oy);
    else
        v_key := left(trim(coalesce(p_viewer_key, '')), 128);
        if char_length(v_key) < 8 then
            raise exception 'gecersiz izleyici' using errcode = 'P0001';
        end if;

        if to_regclass('public.itiraf_oylar') is not null then
            if exists (
                select 1 from public.itiraf_oylar o
                where o.itiraf_id = p_itiraf_id and o.viewer_key = v_key
            ) then
                raise exception 'zaten_oyladin' using errcode = 'P0001';
            end if;
            insert into public.itiraf_oylar (itiraf_id, viewer_key, oy)
            values (p_itiraf_id, v_key, v_oy);
        else
            if exists (
                select 1 from public.hikaye_oylar o
                where o.hikaye_id = p_itiraf_id and o.viewer_key = v_key
            ) then
                raise exception 'zaten_oyladin' using errcode = 'P0001';
            end if;
            insert into public.hikaye_oylar (hikaye_id, viewer_key, oy)
            values (p_itiraf_id, v_key, v_oy);
        end if;
    end if;

    if to_regclass('public.itiraflar') is not null then
        return (
            select json_build_object(
                'up_votes', coalesce(i.up_votes, 0),
                'down_votes', coalesce(i.down_votes, 0),
                'oy', v_oy
            )
            from public.itiraflar i
            where i.id = p_itiraf_id
        );
    end if;

    return (
        select json_build_object(
            'up_votes', coalesce(i.up_votes, 0),
            'down_votes', coalesce(i.down_votes, 0),
            'oy', v_oy
        )
        from public.hikayeler i
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
-- uye_kart_profilleri (INVOKER + dar RLS)
-- ---------------------------------------------------------------------------
revoke all on public.uye from anon;

drop policy if exists uye_select_kart_rpc on public.uye;

do $kart$
declare
    v_using text := 'false';
begin
    if to_regclass('public.itiraflar') is not null then
        v_using := v_using || ' or exists (
            select 1 from public.itiraflar i
            where i.user_id = uye.id
              and coalesce(i.is_gizli, false) = false
              and i.silindi_at is null
        )';
    end if;

    if to_regclass('public.hikayeler') is not null then
        v_using := v_using || ' or exists (
            select 1 from public.hikayeler i
            where i.user_id = uye.id
              and coalesce(i.is_gizli, false) = false
              and i.silindi_at is null
        )';
    end if;

    if to_regclass('public.hikaye_cevaplar') is not null and to_regclass('public.hikayeler') is not null then
        v_using := v_using || ' or exists (
            select 1
            from public.hikaye_cevaplar c
            inner join public.hikayeler i on i.id = c.hikaye_id
            where c.user_id = uye.id
              and coalesce(i.is_gizli, false) = false
              and i.silindi_at is null
        )';
    end if;

    if to_regclass('public.itiraf_cevaplar') is not null and to_regclass('public.itiraflar') is not null then
        v_using := v_using || ' or exists (
            select 1
            from public.itiraf_cevaplar c
            inner join public.itiraflar i on i.id = c.itiraf_id
            where c.user_id = uye.id
              and coalesce(i.is_gizli, false) = false
              and i.silindi_at is null
        )';
    end if;

    execute format(
        'create policy uye_select_kart_rpc on public.uye
         for select to anon, authenticated
         using (%s)',
        v_using
    );
end;
$kart$;

create or replace function public.uye_kart_profilleri(p_ids uuid[])
returns table (
    id uuid,
    username varchar(50),
    gender varchar(6),
    age int,
    avatar_url text,
    yasadigi_yer varchar(40),
    yurtdisi_sehir varchar(80),
    meslek varchar(40),
    medeni_durum varchar(40)
)
language sql
security invoker
stable
set search_path = public
as $$
    select
        u.id,
        u.username,
        u.gender,
        case
            when u.dogum_yili is null then null
            else greatest(extract(year from current_date)::int - u.dogum_yili, 0)
        end as age,
        u.avatar_url,
        u.yasadigi_yer,
        u.yurtdisi_sehir,
        u.meslek,
        u.medeni_durum
    from public.uye u
    where u.id = any(coalesce(p_ids, '{}'::uuid[]));
$$;

revoke all on function public.uye_kart_profilleri(uuid[]) from public;
grant execute on function public.uye_kart_profilleri(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- profil_uye_guncelle (INVOKER)
-- ---------------------------------------------------------------------------
grant update on public.uye to authenticated;

drop policy if exists uye_update_own on public.uye;
create policy uye_update_own on public.uye
    for update to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

create or replace function public.profil_uye_guncelle(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_uid uuid;
    v_row public.uye%rowtype;
    v_yer text;
    v_yurtdisi text;
begin
    v_uid := auth.uid();
    if v_uid is null then
        return jsonb_build_object('ok', false, 'hata', 'oturum yok');
    end if;

    perform private.gunde5_profil_uye_ensure(v_uid);

    select * into v_row from public.uye where id = v_uid;
    if not found then
        return jsonb_build_object('ok', false, 'hata', 'uye satiri olusturulamadi');
    end if;

    if coalesce(v_row.durum, 'aktif') = 'ban' then
        return jsonb_build_object('ok', false, 'hata', 'hesap kapali');
    end if;

    if p_body is not null and p_body ? 'yasadigi_yer' then
        v_yer := nullif(trim(coalesce(p_body->>'yasadigi_yer', '')), '');
        update public.uye
        set yasadigi_yer = v_yer,
            yurtdisi_sehir = case when v_yer is distinct from 'yurtdisi' then null else yurtdisi_sehir end
        where id = v_uid;
    end if;

    if p_body is not null and p_body ? 'yurtdisi_sehir' then
        v_yurtdisi := nullif(left(trim(coalesce(p_body->>'yurtdisi_sehir', '')), 80), '');
        update public.uye set yurtdisi_sehir = v_yurtdisi where id = v_uid;
    end if;

    if p_body is not null and p_body ? 'meslek' then
        update public.uye
        set meslek = nullif(left(trim(coalesce(p_body->>'meslek', '')), 40), '')
        where id = v_uid;
    end if;

    if p_body is not null and p_body ? 'medeni_durum' then
        update public.uye
        set medeni_durum = nullif(left(trim(coalesce(p_body->>'medeni_durum', '')), 40), '')
        where id = v_uid;
    end if;

    if p_body is not null and p_body ? 'avatar_url' then
        update public.uye
        set avatar_url = nullif(trim(coalesce(p_body->>'avatar_url', '')), '')
        where id = v_uid;
    end if;

    select * into v_row from public.uye where id = v_uid;

    return jsonb_build_object(
        'ok', true,
        'uye', jsonb_build_object(
            'id', v_row.id,
            'username', v_row.username,
            'email', v_row.email,
            'gender', v_row.gender,
            'dogum_yili', v_row.dogum_yili,
            'avatar_url', v_row.avatar_url,
            'yasadigi_yer', v_row.yasadigi_yer,
            'yurtdisi_sehir', v_row.yurtdisi_sehir,
            'meslek', v_row.meslek,
            'medeni_durum', v_row.medeni_durum,
            'durum', coalesce(v_row.durum, 'aktif'),
            'durum_notu', v_row.durum_notu,
            'zorunlu_gizli', coalesce(v_row.zorunlu_gizli, false)
        )
    );
end;
$$;

revoke all on function public.profil_uye_guncelle(jsonb) from public, anon;
grant execute on function public.profil_uye_guncelle(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Puan fonksiyonları: REST ile çağrılmasın (trigger içi DEFINER kalır)
-- ---------------------------------------------------------------------------
do $puan$
declare
    r record;
begin
    for r in
        select p.oid::regprocedure as f
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('hikaye_puan_guncelle', 'itiraf_puan_guncelle')
    loop
        execute format('revoke all on function %s from public, anon, authenticated', r.f);
    end loop;
end;
$puan$;

-- (Eski master-kamikaze-panel.sql grant’i: yukarıdaki döngü hikaye_/itiraf_puan_guncelle ikisini de kapsar.)

-- ---------------------------------------------------------------------------
-- Kamikaze RPC: DEFINER → INVOKER (gövde aynı; master RLS ile)
-- ---------------------------------------------------------------------------
do $inv$
declare
    r record;
begin
    for r in
        select p.oid::regprocedure as f
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
              'master_kamikaze_panel',
              'master_kamikaze_ara',
              'master_kamikaze_hikaye_detay',
              'master_oy_islem'
          )
          and p.prosecdef
    loop
        execute format('alter function %s security invoker', r.f);
    end loop;
end;
$inv$;

-- ---------------------------------------------------------------------------
-- Trigger / dahili: EXECUTE kapat
-- ---------------------------------------------------------------------------
do $trg$
declare
    r record;
begin
    for r in
        select p.oid::regprocedure as f
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
              'hikaye_oy_sayaci',
              'itiraf_oy_sayaci',
              'hikaye_cevap_puan_sayaci',
              'itiraf_cevap_puan_sayaci',
              'hikaye_puan_guncelle',
              'itiraf_puan_guncelle',
              'trg_hikaye_oy_bildirim',
              'trg_itiraf_oy_bildirim',
              'trg_hikaye_cevap_bildirim',
              'handle_new_user',
              'handle_deleted_user_content'
          )
    loop
        execute format('revoke all on function %s from public, anon, authenticated', r.f);
    end loop;
end;
$trg$;

notify pgrst, 'reload schema';

-- Doğrulama:
-- select proname, prosecdef from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and proname in (
--   'itiraf_oy_ver','oy_ver','uye_kart_profilleri','ziyaret_kaydet',
--   'profil_uye_guncelle','master_kamikaze_panel','itiraf_puan_guncelle'
-- );
-- prosecdef = false → INVOKER; puan fonksiyonlarında proacl içinde authenticated olmamalı.
