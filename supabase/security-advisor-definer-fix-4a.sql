-- Adim 1/3 — yardimcilar + ziyaret + analytics (SQL Editor'da ayri Run)
set statement_timeout = '0';
set lock_timeout = '60s';

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to postgres, service_role, anon, authenticated;

-- ---------------------------------------------------------------------------
-- analytics_kimlik â€” search_path
-- ---------------------------------------------------------------------------
create or replace function public.analytics_kimlik(p_user_id uuid, p_visitor_id text)
returns text
language sql
immutable
set search_path = public
as $$
    select case
        when p_user_id is not null then 'u:' || p_user_id::text
        else 'v:' || coalesce(p_visitor_id, '')
    end;
$$;

-- ---------------------------------------------------------------------------
-- private yardÄ±mcÄ±lar (PostgREST RPC deÄŸil â†’ linter DEFINER uyarÄ±sÄ± yok)
-- ---------------------------------------------------------------------------
create or replace function private.gunde5_master_user_uuid()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select u.id
    from auth.users u
    where lower(trim(coalesce(u.email, ''))) = public.master_email_hedef()
    limit 1;
$$;

revoke all on function private.gunde5_master_user_uuid() from public;

create or replace function private.gunde5_analytics_kayit_dahil(
    p_user_id uuid,
    p_oturum_key text,
    p_haric text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select case lower(trim(coalesce(p_haric, 'master')))
        when 'yok' then true
        when 'uyeler' then
            p_user_id is null
            and coalesce(p_oturum_key, '') !~ '^u:'
        else
            (p_user_id is null or p_user_id is distinct from private.gunde5_master_user_uuid())
            and (
                private.gunde5_master_user_uuid() is null
                or coalesce(p_oturum_key, '') is distinct from ('u:' || private.gunde5_master_user_uuid()::text)
            )
    end;
$$;

revoke all on function private.gunde5_analytics_kayit_dahil(uuid, text, text) from public;
grant execute on function private.gunde5_analytics_kayit_dahil(uuid, text, text) to authenticated;
grant execute on function private.gunde5_master_user_uuid() to anon, authenticated;

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
-- Analitik tablolar â€” INVOKER insert/update (REST doÄŸrudan yok)
-- ---------------------------------------------------------------------------
grant insert, update on public.site_analytics_sessions to anon, authenticated;
grant insert on public.site_analytics_events to anon, authenticated;

drop policy if exists site_analytics_sessions_insert_rpc on public.site_analytics_sessions;
create policy site_analytics_sessions_insert_rpc on public.site_analytics_sessions
    for insert to anon, authenticated
    with check (char_length(session_id) >= 8 and char_length(visitor_id) >= 8);

drop policy if exists site_analytics_sessions_update_rpc on public.site_analytics_sessions;
create policy site_analytics_sessions_update_rpc on public.site_analytics_sessions
    for update to anon, authenticated
    using (char_length(session_id) >= 8)
    with check (char_length(session_id) >= 8);

drop policy if exists site_analytics_events_insert_rpc on public.site_analytics_events;
create policy site_analytics_events_insert_rpc on public.site_analytics_events
    for insert to anon, authenticated
    with check (char_length(session_id) >= 8 and char_length(visitor_id) >= 8);

create or replace function public.analytics_event_kaydet(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_event text;
    v_sid text;
    v_vid text;
    v_uid uuid;
    v_sayfa text;
    v_path text;
    v_ref text;
    v_story bigint;
    v_vote text;
    v_loaded int;
    v_delta int;
begin
    v_event := lower(trim(coalesce(p_body->>'event', '')));
    v_sid := left(trim(coalesce(p_body->>'session_id', '')), 128);
    v_vid := left(trim(coalesce(p_body->>'visitor_id', '')), 128);

    if length(v_sid) < 8 or length(v_vid) < 8 then
        return jsonb_build_object('ok', false, 'hata', 'session_id ve visitor_id gerekli');
    end if;

    if v_event not in ('page_view', 'load_more_click', 'story_vote', 'story_share', 'heartbeat', 'story_impression') then
        return jsonb_build_object('ok', false, 'hata', 'gecersiz event');
    end if;

    v_uid := auth.uid();

    if v_uid is not null and v_uid = private.gunde5_master_user_uuid() then
        return jsonb_build_object('ok', true, 'atlandi', true, 'neden', 'master');
    end if;

    v_sayfa := nullif(left(trim(coalesce(p_body->>'sayfa', '')), 40), '');
    v_path := nullif(left(trim(coalesce(p_body->>'path', '')), 500), '');
    v_ref := nullif(left(trim(coalesce(p_body->>'referrer', '')), 500), '');
    v_story := nullif(trim(coalesce(p_body->>'story_id', '')), '')::bigint;
    v_vote := nullif(lower(trim(coalesce(p_body->>'vote_type', ''))), '');
    v_loaded := nullif(trim(coalesce(p_body->>'loaded_count', '')), '')::int;
    v_delta := coalesce(nullif(trim(coalesce(p_body->>'active_delta', '')), '')::int, 15);

    if v_event = 'page_view' then
        insert into public.site_analytics_sessions (
            session_id, visitor_id, user_id, sayfa, path, referrer,
            stories_loaded, load_more_count, active_seconds
        ) values (
            v_sid, v_vid, v_uid, v_sayfa, v_path, v_ref,
            coalesce(v_loaded, case when v_sayfa = 'index' then 5 else 0 end),
            0, 0
        )
        on conflict (session_id) do update set
            last_active_at = now(),
            user_id = coalesce(excluded.user_id, site_analytics_sessions.user_id),
            sayfa = coalesce(excluded.sayfa, site_analytics_sessions.sayfa),
            path = coalesce(excluded.path, site_analytics_sessions.path),
            referrer = coalesce(excluded.referrer, site_analytics_sessions.referrer),
            stories_loaded = greatest(site_analytics_sessions.stories_loaded, coalesce(excluded.stories_loaded, 0));

        insert into public.site_analytics_events (
            event_type, session_id, visitor_id, user_id, loaded_count, payload
        ) values (
            v_event, v_sid, v_vid, v_uid, v_loaded,
            jsonb_build_object('sayfa', v_sayfa, 'path', v_path, 'referrer', v_ref)
        );

    elsif v_event = 'load_more_click' then
        update public.site_analytics_sessions s set
            last_active_at = now(),
            user_id = coalesce(v_uid, s.user_id),
            load_more_count = s.load_more_count + 1,
            stories_loaded = greatest(s.stories_loaded, coalesce(v_loaded, s.stories_loaded + 5))
        where s.session_id = v_sid;

        insert into public.site_analytics_events (
            event_type, session_id, visitor_id, user_id, loaded_count
        ) values (
            v_event, v_sid, v_vid, v_uid, v_loaded
        );

    elsif v_event = 'story_vote' then
        if v_story is null or v_vote not in ('like', 'dislike') then
            return jsonb_build_object('ok', false, 'hata', 'story_id ve vote_type gerekli');
        end if;

        update public.site_analytics_sessions s set
            last_active_at = now(),
            user_id = coalesce(v_uid, s.user_id)
        where s.session_id = v_sid;

        insert into public.site_analytics_events (
            event_type, session_id, visitor_id, user_id, story_id, vote_type
        ) values (
            v_event, v_sid, v_vid, v_uid, v_story, v_vote
        );

    elsif v_event = 'story_share' then
        if v_story is null then
            return jsonb_build_object('ok', false, 'hata', 'story_id gerekli');
        end if;

        update public.site_analytics_sessions s set
            last_active_at = now(),
            user_id = coalesce(v_uid, s.user_id)
        where s.session_id = v_sid;

        insert into public.site_analytics_events (
            event_type, session_id, visitor_id, user_id, story_id
        ) values (
            v_event, v_sid, v_vid, v_uid, v_story
        );

    elsif v_event = 'story_impression' then
        if v_story is null then
            return jsonb_build_object('ok', false, 'hata', 'story_id gerekli');
        end if;

        insert into public.site_analytics_events (
            event_type, session_id, visitor_id, user_id, story_id
        ) values (
            v_event, v_sid, v_vid, v_uid, v_story
        );

    elsif v_event = 'heartbeat' then
        update public.site_analytics_sessions s set
            last_active_at = now(),
            user_id = coalesce(v_uid, s.user_id),
            active_seconds = s.active_seconds + least(greatest(v_delta, 0), 60)
        where s.session_id = v_sid;

        if not found then
            insert into public.site_analytics_sessions (
                session_id, visitor_id, user_id, active_seconds
            ) values (v_sid, v_vid, v_uid, least(greatest(v_delta, 0), 60));
        end if;
    end if;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.analytics_event_kaydet(jsonb) from public;
grant execute on function public.analytics_event_kaydet(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

