-- İlk ziyaret referrer'ı (visitor_id başına kalıcı, değişmez)
-- analytics-event-session-fix.sql sonrası SQL Editor'da bir kez Run.
-- Geriye dönük doldurma büyük tabloda uzun sürebilir; gerekirse aşağıdaki SET satırının yorumunu kaldırın.

-- set local statement_timeout = '600s';

-- created_at indeksi (mudavim / trafik sorguları)
create index if not exists site_analytics_events_created_idx
    on public.site_analytics_events (created_at desc);

-- ---------------------------------------------------------------------------
-- Referrer → kaynak grubu (Instagram, X, Google, Direct …)
-- ---------------------------------------------------------------------------
create or replace function public.analytics_referrer_kaynak(p_referrer text)
returns text
language sql
immutable
set search_path = public
as $$
    select case
        when coalesce(p_referrer, '') = '' then 'Direct'
        when p_referrer ilike '%instagram.%' or p_referrer ilike '%l.instagram.%' then 'Instagram'
        when p_referrer ilike '%facebook.%' or p_referrer ilike '%fb.%' or p_referrer ilike '%l.facebook.%' then 'Facebook'
        when p_referrer ilike '%t.co%'
            or p_referrer ilike '%twitter.%'
            or p_referrer ilike '%x.com%'
            or p_referrer ilike '%android-app://com.twitter.%' then 'X'
        when p_referrer ilike '%google.%' or p_referrer ilike '%google.com%' then 'Google'
        when p_referrer ilike '%bing.%' then 'Bing'
        when p_referrer ilike '%yahoo.%' then 'Yahoo'
        when p_referrer ilike '%duckduckgo.%' then 'DuckDuckGo'
        else 'Diğer'
    end;
$$;

-- ---------------------------------------------------------------------------
-- Kalıcı ilk kaynak (visitor_id PK — yalnızca ilk insert)
-- ---------------------------------------------------------------------------
create table if not exists public.site_analytics_first_source (
    visitor_id text primary key,
    referrer text,
    analytics_first_source varchar(64) not null,
    first_seen_at timestamptz not null default now(),
    constraint site_analytics_first_source_vid_len check (char_length(visitor_id) >= 8)
);

create index if not exists site_analytics_first_source_kaynak_idx
    on public.site_analytics_first_source (analytics_first_source);

alter table public.site_analytics_first_source enable row level security;
revoke all on public.site_analytics_first_source from anon, authenticated;
grant insert on public.site_analytics_first_source to anon, authenticated;
grant select on public.site_analytics_first_source to authenticated;

drop policy if exists site_analytics_first_source_insert on public.site_analytics_first_source;
create policy site_analytics_first_source_insert on public.site_analytics_first_source
    for insert to anon, authenticated
    with check (char_length(visitor_id) >= 8);

drop policy if exists site_analytics_first_source_select_master on public.site_analytics_first_source;
create policy site_analytics_first_source_select_master on public.site_analytics_first_source
    for select to authenticated
    using (public.master_email_eslesir());

-- Mevcut oturumlardan geriye dönük doldur (en erken oturum referrer'ı)
insert into public.site_analytics_first_source (visitor_id, referrer, analytics_first_source, first_seen_at)
select distinct on (s.visitor_id)
    s.visitor_id,
    s.referrer,
    public.analytics_referrer_kaynak(s.referrer),
    s.started_at
from public.site_analytics_sessions s
where char_length(s.visitor_id) >= 8
order by s.visitor_id, s.started_at asc
on conflict (visitor_id) do nothing;

-- page_view payload'ından yedek (oturumda referrer boş kalmışsa)
insert into public.site_analytics_first_source (visitor_id, referrer, analytics_first_source, first_seen_at)
select distinct on (e.visitor_id)
    e.visitor_id,
    nullif(trim(coalesce(e.payload->>'referrer', '')), ''),
    public.analytics_referrer_kaynak(nullif(trim(coalesce(e.payload->>'referrer', '')), '')),
    e.created_at
from public.site_analytics_events e
where e.event_type = 'page_view'
  and char_length(e.visitor_id) >= 8
order by e.visitor_id, e.created_at asc
on conflict (visitor_id) do nothing;

-- ---------------------------------------------------------------------------
-- analytics_event_kaydet: ilk ziyarette kaynak kilitle (ON CONFLICT DO NOTHING)
-- ---------------------------------------------------------------------------
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

    if v_event not in ('page_view', 'load_more_click', 'story_vote', 'story_share', 'heartbeat', 'story_impression') then
        return jsonb_build_object('ok', false, 'hata', 'gecersiz event');
    end if;

    v_uid := auth.uid();

    v_sayfa := nullif(left(trim(coalesce(p_body->>'sayfa', '')), 40), '');
    v_path := nullif(left(trim(coalesce(p_body->>'path', '')), 500), '');
    v_ref := nullif(left(trim(coalesce(p_body->>'referrer', '')), 500), '');
    v_story := nullif(trim(coalesce(p_body->>'story_id', '')), '')::bigint;
    v_vote := nullif(lower(trim(coalesce(p_body->>'vote_type', ''))), '');
    v_loaded := nullif(trim(coalesce(p_body->>'loaded_count', '')), '')::int;
    v_delta := coalesce(nullif(trim(coalesce(p_body->>'active_delta', '')), '')::int, 15);

    if v_sayfa is null and v_event in ('story_impression', 'story_vote', 'story_share', 'load_more_click') then
        v_sayfa := 'index';
    end if;

    -- İlk ziyaret kaynağı: yalnızca ilk insert geçerli, sonradan güncellenmez
    insert into public.site_analytics_first_source (visitor_id, referrer, analytics_first_source)
    values (v_vid, v_ref, public.analytics_referrer_kaynak(v_ref))
    on conflict (visitor_id) do nothing;

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
                event_type, session_id, visitor_id, user_id, loaded_count
            ) values (
                v_event, v_sid, v_vid, v_uid, v_loaded
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
