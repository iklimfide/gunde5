-- Müdavimler RPC — retention / sadakat laboratuvarı (site_analytics_events)
-- index-analytics.sql + analytics-event-session-fix.sql sonrası Run.

create or replace function public.master_mudavim_istatistik(
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
    v_tekil int;
    v_geri int;
    v_gun2 int;
    v_gun3 int;
    v_gun5 int;
    v_gun10 int;
    v_ayni_gun int;
    v_guc int;
    v_avg_oturum numeric;
    v_avg_hikaye numeric;
    v_paylasim_oran numeric;
    v_begeni_oran numeric;
    v_yasam numeric;
    v_impression_var boolean;
    v_hunisi jsonb;
    v_en_sadik jsonb;
    v_gunluk jsonb;
    v_bugun date;
    v_bugun_gelen int;
    v_dun_de_gelen int;
    v_dun_bugun_oran numeric;
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

    -- Bugün / dün sadakat KPI (dönem filtresinden bağımsız; takvim günü Istanbul)
    with bugun_kid as (
        select distinct public.analytics_kimlik(e.user_id, e.visitor_id) as kid
        from public.site_analytics_events e
        where (e.created_at at time zone 'Europe/Istanbul')::date = v_bugun
          and (
            v_haric = 'yok'
            or (v_haric = 'uyeler' and e.user_id is null)
            or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
          )
    ),
    dun_kid as (
        select distinct public.analytics_kimlik(e.user_id, e.visitor_id) as kid
        from public.site_analytics_events e
        where (e.created_at at time zone 'Europe/Istanbul')::date = (v_bugun - 1)
          and (
            v_haric = 'yok'
            or (v_haric = 'uyeler' and e.user_id is null)
            or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
          )
    )
    select
        (select count(*)::int from bugun_kid),
        (select count(*)::int from bugun_kid b join dun_kid d on d.kid = b.kid)
    into v_bugun_gelen, v_dun_de_gelen;

    v_dun_bugun_oran := case
        when coalesce(v_bugun_gelen, 0) > 0 then
            round((v_dun_de_gelen::numeric / v_bugun_gelen) * 100, 1)
        else 0
    end;

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
    ilk_global as materialized (
        select
            public.analytics_kimlik(e.user_id, e.visitor_id) as kid,
            min((e.created_at at time zone 'Europe/Istanbul')::date) as ilk_gun,
            min(e.created_at) as ilk_ziyaret,
            max(e.created_at) as son_ziyaret
        from public.site_analytics_events e
        where (
            v_haric = 'yok'
            or (v_haric = 'uyeler' and e.user_id is null)
            or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
        )
        group by 1
    ),
    kimlik_raw as (
        select
            public.analytics_kimlik(e.user_id, e.visitor_id) as kid,
            e.session_id,
            (e.created_at at time zone 'Europe/Istanbul')::date as gun,
            e.event_type,
            e.story_id,
            e.loaded_count
        from fe e
    ),
    kimlik_agg as materialized (
        select
            kr.kid,
            count(distinct kr.session_id)::int as oturum,
            count(distinct kr.gun)::int as gun_sayisi,
            count(*) filter (where kr.event_type = 'story_share')::int as paylasim,
            count(*) filter (where kr.event_type = 'story_vote')::int as oy,
            count(distinct kr.story_id) filter (where kr.event_type = 'story_impression')::int as hikaye_impression,
            (count(*) filter (where kr.event_type = 'story_share') > 0) as paylasim_yapti,
            (count(*) filter (where kr.event_type = 'story_vote') > 0) as oy_verdi
        from kimlik_raw kr
        group by kr.kid
    ),
    oturum_yuk as (
        select
            kr.kid,
            kr.session_id,
            max(kr.loaded_count) filter (where kr.loaded_count is not null) as max_loaded
        from kimlik_raw kr
        group by kr.kid, kr.session_id
    ),
    hikaye_yuk as (
        select
            oy.kid,
            coalesce(sum(nullif(oy.max_loaded, 0)), 0)::int as hikaye_loaded
        from oturum_yuk oy
        group by oy.kid
    ),
    gun_oturum as (
        select
            kr.kid,
            kr.gun,
            count(distinct kr.session_id)::int as oturum
        from kimlik_raw kr
        group by kr.kid, kr.gun
    ),
    geri_set as (
        select k.kid
        from kimlik_agg k
        where k.oturum >= 2
    ),
    hikaye_kid as (
        select
            k.kid,
            case
                when (select exists (select 1 from fe where fe.event_type = 'story_impression' limit 1))
                then k.hikaye_impression
                else coalesce(h.hikaye_loaded, 0)
            end as hikaye_sayisi
        from kimlik_agg k
        left join hikaye_yuk h on h.kid = k.kid
    ),
    gunluk_aktif as (
        select distinct kr.gun, kr.kid
        from kimlik_raw kr
    ),
    gun_aralik as (
        select gs::date as gun
        from generate_series(
            (v_since at time zone 'Europe/Istanbul')::date,
            (now() at time zone 'Europe/Istanbul')::date,
            interval '1 day'
        ) gs
    ),
    gunluk_hesap as (
        select
            ga.gun,
            count(*) filter (where ig.ilk_gun = ga.gun)::int as yeni,
            count(*) filter (where ig.ilk_gun < ga.gun)::int as geri_gelen
        from gunluk_aktif ga
        join ilk_global ig on ig.kid = ga.kid
        group by ga.gun
    ),
    ozet as (
        select
            (select count(*)::int from kimlik_agg) as tekil,
            (select count(*)::int from geri_set) as geri_gelen,
            (select count(*)::int from kimlik_agg where gun_sayisi >= 2) as gun_2,
            (select count(*)::int from kimlik_agg where gun_sayisi >= 3) as gun_3,
            (select count(*)::int from kimlik_agg where gun_sayisi >= 5) as gun_5,
            (select count(*)::int from kimlik_agg where gun_sayisi >= 10) as gun_10,
            (select count(distinct go.kid)::int from gun_oturum go where go.oturum >= 2) as ayni_gun_tekrar,
            (
                select count(*)::int
                from kimlik_agg k
                where k.gun_sayisi >= 3
                  and exists (
                      select 1 from gun_oturum go
                      where go.kid = k.kid and go.oturum >= 2
                  )
            ) as guc_kullanici,
            coalesce((
                select avg(k.oturum::numeric)
                from kimlik_agg k
                where k.oturum >= 2
            ), 0) as ort_oturum,
            coalesce((
                select avg(hk.hikaye_sayisi::numeric)
                from hikaye_kid hk
                join geri_set g on g.kid = hk.kid
            ), 0) as ort_hikaye,
            coalesce((
                select round(
                    (count(*) filter (where k.paylasim_yapti)::numeric / nullif(count(*), 0)) * 100, 1
                )
                from kimlik_agg k
                join geri_set g on g.kid = k.kid
            ), 0) as paylasim_oran,
            coalesce((
                select round(
                    (count(*) filter (where k.oy_verdi)::numeric / nullif(count(*), 0)) * 100, 1
                )
                from kimlik_agg k
                join geri_set g on g.kid = k.kid
            ), 0) as begeni_oran,
            coalesce((
                select avg(
                    ((ig.son_ziyaret at time zone 'Europe/Istanbul')::date
                      - (ig.ilk_ziyaret at time zone 'Europe/Istanbul')::date)::numeric
                )
                from geri_set g
                join ilk_global ig on ig.kid = g.kid
                where ig.son_ziyaret > ig.ilk_ziyaret
            ), 0) as yasam_gun,
            (select exists (select 1 from fe where fe.event_type = 'story_impression' limit 1)) as impression_var
    )
    select
        o.tekil, o.geri_gelen, o.gun_2, o.gun_3, o.gun_5, o.gun_10,
        o.ayni_gun_tekrar, o.guc_kullanici, o.ort_oturum, o.ort_hikaye,
        o.paylasim_oran, o.begeni_oran, o.yasam_gun, o.impression_var
    into
        v_tekil, v_geri, v_gun2, v_gun3, v_gun5, v_gun10,
        v_ayni_gun, v_guc, v_avg_oturum, v_avg_hikaye,
        v_paylasim_oran, v_begeni_oran, v_yasam, v_impression_var
    from ozet o;

    -- loaded_count yedeği: impression yoksa ve ort_hikaye 0 ise oturum başına 5 varsay (metrikler ile uyumlu)
    if not coalesce(v_impression_var, false) and coalesce(v_avg_hikaye, 0) <= 0 and coalesce(v_geri, 0) > 0 then
        v_avg_hikaye := 5;
    end if;

    v_hunisi := jsonb_build_array(
        jsonb_build_object('etiket', 'Tekil Ziyaretçi', 'adet', coalesce(v_tekil, 0), 'oran', 100),
        jsonb_build_object(
            'etiket', 'Geri Gelen',
            'adet', coalesce(v_geri, 0),
            'oran', case when coalesce(v_tekil, 0) > 0 then round((v_geri::numeric / v_tekil) * 100, 1) else 0 end
        ),
        jsonb_build_object(
            'etiket', '2+ Gün Gelen',
            'adet', coalesce(v_gun2, 0),
            'oran', case when coalesce(v_geri, 0) > 0 then round((v_gun2::numeric / v_geri) * 100, 1) else 0 end
        ),
        jsonb_build_object(
            'etiket', '3+ Gün Gelen',
            'adet', coalesce(v_gun3, 0),
            'oran', case when coalesce(v_gun2, 0) > 0 then round((v_gun3::numeric / v_gun2) * 100, 1) else 0 end
        ),
        jsonb_build_object(
            'etiket', '5+ Gün Gelen',
            'adet', coalesce(v_gun5, 0),
            'oran', case when coalesce(v_gun3, 0) > 0 then round((v_gun5::numeric / v_gun3) * 100, 1) else 0 end
        ),
        jsonb_build_object(
            'etiket', '10+ Gün Gelen',
            'adet', coalesce(v_gun10, 0),
            'oran', case when coalesce(v_gun5, 0) > 0 then round((v_gun10::numeric / v_gun5) * 100, 1) else 0 end
        )
    );

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
    kimlik_raw as (
        select
            public.analytics_kimlik(e.user_id, e.visitor_id) as kid,
            e.session_id,
            (e.created_at at time zone 'Europe/Istanbul')::date as gun,
            e.event_type,
            e.story_id,
            e.loaded_count
        from fe e
    ),
    kimlik_agg as (
        select
            kr.kid,
            count(distinct kr.session_id)::int as oturum,
            count(distinct kr.gun)::int as gun_sayisi,
            count(*) filter (where kr.event_type = 'story_share')::int as paylasim,
            count(*) filter (where kr.event_type = 'story_vote')::int as oy,
            count(distinct kr.story_id) filter (where kr.event_type = 'story_impression')::int as hikaye_impression
        from kimlik_raw kr
        group by kr.kid
    ),
    oturum_yuk as (
        select kr.kid, kr.session_id,
            max(kr.loaded_count) filter (where kr.loaded_count is not null) as max_loaded
        from kimlik_raw kr
        group by kr.kid, kr.session_id
    ),
    hikaye_yuk as (
        select oy.kid, coalesce(sum(nullif(oy.max_loaded, 0)), 0)::int as hikaye_loaded
        from oturum_yuk oy
        group by oy.kid
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'oturum', t.oturum,
        'gun', t.gun_sayisi,
        'hikaye', t.hikaye,
        'paylasim', t.paylasim,
        'oy', t.oy
    ) order by t.gun_sayisi desc, t.oturum desc, t.hikaye desc), '[]'::jsonb)
    into v_en_sadik
    from (
        select
            k.oturum,
            k.gun_sayisi,
            case
                when coalesce(v_impression_var, false) then k.hikaye_impression
                else coalesce(h.hikaye_loaded, 0)
            end as hikaye,
            k.paylasim,
            k.oy
        from kimlik_agg k
        left join hikaye_yuk h on h.kid = k.kid
        order by k.gun_sayisi desc, k.oturum desc, 3 desc
        limit 20
    ) t;

    with ilk_global as (
        select
            public.analytics_kimlik(e.user_id, e.visitor_id) as kid,
            min((e.created_at at time zone 'Europe/Istanbul')::date) as ilk_gun
        from public.site_analytics_events e
        where (
            v_haric = 'yok'
            or (v_haric = 'uyeler' and e.user_id is null)
            or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
        )
        group by 1
    ),
    gunluk_aktif_global as (
        select distinct
            (e.created_at at time zone 'Europe/Istanbul')::date as gun,
            public.analytics_kimlik(e.user_id, e.visitor_id) as kid
        from public.site_analytics_events e
        where (
            v_haric = 'yok'
            or (v_haric = 'uyeler' and e.user_id is null)
            or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
        )
    ),
    gunluk_aktif as (
        select distinct ga.gun, ga.kid
        from gunluk_aktif_global ga
        where ga.gun >= (v_since at time zone 'Europe/Istanbul')::date
    ),
    gunluk_hesap as (
        select
            ga.gun,
            count(*) filter (where ig.ilk_gun = ga.gun)::int as yeni,
            count(*) filter (where ig.ilk_gun < ga.gun)::int as geri_gelen,
            count(*) filter (where exists (
                select 1 from gunluk_aktif_global prev
                where prev.kid = ga.kid and prev.gun = ga.gun - 1
            ))::int as dun_de_gelen
        from gunluk_aktif ga
        join ilk_global ig on ig.kid = ga.kid
        group by ga.gun
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'gun', to_char(gh.gun, 'YYYY-MM-DD'),
        'yeni', gh.yeni,
        'geri_gelen', gh.geri_gelen,
        'dun_de_gelen', gh.dun_de_gelen
    ) order by gh.gun), '[]'::jsonb)
    into v_gunluk
    from gunluk_hesap gh
    where (gh.yeni + gh.geri_gelen + gh.dun_de_gelen) > 0;

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
        'tekil_ziyaretci', coalesce(v_tekil, 0),
        'kpi', jsonb_build_object(
            'geri_gelen', coalesce(v_geri, 0),
            'gun_2_plus', coalesce(v_gun2, 0),
            'gun_3_plus', coalesce(v_gun3, 0),
            'gun_5_plus', coalesce(v_gun5, 0),
            'gun_10_plus', coalesce(v_gun10, 0),
            'ayni_gun_tekrar', coalesce(v_ayni_gun, 0),
            'guc_kullanici', coalesce(v_guc, 0),
            'ortalama_oturum', round(coalesce(v_avg_oturum, 0), 1),
            'ortalama_hikaye', round(coalesce(v_avg_hikaye, 0), 1),
            'paylasim_oran', coalesce(v_paylasim_oran, 0),
            'begeni_oran', coalesce(v_begeni_oran, 0),
            'yasam_suresi_gun', round(coalesce(v_yasam, 0), 1),
            'dun_de_gelen', coalesce(v_dun_de_gelen, 0),
            'bugun_gelen', coalesce(v_bugun_gelen, 0),
            'dun_bugun_sadakat_oran', coalesce(v_dun_bugun_oran, 0)
        ),
        'hunisi', coalesce(v_hunisi, '[]'::jsonb),
        'en_sadik', coalesce(v_en_sadik, '[]'::jsonb),
        'gunluk', coalesce(v_gunluk, '[]'::jsonb),
        'impression_var', coalesce(v_impression_var, false)
    );
end;
$$;

revoke all on function public.master_mudavim_istatistik(int, text) from public, anon;
grant execute on function public.master_mudavim_istatistik(int, text) to authenticated;

notify pgrst, 'reload schema';
