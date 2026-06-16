-- G├╝nl├╝k trafik + hikaye okuma (site_ziyaretler + site_analytics_events)
-- SQL Editor'da bir kez Run. ─░statistikler sayfas─▒ master_gunluk_istatistik ├ğa─ş─▒r─▒r.
-- index-analytics.sql ve ziyaret-trafik.sql sonras─▒.

create or replace function public.master_gunluk_istatistik(
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
    v_gunluk jsonb;
    v_hikaye_matris jsonb;
    v_veri_baslangic timestamptz;
    v_bugun date;
    v_matris_baslangic date;
    v_index_arayuz jsonb;
    v_arama_terimleri jsonb;
    v_siralama_filtreleri jsonb;
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
    v_bugun := (now() at time zone 'Europe/Istanbul')::date;
    v_matris_baslangic := v_bugun - 6;

    with fz as materialized (
        select
            z.*,
            (z.created_at at time zone 'Europe/Istanbul')::date as gun
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
    ),
    fe as materialized (
        select
            e.*,
            (e.created_at at time zone 'Europe/Istanbul')::date as gun
        from public.site_analytics_events e
        where e.created_at >= v_since
          and (
            v_haric = 'yok'
            or (v_haric = 'uyeler' and e.user_id is null)
            or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
          )
    ),
    z_gun as (
        select
            gun,
            count(*)::int as sayfa_acilisi,
            count(distinct oturum_key)::int as tekil_oturum,
            count(*) filter (where user_id is not null)::int as girisli_ziyaret
        from fz
        group by gun
    ),
    e_gun as (
        select
            gun,
            count(distinct public.analytics_kimlik(user_id, visitor_id))::int as tekil_ziyaretci,
            count(distinct session_id)::int as analytics_oturum,
            count(*) filter (where event_type = 'page_view')::int as page_view,
            count(*) filter (where event_type = 'story_impression')::int as hikaye_okuma,
            count(*) filter (where event_type = 'story_vote' and vote_type = 'like')::int as begeni,
            count(*) filter (where event_type = 'story_vote' and vote_type = 'dislike')::int as begenmeme,
            count(*) filter (where event_type = 'story_share')::int as paylasim,
            count(*) filter (where event_type = 'load_more_click')::int as daha_fazla_oku,
            coalesce(sum((payload->>'active_delta')::int) filter (where event_type = 'heartbeat'), 0)::int as aktif_saniye
        from fe
        group by gun
    ),
    tum_gunler as (
        select gun from z_gun
        union
        select gun from e_gun
    ),
    birlesik as (
        select
            g.gun,
            coalesce(z.sayfa_acilisi, 0) as sayfa_acilisi,
            coalesce(z.tekil_oturum, 0) as tekil_oturum,
            coalesce(z.girisli_ziyaret, 0) as girisli_ziyaret,
            coalesce(e.tekil_ziyaretci, 0) as tekil_ziyaretci,
            coalesce(e.analytics_oturum, 0) as analytics_oturum,
            coalesce(e.page_view, 0) as page_view,
            coalesce(e.hikaye_okuma, 0) as hikaye_okuma,
            coalesce(e.begeni, 0) as begeni,
            coalesce(e.begenmeme, 0) as begenmeme,
            coalesce(e.paylasim, 0) as paylasim,
            coalesce(e.daha_fazla_oku, 0) as daha_fazla_oku,
            coalesce(e.aktif_saniye, 0) as aktif_saniye
        from tum_gunler g
        left join z_gun z on z.gun = g.gun
        left join e_gun e on e.gun = g.gun
        where (
            coalesce(z.sayfa_acilisi, 0)
            + coalesce(e.tekil_ziyaretci, 0)
            + coalesce(e.hikaye_okuma, 0)
        ) > 0
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'gun', to_char(b.gun, 'YYYY-MM-DD'),
        'gun_etiket', to_char(b.gun, 'DD/MM/YYYY'),
        'sayfa_acilisi', b.sayfa_acilisi,
        'tekil_oturum', b.tekil_oturum,
        'girisli_ziyaret', b.girisli_ziyaret,
        'tekil_ziyaretci', b.tekil_ziyaretci,
        'analytics_oturum', b.analytics_oturum,
        'page_view', b.page_view,
        'hikaye_okuma', b.hikaye_okuma,
        'begeni', b.begeni,
        'begenmeme', b.begenmeme,
        'paylasim', b.paylasim,
        'daha_fazla_oku', b.daha_fazla_oku,
        'aktif_saniye', b.aktif_saniye
    ) order by b.gun desc), '[]'::jsonb)
    into v_gunluk
    from birlesik b;

    with gun_list as (
        select (v_bugun - s)::date as gun
        from generate_series(6, 0, -1) as s
    ),
    fe_matris as materialized (
        select
            e.story_id,
            (e.created_at at time zone 'Europe/Istanbul')::date as gun
        from public.site_analytics_events e
        where e.created_at >= (v_matris_baslangic::timestamp at time zone 'Europe/Istanbul')
          and e.event_type = 'story_impression'
          and e.story_id is not null
          and (
            v_haric = 'yok'
            or (v_haric = 'uyeler' and e.user_id is null)
            or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
          )
    ),
    h_agg as (
        select story_id, gun, count(*)::int as okuma
        from fe_matris
        group by story_id, gun
    ),
    top20 as (
        select h.story_id, sum(h.okuma)::int as toplam
        from h_agg h
        group by h.story_id
        order by sum(h.okuma) desc, h.story_id desc
        limit 20
    ),
    gunler_json as (
        select coalesce(jsonb_agg(jsonb_build_object(
            'gun', to_char(gl.gun, 'YYYY-MM-DD'),
            'etiket', to_char(gl.gun, 'DD/MM')
        ) order by gl.gun), '[]'::jsonb) as gunler
        from gun_list gl
    ),
    satirlar_json as (
        select coalesce(jsonb_agg(jsonb_build_object(
            'id', t.story_id,
            'baslik', coalesce(nullif(trim(i.baslik), ''), left(coalesce(i.content_short, i.content_full, ''), 72)),
            'toplam', t.toplam,
            'okuma', (
                select coalesce(jsonb_agg(coalesce(ha.okuma, 0) order by gl.gun), '[]'::jsonb)
                from gun_list gl
                left join h_agg ha on ha.story_id = t.story_id and ha.gun = gl.gun
            )
        ) order by t.toplam desc, t.story_id desc), '[]'::jsonb) as satirlar
        from top20 t
        join public.itiraflar i on i.id = t.story_id
    )
    select jsonb_build_object(
        'gun_sayisi', 7,
        'baslangic', to_char(v_matris_baslangic, 'DD/MM/YYYY'),
        'bitis', to_char(v_bugun, 'DD/MM/YYYY'),
        'gunler', (select gunler from gunler_json),
        'satirlar', (select satirlar from satirlar_json)
    )
    into v_hikaye_matris;

    select least(
        (select min(z.created_at) from public.site_ziyaretler z),
        (select min(e.created_at) from public.site_analytics_events e)
    ) into v_veri_baslangic;

    select jsonb_build_object(
        'altbar_ara', count(*) filter (where e.event_type = 'altbar_ara_click')::int,
        'altbar_dun', count(*) filter (where e.event_type = 'altbar_dun_click')::int,
        'daha_fazla_toplam', count(*) filter (where e.event_type = 'load_more_click')::int,
        'daha_fazla_dun', count(*) filter (
            where e.event_type = 'load_more_click'
              and coalesce(e.payload->>'tip', '') = 'dun'
        )::int,
        'daha_fazla_onceki', count(*) filter (
            where e.event_type = 'load_more_click'
              and coalesce(e.payload->>'tip', '') = 'onceki'
        )::int,
        'arama', count(*) filter (where e.event_type = 'index_search')::int,
        'siralama_toplam', count(*) filter (where e.event_type = 'index_sort_change')::int
    )
    into v_index_arayuz
    from public.site_analytics_events e
    where e.created_at >= v_since
      and (
        v_haric = 'yok'
        or (v_haric = 'uyeler' and e.user_id is null)
        or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
      );

    select coalesce(jsonb_agg(jsonb_build_object('terim', s.terim, 'adet', s.adet) order by s.adet desc, s.terim asc), '[]'::jsonb)
    into v_arama_terimleri
    from (
        select u.terim, max(u.adet)::int as adet
        from (
            select q.terim, q.adet
            from (
                select left(lower(trim(coalesce(e.payload->>'query', ''))), 120) as terim,
                       count(*)::int as adet
                from public.site_analytics_events e
                where e.created_at >= v_since
                  and e.event_type = 'index_search'
                  and length(trim(coalesce(e.payload->>'query', ''))) >= 2
                  and (
                    v_haric = 'yok'
                    or (v_haric = 'uyeler' and e.user_id is null)
                    or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
                  )
                group by 1
            ) q
            where length(q.terim) >= 2

            union all

            select lower(trim(t.terim)) as terim, 0 as adet
            from public.index_arama_terimler t
            where length(trim(t.terim)) >= 2
        ) u
        group by u.terim
        order by max(u.adet) desc, u.terim asc
        limit 40
    ) s;

    select coalesce(jsonb_agg(jsonb_build_object(
        'kod', s.kod,
        'etiket', s.etiket,
        'adet', coalesce(c.adet, 0)
    ) order by coalesce(c.adet, 0) desc, s.sira), '[]'::jsonb)
    into v_siralama_filtreleri
    from (
        values
            (1, 'gulumseten', '­şöÑ En ├ğok g├╝l├╝msetenler'),
            (2, 'dun', '­şôà D├╝nk├╝ 5'),
            (3, 'rastgele', '­şÄ▓ Rastgele hikayeler'),
            (4, 'tum', '­şôÜ T├╝m hikayeler'),
            (5, 'yeni', 'Ôİò Bug├╝n├╝n 5''i'),
            (6, 'populer', 'Sevilenler (eski)'),
            (7, 'efsane', 'Efsaneler (eski)')
    ) as s(sira, kod, etiket)
    left join (
        select left(trim(coalesce(e.payload->>'siralama', '')), 20) as kod,
               count(*)::int as adet
        from public.site_analytics_events e
        where e.created_at >= v_since
          and e.event_type = 'index_sort_change'
          and coalesce(e.payload->>'siralama', '') in ('yeni', 'gulumseten', 'dun', 'rastgele', 'tum', 'populer', 'efsane')
          and (
            v_haric = 'yok'
            or (v_haric = 'uyeler' and e.user_id is null)
            or (v_haric = 'master' and (e.user_id is null or e.user_id is distinct from v_master))
          )
        group by 1
    ) c on c.kod = s.kod;

    v_index_arayuz := coalesce(v_index_arayuz, jsonb_build_object(
        'altbar_ara', 0, 'altbar_dun', 0, 'daha_fazla_toplam', 0,
        'daha_fazla_dun', 0, 'daha_fazla_onceki', 0, 'arama', 0,
        'siralama_toplam', 0
    )) || jsonb_build_object(
        'arama_terimleri', coalesce(v_arama_terimleri, '[]'::jsonb),
        'siralama_filtreleri', coalesce(v_siralama_filtreleri, '[]'::jsonb)
    );

    return jsonb_build_object(
        'ok', true,
        'gun', v_gun,
        'filtre', jsonb_build_object(
            'haric', v_haric,
            'etiket', case v_haric
                when 'uyeler' then 'Giri┼şli ├╝yeler ve master hari├ğ'
                when 'yok' then 'Filtre yok (herkes dahil)'
                else 'Master hesab─▒ hari├ğ'
            end
        ),
        'veri_baslangic', v_veri_baslangic,
        'gunluk', coalesce(v_gunluk, '[]'::jsonb),
        'hikaye_matris', coalesce(v_hikaye_matris, jsonb_build_object('gunler', '[]'::jsonb, 'satirlar', '[]'::jsonb)),
        'index_arayuz', coalesce(v_index_arayuz, jsonb_build_object(
            'altbar_ara', 0, 'altbar_dun', 0, 'daha_fazla_toplam', 0,
            'daha_fazla_dun', 0, 'daha_fazla_onceki', 0, 'arama', 0,
            'siralama_toplam', 0, 'arama_terimleri', '[]'::jsonb, 'siralama_filtreleri', '[]'::jsonb
        )),
        'not', 'hikaye_okuma = story_impression (oturumda hikaye ba┼ş─▒na en fazla 1); matris son 7 g├╝n, en ├ğok 20 hikaye'
    );
end;
$$;

revoke all on function public.master_gunluk_istatistik(int, text) from public, anon;
grant execute on function public.master_gunluk_istatistik(int, text) to authenticated;

notify pgrst, 'reload schema';
