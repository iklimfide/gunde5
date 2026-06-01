-- Mevcut kuruluma düzenleme RPC ekler (footer-submissions.sql sonrası bir kez çalıştırın)

create or replace function public.master_submission_guncelle(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
    v_content text;
    v_title text;
    v_age int;
    v_city text;
    v_gender text;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'Yetkisiz');
    end if;

    v_id := (p_body->>'id')::uuid;
    if v_id is null then
        return jsonb_build_object('ok', false, 'hata', 'id gerekli');
    end if;

    if not exists (select 1 from public.user_submissions where id = v_id) then
        return jsonb_build_object('ok', false, 'hata', 'Kayıt bulunamadı');
    end if;

    v_content := trim(coalesce(p_body->>'content', ''));
    if v_content = '' then
        return jsonb_build_object('ok', false, 'hata', 'Hikaye metni gerekli');
    end if;
    if char_length(v_content) < 50 then
        return jsonb_build_object('ok', false, 'hata', 'Hikaye en az 50 karakter olmalı');
    end if;
    if char_length(v_content) > 12000 then
        return jsonb_build_object('ok', false, 'hata', 'Hikaye çok uzun');
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
    if v_gender = '' then
        v_gender := null;
    elsif v_gender not in ('Kadın', 'Erkek', 'Belirtmek istemiyorum') then
        return jsonb_build_object('ok', false, 'hata', 'Geçersiz cinsiyet');
    end if;

    if p_body ? 'age' and nullif(trim(p_body->>'age'), '') is not null then
        v_age := (p_body->>'age')::int;
        if v_age is null or v_age < 13 or v_age > 120 then
            return jsonb_build_object('ok', false, 'hata', 'Yaş 13–120 arasında olmalı');
        end if;
    else
        v_age := null;
    end if;

    update public.user_submissions
    set title = v_title,
        content = v_content,
        age = v_age,
        city = v_city,
        gender = v_gender
    where id = v_id;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.master_submission_guncelle(jsonb) from public, anon;
grant execute on function public.master_submission_guncelle(jsonb) to authenticated;

notify pgrst, 'reload schema';
