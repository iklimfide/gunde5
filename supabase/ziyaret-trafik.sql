-- Ziyaret / trafik kaynağı (referrer, UTM, sayfa) — SQL Editor'da bir kez çalıştırın
-- İstatistik sayfası sonra master_ziyaret_istatistik RPC ile beslenecek.

create table if not exists public.site_ziyaretler (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    oturum_key text not null,
    user_id uuid references auth.users (id) on delete set null,
    sayfa varchar(40) not null,
    yol text not null,
    referrer text,
    utm_source varchar(120),
    utm_medium varchar(120),
    utm_campaign varchar(120),
    utm_term varchar(120),
    utm_content varchar(120),
    cihaz varchar(16),
    dil varchar(16)
);

create index if not exists site_ziyaretler_created_idx
    on public.site_ziyaretler (created_at desc);

create index if not exists site_ziyaretler_sayfa_idx
    on public.site_ziyaretler (sayfa, created_at desc);

create index if not exists site_ziyaretler_utm_source_idx
    on public.site_ziyaretler (utm_source, created_at desc)
    where utm_source is not null;

create index if not exists site_ziyaretler_referrer_idx
    on public.site_ziyaretler (referrer, created_at desc)
    where referrer is not null and referrer <> '';

alter table public.site_ziyaretler enable row level security;

-- Yalnızca ziyaret_kaydet (SECURITY DEFINER) insert eder; REST ile doğrudan tablo yok
revoke all on public.site_ziyaretler from anon, authenticated;
grant select on public.site_ziyaretler to authenticated;

-- Master: ham kayıt + ileride istatistik sayfası
drop policy if exists site_ziyaretler_select_master on public.site_ziyaretler;
create policy site_ziyaretler_select_master on public.site_ziyaretler
    for select to authenticated
    using (public.master_email_eslesir());

-- ---------------------------------------------------------------------------
-- Kayıt (anon + giriş yapmış)
-- p_body: { sayfa, yol, referrer?, utm_source?, utm_medium?, utm_campaign?,
--           utm_term?, utm_content?, cihaz?, dil?, oturum_key? }
-- ---------------------------------------------------------------------------
create or replace function public.ziyaret_kaydet(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_key text;
    v_sayfa text;
    v_yol text;
    v_ref text;
begin
    v_key := left(trim(coalesce(p_body->>'oturum_key', '')), 128);
    if length(v_key) < 8 then
        return jsonb_build_object('ok', false, 'hata', 'oturum_key gerekli');
    end if;

    v_sayfa := left(trim(coalesce(p_body->>'sayfa', '')), 40);
    v_yol := left(trim(coalesce(p_body->>'yol', '')), 500);
    if v_sayfa = '' or v_yol = '' then
        return jsonb_build_object('ok', false, 'hata', 'sayfa ve yol gerekli');
    end if;

    v_ref := nullif(left(trim(coalesce(p_body->>'referrer', '')), 500), '');

    -- Aynı oturum + aynı sayfa/yol: 5 dk içinde tekrar kayıt yok (yenileme spam)
    if exists (
        select 1 from public.site_ziyaretler z
        where z.oturum_key = v_key
          and z.yol = v_yol
          and z.created_at > now() - interval '5 minutes'
    ) then
        return jsonb_build_object('ok', true, 'atlandi', true);
    end if;

    insert into public.site_ziyaretler (
        oturum_key,
        user_id,
        sayfa,
        yol,
        referrer,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        cihaz,
        dil
    ) values (
        v_key,
        auth.uid(),
        v_sayfa,
        v_yol,
        v_ref,
        nullif(left(trim(coalesce(p_body->>'utm_source', '')), 120), ''),
        nullif(left(trim(coalesce(p_body->>'utm_medium', '')), 120), ''),
        nullif(left(trim(coalesce(p_body->>'utm_campaign', '')), 120), ''),
        nullif(left(trim(coalesce(p_body->>'utm_term', '')), 120), ''),
        nullif(left(trim(coalesce(p_body->>'utm_content', '')), 120), ''),
        nullif(left(trim(coalesce(p_body->>'cihaz', '')), 16), ''),
        nullif(left(trim(coalesce(p_body->>'dil', '')), 16), '')
    );

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.ziyaret_kaydet(jsonb) from public;
grant execute on function public.ziyaret_kaydet(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Master özet (istatistik sayfası için — p_gun: son kaç gün, varsayılan 30)
-- ---------------------------------------------------------------------------
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
            'kulis', (select count(*)::int from public.hikayeler i where i.status = 'kulis' and i.silindi_at is null),
            'podyum', (select count(*)::int from public.hikayeler i where i.status = 'podyum' and i.silindi_at is null),
            'gizli_hikaye', (select count(*)::int from public.hikayeler i where i.is_gizli = true and i.silindi_at is null),
            'silinen', (select count(*)::int from public.hikayeler i where i.silindi_at is not null),
            'cevaplar', (select count(*)::int from public.hikaye_cevaplar),
            'oylar', (select count(*)::int from public.hikaye_oylar),
            'sikayetler', (select count(*)::int from public.hikaye_sikayetler)
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
