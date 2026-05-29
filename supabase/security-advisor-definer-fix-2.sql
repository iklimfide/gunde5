-- Security Advisor — 4 WARN (ziyaret_kaydet, master_uye_guncelle, master_uye_islem)
-- SQL Editor'da bu dosyanın TAMAMINI bir kez çalıştırın. Dashboard → Security Advisor → Rerun.
--
-- Public RPC'ler SECURITY INVOKER; auth.users / dedup için private şema (PostgREST'te yok).
-- security-advisor-definer-fix.sql + master-uyeler-yonetim.sql sonrası.

do $$
begin
    if exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'hikaye_cevaplar'
    ) then
        alter table public.hikaye_cevaplar
            alter column user_id drop not null;

        alter table public.hikaye_cevaplar
            drop constraint if exists hikaye_cevaplar_user_id_fkey;

        alter table public.hikaye_cevaplar
            add constraint hikaye_cevaplar_user_id_fkey
            foreign key (user_id) references auth.users (id) on delete set null;
    end if;
end;
$$;

create or replace function public.handle_deleted_user_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.hikayeler
    set is_gizli = true,
        username = 'Gizli Üye'
    where user_id = old.id;

    if exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'hikaye_cevaplar'
    ) then
        update public.hikaye_cevaplar
        set username = 'Gizli Üye'
        where user_id = old.id;
    end if;

    return old;
end;
$$;

drop trigger if exists on_auth_user_deleted_content on auth.users;
create trigger on_auth_user_deleted_content
    before delete on auth.users
    for each row execute function public.handle_deleted_user_content();

revoke all on function public.handle_deleted_user_content() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- private: PostgREST dışı DEFINER yardımcılar (RPC linter uyarısı yok)
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

create or replace function private.gunde5_master_auth_email_guncelle(p_uid uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if not public.master_email_eslesir() then
        raise exception 'yetkisiz';
    end if;
    update auth.users
    set email = p_email,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
            || jsonb_build_object('email', p_email)
    where id = p_uid;
    if not found then
        raise exception 'auth kullanici bulunamadi';
    end if;
end;
$$;

revoke all on function private.gunde5_master_auth_email_guncelle(uuid, text) from public;
grant execute on function private.gunde5_master_auth_email_guncelle(uuid, text) to authenticated;

create or replace function private.gunde5_master_auth_user_sil(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if not public.master_email_eslesir() then
        raise exception 'yetkisiz';
    end if;
    delete from auth.users where id = p_uid;
end;
$$;

revoke all on function private.gunde5_master_auth_user_sil(uuid) from public;
grant execute on function private.gunde5_master_auth_user_sil(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- site_ziyaretler: INVOKER insert (doğrudan tablo REST yok; yalnızca RPC üzerinden)
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

-- ---------------------------------------------------------------------------
-- ziyaret_kaydet — SECURITY INVOKER
-- ---------------------------------------------------------------------------
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
    v_ip text;
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
    v_ip := public.request_client_ip();
    if v_ip is null then
        v_ip := nullif(left(trim(coalesce(p_body->>'ip_adresi', '')), 45), '');
    end if;

    if private.gunde5_ziyaret_atlandi_mi(v_key, v_yol) then
        return jsonb_build_object('ok', true, 'atlandi', true);
    end if;

    v_uid := auth.uid();

    insert into public.site_ziyaretler (
        oturum_key,
        user_id,
        sayfa,
        yol,
        referrer,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        cihaz,
        dil,
        ip_adresi
    ) values (
        v_key,
        v_uid,
        v_sayfa,
        v_yol,
        v_ref,
        nullif(left(trim(coalesce(p_body->>'utm_source', '')), 120), ''),
        nullif(left(trim(coalesce(p_body->>'utm_medium', '')), 120), ''),
        nullif(left(trim(coalesce(p_body->>'utm_campaign', '')), 120), ''),
        nullif(left(trim(coalesce(p_body->>'utm_term', '')), 120), ''),
        nullif(left(trim(coalesce(p_body->>'utm_content', '')), 120), ''),
        nullif(left(trim(coalesce(p_body->>'cihaz', '')), 16), ''),
        nullif(left(trim(coalesce(p_body->>'dil', '')), 16), ''),
        v_ip
    );

    if v_uid is not null then
        update public.uye
        set son_aktif_at = now(),
            son_ip = coalesce(v_ip, son_ip)
        where id = v_uid;
    end if;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.ziyaret_kaydet(jsonb) from public;
grant execute on function public.ziyaret_kaydet(jsonb) to anon, authenticated;

revoke all on function public.request_client_ip() from public, anon;
grant execute on function public.request_client_ip() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- master_uye_guncelle — SECURITY INVOKER (auth.users → private)
-- ---------------------------------------------------------------------------
create or replace function public.master_uye_guncelle(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_uid uuid;
    v_row public.uye%rowtype;
    v_rumuz text;
    v_email text;
    v_gender text;
    v_yil int;
    v_yas int;
    v_yer text;
    v_yurtdisi text;
    v_meslek text;
    v_medeni text;
    v_avatar text;
    v_not text;
    v_baska uuid;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_uid := (p_body->>'uye_id')::uuid;
    if v_uid is null then
        return jsonb_build_object('ok', false, 'hata', 'uye_id gerekli');
    end if;

    select * into v_row from public.uye where id = v_uid;
    if not found then
        return jsonb_build_object('ok', false, 'hata', 'uye bulunamadi');
    end if;

    perform set_config('gunde5.master_bypass', '1', true);

    if p_body ? 'username' then
        v_rumuz := trim(coalesce(p_body->>'username', ''));
        if length(v_rumuz) < 5 or length(v_rumuz) > 15 then
            return jsonb_build_object('ok', false, 'hata', 'rumuz 5-15 karakter');
        end if;
        select id into v_baska from public.uye where lower(username) = lower(v_rumuz) and id <> v_uid limit 1;
        if found then
            return jsonb_build_object('ok', false, 'hata', 'rumuz kullaniliyor');
        end if;
        update public.uye set username = v_rumuz where id = v_uid;
    end if;

    if p_body ? 'email' then
        v_email := lower(trim(coalesce(p_body->>'email', '')));
        if v_email = '' or position('@' in v_email) < 2 then
            return jsonb_build_object('ok', false, 'hata', 'gecersiz e-posta');
        end if;
        perform private.gunde5_master_auth_email_guncelle(v_uid, v_email);
        update public.uye set email = v_email where id = v_uid;
    end if;

    if p_body ? 'gender' then
        v_gender := lower(trim(coalesce(p_body->>'gender', '')));
        if v_gender not in ('male', 'female') then
            return jsonb_build_object('ok', false, 'hata', 'gecersiz cinsiyet');
        end if;
        update public.uye set gender = v_gender where id = v_uid;
    end if;

    if p_body ? 'dogum_yili' then
        v_yil := (p_body->>'dogum_yili')::int;
        v_yas := extract(year from now())::int - v_yil;
        if v_yas < 18 or v_yas > 120 then
            return jsonb_build_object('ok', false, 'hata', 'dogum yili gecersiz (18+)');
        end if;
        update public.uye set dogum_yili = v_yil where id = v_uid;
    end if;

    if p_body ? 'yasadigi_yer' then
        v_yer := nullif(trim(coalesce(p_body->>'yasadigi_yer', '')), '');
        update public.uye set yasadigi_yer = v_yer where id = v_uid;
        if v_yer is distinct from 'yurtdisi' then
            update public.uye set yurtdisi_sehir = null where id = v_uid;
        end if;
    end if;

    if p_body ? 'yurtdisi_sehir' then
        v_yurtdisi := nullif(left(trim(coalesce(p_body->>'yurtdisi_sehir', '')), 80), '');
        update public.uye set yurtdisi_sehir = v_yurtdisi where id = v_uid;
    end if;

    if p_body ? 'meslek' then
        v_meslek := nullif(left(trim(coalesce(p_body->>'meslek', '')), 40), '');
        update public.uye set meslek = v_meslek where id = v_uid;
    end if;

    if p_body ? 'medeni_durum' then
        v_medeni := nullif(left(trim(coalesce(p_body->>'medeni_durum', '')), 40), '');
        update public.uye set medeni_durum = v_medeni where id = v_uid;
    end if;

    if p_body ? 'avatar_url' then
        v_avatar := nullif(trim(coalesce(p_body->>'avatar_url', '')), '');
        update public.uye set avatar_url = v_avatar where id = v_uid;
    end if;

    if p_body ? 'durum_notu' then
        v_not := nullif(left(trim(coalesce(p_body->>'durum_notu', '')), 500), '');
        update public.uye set durum_notu = v_not where id = v_uid;
    end if;

    select * into v_row from public.uye where id = v_uid;
    v_yas := extract(year from now())::int - v_row.dogum_yili;

    update public.hikayeler i
    set
        username = case
            when i.is_gizli or coalesce(v_row.zorunlu_gizli, false) then i.username
            else v_row.username
        end,
        gender = v_row.gender,
        age = v_yas,
        yasadigi_yer = v_row.yasadigi_yer,
        yurtdisi_sehir = v_row.yurtdisi_sehir,
        meslek = v_row.meslek,
        medeni_durum = v_row.medeni_durum,
        avatar_url = v_row.avatar_url
    where i.user_id = v_uid and i.silindi_at is null;

    return jsonb_build_object('ok', true, 'uye', public.master_uye_json(v_row));
end;
$$;

revoke all on function public.master_uye_guncelle(jsonb) from public, anon;
grant execute on function public.master_uye_guncelle(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- master_uye_islem — SECURITY INVOKER (sil → private auth delete)
-- ---------------------------------------------------------------------------
create or replace function public.master_uye_islem(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_uid uuid;
    v_islem text;
    v_not text;
    v_row public.uye%rowtype;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_uid := (p_body->>'uye_id')::uuid;
    v_islem := lower(trim(coalesce(p_body->>'islem', '')));
    v_not := left(trim(coalesce(p_body->>'not', '')), 500);
    if v_uid is null or v_islem = '' then
        return jsonb_build_object('ok', false, 'hata', 'uye_id ve islem gerekli');
    end if;

    if v_islem not in ('aktif', 'askida', 'ban', 'gizli_uye', 'gizli_kaldir', 'sil') then
        return jsonb_build_object('ok', false, 'hata', 'gecersiz islem');
    end if;

    select * into v_row from public.uye where id = v_uid;
    if not found then
        return jsonb_build_object('ok', false, 'hata', 'uye bulunamadi');
    end if;

    perform set_config('gunde5.master_bypass', '1', true);

    if v_islem = 'sil' then
        perform private.gunde5_master_auth_user_sil(v_uid);
        return jsonb_build_object('ok', true, 'silindi', true);
    end if;

    if v_islem = 'gizli_uye' then
        update public.uye set zorunlu_gizli = true where id = v_uid;
        update public.hikayeler
        set is_gizli = true, username = 'Gizli Üye'
        where user_id = v_uid and silindi_at is null;
    elsif v_islem = 'gizli_kaldir' then
        update public.uye set zorunlu_gizli = false where id = v_uid;
        update public.hikayeler i
        set is_gizli = false,
            username = v_row.username
        where i.user_id = v_uid and silindi_at is null;
    else
        update public.uye
        set durum = v_islem,
            durum_notu = case when v_not = '' then durum_notu else v_not end
        where id = v_uid;
    end if;

    select * into v_row from public.uye where id = v_uid;
    return jsonb_build_object(
        'ok', true,
        'uye', jsonb_build_object(
            'id', v_row.id,
            'username', v_row.username,
            'email', v_row.email,
            'durum', coalesce(v_row.durum, 'aktif'),
            'zorunlu_gizli', coalesce(v_row.zorunlu_gizli, false)
        )
    );
end;
$$;

revoke all on function public.master_uye_islem(jsonb) from public, anon;
grant execute on function public.master_uye_islem(jsonb) to authenticated;

notify pgrst, 'reload schema';
