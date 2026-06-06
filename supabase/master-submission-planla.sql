-- Gelen kutusu: gönderiyi onayla + planlı hikaye olarak itiraflar'a ekle
-- footer-submissions.sql + itiraf-hikaye-yaz-kurulum.sql sonrası bir kez Run.

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

    v_username := left(trim(coalesce(p_body->>'username', '')), 50);
    if char_length(v_username) < 2 then
        return jsonb_build_object('ok', false, 'hata', 'rumuz en az 2 karakter');
    end if;

    v_age := coalesce((p_body->>'age')::int, v_row.age);
    if v_age is null or v_age < 18 or v_age > 120 then
        return jsonb_build_object('ok', false, 'hata', 'yas 18-120 arasi olmali');
    end if;

    v_gender := lower(trim(coalesce(p_body->>'gender', '')));
    if v_gender not in ('male', 'female') then
        return jsonb_build_object('ok', false, 'hata', 'gecersiz cinsiyet');
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
