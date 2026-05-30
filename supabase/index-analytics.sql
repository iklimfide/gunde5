-- Index odaklı kullanım analitiği (oturum, olay, davranış metrikleri)
-- SQL Editor'da bir kez Run. İstatistik sayfası master_ziyaret_istatistik ile beslenir.

-- ---------------------------------------------------------------------------
-- Oturumlar (visitor_id kalıcı, session_id tarayıcı oturumu)
-- ---------------------------------------------------------------------------
create table if not exists public.site_analytics_sessions (
    id bigserial primary key,
    session_id text not null,
    visitor_id text not null,
    user_id uuid references auth.users (id) on delete set null,
    sayfa varchar(40),
    path text,
    referrer text,
    started_at timestamptz not null default now(),
    last_active_at timestamptz not null default now(),
    stories_loaded int not null default 0,
    load_more_count int not null default 0,
    active_seconds int not null default 0
);

create unique index if not exists site_analytics_sessions_sid_uniq
    on public.site_analytics_sessions (session_id);

create index if not exists site_analytics_sessions_visitor_idx
    on public.site_analytics_sessions (visitor_id, started_at desc);

create index if not exists site_analytics_sessions_started_idx
    on public.site_analytics_sessions (started_at desc);

create index if not exists site_analytics_sessions_user_idx
    on public.site_analytics_sessions (user_id, started_at desc)
    where user_id is not null;

alter table public.site_analytics_sessions enable row level security;
revoke all on public.site_analytics_sessions from anon, authenticated;
grant select on public.site_analytics_sessions to authenticated;

drop policy if exists site_analytics_sessions_select_master on public.site_analytics_sessions;
create policy site_analytics_sessions_select_master on public.site_analytics_sessions
    for select to authenticated
    using (public.master_email_eslesir());

-- ---------------------------------------------------------------------------
-- Olaylar (page_view, load_more_click, story_vote, story_share, heartbeat)
-- ---------------------------------------------------------------------------
create table if not exists public.site_analytics_events (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    event_type varchar(32) not null,
    session_id text not null,
    visitor_id text not null,
    user_id uuid references auth.users (id) on delete set null,
    story_id bigint references public.itiraflar (id) on delete set null,
    vote_type varchar(16),
    loaded_count int,
    payload jsonb
);

create index if not exists site_analytics_events_type_created_idx
    on public.site_analytics_events (event_type, created_at desc);

create index if not exists site_analytics_events_session_idx
    on public.site_analytics_events (session_id, created_at desc);

create index if not exists site_analytics_events_story_idx
    on public.site_analytics_events (story_id, event_type, created_at desc)
    where story_id is not null;

alter table public.site_analytics_events enable row level security;
revoke all on public.site_analytics_events from anon, authenticated;
grant select on public.site_analytics_events to authenticated;

drop policy if exists site_analytics_events_select_master on public.site_analytics_events;
create policy site_analytics_events_select_master on public.site_analytics_events
    for select to authenticated
    using (public.master_email_eslesir());

-- ---------------------------------------------------------------------------
-- Kimlik anahtarı (geri gelen / tekil ziyaretçi)
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
-- private yardımcılar (PostgREST dışı — Security Advisor DEFINER uyarısı yok)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to postgres, service_role, anon, authenticated;

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
grant execute on function private.gunde5_master_user_uuid() to anon, authenticated;

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

-- ---------------------------------------------------------------------------
-- Analitik tablolar — INVOKER RPC için insert/update izinleri
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

-- ---------------------------------------------------------------------------
-- İstatistik filtreleri (master / girişli üyeler hariç) — private.gunde5_analytics_kayit_dahil
-- p_haric: 'master' (varsayılan) | 'uyeler' | 'yok'
-- ---------------------------------------------------------------------------
-- Olay kaydı (anon + authenticated)
-- p_body: {
--   event: page_view | load_more_click | story_vote | story_share | heartbeat,
--   session_id, visitor_id,
--   sayfa?, path?, referrer?,
--   story_id?, vote_type? (like|dislike),
--   loaded_count?, active_delta?
-- }
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Master istatistik (trafik + davranış + etkileşim + içerik)
-- p_haric: master (varsayılan) | uyeler | yok
-- ---------------------------------------------------------------------------
drop function if exists public.master_ziyaret_istatistik(int);

create or replace function public.master_ziyaret_istatistik(
    p_gun int default 30,
    p_haric text default 'master'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_gun int;
    v_haric text;
    v_since timestamptz;
    v_tekil_ziyaretci int;
    v_geri_gelen int;
    v_index_oturum int;
    v_load_more_oturum int;
    v_avg_stories numeric;
    v_avg_active numeric;
    v_begeni int;
    v_begenmeme int;
    v_paylasim int;
    v_etkilesim_oran numeric;
    v_impression_var boolean;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_gun := least(greatest(coalesce(p_gun, 30), 1), 365);
    v_haric := lower(trim(coalesce(p_haric, 'master')));
    if v_haric not in ('master', 'uyeler', 'yok') then
        v_haric := 'master';
    end if;
    v_since := now() - (v_gun || ' days')::interval;

    select count(distinct public.analytics_kimlik(s.user_id, s.visitor_id))::int
    into v_tekil_ziyaretci
    from public.site_analytics_sessions s
    where s.started_at >= v_since
      and private.gunde5_analytics_kayit_dahil(s.user_id, null, v_haric);

    select count(distinct k.kid)::int
    into v_geri_gelen
    from (
        select distinct public.analytics_kimlik(s.user_id, s.visitor_id) as kid
        from public.site_analytics_sessions s
        where s.started_at >= v_since
          and private.gunde5_analytics_kayit_dahil(s.user_id, null, v_haric)
    ) k
    where exists (
        select 1
        from public.site_analytics_sessions es
        where es.started_at < v_since
          and private.gunde5_analytics_kayit_dahil(es.user_id, null, v_haric)
          and public.analytics_kimlik(es.user_id, es.visitor_id) = k.kid
    );

    select count(*)::int,
           count(*) filter (where s.load_more_count >= 1)::int,
           coalesce(avg(nullif(s.stories_loaded, 0)), 0),
           coalesce(avg(greatest(
               s.active_seconds,
               extract(epoch from (s.last_active_at - s.started_at))::int
           )), 0)
    into v_index_oturum, v_load_more_oturum, v_avg_stories, v_avg_active
    from public.site_analytics_sessions s
    where s.started_at >= v_since
      and coalesce(s.sayfa, '') = 'index'
      and private.gunde5_analytics_kayit_dahil(s.user_id, null, v_haric);

    select count(*)::int into v_begeni
    from public.site_analytics_events e
    where e.created_at >= v_since
      and e.event_type = 'story_vote'
      and e.vote_type = 'like'
      and private.gunde5_analytics_kayit_dahil(e.user_id, null, v_haric);

    select count(*)::int into v_begenmeme
    from public.site_analytics_events e
    where e.created_at >= v_since
      and e.event_type = 'story_vote'
      and e.vote_type = 'dislike'
      and private.gunde5_analytics_kayit_dahil(e.user_id, null, v_haric);

    select count(*)::int into v_paylasim
    from public.site_analytics_events e
    where e.created_at >= v_since
      and e.event_type = 'story_share'
      and private.gunde5_analytics_kayit_dahil(e.user_id, null, v_haric);

    v_etkilesim_oran := case
        when coalesce(v_tekil_ziyaretci, 0) > 0 then
            round(((coalesce(v_begeni, 0) + coalesce(v_begenmeme, 0) + coalesce(v_paylasim, 0))::numeric
                / v_tekil_ziyaretci) * 100, 1)
        else 0
    end;

    select exists (
        select 1 from public.site_analytics_events e
        where e.event_type = 'story_impression'
          and private.gunde5_analytics_kayit_dahil(e.user_id, null, v_haric)
        limit 1
    ) into v_impression_var;

    return jsonb_build_object(
        'ok', true,
        'gun', v_gun,
        'filtre', jsonb_build_object(
            'haric', v_haric,
            'etiket', case v_haric
                when 'uyeler' then 'Girişli üyeler ve master hariç'
                when 'yok' then 'Filtre yok (herkes dahil)'
                else 'Master hesabı hariç'
            end
        ),
        'toplam', (
            select count(*)::int from public.site_ziyaretler z
            where z.created_at >= v_since
              and private.gunde5_analytics_kayit_dahil(z.user_id, z.oturum_key, v_haric)
        ),
        'tekil_oturum', (
            select count(distinct z.oturum_key)::int
            from public.site_ziyaretler z
            where z.created_at >= v_since
              and private.gunde5_analytics_kayit_dahil(z.user_id, z.oturum_key, v_haric)
        ),
        'tekil_ziyaretci', coalesce(v_tekil_ziyaretci, 0),
        'girisli_ziyaret', (
            select count(*)::int
            from public.site_ziyaretler z
            where z.created_at >= v_since
              and z.user_id is not null
              and private.gunde5_analytics_kayit_dahil(z.user_id, z.oturum_key, v_haric)
        ),
        'davranis', jsonb_build_object(
            'geri_gelen', coalesce(v_geri_gelen, 0),
            'geri_gelen_oran', case
                when coalesce(v_tekil_ziyaretci, 0) > 0 then
                    round((v_geri_gelen::numeric / v_tekil_ziyaretci) * 100, 1)
                else 0
            end,
            'ortalama_hikaye', round(coalesce(v_avg_stories, 0), 1),
            'daha_fazla_oran', case
                when coalesce(v_index_oturum, 0) > 0 then
                    round((v_load_more_oturum::numeric / v_index_oturum) * 100, 1)
                else 0
            end,
            'index_oturum', coalesce(v_index_oturum, 0),
            'ortalama_sure_sn', round(coalesce(v_avg_active, 0))::int
        ),
        'etkilesim', jsonb_build_object(
            'begeni', coalesce(v_begeni, 0),
            'begenmeme', coalesce(v_begenmeme, 0),
            'paylasim', coalesce(v_paylasim, 0),
            'etkilesim_oran', v_etkilesim_oran
        ),
        'icerik', jsonb_build_object(
            'impression_var', coalesce(v_impression_var, false),
            'en_begenilen', coalesce((
                select jsonb_agg(jsonb_build_object(
                    'id', t.story_id,
                    'baslik', t.baslik,
                    'begeni', t.begeni,
                    'begenmeme', t.begenmeme,
                    'paylasim', t.paylasim
                ) order by t.begeni desc, t.story_id desc)
                from (
                    select e.story_id,
                        coalesce(nullif(trim(i.baslik), ''), left(coalesce(i.content_short, i.content_full, ''), 80)) as baslik,
                        count(*) filter (where e.vote_type = 'like')::int as begeni,
                        count(*) filter (where e.vote_type = 'dislike')::int as begenmeme,
                        (select count(*)::int from public.site_analytics_events sh
                         where sh.story_id = e.story_id and sh.event_type = 'story_share'
                           and sh.created_at >= v_since
                           and private.gunde5_analytics_kayit_dahil(sh.user_id, null, v_haric)) as paylasim
                    from public.site_analytics_events e
                    join public.itiraflar i on i.id = e.story_id
                    where e.created_at >= v_since
                      and e.event_type = 'story_vote'
                      and e.story_id is not null
                      and private.gunde5_analytics_kayit_dahil(e.user_id, null, v_haric)
                    group by e.story_id, i.baslik, i.content_short, i.content_full
                    having count(*) filter (where e.vote_type = 'like') > 0
                    order by count(*) filter (where e.vote_type = 'like') desc
                    limit 10
                ) t
            ), '[]'::jsonb),
            'en_paylasilan', coalesce((
                select jsonb_agg(jsonb_build_object(
                    'id', t.story_id,
                    'baslik', t.baslik,
                    'paylasim', t.paylasim,
                    'begeni', t.begeni
                ) order by t.paylasim desc, t.story_id desc)
                from (
                    select e.story_id,
                        coalesce(nullif(trim(i.baslik), ''), left(coalesce(i.content_short, i.content_full, ''), 80)) as baslik,
                        count(*)::int as paylasim,
                        (select count(*)::int from public.site_analytics_events v
                         where v.story_id = e.story_id and v.event_type = 'story_vote'
                           and v.vote_type = 'like' and v.created_at >= v_since
                           and private.gunde5_analytics_kayit_dahil(v.user_id, null, v_haric)) as begeni
                    from public.site_analytics_events e
                    join public.itiraflar i on i.id = e.story_id
                    where e.created_at >= v_since
                      and e.event_type = 'story_share'
                      and e.story_id is not null
                      and private.gunde5_analytics_kayit_dahil(e.user_id, null, v_haric)
                    group by e.story_id, i.baslik, i.content_short, i.content_full
                    order by count(*) desc
                    limit 10
                ) t
            ), '[]'::jsonb),
            'en_begenilmeyen', coalesce((
                select jsonb_agg(jsonb_build_object(
                    'id', t.story_id,
                    'baslik', t.baslik,
                    'begenmeme', t.begenmeme,
                    'begeni', t.begeni
                ) order by t.begenmeme desc, t.story_id desc)
                from (
                    select e.story_id,
                        coalesce(nullif(trim(i.baslik), ''), left(coalesce(i.content_short, i.content_full, ''), 80)) as baslik,
                        count(*) filter (where e.vote_type = 'dislike')::int as begenmeme,
                        count(*) filter (where e.vote_type = 'like')::int as begeni
                    from public.site_analytics_events e
                    join public.itiraflar i on i.id = e.story_id
                    where e.created_at >= v_since
                      and e.event_type = 'story_vote'
                      and e.story_id is not null
                      and private.gunde5_analytics_kayit_dahil(e.user_id, null, v_haric)
                    group by e.story_id, i.baslik, i.content_short, i.content_full
                    having count(*) filter (where e.vote_type = 'dislike') > 0
                    order by count(*) filter (where e.vote_type = 'dislike') desc
                    limit 10
                ) t
            ), '[]'::jsonb),
            'en_gorulen', case when v_impression_var then coalesce((
                select jsonb_agg(jsonb_build_object(
                    'id', t.story_id,
                    'baslik', t.baslik,
                    'goruntulenme', t.goruntulenme
                ) order by t.goruntulenme desc, t.story_id desc)
                from (
                    select e.story_id,
                        coalesce(nullif(trim(i.baslik), ''), left(coalesce(i.content_short, i.content_full, ''), 80)) as baslik,
                        count(*)::int as goruntulenme
                    from public.site_analytics_events e
                    join public.itiraflar i on i.id = e.story_id
                    where e.created_at >= v_since
                      and e.event_type = 'story_impression'
                      and e.story_id is not null
                      and private.gunde5_analytics_kayit_dahil(e.user_id, null, v_haric)
                    group by e.story_id, i.baslik, i.content_short, i.content_full
                    order by count(*) desc
                    limit 10
                ) t
            ), '[]'::jsonb) else null end
        ),
        'sayfalar', coalesce((
            select jsonb_agg(jsonb_build_object('sayfa', t.sayfa, 'adet', t.adet) order by t.adet desc)
            from (
                select z.sayfa, count(*)::int as adet
                from public.site_ziyaretler z
                where z.created_at >= v_since
                  and private.gunde5_analytics_kayit_dahil(z.user_id, z.oturum_key, v_haric)
                group by z.sayfa
            ) t
        ), '[]'::jsonb),
        'referrerlar', coalesce((
            select jsonb_agg(jsonb_build_object('referrer', t.referrer, 'adet', t.adet) order by t.adet desc)
            from (
                select coalesce(nullif(z.referrer, ''), '(direkt / bilinmiyor)') as referrer,
                       count(*)::int as adet
                from public.site_ziyaretler z
                where z.created_at >= v_since
                  and private.gunde5_analytics_kayit_dahil(z.user_id, z.oturum_key, v_haric)
                group by 1
                order by adet desc
                limit 25
            ) t
        ), '[]'::jsonb),
        'referrer_gruplu', coalesce((
            select jsonb_agg(jsonb_build_object('kaynak', t.kaynak, 'adet', t.adet) order by t.adet desc)
            from (
                select
                    case
                        when coalesce(z.referrer, '') = '' then 'direct / bilinmiyor'
                        when z.referrer ilike '%t.co%' then 't.co'
                        when z.referrer ilike '%android-app://com.twitter.android%' then 'android-app://com.twitter.android/'
                        when z.referrer ilike '%google.%' or z.referrer ilike '%google.com%' then 'google'
                        else 'diğerleri'
                    end as kaynak,
                    count(*)::int as adet
                from public.site_ziyaretler z
                where z.created_at >= v_since
                  and private.gunde5_analytics_kayit_dahil(z.user_id, z.oturum_key, v_haric)
                group by 1
            ) t
        ), '[]'::jsonb),
        'utm_kaynaklar', coalesce((
            select jsonb_agg(jsonb_build_object('utm_source', t.utm_source, 'adet', t.adet) order by t.adet desc)
            from (
                select z.utm_source, count(*)::int as adet
                from public.site_ziyaretler z
                where z.created_at >= v_since and z.utm_source is not null
                  and private.gunde5_analytics_kayit_dahil(z.user_id, z.oturum_key, v_haric)
                group by z.utm_source
                order by adet desc
                limit 25
            ) t
        ), '[]'::jsonb),
        'utm_medium', coalesce((
            select jsonb_agg(jsonb_build_object('utm_medium', t.utm_medium, 'adet', t.adet) order by t.adet desc)
            from (
                select z.utm_medium, count(*)::int as adet
                from public.site_ziyaretler z
                where z.created_at >= v_since and z.utm_medium is not null
                  and private.gunde5_analytics_kayit_dahil(z.user_id, z.oturum_key, v_haric)
                group by z.utm_medium
                order by adet desc
                limit 15
            ) t
        ), '[]'::jsonb),
        'cihazlar', coalesce((
            select jsonb_agg(jsonb_build_object('cihaz', t.cihaz, 'adet', t.adet) order by t.adet desc)
            from (
                select coalesce(nullif(z.cihaz, ''), 'bilinmiyor') as cihaz,
                       count(*)::int as adet
                from public.site_ziyaretler z
                where z.created_at >= v_since
                  and private.gunde5_analytics_kayit_dahil(z.user_id, z.oturum_key, v_haric)
                group by 1
            ) t
        ), '[]'::jsonb),
        'site', jsonb_build_object(
            'uyeler', (select count(*)::int from public.uye),
            'kulis', (select count(*)::int from public.itiraflar i where i.status = 'kulis' and i.silindi_at is null),
            'podyum', (select count(*)::int from public.itiraflar i where i.status = 'podyum' and i.silindi_at is null),
            'gizli_hikaye', (select count(*)::int from public.itiraflar i where i.is_gizli = true and i.silindi_at is null),
            'silinen', (select count(*)::int from public.itiraflar i where i.silindi_at is not null),
            'cevaplar', (select count(*)::int from public.itiraf_cevaplar),
            'oylar', (select count(*)::int from public.itiraf_oylar),
            'sikayetler', (select count(*)::int from public.itiraf_sikayetler)
        ),
        'son_kayitlar', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', z.id,
                'created_at', z.created_at,
                'sayfa', z.sayfa,
                'yol', z.yol,
                'referrer', z.referrer,
                'utm_source', z.utm_source,
                'utm_medium', z.utm_medium,
                'utm_campaign', z.utm_campaign,
                'oturum_key', z.oturum_key,
                'user_id', z.user_id
            ) order by z.created_at desc)
            from (
                select * from public.site_ziyaretler z
                where z.created_at >= v_since
                  and private.gunde5_analytics_kayit_dahil(z.user_id, z.oturum_key, v_haric)
                order by z.created_at desc
                limit 100
            ) z
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.master_ziyaret_istatistik(int, text) from public, anon;
grant execute on function public.master_ziyaret_istatistik(int, text) to authenticated;

notify pgrst, 'reload schema';
