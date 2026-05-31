-- Müdavimler RPC — retention / sadakat laboratuvarı (site_analytics_events)
-- index-analytics.sql + analytics-first-source.sql sonrası Run.
-- Perf: tek dönem taraması (temp tablo), Istanbul günü timestamp aralığı, kaynak join.

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
    v_kaynak_tablo jsonb;
    v_bugun date;
    v_bugun_bas timestamptz;
    v_bugun_son timestamptz;
    v_dun_bas timestamptz;
    v_bugun_gelen int;
    v_dun_de_gelen int;
    v_dun_bugun_oran numeric;
begin
    perform set_config('statement_timeout', '120000', true);

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
    v_bugun_bas := timezone('Europe/Istanbul', v_bugun::timestamp);
    v_bugun_son := v_bugun_bas + interval '1 day';
    v_dun_bas := v_bugun_bas - interval '1 day';

    drop table if exists _mud_fe;
    create temp table _mud_fe on commit drop as
    select
        e.user_id,
        e.visitor_id,
        e.session_id,
        e.created_at,
        e.event_type,
        e.story_id,
        e.loaded_count,
        public.analytics_kimlik(e.user_id, e.visitor_id) as kid,
        (e.created_at at time zone 'Europe/Istanbul')::date as gun
    from public.site_analytics_events e
    where e.created_at >= v_since
      and (
        v_haric = 'yok'
        or (v_haric = 'uyeler' and e.user_id is null)
        or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
      );

    create index on _mud_fe (kid);
    create index on _mud_fe (visitor_id);
    create index on _mud_fe (session_id);

    drop table if exists _mud_bugun_kid;
    create temp table _mud_bugun_kid on commit drop as
    select distinct public.analytics_kimlik(e.user_id, e.visitor_id) as kid
    from public.site_analytics_events e
    where e.created_at >= v_bugun_bas
      and e.created_at < v_bugun_son
      and (
        v_haric = 'yok'
        or (v_haric = 'uyeler' and e.user_id is null)
        or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
      );
    create index on _mud_bugun_kid (kid);

    drop table if exists _mud_dun_kid;
    create temp table _mud_dun_kid on commit drop as
    select distinct public.analytics_kimlik(e.user_id, e.visitor_id) as kid
    from public.site_analytics_events e
    where e.created_at >= v_dun_bas
      and e.created_at < v_bugun_bas
      and (
        v_haric = 'yok'
        or (v_haric = 'uyeler' and e.user_id is null)
        or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
      );
    create index on _mud_dun_kid (kid);

    select
        (select count(*)::int from _mud_bugun_kid),
        (select count(*)::int from _mud_bugun_kid b join _mud_dun_kid d on d.kid = b.kid)
    into v_bugun_gelen, v_dun_de_gelen;

    v_dun_bugun_oran := case
        when coalesce(v_bugun_gelen, 0) > 0 then
            round((v_dun_de_gelen::numeric / v_bugun_gelen) * 100, 1)
        else 0
    end;

    drop table if exists _mud_kids;
    create temp table _mud_kids on commit drop as
    select distinct kid from _mud_fe;
    create index on _mud_kids (kid);

    drop table if exists _mud_ilk_global;
    create temp table _mud_ilk_global on commit drop as
    select
        k.kid,
        min((e.created_at at time zone 'Europe/Istanbul')::date) as ilk_gun,
        min(e.created_at) as ilk_ziyaret,
        max(e.created_at) as son_ziyaret
    from _mud_kids k
    join public.site_analytics_events e
        on public.analytics_kimlik(e.user_id, e.visitor_id) = k.kid
    where (
        v_haric = 'yok'
        or (v_haric = 'uyeler' and e.user_id is null)
        or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
    )
    group by k.kid;
    create index on _mud_ilk_global (kid);

    drop table if exists _mud_kimlik_agg;
    create temp table _mud_kimlik_agg on commit drop as
    select
        f.kid,
        count(distinct f.session_id)::int as oturum,
        count(distinct f.gun)::int as gun_sayisi,
        count(*) filter (where f.event_type = 'story_share')::int as paylasim,
        count(*) filter (where f.event_type = 'story_vote')::int as oy,
        count(distinct f.story_id) filter (where f.event_type = 'story_impression')::int as hikaye_impression,
        (count(*) filter (where f.event_type = 'story_share') > 0) as paylasim_yapti,
        (count(*) filter (where f.event_type = 'story_vote') > 0) as oy_verdi
    from _mud_fe f
    group by f.kid;
    create index on _mud_kimlik_agg (kid);

    select exists (select 1 from _mud_fe where event_type = 'story_impression' limit 1)
    into v_impression_var;

    drop table if exists _mud_hikaye_kid;
    create temp table _mud_hikaye_kid on commit drop as
    select
        k.kid,
        case
            when coalesce(v_impression_var, false) then k.hikaye_impression
            else coalesce(h.hikaye_loaded, 0)
        end as hikaye_sayisi
    from _mud_kimlik_agg k
    left join (
        select
            oy.kid,
            coalesce(sum(nullif(oy.max_loaded, 0)), 0)::int as hikaye_loaded
        from (
            select f.kid, f.session_id,
                max(f.loaded_count) filter (where f.loaded_count is not null) as max_loaded
            from _mud_fe f
            group by f.kid, f.session_id
        ) oy
        group by oy.kid
    ) h on h.kid = k.kid;
    create index on _mud_hikaye_kid (kid);

    drop table if exists _mud_gun_oturum;
    create temp table _mud_gun_oturum on commit drop as
    select
        f.kid,
        f.gun,
        count(distinct f.session_id)::int as oturum
    from _mud_fe f
    group by f.kid, f.gun;
    create index on _mud_gun_oturum (kid);

    with geri_set as (
        select k.kid from _mud_kimlik_agg k where k.oturum >= 2
    ),
    ozet as (
        select
            (select count(*)::int from _mud_kimlik_agg) as tekil,
            (select count(*)::int from geri_set) as geri_gelen,
            (select count(*)::int from _mud_kimlik_agg where gun_sayisi >= 2) as gun_2,
            (select count(*)::int from _mud_kimlik_agg where gun_sayisi >= 3) as gun_3,
            (select count(*)::int from _mud_kimlik_agg where gun_sayisi >= 5) as gun_5,
            (select count(*)::int from _mud_kimlik_agg where gun_sayisi >= 10) as gun_10,
            (select count(distinct go.kid)::int from _mud_gun_oturum go where go.oturum >= 2) as ayni_gun_tekrar,
            (
                select count(*)::int
                from _mud_kimlik_agg k
                where k.gun_sayisi >= 3
                  and exists (
                      select 1 from _mud_gun_oturum go
                      where go.kid = k.kid and go.oturum >= 2
                  )
            ) as guc_kullanici,
            coalesce((
                select avg(k.oturum::numeric)
                from _mud_kimlik_agg k
                where k.oturum >= 2
            ), 0) as ort_oturum,
            coalesce((
                select avg(hk.hikaye_sayisi::numeric)
                from _mud_hikaye_kid hk
                join geri_set g on g.kid = hk.kid
            ), 0) as ort_hikaye,
            coalesce((
                select round(
                    (count(*) filter (where k.paylasim_yapti)::numeric / nullif(count(*), 0)) * 100, 1
                )
                from _mud_kimlik_agg k
                join geri_set g on g.kid = k.kid
            ), 0) as paylasim_oran,
            coalesce((
                select round(
                    (count(*) filter (where k.oy_verdi)::numeric / nullif(count(*), 0)) * 100, 1
                )
                from _mud_kimlik_agg k
                join geri_set g on g.kid = k.kid
            ), 0) as begeni_oran,
            coalesce((
                select avg(
                    ((ig.son_ziyaret at time zone 'Europe/Istanbul')::date
                      - (ig.ilk_ziyaret at time zone 'Europe/Istanbul')::date)::numeric
                )
                from geri_set g
                join _mud_ilk_global ig on ig.kid = g.kid
                where ig.son_ziyaret > ig.ilk_ziyaret
            ), 0) as yasam_gun
    )
    select
        o.tekil, o.geri_gelen, o.gun_2, o.gun_3, o.gun_5, o.gun_10,
        o.ayni_gun_tekrar, o.guc_kullanici, o.ort_oturum, o.ort_hikaye,
        o.paylasim_oran, o.begeni_oran, o.yasam_gun
    into
        v_tekil, v_geri, v_gun2, v_gun3, v_gun5, v_gun10,
        v_ayni_gun, v_guc, v_avg_oturum, v_avg_hikaye,
        v_paylasim_oran, v_begeni_oran, v_yasam
    from ozet o;

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
            hk.hikaye_sayisi as hikaye,
            k.paylasim,
            k.oy
        from _mud_kimlik_agg k
        join _mud_hikaye_kid hk on hk.kid = k.kid
        order by k.gun_sayisi desc, k.oturum desc, hk.hikaye_sayisi desc
        limit 20
    ) t;

    drop table if exists _mud_gunluk_aktif;
    create temp table _mud_gunluk_aktif on commit drop as
    select distinct
        (e.created_at at time zone 'Europe/Istanbul')::date as gun,
        public.analytics_kimlik(e.user_id, e.visitor_id) as kid
    from public.site_analytics_events e
    where e.created_at >= v_since - interval '1 day'
      and e.created_at < v_bugun_son
      and (
        v_haric = 'yok'
        or (v_haric = 'uyeler' and e.user_id is null)
        or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
      );
    create index on _mud_gunluk_aktif (kid, gun);

    with gunluk_aktif as (
        select ga.gun, ga.kid
        from _mud_gunluk_aktif ga
        where ga.gun >= (v_since at time zone 'Europe/Istanbul')::date
    ),
    gunluk_hesap as (
        select
            ga.gun,
            count(*) filter (where ig.ilk_gun = ga.gun)::int as yeni,
            count(*) filter (where ig.ilk_gun < ga.gun)::int as geri_gelen,
            count(*) filter (where prev.kid is not null)::int as dun_de_gelen
        from gunluk_aktif ga
        join _mud_ilk_global ig on ig.kid = ga.kid
        left join _mud_gunluk_aktif prev on prev.kid = ga.kid and prev.gun = ga.gun - 1
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

    drop table if exists _mud_kid_kaynak;
    create temp table _mud_kid_kaynak on commit drop as
    select distinct on (v.kid)
        v.kid,
        coalesce(fs.analytics_first_source, 'Direct') as kaynak
    from (select distinct kid, visitor_id from _mud_fe) v
    left join public.site_analytics_first_source fs on fs.visitor_id = v.visitor_id
    order by v.kid, fs.first_seen_at asc nulls last;
    create index on _mud_kid_kaynak (kid);
    create index on _mud_kid_kaynak (kaynak);

    drop table if exists _mud_sure_agg;
    create temp table _mud_sure_agg on commit drop as
    select
        ds.kid,
        coalesce(sum(s.active_seconds), 0)::int as toplam_sure
    from (select distinct kid, session_id from _mud_fe) ds
    join public.site_analytics_sessions s on s.session_id = ds.session_id
    group by ds.kid;
    create index on _mud_sure_agg (kid);

    with kaynak_metrik as (
        select
            kk.kaynak,
            count(*)::int as tekil,
            count(*) filter (where ka.oturum >= 2)::int as geri_gelen,
            count(*) filter (where ka.gun_sayisi >= 2)::int as gun_2,
            count(*) filter (where b.kid is not null and d.kid is not null)::int as dun_de_gelen,
            round(coalesce(avg(hk.hikaye_sayisi::numeric), 0), 1) as ort_hikaye,
            round(coalesce(avg(sa.toplam_sure::numeric), 0), 0) as ort_sure
        from _mud_kid_kaynak kk
        join _mud_kimlik_agg ka on ka.kid = kk.kid
        left join _mud_hikaye_kid hk on hk.kid = kk.kid
        left join _mud_sure_agg sa on sa.kid = kk.kid
        left join _mud_bugun_kid b on b.kid = kk.kid
        left join _mud_dun_kid d on d.kid = kk.kid
        group by kk.kaynak
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'kaynak', km.kaynak,
        'tekil', km.tekil,
        'geri_gelen', km.geri_gelen,
        'gun_2', km.gun_2,
        'dun_de_gelen', km.dun_de_gelen,
        'ort_hikaye', km.ort_hikaye,
        'ort_sure', km.ort_sure
    ) order by km.tekil desc, km.kaynak), '[]'::jsonb)
    into v_kaynak_tablo
    from kaynak_metrik km;

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
        'kaynak_tablo', coalesce(v_kaynak_tablo, '[]'::jsonb),
        'impression_var', coalesce(v_impression_var, false)
    );
end;
$$;

revoke all on function public.master_mudavim_istatistik(int, text) from public, anon;
grant execute on function public.master_mudavim_istatistik(int, text) to authenticated;

notify pgrst, 'reload schema';
