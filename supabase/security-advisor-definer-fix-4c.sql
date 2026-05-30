-- Adim 3/3 — master_ziyaret_istatistik + eski helper temizligi
set statement_timeout = '0';
set lock_timeout = '60s';

-- ---------------------------------------------------------------------------
-- master_ziyaret_istatistik â€” SECURITY INVOKER + private.gunde5_analytics_kayit_dahil
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
                when 'uyeler' then 'GiriÅŸli Ã¼yeler ve master hariÃ§'
                when 'yok' then 'Filtre yok (herkes dahil)'
                else 'Master hesabÄ± hariÃ§'
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
                        else 'diÄŸerleri'
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

drop function if exists public.master_user_uuid();
drop function if exists public.analytics_kayit_dahil(uuid, text, text);

notify pgrst, 'reload schema';

