-- Footer gönderiminde rumuz (username) kaydı + gelen kutusu listeleme/planlama
-- Supabase SQL Editor'da bir kez çalıştırın (footer-submissions.sql sonrası).

alter table public.user_submissions
    add column if not exists username text;

create or replace function public.footer_gonder_hikaye(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_content text;
    v_type text;
    v_title text;
    v_username text;
    v_age int;
    v_city text;
    v_gender text;
    v_ip text;
    v_vid text;
    v_ua text;
    v_id uuid;
begin
    v_content := trim(coalesce(p_body->>'content', ''));
    if char_length(v_content) < 50 then
        return jsonb_build_object('ok', false, 'hata', 'Hikaye en az 50 karakter olmalı.');
    end if;
    if char_length(v_content) > 12000 then
        return jsonb_build_object('ok', false, 'hata', 'Hikaye çok uzun.');
    end if;

    v_type := lower(trim(coalesce(p_body->>'type', 'story')));
    if v_type not in ('story', 'confession') then
        v_type := 'story';
    end if;

    v_username := left(trim(coalesce(
        nullif(trim(p_body->>'username'), ''),
        nullif(trim(p_body->>'title'), ''),
        ''
    )), 50);
    if char_length(v_username) < 2 then
        return jsonb_build_object('ok', false, 'hata', 'Rumuz en az 2 karakter olmalı.');
    end if;

    v_title := left(trim(coalesce(p_body->>'title', '')), 120);
    if v_title = '' then
        v_title := null;
    end if;

    v_city := left(trim(coalesce(p_body->>'city', '')), 80);
    if v_city = '' then
        v_city := null;
    end if;

    v_gender := trim(coalesce(p_body->>'gender', ''));
    if v_gender not in ('Kadın', 'Erkek') then
        return jsonb_build_object('ok', false, 'hata', 'Cinsiyet seçimi zorunlu.');
    end if;

    if not (p_body ? 'age') or nullif(trim(p_body->>'age'), '') is null then
        return jsonb_build_object('ok', false, 'hata', 'Yaş zorunlu.');
    end if;
    v_age := (p_body->>'age')::int;
    if v_age is null or v_age < 13 or v_age > 120 then
        return jsonb_build_object('ok', false, 'hata', 'Yaş 13–120 arasında olmalı.');
    end if;

    v_ip := left(trim(coalesce(p_body->>'ip_hash', '')), 64);
    if v_ip = '' then
        v_ip := null;
    end if;
    v_vid := left(trim(coalesce(p_body->>'visitor_id', '')), 128);
    if v_vid = '' then
        v_vid := null;
    end if;
    v_ua := left(trim(coalesce(p_body->>'user_agent', '')), 400);
    if v_ua = '' then
        v_ua := null;
    end if;

    if v_ip is null and v_vid is null then
        return jsonb_build_object('ok', false, 'hata', 'Gönderim kimliği eksik.');
    end if;

    if private.footer_rate_limit_asildi(v_ip, v_vid, 'submission', 15) then
        return jsonb_build_object('ok', false, 'hata', 'Çok sık gönderim yaptın. Biraz sonra tekrar dene.');
    end if;

    insert into public.user_submissions (
        type, title, username, content, age, city, gender, status, source, ip_hash, visitor_id, user_agent
    )
    values (
        v_type, v_title, v_username, v_content, v_age, v_city, v_gender, 'pending', 'footer_form', v_ip, v_vid, v_ua
    )
    returning id into v_id;

    perform private.master_bildirim_ekle('yeni_hikaye', v_id);

    return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.footer_gonder_hikaye(jsonb) from public;
grant execute on function public.footer_gonder_hikaye(jsonb) to anon, authenticated;

create or replace function public.master_submissions_listele(p_body jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_status text;
    v_lim int;
    v_off int;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'Yetkisiz');
    end if;

    v_status := lower(trim(coalesce(p_body->>'status', 'pending')));
    if v_status not in ('pending', 'approved', 'rejected', 'archived', 'all') then
        v_status := 'pending';
    end if;
    v_lim := greatest(1, least(coalesce((p_body->>'limit')::int, 50), 100));
    v_off := greatest(0, coalesce((p_body->>'offset')::int, 0));

    return jsonb_build_object(
        'ok', true,
        'rows', coalesce((
            select jsonb_agg(to_jsonb(t) order by t.created_at desc)
            from (
                select
                    s.id, s.type, s.title, s.username, s.content, s.age, s.city, s.gender,
                    s.status, s.source, s.created_at, s.reviewed_at, s.published_story_id
                from public.user_submissions s
                where v_status = 'all' or s.status = v_status
                order by s.created_at desc
                limit v_lim offset v_off
            ) t
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.master_submissions_listele(jsonb) from public, anon;
grant execute on function public.master_submissions_listele(jsonb) to authenticated;

create or replace function public.master_submission_planla(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
    v_row public.user_submissions%rowtype;
    v_username text;
    v_age int;
    v_gender text;
    v_yer text;
    v_baslik text;
    v_tam text;
    v_kisa text;
    v_created timestamptz;
    v_itiraf public.itiraflar%rowtype;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'Yetkisiz');
    end if;

    v_id := (p_body->>'id')::uuid;
    if v_id is null then
        return jsonb_build_object('ok', false, 'hata', 'id gerekli');
    end if;

    select * into v_row from public.user_submissions where id = v_id;
    if not found then
        return jsonb_build_object('ok', false, 'hata', 'Kayıt bulunamadı');
    end if;

    if v_row.published_story_id is not null then
        return jsonb_build_object(
            'ok', false,
            'hata', 'Bu gönderi zaten planlandı',
            'published_story_id', v_row.published_story_id
        );
    end if;

    v_username := left(trim(coalesce(
        nullif(trim(p_body->>'username'), ''),
        nullif(trim(v_row.username), ''),
        ''
    )), 50);
    if char_length(v_username) < 2 then
        return jsonb_build_object('ok', false, 'hata', 'rumuz en az 2 karakter');
    end if;

    v_age := coalesce((p_body->>'age')::int, v_row.age);
    if v_age is null or v_age < 18 or v_age > 120 then
        return jsonb_build_object('ok', false, 'hata', 'yas 18-120 arasi olmali');
    end if;

    v_gender := lower(trim(coalesce(nullif(trim(p_body->>'gender'), ''), '')));
    if v_gender not in ('male', 'female') then
        if lower(trim(coalesce(v_row.gender, ''))) like '%erkek%' then
            v_gender := 'male';
        elsif lower(trim(coalesce(v_row.gender, ''))) like '%kad%' then
            v_gender := 'female';
        else
            return jsonb_build_object('ok', false, 'hata', 'gecersiz cinsiyet');
        end if;
    end if;

    v_tam := trim(coalesce(nullif(trim(p_body->>'content'), ''), v_row.content));
    if v_tam = '' or char_length(v_tam) < 50 then
        return jsonb_build_object('ok', false, 'hata', 'hikaye en az 50 karakter');
    end if;
    if char_length(v_tam) > 12000 then
        return jsonb_build_object('ok', false, 'hata', 'hikaye cok uzun');
    end if;

    v_baslik := left(trim(coalesce(nullif(trim(p_body->>'title'), ''), coalesce(v_row.title, ''))), 120);
    if v_baslik = '' then
        v_baslik := null;
    end if;

    v_yer := left(trim(coalesce(nullif(trim(p_body->>'city'), ''), coalesce(v_row.city, ''))), 80);
    if v_yer = '' then
        v_yer := null;
    end if;

    if not (p_body ? 'created_at') or nullif(trim(p_body->>'created_at'), '') is null then
        return jsonb_build_object('ok', false, 'hata', 'yayin tarihi gerekli');
    end if;

    begin
        v_created := (p_body->>'created_at')::timestamptz;
    exception
        when others then
            return jsonb_build_object('ok', false, 'hata', 'gecersiz yayin tarihi');
    end;

    v_kisa := case when char_length(v_tam) <= 140 then v_tam else left(v_tam, 137) || '...' end;

    perform set_config('gunde5.master_bypass', '1', true);

    insert into public.itiraflar (
        user_id,
        username,
        age,
        gender,
        yasadigi_yer,
        yurtdisi_sehir,
        baslik,
        content_short,
        content_full,
        status,
        is_gizli,
        created_at
    ) values (
        null,
        v_username,
        v_age,
        v_gender,
        v_yer,
        null,
        v_baslik,
        v_kisa,
        v_tam,
        'kulis',
        false,
        v_created
    )
    returning * into v_itiraf;

    update public.user_submissions
    set
        status = 'approved',
        username = v_username,
        title = coalesce(v_baslik, title),
        content = v_tam,
        age = v_age,
        city = v_yer,
        gender = case v_gender when 'male' then 'Erkek' when 'female' then 'Kadın' else gender end,
        reviewed_at = now(),
        reviewed_by = auth.uid(),
        published_story_id = v_itiraf.id
    where id = v_id;

    return jsonb_build_object(
        'ok', true,
        'published_story_id', v_itiraf.id,
        'hikaye', to_jsonb(v_itiraf)
    );
end;
$$;

revoke all on function public.master_submission_planla(jsonb) from public, anon;
grant execute on function public.master_submission_planla(jsonb) to authenticated;

notify pgrst, 'reload schema';
