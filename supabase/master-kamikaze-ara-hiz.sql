-- Kamikaze arama: başlık, hikaye metni, rumuz (+ #id)
-- SQL Editor'da bir kez Run.

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

    v_q := public.tr_arama_norm(trim(coalesce(p_body->>'q', '')));
    v_lim := least(greatest(coalesce((p_body->>'limit')::int, 40), 1), 80);
    v_id := null;

    if trim(coalesce(p_body->>'q', '')) ~ '^[0-9]+$' then
        v_id := trim(p_body->>'q')::bigint;
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
                   or public.tr_arama_norm(coalesce(i.baslik, '')) like '%' || v_q || '%'
                   or public.tr_arama_norm(coalesce(i.content_full, i.content_short, '')) like '%' || v_q || '%'
                   or public.tr_arama_norm(coalesce(i.username, '')) like '%' || v_q || '%'
                order by i.created_at desc
                limit v_lim
            ) t
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.master_kamikaze_ara(jsonb) from public, anon;
grant execute on function public.master_kamikaze_ara(jsonb) to authenticated;

notify pgrst, 'reload schema';
