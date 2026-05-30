-- İstatistik sayfası: master_ziyaret_istatistik → itiraflar şeması
-- Hata: relation "public.hikayeler" does not exist
-- Yeni kurulum: index-analytics.sql (bu fix + index metrikleri). Yalnızca şema fix için bu dosya yeterli.

create or replace function public.master_ziyaret_istatistik(p_gun int default 30)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_gun int;
    v_since timestamptz;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_gun := least(greatest(coalesce(p_gun, 30), 1), 365);
    v_since := now() - (v_gun || ' days')::interval;

    return jsonb_build_object(
        'ok', true,
        'gun', v_gun,
        'toplam', (select count(*)::int from public.site_ziyaretler z where z.created_at >= v_since),
        'tekil_oturum', (
            select count(distinct z.oturum_key)::int
            from public.site_ziyaretler z
            where z.created_at >= v_since
        ),
        'girisli_ziyaret', (
            select count(*)::int
            from public.site_ziyaretler z
            where z.created_at >= v_since and z.user_id is not null
        ),
        'sayfalar', coalesce((
            select jsonb_agg(jsonb_build_object('sayfa', t.sayfa, 'adet', t.adet) order by t.adet desc)
            from (
                select z.sayfa, count(*)::int as adet
                from public.site_ziyaretler z
                where z.created_at >= v_since
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
                group by 1
                order by adet desc
                limit 25
            ) t
        ), '[]'::jsonb),
        'utm_kaynaklar', coalesce((
            select jsonb_agg(jsonb_build_object('utm_source', t.utm_source, 'adet', t.adet) order by t.adet desc)
            from (
                select z.utm_source, count(*)::int as adet
                from public.site_ziyaretler z
                where z.created_at >= v_since and z.utm_source is not null
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
                select * from public.site_ziyaretler
                where created_at >= v_since
                order by created_at desc
                limit 100
            ) z
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.master_ziyaret_istatistik(int) from public, anon;
grant execute on function public.master_ziyaret_istatistik(int) to authenticated;

notify pgrst, 'reload schema';
