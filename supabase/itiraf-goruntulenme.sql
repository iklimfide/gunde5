-- İtiraf görüntülenme: tekil ziyaret + sayfa görüntülenmesi (pageview)
-- Supabase SQL Editor'da bir kez çalıştırın.

alter table public.itiraflar
    add column if not exists tekil_goruntulenme int not null default 0,
    add column if not exists sayfa_goruntulenme int not null default 0;

create table if not exists public.itiraf_goruntulenmeler (
    itiraf_id bigint not null references public.itiraflar (id) on delete cascade,
    viewer_key text not null,
    created_at timestamptz not null default now(),
    primary key (itiraf_id, viewer_key)
);

create index if not exists itiraf_goruntulenmeler_itiraf_idx on public.itiraf_goruntulenmeler (itiraf_id);

alter table public.itiraf_goruntulenmeler enable row level security;

-- Yalnızca RPC (security definer) yazar; istemci doğrudan erişemez
revoke all on public.itiraf_goruntulenmeler from public, anon, authenticated;

create or replace function public.itiraf_goruntulenme_kaydet(p_itiraf_id bigint, p_viewer_key text)
returns json
language plpgsql
security definer
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
    if not exists (select 1 from public.itiraflar i where i.id = p_itiraf_id) then
        return null;
    end if;

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
