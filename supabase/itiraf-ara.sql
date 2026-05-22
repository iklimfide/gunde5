-- Kulis / Podyum arama: rumuz, hikaye, cevap/yorum (SQL Editor'da bir kez)

drop function if exists public.itiraf_ara(jsonb);

create or replace function public.itiraf_ara(
    p_q text,
    p_status text default 'kulis',
    p_limit int default 40
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_q text;
    v_status text;
    v_lim int;
    v_pattern text;
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
    v_pattern := '%' || lower(v_q) || '%';

    select count(*)::int into v_adet
    from public.itiraflar i
    where i.status = v_status
      and i.silindi_at is null
      and (
          lower(i.username) like v_pattern
          or lower(coalesce(i.content_full, '')) like v_pattern
          or lower(coalesce(i.content_short, '')) like v_pattern
          or exists (
              select 1 from public.itiraf_cevaplar c
              where c.itiraf_id = i.id and lower(c.content) like v_pattern
          )
      );

    with eslesen as (
        select distinct on (i.id) i.*
        from public.itiraflar i
        where i.status = v_status
          and i.silindi_at is null
          and (
              lower(i.username) like v_pattern
              or lower(coalesce(i.content_full, '')) like v_pattern
              or lower(coalesce(i.content_short, '')) like v_pattern
              or exists (
                  select 1 from public.itiraf_cevaplar c
                  where c.itiraf_id = i.id and lower(c.content) like v_pattern
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

notify pgrst, 'reload schema';
