-- Index «Efsaneler» sırası: DB görüntülenme + analytics impression (anon erişimi)
-- SQL Editor'da bir kez Run.

create or replace function public.index_itiraf_listele_efsane(
    p_offset int default 0,
    p_limit int default 5
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_off int;
    v_lim int;
begin
    v_off := greatest(coalesce(p_offset, 0), 0);
    v_lim := least(greatest(coalesce(p_limit, 5), 1), 50);

    return coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'id', t.id,
                'baslik', t.baslik,
                'username', t.username,
                'age', t.age,
                'gender', t.gender,
                'city', t.city,
                'yasadigi_yer', t.yasadigi_yer,
                'content_short', t.content_short,
                'content_full', t.content_full,
                'up_votes', t.up_votes,
                'down_votes', t.down_votes,
                'created_at', t.created_at
            )
            order by
                t.goruntu desc,
                t.sayfa desc,
                t.created_at desc
        )
        from (
            select
                i.id,
                i.baslik,
                i.username,
                i.age,
                i.gender,
                i.city,
                i.yasadigi_yer,
                i.content_short,
                i.content_full,
                i.up_votes,
                i.down_votes,
                i.created_at,
                greatest(
                    coalesce(i.tekil_goruntulenme, 0),
                    coalesce(a.tekil, 0)
                ) as goruntu,
                greatest(
                    coalesce(i.sayfa_goruntulenme, 0),
                    coalesce(a.cogul, 0)
                ) as sayfa
            from public.itiraflar i
            left join lateral (
                select
                    count(*) filter (where e.event_type = 'story_impression')::int as cogul,
                    count(distinct public.analytics_kimlik(e.user_id, e.visitor_id))
                        filter (where e.event_type = 'story_impression')::int as tekil
                from public.site_analytics_events e
                where e.story_id = i.id
            ) a on true
            where i.silindi_at is null
              and i.created_at <= now()
            order by
                greatest(coalesce(i.tekil_goruntulenme, 0), coalesce(a.tekil, 0)) desc,
                greatest(coalesce(i.sayfa_goruntulenme, 0), coalesce(a.cogul, 0)) desc,
                i.created_at desc
            offset v_off
            limit v_lim
        ) t
    ), '[]'::jsonb);
end;
$$;

revoke all on function public.index_itiraf_listele_efsane(int, int) from public;
grant execute on function public.index_itiraf_listele_efsane(int, int) to anon, authenticated;

notify pgrst, 'reload schema';
