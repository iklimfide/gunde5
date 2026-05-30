-- Trafik (site_ziyaretler) ve metrik (site_analytics_*) ayırımı
-- SQL Editor: once 4a trafik, sonra 4b metrik (ayri Run — timeout onlemi)
-- Eski master_ziyaret_istatistik kaldirilir; frontend iki RPC cagirir.

-- =============================================================================
-- 4a — TRAFIK (istatistikler.html)
-- =============================================================================
create or replace function public.master_trafik_istatistik(
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
    v_master_oturum := case when v_master is not null then 'u:' || v_master::text else null end;

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
        'girisli_ziyaret', coalesce(v_girisli, 0),
        'sayfalar', coalesce(v_sayfalar, '[]'::jsonb),
        'referrerlar', coalesce(v_referrerlar, '[]'::jsonb),
        'referrer_gruplu', coalesce(v_referrer_gruplu, '[]'::jsonb),
        'utm_kaynaklar', coalesce(v_utm_kaynaklar, '[]'::jsonb),
        'utm_medium', coalesce(v_utm_medium, '[]'::jsonb),
        'cihazlar', coalesce(v_cihazlar, '[]'::jsonb),
        'son_kayitlar', coalesce(v_son_kayitlar, '[]'::jsonb),
        'site', jsonb_build_object(
            'uyeler', (select count(*)::int from public.uye),
            'kulis', (select count(*)::int from public.itiraflar i where i.status = 'kulis' and i.silindi_at is null),
            'podyum', (select count(*)::int from public.itiraflar i where i.status = 'podyum' and i.silindi_at is null),
            'gizli_hikaye', (select count(*)::int from public.itiraflar i where i.is_gizli = true and i.silindi_at is null),
            'silinen', (select count(*)::int from public.itiraflar i where i.silindi_at is not null),
            'cevaplar', (select count(*)::int from public.itiraf_cevaplar),
            'oylar', (select count(*)::int from public.itiraf_oylar),
            'sikayetler', (select count(*)::int from public.itiraf_sikayetler)
        )
    );
end;
$$;

revoke all on function public.master_trafik_istatistik(int, text) from public, anon;
grant execute on function public.master_trafik_istatistik(int, text) to authenticated;

notify pgrst, 'reload schema';
