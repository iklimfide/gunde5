-- Footer hikaye/itiraf + mesaj gönderimi, master bildirimleri ve onay paneli
-- Önce master-admin.sql (master_email_eslesir). SQL Editor'da bir kez çalıştırın.

-- ---------------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------------
create table if not exists public.user_submissions (
    id uuid primary key default gen_random_uuid(),
    type text not null check (type in ('story', 'confession')),
    title text,
    content text not null,
    age int,
    city text,
    gender text check (gender is null or gender in ('Kadın', 'Erkek', 'Belirtmek istemiyorum')),
    status text not null default 'pending'
        check (status in ('pending', 'approved', 'rejected', 'archived')),
    source text not null default 'footer_form',
    created_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid references auth.users (id) on delete set null,
    published_story_id bigint,
    ip_hash text,
    visitor_id text,
    user_agent text
);

create index if not exists user_submissions_status_created_idx
    on public.user_submissions (status, created_at desc);

create index if not exists user_submissions_rate_idx
    on public.user_submissions (ip_hash, visitor_id, created_at desc);

create table if not exists public.contact_messages (
    id uuid primary key default gen_random_uuid(),
    message text not null,
    email text,
    status text not null default 'unread'
        check (status in ('unread', 'read', 'archived')),
    source text not null default 'footer_form',
    created_at timestamptz not null default now(),
    ip_hash text,
    visitor_id text,
    user_agent text
);

create index if not exists contact_messages_status_created_idx
    on public.contact_messages (status, created_at desc);

create index if not exists contact_messages_rate_idx
    on public.contact_messages (ip_hash, visitor_id, created_at desc);

create table if not exists public.master_bildirimler (
    id bigserial primary key,
    baslik text not null,
    metin text not null,
    tip text not null check (tip in ('yeni_hikaye', 'yeni_mesaj')),
    link_path text not null,
    ref_id uuid,
    okundu boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists master_bildirimler_okundu_created_idx
    on public.master_bildirimler (okundu, created_at desc);

alter table public.user_submissions enable row level security;
alter table public.contact_messages enable row level security;
alter table public.master_bildirimler enable row level security;

-- Doğrudan REST erişimi yok (yalnızca RPC)
revoke all on public.user_submissions from anon, authenticated;
revoke all on public.contact_messages from anon, authenticated;
grant select, update on public.master_bildirimler to authenticated;

drop policy if exists master_bildirimler_select on public.master_bildirimler;
create policy master_bildirimler_select on public.master_bildirimler
    for select to authenticated
    using (public.master_email_eslesir());

drop policy if exists master_bildirimler_update on public.master_bildirimler;
create policy master_bildirimler_update on public.master_bildirimler
    for update to authenticated
    using (public.master_email_eslesir())
    with check (public.master_email_eslesir());

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------
create or replace function private.footer_rate_limit_asildi(
    p_ip_hash text,
    p_visitor_id text,
    p_tablo text,
    p_dakika int default 15
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_sayi int;
    v_vid text := nullif(trim(coalesce(p_visitor_id, '')), '');
    v_ip text := nullif(trim(coalesce(p_ip_hash, '')), '');
begin
    if p_tablo = 'contact' then
        select count(*)::int into v_sayi
        from public.contact_messages m
        where m.created_at > now() - make_interval(mins => greatest(1, coalesce(p_dakika, 15)))
          and (
              (v_ip is not null and m.ip_hash = v_ip)
              or (v_vid is not null and m.visitor_id = v_vid)
          );
    else
        select count(*)::int into v_sayi
        from public.user_submissions s
        where s.created_at > now() - make_interval(mins => greatest(1, coalesce(p_dakika, 15)))
          and (
              (v_ip is not null and s.ip_hash = v_ip)
              or (v_vid is not null and s.visitor_id = v_vid)
          );
    end if;
    return coalesce(v_sayi, 0) >= 3;
end;
$$;

revoke all on function private.footer_rate_limit_asildi(text, text, text, int) from public, anon, authenticated;

create or replace function private.master_bildirim_ekle(
    p_tip text,
    p_ref_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_tip = 'yeni_hikaye' then
        insert into public.master_bildirimler (baslik, metin, tip, link_path, ref_id)
        values (
            'Yeni hikaye geldi',
            'Kullanıcı yeni bir hikaye/itiraf gönderdi. Onay bekliyor.',
            'yeni_hikaye',
            '/admin/inbox?tab=hikaye',
            p_ref_id
        );
    elsif p_tip = 'yeni_mesaj' then
        insert into public.master_bildirimler (baslik, metin, tip, link_path, ref_id)
        values (
            'Yeni mesaj geldi',
            'Kullanıcı Günde5''e yeni bir mesaj bıraktı.',
            'yeni_mesaj',
            '/admin/inbox?tab=mesaj',
            p_ref_id
        );
    end if;
end;
$$;

revoke all on function private.master_bildirim_ekle(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Anonim gönderim (API veya doğrudan RPC)
-- ---------------------------------------------------------------------------
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
        return jsonb_build_object('ok', false, 'hata', 'Geçersiz cinsiyet seçimi.');
    end if;

    if p_body ? 'age' and nullif(trim(p_body->>'age'), '') is not null then
        v_age := (p_body->>'age')::int;
        if v_age is null or v_age < 13 or v_age > 120 then
            return jsonb_build_object('ok', false, 'hata', 'Yaş 13–120 arasında olmalı.');
        end if;
    else
        v_age := null;
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
        type, title, content, age, city, gender, status, source, ip_hash, visitor_id, user_agent
    )
    values (
        v_type, v_title, v_content, v_age, v_city, v_gender, 'pending', 'footer_form', v_ip, v_vid, v_ua
    )
    returning id into v_id;

    perform private.master_bildirim_ekle('yeni_hikaye', v_id);

    return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.footer_gonder_hikaye(jsonb) from public;
grant execute on function public.footer_gonder_hikaye(jsonb) to anon, authenticated;

create or replace function public.footer_gonder_mesaj(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_message text;
    v_email text;
    v_ip text;
    v_vid text;
    v_ua text;
    v_id uuid;
begin
    v_message := trim(coalesce(p_body->>'message', ''));
    if char_length(v_message) < 10 then
        return jsonb_build_object('ok', false, 'hata', 'Mesaj en az 10 karakter olmalı.');
    end if;
    if char_length(v_message) > 4000 then
        return jsonb_build_object('ok', false, 'hata', 'Mesaj çok uzun.');
    end if;

    v_email := left(trim(coalesce(p_body->>'email', '')), 200);
    if v_email = '' then
        v_email := null;
    elsif v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        return jsonb_build_object('ok', false, 'hata', 'Geçerli bir e-posta gir veya boş bırak.');
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

    if private.footer_rate_limit_asildi(v_ip, v_vid, 'contact', 15) then
        return jsonb_build_object('ok', false, 'hata', 'Çok sık gönderim yaptın. Biraz sonra tekrar dene.');
    end if;

    insert into public.contact_messages (message, email, status, source, ip_hash, visitor_id, user_agent)
    values (v_message, v_email, 'unread', 'footer_form', v_ip, v_vid, v_ua)
    returning id into v_id;

    perform private.master_bildirim_ekle('yeni_mesaj', v_id);

    return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.footer_gonder_mesaj(jsonb) from public;
grant execute on function public.footer_gonder_mesaj(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Master yönetim RPC
-- ---------------------------------------------------------------------------
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
                    s.id, s.type, s.title, s.content, s.age, s.city, s.gender,
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
        if not found then
            return jsonb_build_object('ok', false, 'hata', 'Kayıt bulunamadı');
        end if;
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

    if not found then
        return jsonb_build_object('ok', false, 'hata', 'Kayıt bulunamadı');
    end if;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.master_submission_islem(jsonb) from public, anon;
grant execute on function public.master_submission_islem(jsonb) to authenticated;

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

create or replace function public.master_messages_listele(p_body jsonb default '{}'::jsonb)
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

    v_status := lower(trim(coalesce(p_body->>'status', 'unread')));
    if v_status not in ('unread', 'read', 'archived', 'all') then
        v_status := 'unread';
    end if;
    v_lim := greatest(1, least(coalesce((p_body->>'limit')::int, 50), 100));
    v_off := greatest(0, coalesce((p_body->>'offset')::int, 0));

    return jsonb_build_object(
        'ok', true,
        'rows', coalesce((
            select jsonb_agg(to_jsonb(t) order by t.created_at desc)
            from (
                select m.id, m.message, m.email, m.status, m.source, m.created_at
                from public.contact_messages m
                where v_status = 'all' or m.status = v_status
                order by m.created_at desc
                limit v_lim offset v_off
            ) t
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.master_messages_listele(jsonb) from public, anon;
grant execute on function public.master_messages_listele(jsonb) to authenticated;

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

revoke all on function public.master_message_islem(jsonb) from public, anon;
grant execute on function public.master_message_islem(jsonb) to authenticated;

create or replace function public.master_bildirimleri_listele(p_limit int default 40)
returns setof public.master_bildirimler
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.master_email_eslesir() then
        return;
    end if;
    return query
    select *
    from public.master_bildirimler
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 80));
end;
$$;

revoke all on function public.master_bildirimleri_listele(int) from public, anon;
grant execute on function public.master_bildirimleri_listele(int) to authenticated;

create or replace function public.master_bildirim_okunmamis_sayisi()
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.master_email_eslesir() then
        return 0;
    end if;
    return (
        select count(*)::int
        from public.master_bildirimler
        where okundu = false
    );
end;
$$;

revoke all on function public.master_bildirim_okunmamis_sayisi() from public, anon;
grant execute on function public.master_bildirim_okunmamis_sayisi() to authenticated;

create or replace function public.master_bildirim_okundu(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.master_email_eslesir() then
        return;
    end if;
    update public.master_bildirimler
    set okundu = true
    where id = p_id;
end;
$$;

revoke all on function public.master_bildirim_okundu(bigint) from public, anon;
grant execute on function public.master_bildirim_okundu(bigint) to authenticated;

create or replace function public.master_bildirim_tumunu_okundu()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.master_email_eslesir() then
        return;
    end if;
    update public.master_bildirimler set okundu = true where okundu = false;
end;
$$;

revoke all on function public.master_bildirim_tumunu_okundu() from public, anon;
grant execute on function public.master_bildirim_tumunu_okundu() to authenticated;

-- İsteğe bağlı anlık bildirim (Dashboard → Database → Replication):
-- alter publication supabase_realtime add table public.master_bildirimler;

notify pgrst, 'reload schema';
