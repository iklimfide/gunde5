-- İstatistik sayfası timeout düzeltmesi (runtime — SQL Editor'da Run)
-- Sebep: eski fonksiyon her satırda private.gunde5_analytics_kayit_dahil çağırıyordu
-- (satır başına auth.users sorgusu). Bu sürüm master UUID'yi bir kez alır, CTE ile tarar.
-- SECURITY DEFINER: yalnızca master_email_eslesir() sonrası; RLS tarama maliyeti yok.

drop function if exists public.master_ziyaret_istatistik(int);

create or replace function public.master_ziyaret_istatistik(
    p_gun int default 30,
    p_haric text default 'master'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_gun int;
    v_haric text;
    v_since timestamptz;
    v_master uuid;
    v_master_oturum text;
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
    v_toplam int;
    v_tekil_oturum int;
    v_girisli int;
    v_sayfalar jsonb;
    v_referrerlar jsonb;
    v_referrer_gruplu jsonb;
    v_utm_kaynaklar jsonb;
    v_utm_medium jsonb;
    v_cihazlar jsonb;
    v_son_kayitlar jsonb;
    v_en_begenilen jsonb;
    v_en_paylasilan jsonb;
    v_en_begenilmeyen jsonb;
    v_en_gorulen jsonb;
begin
    perform set_config('statement_timeout', '60000', true);

    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_gun := least(greatest(coalesce(p_gun, 30), 1), 365);
    v_haric := lower(trim(coalesce(p_haric, 'master')));
    if v_haric not in ('master', 'uyeler', 'yok') then
        v_haric := 'master';
    end if;
    v_since := now() - (v_gun || ' days')::interval;
    v_master := private.gunde5_master_user_uuid();
    v_master_oturum := case when v_master is not null then 'u:' || v_master::text else null end;

    -- site_ziyaretler (tek tarama)
    with fz as materialized (
        select z.*
        from public.site_ziyaretler z
        where z.created_at >= v_since
          and (
            v_haric = 'yok'
            or (v_haric = 'uyeler' and z.user_id is null and coalesce(z.oturum_key, '') !~ '^u:')
            or (
                v_haric = 'master'
                and (z.user_id is null or z.user_id is distinct from v_master)
                and (v_master is null or coalesce(z.oturum_key, '') is distinct from v_master_oturum)
            )
          )
    )
    select
        (select count(*)::int from fz),
        (select count(distinct oturum_key)::int from fz),
        (select count(*) filter (where user_id is not null)::int from fz),
        coalesce((
            select jsonb_agg(jsonb_build_object('sayfa', t.sayfa, 'adet', t.adet) order by t.adet desc)
            from (select sayfa, count(*)::int as adet from fz group by sayfa) t
        ), '[]'::jsonb),
        coalesce((
            select jsonb_agg(jsonb_build_object('referrer', t.referrer, 'adet', t.adet) order by t.adet desc)
            from (
                select coalesce(nullif(referrer, ''), '(direkt / bilinmiyor)') as referrer,
                       count(*)::int as adet
                from fz group by 1 order by adet desc limit 25
            ) t
        ), '[]'::jsonb),
        coalesce((
            select jsonb_agg(jsonb_build_object('kaynak', t.kaynak, 'adet', t.adet) order by t.adet desc)
            from (
                select case
                    when coalesce(referrer, '') = '' then 'direct / bilinmiyor'
                    when referrer ilike '%t.co%' then 't.co'
                    when referrer ilike '%android-app://com.twitter.android%' then 'android-app://com.twitter.android/'
                    when referrer ilike '%google.%' or referrer ilike '%google.com%' then 'google'
                    else 'diğerleri'
                end as kaynak,
                count(*)::int as adet
                from fz group by 1
            ) t
        ), '[]'::jsonb),
        coalesce((
            select jsonb_agg(jsonb_build_object('utm_source', t.utm_source, 'adet', t.adet) order by t.adet desc)
            from (
                select utm_source, count(*)::int as adet
                from fz where utm_source is not null
                group by utm_source order by adet desc limit 25
            ) t
        ), '[]'::jsonb),
        coalesce((
            select jsonb_agg(jsonb_build_object('utm_medium', t.utm_medium, 'adet', t.adet) order by t.adet desc)
            from (
                select utm_medium, count(*)::int as adet
                from fz where utm_medium is not null
                group by utm_medium order by adet desc limit 15
            ) t
        ), '[]'::jsonb),
        coalesce((
            select jsonb_agg(jsonb_build_object('cihaz', t.cihaz, 'adet', t.adet) order by t.adet desc)
            from (
                select coalesce(nullif(cihaz, ''), 'bilinmiyor') as cihaz, count(*)::int as adet
                from fz group by 1
            ) t
        ), '[]'::jsonb),
        coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', z.id, 'created_at', z.created_at, 'sayfa', z.sayfa, 'yol', z.yol,
                'referrer', z.referrer, 'utm_source', z.utm_source, 'utm_medium', z.utm_medium,
                'utm_campaign', z.utm_campaign, 'oturum_key', z.oturum_key, 'user_id', z.user_id
            ) order by z.created_at desc)
            from (select * from fz order by created_at desc limit 100) z
        ), '[]'::jsonb)
    into v_toplam, v_tekil_oturum, v_girisli,
         v_sayfalar, v_referrerlar, v_referrer_gruplu,
         v_utm_kaynaklar, v_utm_medium, v_cihazlar, v_son_kayitlar;

    -- analytics oturumları
    with fs as materialized (
        select s.*
        from public.site_analytics_sessions s
        where s.started_at >= v_since
          and (
            v_haric = 'yok'
            or (v_haric = 'uyeler' and s.user_id is null)
            or (v_haric = 'master' and (s.user_id is null or s.user_id is distinct from v_master))
          )
    )
    select count(distinct public.analytics_kimlik(user_id, visitor_id))::int
    into v_tekil_ziyaretci
    from fs;

    select
        count(*)::int,
        count(*) filter (where load_more_count >= 1)::int,
        coalesce(avg(nullif(stories_loaded, 0)), 0),
        coalesce(avg(greatest(
            active_seconds,
            extract(epoch from (last_active_at - started_at))::int
        )), 0)
    into v_index_oturum, v_load_more_oturum, v_avg_stories, v_avg_active
    from public.site_analytics_sessions s
    where s.started_at >= v_since
      and coalesce(s.sayfa, '') = 'index'
      and (
        v_haric = 'yok'
        or (v_haric = 'uyeler' and s.user_id is null)
        or (v_haric = 'master' and (s.user_id is null or s.user_id is distinct from v_master))
      );

    -- geri gelen (iki dar tarama + join)
    with cur as materialized (
        select distinct public.analytics_kimlik(s.user_id, s.visitor_id) as kid
        from public.site_analytics_sessions s
        where s.started_at >= v_since
          and (
            v_haric = 'yok'
            or (v_haric = 'uyeler' and s.user_id is null)
            or (v_haric = 'master' and (s.user_id is null or s.user_id is distinct from v_master))
          )
    ),
    past as materialized (
        select distinct public.analytics_kimlik(s.user_id, s.visitor_id) as kid
        from public.site_analytics_sessions s
        where s.started_at < v_since
          and (
            v_haric = 'yok'
            or (v_haric = 'uyeler' and s.user_id is null)
            or (v_haric = 'master' and (s.user_id is null or s.user_id is distinct from v_master))
          )
    )
    select count(*)::int into v_geri_gelen
    from cur c
    where exists (select 1 from past p where p.kid = c.kid);

    -- analytics olayları (tek tarama)
    with fe as materialized (
        select e.*
        from public.site_analytics_events e
        where e.created_at >= v_since
          and (
            v_haric = 'yok'
            or (v_haric = 'uyeler' and e.user_id is null)
            or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
          )
    ),
    story as materialized (
        select
            e.story_id,
            count(*) filter (where e.event_type = 'story_vote' and e.vote_type = 'like')::int as begeni,
            count(*) filter (where e.event_type = 'story_vote' and e.vote_type = 'dislike')::int as begenmeme,
            count(*) filter (where e.event_type = 'story_share')::int as paylasim,
            count(*) filter (where e.event_type = 'story_impression')::int as goruntulenme
        from fe e
        where e.story_id is not null
        group by e.story_id
    )
    select
        count(*) filter (where event_type = 'story_vote' and vote_type = 'like')::int,
        count(*) filter (where event_type = 'story_vote' and vote_type = 'dislike')::int,
        count(*) filter (where event_type = 'story_share')::int,
        exists (select 1 from fe where event_type = 'story_impression' limit 1),
        coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', t.story_id, 'baslik', t.baslik,
                'begeni', t.begeni, 'begenmeme', t.begenmeme, 'paylasim', t.paylasim
            ) order by t.begeni desc, t.story_id desc)
            from (
                select st.story_id, st.begeni, st.begenmeme, st.paylasim,
                    coalesce(nullif(trim(i.baslik), ''), left(coalesce(i.content_short, i.content_full, ''), 80)) as baslik
                from story st
                join public.itiraflar i on i.id = st.story_id
                where st.begeni > 0
                order by st.begeni desc, st.story_id desc
                limit 10
            ) t
        ), '[]'::jsonb),
        coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', t.story_id, 'baslik', t.baslik, 'paylasim', t.paylasim, 'begeni', t.begeni
            ) order by t.paylasim desc, t.story_id desc)
            from (
                select st.story_id, st.paylasim, st.begeni,
                    coalesce(nullif(trim(i.baslik), ''), left(coalesce(i.content_short, i.content_full, ''), 80)) as baslik
                from story st
                join public.itiraflar i on i.id = st.story_id
                where st.paylasim > 0
                order by st.paylasim desc, st.story_id desc
                limit 10
            ) t
        ), '[]'::jsonb),
        coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', t.story_id, 'baslik', t.baslik, 'begenmeme', t.begenmeme, 'begeni', t.begeni
            ) order by t.begenmeme desc, t.story_id desc)
            from (
                select st.story_id, st.begenmeme, st.begeni,
                    coalesce(nullif(trim(i.baslik), ''), left(coalesce(i.content_short, i.content_full, ''), 80)) as baslik
                from story st
                join public.itiraflar i on i.id = st.story_id
                where st.begenmeme > 0
                order by st.begenmeme desc, st.story_id desc
                limit 10
            ) t
        ), '[]'::jsonb),
        coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', t.story_id, 'baslik', t.baslik, 'goruntulenme', t.goruntulenme
            ) order by t.goruntulenme desc, t.story_id desc)
            from (
                select st.story_id, st.goruntulenme,
                    coalesce(nullif(trim(i.baslik), ''), left(coalesce(i.content_short, i.content_full, ''), 80)) as baslik
                from story st
                join public.itiraflar i on i.id = st.story_id
                where st.goruntulenme > 0
                order by st.goruntulenme desc, st.story_id desc
                limit 10
            ) t
        ), '[]'::jsonb)
    into v_begeni, v_begenmeme, v_paylasim, v_impression_var,
         v_en_begenilen, v_en_paylasilan, v_en_begenilmeyen, v_en_gorulen
    from fe;

    v_etkilesim_oran := case
        when coalesce(v_tekil_ziyaretci, 0) > 0 then
            round(((coalesce(v_begeni, 0) + coalesce(v_begenmeme, 0) + coalesce(v_paylasim, 0))::numeric
                / v_tekil_ziyaretci) * 100, 1)
        else 0
    end;

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
        'toplam', coalesce(v_toplam, 0),
        'tekil_oturum', coalesce(v_tekil_oturum, 0),
        'tekil_ziyaretci', coalesce(v_tekil_ziyaretci, 0),
        'girisli_ziyaret', coalesce(v_girisli, 0),
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
            'en_begenilen', coalesce(v_en_begenilen, '[]'::jsonb),
            'en_paylasilan', coalesce(v_en_paylasilan, '[]'::jsonb),
            'en_begenilmeyen', coalesce(v_en_begenilmeyen, '[]'::jsonb),
            'en_gorulen', case when v_impression_var then coalesce(v_en_gorulen, '[]'::jsonb) else null end
        ),
        'sayfalar', coalesce(v_sayfalar, '[]'::jsonb),
        'referrerlar', coalesce(v_referrerlar, '[]'::jsonb),
        'referrer_gruplu', coalesce(v_referrer_gruplu, '[]'::jsonb),
        'utm_kaynaklar', coalesce(v_utm_kaynaklar, '[]'::jsonb),
        'utm_medium', coalesce(v_utm_medium, '[]'::jsonb),
        'cihazlar', coalesce(v_cihazlar, '[]'::jsonb),
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
        'son_kayitlar', coalesce(v_son_kayitlar, '[]'::jsonb)
    );
end;
$$;

revoke all on function public.master_ziyaret_istatistik(int, text) from public, anon;
grant execute on function public.master_ziyaret_istatistik(int, text) to authenticated;

create index if not exists site_analytics_events_created_idx
    on public.site_analytics_events (created_at desc);

create index if not exists site_ziyaretler_created_user_idx
    on public.site_ziyaretler (created_at desc, user_id);

notify pgrst, 'reload schema';
