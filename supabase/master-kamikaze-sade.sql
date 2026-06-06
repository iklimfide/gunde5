-- Kamikaze: sade hikaye paneli (SQL Editor'da bir kez Run)
-- Panel yalnızca son hikayeler; arama: başlık, metin, rumuz; düzenleme: başlık + rumuz

create or replace function public.tr_arama_norm(p text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
    select replace(
        lower(
            translate(
                coalesce(p, ''),
                E'İIĞÜŞÖÇ',
                E'iıguşöç'
            )
        ),
        'ı', 'i'
    );
$$;

revoke all on function public.tr_arama_norm(text) from public;
grant execute on function public.tr_arama_norm(text) to anon, authenticated;

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
        'son_hikayeler', coalesce((
            select jsonb_agg(row_to_json(t)::jsonb)
            from (
                select
                    i.id,
                    i.status,
                    i.username,
                    i.baslik,
                    i.age,
                    i.gender,
                    i.yasadigi_yer,
                    i.yurtdisi_sehir,
                    i.is_gizli,
                    i.silindi_at,
                    i.up_votes,
                    i.down_votes,
                    i.tekil_goruntulenme,
                    i.sayfa_goruntulenme,
                    i.podyum_donem,
                    i.podyum_sira,
                    i.content_full,
                    left(coalesce(i.content_full, i.content_short, ''), 120) as onizleme,
                    i.created_at
                from public.itiraflar i
                order by i.created_at desc
                limit 80
            ) t
        ), '[]'::jsonb)
    );
end;
$$;

create or replace function public.master_kamikaze_ara(p_body jsonb)
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
    v_raw text;
    v_q text;
    v_pat text;
    v_lim int;
    v_id bigint;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_raw := trim(coalesce(p_body->>'q', ''));
    v_q := public.tr_arama_norm(v_raw);
    v_pat := '%' || v_q || '%';
    v_lim := least(greatest(coalesce((p_body->>'limit')::int, 40), 1), 80);
    v_id := null;

    if v_raw ~ '^[0-9]+$' then
        v_id := v_raw::bigint;
    end if;

    if v_q = '' then
        return jsonb_build_object(
            'ok', true,
            'q', '',
            'sayilar', jsonb_build_object('hikayeler', 0),
            'hikayeler', '[]'::jsonb
        );
    end if;

    if length(v_q) < 2 and v_id is null then
        return jsonb_build_object('ok', false, 'hata', 'en az 2 karakter');
    end if;

    return jsonb_build_object(
        'ok', true,
        'q', v_q,
        'sayilar', jsonb_build_object('hikayeler', 0),
        'hikayeler', coalesce((
            select jsonb_agg(row_to_json(t)::jsonb)
            from (
                select
                    i.id,
                    i.status,
                    i.username,
                    i.baslik,
                    i.age,
                    i.gender,
                    i.yasadigi_yer,
                    i.yurtdisi_sehir,
                    i.is_gizli,
                    i.silindi_at,
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
                where (v_id is not null and i.id = v_id)
                   or (v_id is null and (
                       public.tr_arama_norm(coalesce(i.username, '')) like v_pat
                       or public.tr_arama_norm(coalesce(i.baslik, '')) like v_pat
                       or public.tr_arama_norm(coalesce(i.content_full, i.content_short, '')) like v_pat
                   ))
                order by i.created_at desc
                limit v_lim
            ) t
        ), '[]'::jsonb)
    );
end;
$$;

create or replace function public.master_kamikaze_hikaye_detay(p_body jsonb)
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
    v_hikaye_id bigint;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_hikaye_id := coalesce(
        nullif(trim(coalesce(p_body->>'hikaye_id', '')), '')::bigint,
        nullif(trim(coalesce(p_body->>'itiraf_id', '')), '')::bigint
    );
    if v_hikaye_id is null then
        return jsonb_build_object('ok', false, 'hata', 'hikaye_id gerekli');
    end if;

    return jsonb_build_object(
        'ok', true,
        'hikaye', (
            select jsonb_build_object(
                'id', i.id,
                'status', i.status,
                'username', i.username,
                'baslik', i.baslik,
                'is_gizli', i.is_gizli,
                'silindi_at', i.silindi_at,
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
            where i.id = v_hikaye_id
        )
    );
end;
$$;

-- master_hikaye_islem: guncelle → baslik + username
create or replace function public.master_hikaye_islem(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_id bigint;
    v_islem text;
    v_row public.itiraflar%rowtype;
    v_tam text;
    v_kisa text;
    v_up int;
    v_down int;
    v_status text;
    v_age int;
    v_gender text;
    v_yer text;
    v_yurtdisi text;
    v_baslik text;
    v_rumuz text;
    v_created timestamptz;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_id := coalesce(
        nullif(trim(coalesce(p_body->>'itiraf_id', '')), '')::bigint,
        nullif(trim(coalesce(p_body->>'hikaye_id', '')), '')::bigint
    );
    v_islem := lower(trim(coalesce(p_body->>'islem', '')));
    if v_id is null or v_islem = '' then
        return jsonb_build_object('ok', false, 'hata', 'itiraf_id ve islem gerekli');
    end if;

    select * into v_row from public.itiraflar where id = v_id;
    if not found then
        return jsonb_build_object('ok', false, 'hata', 'hikaye bulunamadi');
    end if;

    perform set_config('gunde5.master_bypass', '1', true);

    if v_islem = 'meta' then
        if p_body ? 'age' then
            v_age := (p_body->>'age')::int;
            if v_age < 18 or v_age > 120 then
                return jsonb_build_object('ok', false, 'hata', 'yas 18-120 arasi olmali');
            end if;
            update public.itiraflar set age = v_age where id = v_id;
        end if;
        if p_body ? 'gender' then
            v_gender := lower(trim(coalesce(p_body->>'gender', '')));
            if v_gender not in ('male', 'female') then
                return jsonb_build_object('ok', false, 'hata', 'gecersiz cinsiyet');
            end if;
            update public.itiraflar set gender = v_gender where id = v_id;
        end if;
        if p_body ? 'yasadigi_yer' then
            v_yer := nullif(trim(coalesce(p_body->>'yasadigi_yer', '')), '');
            update public.itiraflar set yasadigi_yer = v_yer where id = v_id;
            if v_yer is distinct from 'yurtdisi' then
                update public.itiraflar set yurtdisi_sehir = null where id = v_id;
            end if;
        end if;
        if p_body ? 'yurtdisi_sehir' then
            v_yurtdisi := nullif(left(trim(coalesce(p_body->>'yurtdisi_sehir', '')), 80), '');
            update public.itiraflar set yurtdisi_sehir = v_yurtdisi where id = v_id;
        end if;
    elsif v_islem = 'guncelle' then
        v_tam := trim(coalesce(p_body->>'content_full', ''));
        if v_tam = '' then
            return jsonb_build_object('ok', false, 'hata', 'metin bos');
        end if;
        v_kisa := case when char_length(v_tam) <= 140 then v_tam else left(v_tam, 137) || '...' end;
        update public.itiraflar
        set content_full = v_tam, content_short = v_kisa
        where id = v_id;
        if p_body ? 'baslik' then
            v_baslik := nullif(left(trim(coalesce(p_body->>'baslik', '')), 120), '');
            update public.itiraflar set baslik = v_baslik where id = v_id;
        end if;
        if p_body ? 'username' then
            v_rumuz := nullif(left(trim(coalesce(p_body->>'username', '')), 50), '');
            if v_rumuz is null then
                return jsonb_build_object('ok', false, 'hata', 'rumuz bos olamaz');
            end if;
            update public.itiraflar set username = v_rumuz where id = v_id;
        end if;
    elsif v_islem = 'gizle' then
        update public.itiraflar set is_gizli = true where id = v_id;
    elsif v_islem = 'goster' then
        update public.itiraflar set is_gizli = false where id = v_id;
    elsif v_islem = 'sil' then
        update public.itiraflar
        set silindi_at = now(), status = 'silindi'
        where id = v_id;
    elsif v_islem = 'geri_al' then
        update public.itiraflar
        set silindi_at = null, status = 'kulis'
        where id = v_id;
    elsif v_islem = 'oylar' then
        v_up := coalesce((p_body->>'up_votes')::int, v_row.up_votes);
        v_down := coalesce((p_body->>'down_votes')::int, v_row.down_votes);
        if v_up < 0 or v_down < 0 then
            return jsonb_build_object('ok', false, 'hata', 'oy sayisi negatif olamaz');
        end if;
        update public.itiraflar set up_votes = v_up, down_votes = v_down where id = v_id;
        if to_regprocedure('public.itiraf_puan_guncelle(bigint)') is not null then
            perform public.itiraf_puan_guncelle(v_id);
        elsif to_regprocedure('public.hikaye_puan_guncelle(bigint)') is not null then
            perform public.hikaye_puan_guncelle(v_id);
        end if;
    elsif v_islem = 'status' then
        v_status := lower(trim(coalesce(p_body->>'status', '')));
        if v_status not in ('kulis', 'podyum', 'silindi') then
            return jsonb_build_object('ok', false, 'hata', 'status kulis, podyum veya silindi olmali');
        end if;
        update public.itiraflar
        set status = v_status,
            silindi_at = case when v_status = 'silindi' then coalesce(silindi_at, now()) else null end
        where id = v_id;
    elsif v_islem = 'yayin_tarihi' then
        if not p_body ? 'created_at' or nullif(trim(coalesce(p_body->>'created_at', '')), '') is null then
            return jsonb_build_object('ok', false, 'hata', 'created_at gerekli');
        end if;
        begin
            v_created := (p_body->>'created_at')::timestamptz;
        exception
            when others then
                return jsonb_build_object('ok', false, 'hata', 'gecersiz yayin tarihi');
        end;
        update public.itiraflar set created_at = v_created where id = v_id;
    else
        return jsonb_build_object('ok', false, 'hata', 'bilinmeyen islem');
    end if;

    select * into v_row from public.itiraflar where id = v_id;
    return jsonb_build_object(
        'ok', true,
        'hikaye', jsonb_build_object(
            'id', v_row.id,
            'status', v_row.status,
            'is_gizli', v_row.is_gizli,
            'silindi_at', v_row.silindi_at,
            'up_votes', v_row.up_votes,
            'down_votes', v_row.down_votes,
            'content_full', v_row.content_full,
            'content_short', v_row.content_short,
            'baslik', v_row.baslik,
            'username', v_row.username,
            'age', v_row.age,
            'gender', v_row.gender,
            'yasadigi_yer', v_row.yasadigi_yer,
            'yurtdisi_sehir', v_row.yurtdisi_sehir,
            'created_at', v_row.created_at
        )
    );
end;
$$;

revoke all on function public.master_kamikaze_panel() from public, anon;
grant execute on function public.master_kamikaze_panel() to authenticated;
revoke all on function public.master_kamikaze_ara(jsonb) from public, anon;
grant execute on function public.master_kamikaze_ara(jsonb) to authenticated;
revoke all on function public.master_kamikaze_hikaye_detay(jsonb) from public, anon;
grant execute on function public.master_kamikaze_hikaye_detay(jsonb) to authenticated;
revoke all on function public.master_hikaye_islem(jsonb) from public, anon;
grant execute on function public.master_hikaye_islem(jsonb) to authenticated;

notify pgrst, 'reload schema';
