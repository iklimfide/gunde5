-- Kamikaze yönetim paneli — Supabase SQL Editor'da bir kez çalıştırın.
-- js/kamikaze-config.js içindeki KAMIKAZE_API_TOKEN ile aynı olmalı.

insert into public.site_ayar (anahtar, deger)
values ('kamikaze_token', 'gunde5-kamikaze-DEGISTIR-bu-tokeni')
on conflict (anahtar) do update set deger = excluded.deger, updated_at = now();

create or replace function public.kamikaze_panel(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_expected text;
begin
    select deger into v_expected
    from public.site_ayar
    where anahtar = 'kamikaze_token';

    if v_expected is null
       or trim(coalesce(p_token, '')) = ''
       or p_token <> v_expected then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    return jsonb_build_object(
        'ok', true,
        'zaman', now(),
        'ozet', (
            select jsonb_build_object(
                'uye', (select count(*)::int from public.uye),
                'itiraf_aktif', (
                    select count(*)::int from public.itiraflar where silindi_at is null
                ),
                'kulis', (
                    select count(*)::int
                    from public.itiraflar
                    where status = 'kulis' and silindi_at is null
                ),
                'podyum', (
                    select count(*)::int
                    from public.itiraflar
                    where status = 'podyum' and silindi_at is null
                ),
                'silindi', (
                    select count(*)::int from public.itiraflar where silindi_at is not null
                ),
                'gizli', (
                    select count(*)::int
                    from public.itiraflar
                    where is_gizli = true and silindi_at is null
                ),
                'oy', (select count(*)::int from public.itiraf_oylar),
                'cevap', (select count(*)::int from public.itiraf_cevaplar),
                'sikayet', (select count(*)::int from public.itiraf_sikayetler),
                'sayfa_goruntulenme', (
                    select coalesce(sum(sayfa_goruntulenme), 0)::bigint from public.itiraflar
                ),
                'tekil_goruntulenme', (
                    select coalesce(sum(tekil_goruntulenme), 0)::bigint from public.itiraflar
                ),
                'up_toplam', (
                    select coalesce(sum(up_votes), 0)::bigint
                    from public.itiraflar
                    where silindi_at is null
                ),
                'down_toplam', (
                    select coalesce(sum(down_votes), 0)::bigint
                    from public.itiraflar
                    where silindi_at is null
                )
            )
        ),
        'site_ayar', coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'anahtar', s.anahtar,
                    'deger', s.deger,
                    'updated_at', s.updated_at
                )
                order by s.anahtar
            )
            from public.site_ayar s
        ), '[]'::jsonb),
        'podyum_donemler', coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'donem', i.podyum_donem,
                    'adet', count(*)::int,
                    'max_sira', max(i.podyum_sira)::int
                )
                order by i.podyum_donem desc
            )
            from public.itiraflar i
            where i.status = 'podyum'
              and i.silindi_at is null
              and i.podyum_donem is not null
            group by i.podyum_donem
        ), '[]'::jsonb),
        'kulis_lider', coalesce((
            select jsonb_agg(row_to_json(t)::jsonb)
            from (
                select
                    i.id,
                    i.username,
                    i.r,
                    i.b,
                    i.up_votes,
                    i.down_votes,
                    i.tekil_goruntulenme,
                    i.sayfa_goruntulenme,
                    i.is_gizli,
                    left(i.content_short, 80) as onizleme,
                    i.created_at
                from public.itiraflar i
                where i.status = 'kulis'
                  and i.silindi_at is null
                order by i.r desc nulls last, i.created_at desc
                limit 20
            ) t
        ), '[]'::jsonb),
        'son_itiraflar', coalesce((
            select jsonb_agg(row_to_json(t)::jsonb)
            from (
                select
                    i.id,
                    i.status,
                    i.username,
                    i.user_id,
                    i.r,
                    i.b,
                    i.up_votes,
                    i.down_votes,
                    i.podyum_donem,
                    i.podyum_sira,
                    i.is_gizli,
                    i.silindi_at,
                    i.tekil_goruntulenme,
                    i.sayfa_goruntulenme,
                    left(i.content_short, 100) as onizleme,
                    i.created_at
                from public.itiraflar i
                order by i.created_at desc
                limit 50
            ) t
        ), '[]'::jsonb),
        'son_uyeler', coalesce((
            select jsonb_agg(row_to_json(t)::jsonb)
            from (
                select
                    u.id,
                    u.username,
                    u.email,
                    u.gender,
                    u.dogum_yili,
                    u.yasadigi_yer,
                    u.created_at,
                    (
                        select count(*)::int
                        from public.itiraflar i
                        where i.user_id = u.id and i.silindi_at is null
                    ) as itiraf_sayisi
                from public.uye u
                order by u.created_at desc
                limit 30
            ) t
        ), '[]'::jsonb),
        'sikayetler', coalesce((
            select jsonb_agg(row_to_json(t)::jsonb)
            from (
                select
                    s.id,
                    s.itiraf_id,
                    s.sebep,
                    left(coalesce(s.aciklama, ''), 200) as aciklama,
                    s.created_at,
                    left(i.content_short, 80) as itiraf_onizleme,
                    i.status as itiraf_status,
                    i.username as itiraf_username
                from public.itiraf_sikayetler s
                left join public.itiraflar i on i.id = s.itiraf_id
                order by s.created_at desc
                limit 40
            ) t
        ), '[]'::jsonb),
        'gunluk_itiraf', coalesce((
            select jsonb_agg(
                jsonb_build_object('gun', g.gun, 'adet', g.adet)
                order by g.gun
            )
            from (
                select
                    to_char(i.created_at at time zone 'Europe/Istanbul', 'YYYY-MM-DD') as gun,
                    count(*)::int as adet
                from public.itiraflar i
                where i.created_at >= (now() - interval '14 days')
                group by 1
            ) g
        ), '[]'::jsonb),
        'gunluk_uye', coalesce((
            select jsonb_agg(
                jsonb_build_object('gun', g.gun, 'adet', g.adet)
                order by g.gun
            )
            from (
                select
                    to_char(u.created_at at time zone 'Europe/Istanbul', 'YYYY-MM-DD') as gun,
                    count(*)::int as adet
                from public.uye u
                where u.created_at >= (now() - interval '14 days')
                group by 1
            ) g
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.kamikaze_panel(text) from public;
grant execute on function public.kamikaze_panel(text) to anon, authenticated;
