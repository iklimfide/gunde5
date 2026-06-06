-- Türkçe arama: büyük/küçük harf + İ/I normalizasyonu
-- SQL Editor'da bir kez Run (index + Kamikaze + podyum araması).

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

-- Anasayfa arama (planlı hariç, silinmemiş)
create or replace function public.index_itiraf_ara(
    p_q text,
    p_offset int default 0,
    p_limit int default 5
)
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
    v_q text;
    v_pat text;
    v_off int;
    v_lim int;
begin
    v_q := trim(coalesce(p_q, ''));
    v_off := greatest(coalesce(p_offset, 0), 0);
    v_lim := least(greatest(coalesce(p_limit, 5), 1), 80);

    if char_length(v_q) < 3 then
        return '[]'::jsonb;
    end if;

    v_pat := '%' || public.tr_arama_norm(v_q) || '%';

    return coalesce((
        select jsonb_agg(row_to_json(t)::jsonb)
        from (
            select
                i.id,
                i.baslik,
                i.username,
                i.age,
                i.gender,
                i.city,
                i.yasadigi_yer,
                i.yurtdisi_sehir,
                i.content_short,
                i.content_full,
                i.up_votes,
                i.down_votes,
                i.created_at
            from public.itiraflar i
            where i.silindi_at is null
              and i.created_at <= now()
              and (
                  public.tr_arama_norm(coalesce(i.username, '')) like v_pat
                  or public.tr_arama_norm(coalesce(i.baslik, '')) like v_pat
                  or public.tr_arama_norm(coalesce(i.content_full, i.content_short, '')) like v_pat
                  or public.tr_arama_norm(coalesce(i.yasadigi_yer, '')) like v_pat
                  or public.tr_arama_norm(coalesce(i.city::text, '')) like v_pat
              )
            order by i.created_at desc
            offset v_off
            limit v_lim
        ) t
    ), '[]'::jsonb);
end;
$$;

revoke all on function public.index_itiraf_ara(text, int, int) from public;
grant execute on function public.index_itiraf_ara(text, int, int) to anon, authenticated;

-- Podyum / itiraf sayfası arama (itiraflar + yorumlar)
create or replace function public.itiraf_ara(
    p_q text,
    p_status text default 'kulis',
    p_limit int default 40
)
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
    v_q text;
    v_status text;
    v_lim int;
    v_pat text;
    v_adet int;
    v_sonuc jsonb;
begin
    v_q := trim(coalesce(p_q, ''));
    v_status := lower(trim(coalesce(p_status, 'kulis')));
    v_lim := least(greatest(coalesce(p_limit, 40), 1), 80);

    if char_length(v_q) < 2 then
        return jsonb_build_object('ok', false, 'hata', 'en az 2 karakter');
    end if;

    if v_status not in ('kulis', 'podyum') then
        v_status := 'kulis';
    end if;

    v_q := regexp_replace(v_q, '[%_\\]', '', 'g');
    v_pat := '%' || public.tr_arama_norm(v_q) || '%';

    select count(*)::int into v_adet
    from public.itiraflar i
    where i.status = v_status
      and i.silindi_at is null
      and (
          public.tr_arama_norm(coalesce(i.username, '')) like v_pat
          or public.tr_arama_norm(coalesce(i.baslik, '')) like v_pat
          or public.tr_arama_norm(coalesce(i.content_full, i.content_short, '')) like v_pat
          or exists (
              select 1 from public.itiraf_cevaplar c
              where c.itiraf_id = i.id
                and public.tr_arama_norm(coalesce(c.content, '')) like v_pat
          )
      );

    with eslesen as (
        select distinct on (i.id) i.*
        from public.itiraflar i
        where i.status = v_status
          and i.silindi_at is null
          and (
              public.tr_arama_norm(coalesce(i.username, '')) like v_pat
              or public.tr_arama_norm(coalesce(i.baslik, '')) like v_pat
              or public.tr_arama_norm(coalesce(i.content_full, i.content_short, '')) like v_pat
              or exists (
                  select 1 from public.itiraf_cevaplar c
                  where c.itiraf_id = i.id
                    and public.tr_arama_norm(coalesce(c.content, '')) like v_pat
              )
          )
        order by i.id, i.created_at desc
    ),
    sinirli as (
        select * from eslesen
        order by created_at desc
        limit v_lim
    )
    select coalesce(
        (select jsonb_agg(to_jsonb(s) order by s.created_at desc) from sinirli s),
        '[]'::jsonb
    ) into v_sonuc;

    return jsonb_build_object(
        'ok', true,
        'adet', coalesce(v_adet, 0),
        'gosterilen', coalesce(jsonb_array_length(v_sonuc), 0),
        'sonuc', coalesce(v_sonuc, '[]'::jsonb)
    );
end;
$$;

revoke all on function public.itiraf_ara(text, text, int) from public;
grant execute on function public.itiraf_ara(text, text, int) to anon, authenticated;

-- Geriye dönük: hikaye_ara → itiraf_ara
create or replace function public.hikaye_ara(
    p_q text,
    p_status text default 'kulis',
    p_limit int default 40
)
returns jsonb
language sql
security invoker
stable
set search_path = public
as $$
    select public.itiraf_ara(p_q, p_status, p_limit);
$$;

revoke all on function public.hikaye_ara(text, text, int) from public;
grant execute on function public.hikaye_ara(text, text, int) to anon, authenticated;

notify pgrst, 'reload schema';
