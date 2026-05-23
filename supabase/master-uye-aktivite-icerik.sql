-- Üye son aktivite, IP, hikaye/yorum listesi ve master cevap düzenleme
-- master-admin.sql + master-uyeler-yonetim.sql + ziyaret-trafik.sql sonrası çalıştırın.

-- ---------------------------------------------------------------------------
-- Üye: son aktivite / IP (ziyaret_kaydet ile güncellenir)
-- ---------------------------------------------------------------------------
alter table public.uye
    add column if not exists son_aktif_at timestamptz,
    add column if not exists son_ip varchar(45);

alter table public.site_ziyaretler
    add column if not exists ip_adresi varchar(45);

create index if not exists site_ziyaretler_user_created_idx
    on public.site_ziyaretler (user_id, created_at desc)
    where user_id is not null;

-- Geriye dönük: son ziyaretten doldur
update public.uye u
set
    son_aktif_at = coalesce(u.son_aktif_at, z.son_z),
    son_ip = coalesce(u.son_ip, z.son_ip)
from (
    select
        z.user_id,
        max(z.created_at) as son_z,
        (
            select z2.ip_adresi
            from public.site_ziyaretler z2
            where z2.user_id = z.user_id
            order by z2.created_at desc
            limit 1
        ) as son_ip
    from public.site_ziyaretler z
    where z.user_id is not null
    group by z.user_id
) z
where u.id = z.user_id;

-- ---------------------------------------------------------------------------
-- İstek IP (Supabase proxy başlıkları; yoksa istemci gönderir)
-- ---------------------------------------------------------------------------
create or replace function public.request_client_ip()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
    v_hdr jsonb;
    v_ip text;
begin
    begin
        v_hdr := current_setting('request.headers', true)::jsonb;
    exception when others then
        return null;
    end;
    if v_hdr is null then
        return null;
    end if;
    v_ip := coalesce(
        nullif(trim(split_part(coalesce(v_hdr->>'x-forwarded-for', ''), ',', 1)), ''),
        nullif(trim(coalesce(v_hdr->>'x-real-ip', '')), ''),
        nullif(trim(coalesce(v_hdr->>'cf-connecting-ip', '')), '')
    );
    return nullif(left(v_ip, 45), '');
end;
$$;

revoke all on function public.request_client_ip() from public, anon;
grant execute on function public.request_client_ip() to authenticated;

-- ---------------------------------------------------------------------------
-- ziyaret_kaydet: IP + üye son_aktif_at
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

-- ---------------------------------------------------------------------------
-- master_uye_json: aktivite alanları
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
        'aktivite', jsonb_build_object(
            'son_aktif_at', coalesce(
                p_u.son_aktif_at,
                (select max(z.created_at) from public.site_ziyaretler z where z.user_id = p_u.id)
            ),
            'son_ip', coalesce(
                p_u.son_ip,
                (
                    select z.ip_adresi
                    from public.site_ziyaretler z
                    where z.user_id = p_u.id and z.ip_adresi is not null
                    order by z.created_at desc
                    limit 1
                )
            ),
            'son_sayfa', (
                select z.sayfa from public.site_ziyaretler z
                where z.user_id = p_u.id
                order by z.created_at desc
                limit 1
            ),
            'son_yol', (
                select z.yol from public.site_ziyaretler z
                where z.user_id = p_u.id
                order by z.created_at desc
                limit 1
            ),
            'ziyaret_sayisi', (
                select count(*)::int from public.site_ziyaretler z where z.user_id = p_u.id
            )
        ),
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
            ),
            'yorum', (
                select count(*)::int from public.itiraf_cevaplar c
                where c.user_id = p_u.id
            )
        )
    );
$$;

-- ---------------------------------------------------------------------------
-- Üye hikayeleri + yorumları (master düzenleme paneli)
-- p_body: { uye_id, hikaye_limit?, yorum_limit? }
-- ---------------------------------------------------------------------------
create or replace function public.master_uye_icerik(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_uid uuid;
    v_h_lim int;
    v_y_lim int;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_uid := (p_body->>'uye_id')::uuid;
    if v_uid is null then
        return jsonb_build_object('ok', false, 'hata', 'uye_id gerekli');
    end if;

    if not exists (select 1 from public.uye where id = v_uid) then
        return jsonb_build_object('ok', false, 'hata', 'uye bulunamadi');
    end if;

    v_h_lim := least(greatest(coalesce((p_body->>'hikaye_limit')::int, 80), 1), 200);
    v_y_lim := least(greatest(coalesce((p_body->>'yorum_limit')::int, 120), 1), 300);

    return jsonb_build_object(
        'ok', true,
        'hikayeler', coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'id', i.id,
                    'created_at', i.created_at,
                    'status', i.status,
                    'is_gizli', i.is_gizli,
                    'silindi_at', i.silindi_at,
                    'content_full', i.content_full,
                    'content_short', i.content_short,
                    'up_votes', i.up_votes,
                    'down_votes', i.down_votes,
                    'podyum_donem', i.podyum_donem,
                    'podyum_sira', i.podyum_sira
                )
                order by i.created_at desc
            )
            from (
                select i.*
                from public.itiraflar i
                where i.user_id = v_uid
                order by i.created_at desc
                limit v_h_lim
            ) i
        ), '[]'::jsonb),
        'yorumlar', coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'id', c.id,
                    'itiraf_id', c.itiraf_id,
                    'parent_id', c.parent_id,
                    'content', c.content,
                    'created_at', c.created_at,
                    'itiraf_status', (
                        select i.status from public.itiraflar i where i.id = c.itiraf_id
                    ),
                    'itiraf_silindi', (
                        select i.silindi_at is not null from public.itiraflar i where i.id = c.itiraf_id
                    )
                )
                order by c.created_at desc
            )
            from (
                select c.*
                from public.itiraf_cevaplar c
                where c.user_id = v_uid
                order by c.created_at desc
                limit v_y_lim
            ) c
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.master_uye_icerik(jsonb) from public, anon;
grant execute on function public.master_uye_icerik(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Cevap/yorum işlemleri: { cevap_id, islem, content? }  islem: guncelle | sil
-- ---------------------------------------------------------------------------
create or replace function public.master_cevap_islem(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_id bigint;
    v_islem text;
    v_metin text;
    v_row public.itiraf_cevaplar%rowtype;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_id := (p_body->>'cevap_id')::bigint;
    v_islem := lower(trim(coalesce(p_body->>'islem', '')));
    if v_id is null or v_islem = '' then
        return jsonb_build_object('ok', false, 'hata', 'cevap_id ve islem gerekli');
    end if;

    select * into v_row from public.itiraf_cevaplar where id = v_id;
    if not found then
        return jsonb_build_object('ok', false, 'hata', 'cevap bulunamadi');
    end if;

    perform set_config('gunde5.master_bypass', '1', true);

    if v_islem = 'guncelle' then
        v_metin := trim(coalesce(p_body->>'content', ''));
        if char_length(v_metin) < 1 then
            return jsonb_build_object('ok', false, 'hata', 'metin bos');
        end if;
        if char_length(v_metin) > 2000 then
            return jsonb_build_object('ok', false, 'hata', 'metin cok uzun');
        end if;
        update public.itiraf_cevaplar set content = v_metin where id = v_id;
    elsif v_islem = 'sil' then
        delete from public.itiraf_cevaplar where id = v_id;
        return jsonb_build_object('ok', true, 'silindi', true);
    else
        return jsonb_build_object('ok', false, 'hata', 'gecersiz islem');
    end if;

    select * into v_row from public.itiraf_cevaplar where id = v_id;
    return jsonb_build_object(
        'ok', true,
        'cevap', jsonb_build_object(
            'id', v_row.id,
            'itiraf_id', v_row.itiraf_id,
            'parent_id', v_row.parent_id,
            'content', v_row.content,
            'created_at', v_row.created_at
        )
    );
end;
$$;

revoke all on function public.master_cevap_islem(jsonb) from public, anon;
grant execute on function public.master_cevap_islem(jsonb) to authenticated;

notify pgrst, 'reload schema';
