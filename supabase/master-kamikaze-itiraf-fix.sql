-- Kamikaze paneli: hikayeler → itiraflar + anasayfa (index) verisi
-- Hata: relation "public.hikayeler" does not exist
-- Kurulum: master-kamikaze-panel.sql sonrası veya canlı itiraflar şemasında bir kez Run.

grant select on public.itiraf_sikayetler to authenticated;
grant update on public.itiraflar to authenticated;
grant update, delete on public.itiraf_cevaplar to authenticated;
grant delete on public.itiraf_oylar to authenticated;

do $$
begin
    if to_regprocedure('public.itiraf_puan_guncelle(bigint)') is not null then
        grant execute on function public.itiraf_puan_guncelle(bigint) to authenticated;
    elsif to_regprocedure('public.hikaye_puan_guncelle(bigint)') is not null then
        grant execute on function public.hikaye_puan_guncelle(bigint) to authenticated;
    end if;
end $$;

drop policy if exists itiraf_sikayetler_select_master on public.itiraf_sikayetler;
create policy itiraf_sikayetler_select_master on public.itiraf_sikayetler
    for select to authenticated
    using (public.master_email_eslesir());

drop policy if exists itiraf_oylar_select_master on public.itiraf_oylar;
create policy itiraf_oylar_select_master on public.itiraf_oylar
    for select to authenticated
    using (public.master_email_eslesir());

drop policy if exists itiraf_oylar_insert_master on public.itiraf_oylar;
create policy itiraf_oylar_insert_master on public.itiraf_oylar
    for insert to authenticated
    with check (public.master_email_eslesir());

drop policy if exists itiraf_oylar_update_master on public.itiraf_oylar;
create policy itiraf_oylar_update_master on public.itiraf_oylar
    for update to authenticated
    using (public.master_email_eslesir())
    with check (public.master_email_eslesir());

drop policy if exists itiraf_oylar_delete_master on public.itiraf_oylar;
create policy itiraf_oylar_delete_master on public.itiraf_oylar
    for delete to authenticated
    using (public.master_email_eslesir());

drop policy if exists itiraf_cevaplar_update_master on public.itiraf_cevaplar;
create policy itiraf_cevaplar_update_master on public.itiraf_cevaplar
    for update to authenticated
    using (public.master_email_eslesir())
    with check (public.master_email_eslesir());

drop policy if exists itiraf_cevaplar_delete_master on public.itiraf_cevaplar;
create policy itiraf_cevaplar_delete_master on public.itiraf_cevaplar
    for delete to authenticated
    using (public.master_email_eslesir());

create or replace function public.master_kamikaze_panel()
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    return jsonb_build_object(
        'ok', true,
        'zaman', now(),
        'ozet', (
            select jsonb_build_object(
                'uye', (select count(*)::int from public.uye),
                'hikaye_aktif', (
                    select count(*)::int
                    from public.itiraflar
                    where silindi_at is null
                ),
                'index', (
                    select count(*)::int
                    from public.itiraflar i
                    where i.silindi_at is null
                      and i.created_at <= now()
                ),
                'planli', (
                    select count(*)::int
                    from public.itiraflar i
                    where i.status = 'kulis'
                      and i.silindi_at is null
                      and i.created_at > now()
                ),
                'podyum', (
                    select count(*)::int
                    from public.itiraflar
                    where status = 'podyum' and silindi_at is null
                ),
                'silindi', (
                    select count(*)::int
                    from public.itiraflar
                    where silindi_at is not null
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
                    select coalesce(sum(sayfa_goruntulenme), 0)::bigint
                    from public.itiraflar
                ),
                'tekil_goruntulenme', (
                    select coalesce(sum(tekil_goruntulenme), 0)::bigint
                    from public.itiraflar
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
                    'donem', t.donem,
                    'adet', t.adet,
                    'max_sira', t.max_sira
                )
                order by t.donem desc
            )
            from (
                select
                    i.podyum_donem as donem,
                    count(*)::int as adet,
                    max(i.podyum_sira)::int as max_sira
                from public.itiraflar i
                where i.status = 'podyum'
                  and i.silindi_at is null
                  and i.podyum_donem is not null
                group by i.podyum_donem
            ) t
        ), '[]'::jsonb),
        'index_lider', coalesce((
            select jsonb_agg(row_to_json(t)::jsonb)
            from (
                select
                    i.id,
                    i.status,
                    i.username,
                    i.user_id,
                    u.email as user_email,
                    i.r,
                    i.b,
                    i.up_votes,
                    i.down_votes,
                    i.tekil_goruntulenme,
                    i.sayfa_goruntulenme,
                    i.is_gizli,
                    i.silindi_at,
                    i.content_full,
                    left(coalesce(i.content_full, i.content_short, ''), 120) as onizleme,
                    i.created_at
                from public.itiraflar i
                left join public.uye u on u.id = i.user_id
                where i.silindi_at is null
                  and i.created_at <= now()
                order by i.r desc nulls last, i.created_at desc
                limit 20
            ) t
        ), '[]'::jsonb),
        'son_hikayeler', coalesce((
            select jsonb_agg(row_to_json(t)::jsonb)
            from (
                select
                    i.id,
                    i.status,
                    i.username,
                    i.user_id,
                    u.email as user_email,
                    i.r,
                    i.b,
                    i.up_votes,
                    i.down_votes,
                    i.tekil_goruntulenme,
                    i.sayfa_goruntulenme,
                    i.podyum_donem,
                    i.podyum_sira,
                    i.is_gizli,
                    i.silindi_at,
                    i.content_full,
                    left(coalesce(i.content_full, i.content_short, ''), 120) as onizleme,
                    i.created_at
                from public.itiraflar i
                left join public.uye u on u.id = i.user_id
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
                    u.yurtdisi_sehir,
                    coalesce(u.durum, 'aktif') as durum,
                    coalesce(u.zorunlu_gizli, false) as zorunlu_gizli,
                    u.created_at,
                    (
                        select count(*)::int
                        from public.itiraflar i
                        where i.user_id = u.id and i.silindi_at is null
                    ) as hikaye_sayisi,
                    (
                        select count(*)::int
                        from public.itiraf_cevaplar c
                        where c.user_id = u.id
                    ) as yorum_sayisi
                from public.uye u
                order by u.created_at desc
                limit 30
            ) t
        ), '[]'::jsonb),
        'son_yorumlar', coalesce((
            select jsonb_agg(row_to_json(t)::jsonb)
            from (
                select
                    c.id,
                    c.itiraf_id as hikaye_id,
                    c.parent_id,
                    c.user_id,
                    c.content,
                    c.created_at,
                    u.username,
                    u.email,
                    i.status as hikaye_status,
                    (i.silindi_at is not null) as hikaye_silindi,
                    left(coalesce(i.content_full, i.content_short, ''), 100) as hikaye_onizleme
                from public.itiraf_cevaplar c
                left join public.uye u on u.id = c.user_id
                left join public.itiraflar i on i.id = c.itiraf_id
                order by c.created_at desc
                limit 50
            ) t
        ), '[]'::jsonb),
        'sikayetler', coalesce((
            select jsonb_agg(row_to_json(t)::jsonb)
            from (
                select
                    s.id,
                    s.itiraf_id as hikaye_id,
                    s.sebep,
                    left(coalesce(s.aciklama, ''), 200) as aciklama,
                    s.created_at,
                    left(coalesce(i.content_short, i.content_full, ''), 80) as hikaye_onizleme,
                    i.status as hikaye_status,
                    i.username as hikaye_username
                from public.itiraf_sikayetler s
                left join public.itiraflar i on i.id = s.itiraf_id
                order by s.created_at desc
                limit 40
            ) t
        ), '[]'::jsonb),
        'gunluk_hikaye', coalesce((
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

revoke all on function public.master_kamikaze_panel() from public, anon;
grant execute on function public.master_kamikaze_panel() to authenticated;

create or replace function public.master_kamikaze_ara(p_body jsonb)
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
    v_q text;
    v_lim int;
    v_id bigint;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_q := lower(trim(coalesce(p_body->>'q', '')));
    v_lim := least(greatest(coalesce((p_body->>'limit')::int, 40), 1), 80);
    v_id := null;

    if v_q ~ '^[0-9]+$' then
        v_id := v_q::bigint;
    end if;

    if v_q = '' then
        return jsonb_build_object(
            'ok', true,
            'q', '',
            'sayilar', jsonb_build_object('uyeler', 0, 'hikayeler', 0, 'yorumlar', 0),
            'uyeler', '[]'::jsonb,
            'hikayeler', '[]'::jsonb,
            'yorumlar', '[]'::jsonb
        );
    end if;

    if length(v_q) < 2 and v_id is null then
        return jsonb_build_object('ok', false, 'hata', 'en az 2 karakter');
    end if;

    return jsonb_build_object(
        'ok', true,
        'q', v_q,
        'sayilar', jsonb_build_object(
            'uyeler', (
                select count(*)::int
                from public.uye u
                where lower(coalesce(u.username, '')) like '%' || v_q || '%'
                   or lower(coalesce(u.email, '')) like '%' || v_q || '%'
            ),
            'hikayeler', (
                select count(*)::int
                from public.itiraflar i
                where (v_id is not null and i.id = v_id)
                   or lower(coalesce(i.content_full, i.content_short, '')) like '%' || v_q || '%'
                   or lower(coalesce(i.username, '')) like '%' || v_q || '%'
            ),
            'yorumlar', (
                select count(*)::int
                from public.itiraf_cevaplar c
                left join public.uye u on u.id = c.user_id
                where (v_id is not null and (c.id = v_id or c.itiraf_id = v_id))
                   or lower(coalesce(c.content, '')) like '%' || v_q || '%'
                   or lower(coalesce(u.username, '')) like '%' || v_q || '%'
                   or lower(coalesce(u.email, '')) like '%' || v_q || '%'
            )
        ),
        'uyeler', coalesce((
            select jsonb_agg(row_to_json(t)::jsonb)
            from (
                select
                    u.id,
                    u.username,
                    u.email,
                    u.gender,
                    u.dogum_yili,
                    u.yasadigi_yer,
                    u.yurtdisi_sehir,
                    coalesce(u.durum, 'aktif') as durum,
                    coalesce(u.zorunlu_gizli, false) as zorunlu_gizli,
                    u.created_at,
                    (
                        select count(*)::int
                        from public.itiraflar i
                        where i.user_id = u.id and i.silindi_at is null
                    ) as hikaye_sayisi,
                    (
                        select count(*)::int
                        from public.itiraf_cevaplar c
                        where c.user_id = u.id
                    ) as yorum_sayisi
                from public.uye u
                where lower(coalesce(u.username, '')) like '%' || v_q || '%'
                   or lower(coalesce(u.email, '')) like '%' || v_q || '%'
                order by u.created_at desc
                limit v_lim
            ) t
        ), '[]'::jsonb),
        'hikayeler', coalesce((
            select jsonb_agg(row_to_json(t)::jsonb)
            from (
                select
                    i.id,
                    i.status,
                    i.user_id,
                    i.username,
                    u.email as user_email,
                    i.is_gizli,
                    i.silindi_at,
                    i.r,
                    i.b,
                    i.up_votes,
                    i.down_votes,
                    i.tekil_goruntulenme,
                    i.sayfa_goruntulenme,
                    i.podyum_donem,
                    i.podyum_sira,
                    i.created_at,
                    i.content_full,
                    left(coalesce(i.content_full, i.content_short, ''), 200) as onizleme
                from public.itiraflar i
                left join public.uye u on u.id = i.user_id
                where (v_id is not null and i.id = v_id)
                   or lower(coalesce(i.content_full, i.content_short, '')) like '%' || v_q || '%'
                   or lower(coalesce(i.username, '')) like '%' || v_q || '%'
                order by i.created_at desc
                limit v_lim
            ) t
        ), '[]'::jsonb),
        'yorumlar', coalesce((
            select jsonb_agg(row_to_json(t)::jsonb)
            from (
                select
                    c.id,
                    c.itiraf_id as hikaye_id,
                    c.parent_id,
                    c.user_id,
                    c.content,
                    c.created_at,
                    u.username,
                    u.email,
                    i.status as hikaye_status,
                    (i.silindi_at is not null) as hikaye_silindi,
                    left(coalesce(i.content_full, i.content_short, ''), 100) as hikaye_onizleme
                from public.itiraf_cevaplar c
                left join public.uye u on u.id = c.user_id
                left join public.itiraflar i on i.id = c.itiraf_id
                where (v_id is not null and (c.id = v_id or c.itiraf_id = v_id))
                   or lower(coalesce(c.content, '')) like '%' || v_q || '%'
                   or lower(coalesce(u.username, '')) like '%' || v_q || '%'
                   or lower(coalesce(u.email, '')) like '%' || v_q || '%'
                order by c.created_at desc
                limit v_lim
            ) t
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.master_kamikaze_ara(jsonb) from public, anon;
grant execute on function public.master_kamikaze_ara(jsonb) to authenticated;

create or replace function public.master_kamikaze_hikaye_detay(p_body jsonb)
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
    v_hikaye_id bigint;
    v_row public.itiraflar%rowtype;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_hikaye_id := (p_body->>'hikaye_id')::bigint;
    if v_hikaye_id is null then
        return jsonb_build_object('ok', false, 'hata', 'hikaye_id gerekli');
    end if;

    select * into v_row from public.itiraflar where id = v_hikaye_id;
    if not found then
        return jsonb_build_object('ok', false, 'hata', 'hikaye bulunamadi');
    end if;

    return jsonb_build_object(
        'ok', true,
        'hikaye', (
            select jsonb_build_object(
                'id', i.id,
                'status', i.status,
                'user_id', i.user_id,
                'username', i.username,
                'user_email', u.email,
                'is_gizli', i.is_gizli,
                'silindi_at', i.silindi_at,
                'r', i.r,
                'b', i.b,
                'up_votes', i.up_votes,
                'down_votes', i.down_votes,
                'podyum_donem', i.podyum_donem,
                'podyum_sira', i.podyum_sira,
                'age', i.age,
                'gender', i.gender,
                'yasadigi_yer', i.yasadigi_yer,
                'yurtdisi_sehir', i.yurtdisi_sehir,
                'tekil_goruntulenme', i.tekil_goruntulenme,
                'sayfa_goruntulenme', i.sayfa_goruntulenme,
                'content_full', i.content_full,
                'created_at', i.created_at
            )
            from public.itiraflar i
            left join public.uye u on u.id = i.user_id
            where i.id = v_hikaye_id
        ),
        'yorumlar', coalesce((
            select jsonb_agg(row_to_json(t)::jsonb)
            from (
                select
                    c.id,
                    c.itiraf_id as hikaye_id,
                    c.parent_id,
                    c.user_id,
                    c.content,
                    c.created_at,
                    u.username,
                    u.email
                from public.itiraf_cevaplar c
                left join public.uye u on u.id = c.user_id
                where c.itiraf_id = v_hikaye_id
                order by c.created_at desc
                limit 200
            ) t
        ), '[]'::jsonb),
        'oylar', coalesce((
            select jsonb_agg(row_to_json(t)::jsonb)
            from (
                select
                    o.id,
                    o.itiraf_id as hikaye_id,
                    o.user_id,
                    o.oy,
                    o.created_at,
                    u.username,
                    u.email
                from public.itiraf_oylar o
                left join public.uye u on u.id = o.user_id
                where o.itiraf_id = v_hikaye_id
                order by o.created_at desc
                limit 300
            ) t
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.master_kamikaze_hikaye_detay(jsonb) from public, anon;
grant execute on function public.master_kamikaze_hikaye_detay(jsonb) to authenticated;

create or replace function public.master_oy_islem(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_islem text;
    v_oy_id bigint;
    v_hikaye_id bigint;
    v_uye_id uuid;
    v_oy smallint;
    v_row public.itiraf_oylar%rowtype;
    v_hikaye public.itiraflar%rowtype;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_islem := lower(trim(coalesce(p_body->>'islem', '')));
    v_oy_id := (p_body->>'oy_id')::bigint;
    v_hikaye_id := (p_body->>'hikaye_id')::bigint;
    v_uye_id := (p_body->>'uye_id')::uuid;
    v_oy := coalesce((p_body->>'oy')::smallint, 0);

    if v_islem not in ('ekle', 'guncelle', 'sil') then
        return jsonb_build_object('ok', false, 'hata', 'gecersiz islem');
    end if;

    if v_islem = 'ekle' then
        if v_hikaye_id is null or v_uye_id is null or v_oy not in (1, -1) then
            return jsonb_build_object('ok', false, 'hata', 'hikaye_id, uye_id ve oy gerekli');
        end if;
        update public.itiraf_oylar
        set oy = v_oy
        where itiraf_id = v_hikaye_id
          and user_id = v_uye_id;

        if not found then
            insert into public.itiraf_oylar (itiraf_id, user_id, oy)
            values (v_hikaye_id, v_uye_id, v_oy);
        end if;

        select * into v_row
        from public.itiraf_oylar
        where itiraf_id = v_hikaye_id
          and user_id = v_uye_id;
    elsif v_islem = 'guncelle' then
        if v_oy_id is null or v_oy not in (1, -1) then
            return jsonb_build_object('ok', false, 'hata', 'oy_id ve oy gerekli');
        end if;
        update public.itiraf_oylar
        set oy = v_oy
        where id = v_oy_id;

        if not found then
            return jsonb_build_object('ok', false, 'hata', 'oy bulunamadi');
        end if;

        select * into v_row from public.itiraf_oylar where id = v_oy_id;
        v_hikaye_id := v_row.itiraf_id;
    else
        if v_oy_id is null then
            return jsonb_build_object('ok', false, 'hata', 'oy_id gerekli');
        end if;
        select * into v_row from public.itiraf_oylar where id = v_oy_id;
        if not found then
            return jsonb_build_object('ok', false, 'hata', 'oy bulunamadi');
        end if;
        v_hikaye_id := v_row.itiraf_id;
        delete from public.itiraf_oylar where id = v_oy_id;
    end if;

    if to_regprocedure('public.itiraf_puan_guncelle(bigint)') is not null then
        perform public.itiraf_puan_guncelle(v_hikaye_id);
    elsif to_regprocedure('public.hikaye_puan_guncelle(bigint)') is not null then
        perform public.hikaye_puan_guncelle(v_hikaye_id);
    end if;

    select * into v_hikaye from public.itiraflar where id = v_hikaye_id;

    return jsonb_build_object(
        'ok', true,
        'silindi', (v_islem = 'sil'),
        'oy', case
            when v_islem = 'sil' then null
            else jsonb_build_object(
                'id', v_row.id,
                'hikaye_id', v_row.itiraf_id,
                'user_id', v_row.user_id,
                'oy', v_row.oy,
                'created_at', v_row.created_at
            )
        end,
        'hikaye', jsonb_build_object(
            'id', v_hikaye.id,
            'up_votes', v_hikaye.up_votes,
            'down_votes', v_hikaye.down_votes,
            'r', v_hikaye.r,
            'b', v_hikaye.b
        )
    );
end;
$$;

revoke all on function public.master_oy_islem(jsonb) from public, anon;
grant execute on function public.master_oy_islem(jsonb) to authenticated;

notify pgrst, 'reload schema';
