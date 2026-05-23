-- Master üye yönetimi: listele, detay, profil güncelle, hesap sil
-- Supabase SQL Editor'da çalıştırın (master-admin.sql sonrası).
-- auth.users için: önce veya birlikte security-advisor-definer-fix-2.sql (private şema).

-- ---------------------------------------------------------------------------
-- Üye JSON (liste / detay)
-- ---------------------------------------------------------------------------
create or replace function public.master_uye_json(p_u public.uye)
returns jsonb
language sql
stable
set search_path = public
as $$
    select jsonb_build_object(
        'id', p_u.id,
        'username', p_u.username,
        'email', p_u.email,
        'gender', p_u.gender,
        'dogum_yili', p_u.dogum_yili,
        'avatar_url', p_u.avatar_url,
        'yasadigi_yer', p_u.yasadigi_yer,
        'yurtdisi_sehir', p_u.yurtdisi_sehir,
        'meslek', p_u.meslek,
        'medeni_durum', p_u.medeni_durum,
        'durum', coalesce(p_u.durum, 'aktif'),
        'durum_notu', p_u.durum_notu,
        'zorunlu_gizli', coalesce(p_u.zorunlu_gizli, false),
        'created_at', p_u.created_at,
        'istatistik', jsonb_build_object(
            'hikaye', (
                select count(*)::int from public.itiraflar i
                where i.user_id = p_u.id and i.silindi_at is null
            ),
            'kulis', (
                select count(*)::int from public.itiraflar i
                where i.user_id = p_u.id and i.status = 'kulis' and i.silindi_at is null
            ),
            'podyum', (
                select count(*)::int from public.itiraflar i
                where i.user_id = p_u.id and i.status = 'podyum' and i.silindi_at is null
            )
        )
    );
$$;

-- ---------------------------------------------------------------------------
-- Liste: { q?, limit?, offset?, durum? }
-- ---------------------------------------------------------------------------
create or replace function public.master_uye_listele(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_q text;
    v_lim int;
    v_off int;
    v_durum text;
    v_toplam bigint;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_q := lower(trim(coalesce(p_body->>'q', '')));
    v_lim := least(greatest(coalesce((p_body->>'limit')::int, 40), 1), 100);
    v_off := greatest(coalesce((p_body->>'offset')::int, 0), 0);
    v_durum := lower(trim(coalesce(p_body->>'durum', '')));

    if length(v_q) > 0 and length(v_q) < 2 then
        return jsonb_build_object('ok', false, 'hata', 'en az 2 karakter');
    end if;

    select count(*) into v_toplam
    from public.uye u
    where (v_q = '' or lower(u.username) like '%' || v_q || '%' or lower(u.email) like '%' || v_q || '%')
      and (v_durum = '' or coalesce(u.durum, 'aktif') = v_durum);

    return jsonb_build_object(
        'ok', true,
        'toplam', v_toplam,
        'limit', v_lim,
        'offset', v_off,
        'uyeler', coalesce((
            select jsonb_agg(public.master_uye_json(u) order by u.created_at desc)
            from (
                select u.*
                from public.uye u
                where (v_q = '' or lower(u.username) like '%' || v_q || '%' or lower(u.email) like '%' || v_q || '%')
                  and (v_durum = '' or coalesce(u.durum, 'aktif') = v_durum)
                order by u.created_at desc
                limit v_lim offset v_off
            ) u
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.master_uye_listele(jsonb) from public, anon;
grant execute on function public.master_uye_listele(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Detay: { uye_id }
-- ---------------------------------------------------------------------------
create or replace function public.master_uye_detay(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_uid uuid;
    v_row public.uye%rowtype;
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

    return jsonb_build_object('ok', true, 'uye', public.master_uye_json(v_row));
end;
$$;

revoke all on function public.master_uye_detay(jsonb) from public, anon;
grant execute on function public.master_uye_detay(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Profil güncelle (auth.users e-posta dahil)
-- p_body: { uye_id, username?, email?, gender?, dogum_yili?, yasadigi_yer?,
--           yurtdisi_sehir?, meslek?, medeni_durum?, avatar_url?, durum_notu? }
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

    update public.itiraflar i
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
-- master_uye_islem: sil eklendi
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
        update public.itiraflar set silindi_at = now()
        where user_id = v_uid and silindi_at is null;
        perform private.gunde5_master_auth_user_sil(v_uid);
        return jsonb_build_object('ok', true, 'silindi', true);
    end if;

    if v_islem = 'gizli_uye' then
        update public.uye set zorunlu_gizli = true where id = v_uid;
        update public.itiraflar
        set is_gizli = true, username = 'Gizli Üye'
        where user_id = v_uid and silindi_at is null;
    elsif v_islem = 'gizli_kaldir' then
        update public.uye set zorunlu_gizli = false where id = v_uid;
        update public.itiraflar i
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

-- Master: herhangi bir üyenin avatar klasörüne yükleme / silme
drop policy if exists avatars_master_manage on storage.objects;
create policy avatars_master_manage on storage.objects
    for all to authenticated
    using (
        bucket_id = 'avatars'
        and public.master_email_eslesir()
    )
    with check (
        bucket_id = 'avatars'
        and public.master_email_eslesir()
    );

notify pgrst, 'reload schema';
