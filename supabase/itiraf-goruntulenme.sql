-- itiraflar görüntülenme sayaçları + RPC (canlı şema: public.itiraflar)
-- SQL Editor'da bir kez Run.

alter table public.itiraflar
    add column if not exists tekil_goruntulenme int not null default 0,
    add column if not exists sayfa_goruntulenme int not null default 0;

create table if not exists public.itiraf_goruntulenmeler (
    itiraf_id bigint not null references public.itiraflar (id) on delete cascade,
    viewer_key text not null,
    created_at timestamptz not null default now(),
    primary key (itiraf_id, viewer_key)
);

create index if not exists itiraf_goruntulenmeler_itiraf_idx
    on public.itiraf_goruntulenmeler (itiraf_id);

alter table public.itiraf_goruntulenmeler enable row level security;

revoke all on public.itiraf_goruntulenmeler from public, anon, authenticated;

drop policy if exists itiraflar_goruntulenme_sayac on public.itiraflar;
create policy itiraflar_goruntulenme_sayac on public.itiraflar
    for update to anon, authenticated
    using (
        silindi_at is null
        and coalesce(current_setting('app.goruntulenme', true), '') = '1'
    )
    with check (coalesce(current_setting('app.goruntulenme', true), '') = '1');

drop policy if exists itiraf_goruntulenmeler_insert on public.itiraf_goruntulenmeler;
create policy itiraf_goruntulenmeler_insert on public.itiraf_goruntulenmeler
    for insert to anon, authenticated
    with check (
        exists (
            select 1 from public.itiraflar i
            where i.id = itiraf_id and i.silindi_at is null
        )
    );

grant insert on public.itiraf_goruntulenmeler to anon, authenticated;

create or replace function public.itiraf_goruntulenme_kaydet(p_itiraf_id bigint, p_viewer_key text)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_key text;
    v_tekil_artis int;
begin
    if p_itiraf_id is null then
        return null;
    end if;
    v_key := left(trim(coalesce(p_viewer_key, '')), 128);
    if length(v_key) < 8 then
        return null;
    end if;
    if not exists (select 1 from public.itiraflar i where i.id = p_itiraf_id and i.silindi_at is null) then
        return null;
    end if;

    perform set_config('app.goruntulenme', '1', true);

    update public.itiraflar
    set sayfa_goruntulenme = sayfa_goruntulenme + 1
    where id = p_itiraf_id;

    with ins as (
        insert into public.itiraf_goruntulenmeler (itiraf_id, viewer_key)
        values (p_itiraf_id, v_key)
        on conflict (itiraf_id, viewer_key) do nothing
        returning 1
    )
    select count(*)::int into v_tekil_artis from ins;

    if v_tekil_artis > 0 then
        update public.itiraflar
        set tekil_goruntulenme = tekil_goruntulenme + v_tekil_artis
        where id = p_itiraf_id;
    end if;

    return (
        select json_build_object(
            'sayfa_goruntulenme', i.sayfa_goruntulenme,
            'tekil_goruntulenme', i.tekil_goruntulenme
        )
        from public.itiraflar i
        where i.id = p_itiraf_id
    );
end;
$$;

revoke all on function public.itiraf_goruntulenme_kaydet(bigint, text) from public;
grant execute on function public.itiraf_goruntulenme_kaydet(bigint, text) to anon, authenticated;

-- Kamikaze: itiraflar + analytics impression birleşimi (master)
create or replace function public.master_hikaye_goruntulenme_toplu(p_ids bigint[])
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
begin
    if not public.master_email_eslesir() then
        return '[]'::jsonb;
    end if;
    if p_ids is null or cardinality(p_ids) = 0 then
        return '[]'::jsonb;
    end if;

    return coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'id', i.id,
                'tekil_goruntulenme', greatest(
                    coalesce(i.tekil_goruntulenme, 0),
                    coalesce(a.tekil, 0)
                ),
                'sayfa_goruntulenme', greatest(
                    coalesce(i.sayfa_goruntulenme, 0),
                    coalesce(a.cogul, 0)
                )
            )
            order by i.id
        )
        from public.itiraflar i
        left join lateral (
            select
                count(*) filter (where e.event_type = 'story_impression')::int as cogul,
                count(distinct public.analytics_kimlik(e.user_id, e.visitor_id))
                    filter (where e.event_type = 'story_impression')::int as tekil
            from public.site_analytics_events e
            where e.story_id = i.id
        ) a on true
        where i.id = any (p_ids)
    ), '[]'::jsonb);
end;
$$;

revoke all on function public.master_hikaye_goruntulenme_toplu(bigint[]) from public, anon;
grant execute on function public.master_hikaye_goruntulenme_toplu(bigint[]) to authenticated;

notify pgrst, 'reload schema';
