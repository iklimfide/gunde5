-- Gelen kutusu: silme + bildirim linkleri (footer-submissions.sql sonrası bir kez)

create or replace function public.master_submission_islem(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
    v_action text;
    v_row public.user_submissions%rowtype;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'Yetkisiz');
    end if;

    v_id := (p_body->>'id')::uuid;
    v_action := lower(trim(coalesce(p_body->>'action', '')));
    if v_id is null then
        return jsonb_build_object('ok', false, 'hata', 'id gerekli');
    end if;

    select * into v_row from public.user_submissions where id = v_id;
    if not found then
        return jsonb_build_object('ok', false, 'hata', 'Kayıt bulunamadı');
    end if;

    if v_action = 'delete' then
        delete from public.user_submissions where id = v_id;
        return jsonb_build_object('ok', true);
    end if;

    if v_action not in ('approve', 'reject', 'archive', 'pending') then
        return jsonb_build_object('ok', false, 'hata', 'Geçersiz işlem');
    end if;

    update public.user_submissions
    set
        status = case v_action
            when 'approve' then 'approved'
            when 'reject' then 'rejected'
            when 'archive' then 'archived'
            else 'pending'
        end,
        reviewed_at = case when v_action = 'pending' then null else now() end,
        reviewed_by = case when v_action = 'pending' then null else auth.uid() end
    where id = v_id;

    return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.master_message_islem(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
    v_action text;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'Yetkisiz');
    end if;

    v_id := (p_body->>'id')::uuid;
    v_action := lower(trim(coalesce(p_body->>'action', '')));
    if v_id is null then
        return jsonb_build_object('ok', false, 'hata', 'id gerekli');
    end if;

    if v_action = 'delete' then
        delete from public.contact_messages where id = v_id;
        if not found then
            return jsonb_build_object('ok', false, 'hata', 'Kayıt bulunamadı');
        end if;
        return jsonb_build_object('ok', true);
    end if;

    if v_action not in ('read', 'archive', 'unread') then
        return jsonb_build_object('ok', false, 'hata', 'Geçersiz işlem');
    end if;

    update public.contact_messages
    set status = case v_action
        when 'read' then 'read'
        when 'archive' then 'archived'
        else 'unread'
    end
    where id = v_id;

    if not found then
        return jsonb_build_object('ok', false, 'hata', 'Kayıt bulunamadı');
    end if;

    return jsonb_build_object('ok', true);
end;
$$;

update public.master_bildirimler
set link_path = '/admin/inbox?tab=hikaye'
where tip = 'yeni_hikaye' and link_path = '/admin/submissions';

update public.master_bildirimler
set link_path = '/admin/inbox?tab=mesaj'
where tip = 'yeni_mesaj' and link_path = '/admin/messages';

notify pgrst, 'reload schema';
