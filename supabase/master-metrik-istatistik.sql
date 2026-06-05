-- Metrik RPC — olay tablosu birincil (impression calisiyor, sessions bos olabilir)
-- analytics-event-session-fix.sql sonrasi Run.
-- Bugünün 5 manuel sıra: once index-bugun5-sira.sql, sonra bu dosya.

create or replace function public.master_metrik_istatistik(
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
    v_tekil_ziyaretci int;
    v_geri_gelen int;
    v_index_oturum int;
    v_load_more_oturum int;
    v_load_more_adet int;
    v_avg_stories numeric;
    v_avg_active numeric;
    v_begeni int;
    v_begenmeme int;
    v_paylasim int;
    v_etkilesim_oran numeric;
    v_impression_var boolean;
    v_en_begenilen jsonb;
    v_en_paylasilan jsonb;
    v_en_begenilmeyen jsonb;
    v_en_gorulen jsonb;
    v_puan_sirali jsonb;
    v_bugun date;
    v_dun date;
    v_son_gun_hikayeler jsonb;
begin
    perform set_config('statement_timeout', '30000', true);

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
    v_bugun := (now() at time zone 'Europe/Istanbul')::date;
    v_dun := v_bugun - 1;

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
    ),
    oturum_yuk as materialized (
        select
            e.session_id,
            max(e.loaded_count) filter (where e.loaded_count is not null) as max_loaded
        from fe e
        group by e.session_id
    )
    select
        (select count(distinct public.analytics_kimlik(e.user_id, e.visitor_id))::int from fe e),
        (select count(distinct e.session_id)::int from fe e),
        (select count(distinct e.session_id)::int from fe e where e.event_type = 'load_more_click'),
        (select count(*)::int from fe e where e.event_type = 'load_more_click'),
        coalesce((select avg(nullif(max_loaded, 0)) from oturum_yuk), 0),
        coalesce((
            select avg(greatest(
                s.active_seconds,
                extract(epoch from (s.last_active_at - s.started_at))::int
            ))
            from public.site_analytics_sessions s
            where s.session_id in (select distinct fe.session_id from fe)
        ), (
            select coalesce(avg((fe.payload->>'active_delta')::int), 0)
            from fe where fe.event_type = 'heartbeat'
        ), 0),
        (select count(*)::int from fe where fe.event_type = 'story_vote' and fe.vote_type = 'like'),
        (select count(*)::int from fe where fe.event_type = 'story_vote' and fe.vote_type = 'dislike'),
        (select count(*)::int from fe where fe.event_type = 'story_share'),
        (select exists (select 1 from fe where fe.event_type = 'story_impression' limit 1)),
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
    into v_tekil_ziyaretci, v_index_oturum, v_load_more_oturum, v_load_more_adet,
         v_avg_stories, v_avg_active,
         v_begeni, v_begenmeme, v_paylasim, v_impression_var,
         v_en_begenilen, v_en_paylasilan, v_en_begenilmeyen, v_en_gorulen
    from (select 1) x;

    -- Geri gelen: seçilen dönemde aynı kişi 2+ oturum (gün farkı şart değil; aynı gün iki geliş sayılır)
    select count(*)::int into v_geri_gelen
    from (
        select public.analytics_kimlik(e.user_id, e.visitor_id) as kid
        from public.site_analytics_events e
        where e.created_at >= v_since
          and (
            v_haric = 'yok'
            or (v_haric = 'uyeler' and e.user_id is null)
            or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
          )
        group by 1
        having count(distinct e.session_id) >= 2
    ) geri;

    if coalesce(v_avg_stories, 0) <= 0 and coalesce(v_index_oturum, 0) > 0 then
        v_avg_stories := 5;
    end if;

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
            count(distinct public.analytics_kimlik(e.user_id, e.visitor_id))
                filter (where e.event_type = 'story_impression')::int as goruntulenme
        from fe e
        where e.story_id is not null
        group by e.story_id
    ),
    puanli as (
        select
            st.story_id as id,
            i.gender,
            coalesce(nullif(trim(i.baslik), ''), left(coalesce(i.content_short, i.content_full, ''), 80)) as baslik,
            greatest(coalesce(i.tekil_goruntulenme, 0), coalesce(st.goruntulenme, 0))::int as goruntulenme,
            st.begeni,
            st.begenmeme,
            st.paylasim,
            round(
                ((st.begeni - st.begenmeme)::numeric
                    / nullif(greatest(coalesce(i.tekil_goruntulenme, 0), coalesce(st.goruntulenme, 0)), 0)::numeric)
                * 100, 1
            ) as puan
        from story st
        join public.itiraflar i on i.id = st.story_id and i.silindi_at is null
        where greatest(coalesce(i.tekil_goruntulenme, 0), coalesce(st.goruntulenme, 0)) > 0
          and (st.begeni > 0 or st.begenmeme > 0)
    )
    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'baslik', p.baslik,
            'gender', p.gender,
            'goruntulenme', p.goruntulenme,
            'begeni', p.begeni,
            'begenmeme', p.begenmeme,
            'paylasim', p.paylasim,
            'puan', p.puan
        )
        order by p.puan desc nulls last, p.goruntulenme desc, p.id desc
    ), '[]'::jsonb)
    into v_puan_sirali
    from (
        select * from puanli
        order by puan desc nulls last, goruntulenme desc, id desc
        limit 100
    ) p;

    v_etkilesim_oran := case
        when coalesce(v_tekil_ziyaretci, 0) > 0 then
            round(((coalesce(v_begeni, 0) + coalesce(v_begenmeme, 0) + coalesce(v_paylasim, 0))::numeric
                / v_tekil_ziyaretci) * 100, 1)
        else 0
    end;

    select coalesce(jsonb_agg(t.row order by t.grup asc, t.sira asc), '[]'::jsonb)
    into v_son_gun_hikayeler
    from (
        with manuel as (
            select s.hikaye_ids
            from public.index_bugun5_sira s
            where s.gun = v_bugun
        ),
        bugun_h as (
            select
                i.id,
                i.created_at,
                i.tekil_goruntulenme,
                i.gender,
                coalesce(nullif(trim(i.baslik), ''), left(coalesce(i.content_short, i.content_full, ''), 80)) as baslik,
                'Bugün' as gun_etiket,
                to_char(i.created_at at time zone 'Europe/Istanbul', 'DD/MM/YYYY') as yayin_tarihi,
                coalesce(
                    array_position((select m.hikaye_ids from manuel m), i.id),
                    row_number() over (order by i.created_at asc)::int
                ) as sira
            from public.itiraflar i
            where i.silindi_at is null
              and i.created_at <= now()
              and (i.created_at at time zone 'Europe/Istanbul')::date = v_bugun
        ),
        dun_h as (
            select
                i.id,
                i.created_at,
                i.tekil_goruntulenme,
                i.gender,
                coalesce(nullif(trim(i.baslik), ''), left(coalesce(i.content_short, i.content_full, ''), 80)) as baslik,
                'Dün' as gun_etiket,
                to_char(i.created_at at time zone 'Europe/Istanbul', 'DD/MM/YYYY') as yayin_tarihi,
                row_number() over (order by i.created_at asc)::int as sira
            from public.itiraflar i
            where i.silindi_at is null
              and i.created_at <= now()
              and (i.created_at at time zone 'Europe/Istanbul')::date = v_dun
            order by i.created_at asc
            limit 5
        ),
        gun_hik as (
            select
                h.id,
                h.created_at,
                h.tekil_goruntulenme,
                h.gender,
                h.baslik,
                h.gun_etiket,
                h.yayin_tarihi,
                h.sira,
                0 as grup,
                true as sira_duzenlenebilir
            from bugun_h h
            union all
            select
                h.id,
                h.created_at,
                h.tekil_goruntulenme,
                h.gender,
                h.baslik,
                h.gun_etiket,
                h.yayin_tarihi,
                h.sira,
                1 as grup,
                false as sira_duzenlenebilir
            from dun_h h
        )
        select
            h.grup,
            h.sira,
            jsonb_build_object(
                'id', h.id,
                'baslik', h.baslik,
                'gender', h.gender,
                'gun_etiket', h.gun_etiket,
                'yayin_tarihi', h.yayin_tarihi,
                'goruntulenme', greatest(
                    coalesce(h.tekil_goruntulenme, 0),
                    coalesce(a.goruntulenme, 0)
                ),
                'begeni', coalesce(a.begeni, 0),
                'begenmeme', coalesce(a.begenmeme, 0),
                'paylasim', coalesce(a.paylasim, 0),
                'sira_duzenlenebilir', h.sira_duzenlenebilir
            ) as row
        from gun_hik h
        left join (
            select
                e.story_id,
                count(distinct public.analytics_kimlik(e.user_id, e.visitor_id))
                    filter (where e.event_type = 'story_impression')::int as goruntulenme,
                count(*) filter (where e.event_type = 'story_vote' and e.vote_type = 'like')::int as begeni,
                count(*) filter (where e.event_type = 'story_vote' and e.vote_type = 'dislike')::int as begenmeme,
                count(*) filter (where e.event_type = 'story_share')::int as paylasim
            from public.site_analytics_events e
            where e.story_id in (select id from gun_hik)
              and (
                v_haric = 'yok'
                or (v_haric = 'uyeler' and e.user_id is null)
                or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
              )
            group by e.story_id
        ) a on a.story_id = h.id
    ) t;

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
        'tekil_ziyaretci', coalesce(v_tekil_ziyaretci, 0),
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
            'load_more_adet', coalesce(v_load_more_adet, 0),
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
            'en_gorulen', case when v_impression_var then coalesce(v_en_gorulen, '[]'::jsonb) else null end,
            'puan_sirali', coalesce(v_puan_sirali, '[]'::jsonb),
            'son_gun_hikayeler', coalesce(v_son_gun_hikayeler, '[]'::jsonb),
            'bugun5_manuel_sira', exists (
                select 1 from public.index_bugun5_sira s where s.gun = v_bugun
            )
        )
    );
end;
$$;

revoke all on function public.master_metrik_istatistik(int, text) from public, anon;
grant execute on function public.master_metrik_istatistik(int, text) to authenticated;

notify pgrst, 'reload schema';
