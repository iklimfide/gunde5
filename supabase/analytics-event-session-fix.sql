-- analytics_event_kaydet: impression/vote gelince oturum satiri da olustur
-- (page_view sessions insert basarisiz olsa bile metrikler dolar)
-- İlk kaynak kilidi için analytics-first-source.sql dosyasını çalıştırın.
-- SQL Editor'da bir kez Run.

create or replace function public.analytics_event_kaydet(p_body jsonb)
returns jsonb
language plpgsql
security definer
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

    if v_event not in (
        'page_view', 'load_more_click', 'story_vote', 'story_share', 'heartbeat', 'story_impression',
        'altbar_ara_click', 'altbar_dun_click', 'index_search'
    ) then
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

    if v_sayfa is null and v_event in (
        'story_impression', 'story_vote', 'story_share', 'load_more_click',
        'altbar_ara_click', 'altbar_dun_click', 'index_search'
    ) then
        v_sayfa := 'index';
    end if;

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

    else
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

        if v_event = 'load_more_click' then
            update public.site_analytics_sessions s set
                load_more_count = s.load_more_count + 1,
                stories_loaded = greatest(s.stories_loaded, coalesce(v_loaded, s.stories_loaded + 5))
            where s.session_id = v_sid;

            insert into public.site_analytics_events (
                event_type, session_id, visitor_id, user_id, loaded_count, payload
            ) values (
                v_event, v_sid, v_vid, v_uid, v_loaded,
                case
                    when nullif(left(trim(coalesce(p_body->'payload'->>'tip', '')), 20), '') is not null
                    then jsonb_build_object('tip', left(trim(coalesce(p_body->'payload'->>'tip', '')), 20))
                    else null
                end
            );

        elsif v_event in ('altbar_ara_click', 'altbar_dun_click') then
            insert into public.site_analytics_events (
                event_type, session_id, visitor_id, user_id, payload
            ) values (
                v_event, v_sid, v_vid, v_uid,
                jsonb_build_object('sayfa', coalesce(v_sayfa, 'index'))
            );

        elsif v_event = 'index_search' then
            v_sayfa := coalesce(v_sayfa, 'index');
            if length(left(trim(coalesce(p_body->'payload'->>'query', p_body->>'query', '')), 120)) < 2 then
                return jsonb_build_object('ok', false, 'hata', 'arama sorgusu gerekli');
            end if;

            insert into public.site_analytics_events (
                event_type, session_id, visitor_id, user_id, payload
            ) values (
                v_event, v_sid, v_vid, v_uid,
                jsonb_build_object(
                    'sayfa', v_sayfa,
                    'query', left(trim(coalesce(p_body->'payload'->>'query', p_body->>'query', '')), 120)
                )
            );

        elsif v_event = 'story_vote' then
            if v_story is null or v_vote not in ('like', 'dislike') then
                return jsonb_build_object('ok', false, 'hata', 'story_id ve vote_type gerekli');
            end if;

            insert into public.site_analytics_events (
                event_type, session_id, visitor_id, user_id, story_id, vote_type
            ) values (
                v_event, v_sid, v_vid, v_uid, v_story, v_vote
            );

        elsif v_event = 'story_share' then
            if v_story is null then
                return jsonb_build_object('ok', false, 'hata', 'story_id gerekli');
            end if;

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
                active_seconds = s.active_seconds + least(greatest(v_delta, 0), 60)
            where s.session_id = v_sid;

            insert into public.site_analytics_events (
                event_type, session_id, visitor_id, user_id, payload
            ) values (
                v_event, v_sid, v_vid, v_uid,
                jsonb_build_object('active_delta', least(greatest(v_delta, 0), 60))
            );
        end if;
    end if;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.analytics_event_kaydet(jsonb) from public;
grant execute on function public.analytics_event_kaydet(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
