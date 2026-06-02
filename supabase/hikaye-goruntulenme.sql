-- ESKİ ŞEMA: public.hikayeler (canlı itiraflar kurulumunda ÇALIŞTIRMAYIN)
-- Görüntülenme için: supabase/itiraf-goruntulenme.sql
-- İtiraf görüntülenme: tekil ziyaret + sayfa görüntülenmesi (pageview)

alter table public.hikayeler
    add column if not exists tekil_goruntulenme int not null default 0,
    add column if not exists sayfa_goruntulenme int not null default 0;

create table if not exists public.hikaye_goruntulenmeler (
    hikaye_id bigint not null references public.hikayeler (id) on delete cascade,
    viewer_key text not null,
    created_at timestamptz not null default now(),
    primary key (hikaye_id, viewer_key)
);

create index if not exists hikaye_goruntulenmeler_hikaye_idx on public.hikaye_goruntulenmeler (hikaye_id);

alter table public.hikaye_goruntulenmeler enable row level security;

-- Yalnızca RPC (security definer) yazar; istemci doğrudan erişemez
revoke all on public.hikaye_goruntulenmeler from public, anon, authenticated;

drop policy if exists hikaye_goruntulenme_sayac on public.hikayeler;
create policy hikaye_goruntulenme_sayac on public.hikayeler
    for update to anon, authenticated
    using (
        silindi_at is null
        and coalesce(current_setting('app.goruntulenme', true), '') = '1'
    )
    with check (coalesce(current_setting('app.goruntulenme', true), '') = '1');

drop policy if exists hikaye_goruntulenmeler_insert_anon on public.hikaye_goruntulenmeler;
create policy hikaye_goruntulenmeler_insert_anon on public.hikaye_goruntulenmeler
    for insert to anon, authenticated
    with check (
        exists (
            select 1 from public.hikayeler i
            where i.id = hikaye_id and i.silindi_at is null
        )
    );

grant insert on public.hikaye_goruntulenmeler to anon, authenticated;

create or replace function public.hikaye_goruntulenme_kaydet(p_hikaye_id bigint, p_viewer_key text)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_key text;
    v_tekil_artis int;
begin
    if p_hikaye_id is null then
        return null;
    end if;
    v_key := left(trim(coalesce(p_viewer_key, '')), 128);
    if length(v_key) < 8 then
        return null;
    end if;
    if not exists (select 1 from public.hikayeler i where i.id = p_hikaye_id and i.silindi_at is null) then
        return null;
    end if;

    perform set_config('app.goruntulenme', '1', true);

    update public.hikayeler
    set sayfa_goruntulenme = sayfa_goruntulenme + 1
    where id = p_hikaye_id;

    with ins as (
        insert into public.hikaye_goruntulenmeler (hikaye_id, viewer_key)
        values (p_hikaye_id, v_key)
        on conflict (hikaye_id, viewer_key) do nothing
        returning 1
    )
    select count(*)::int into v_tekil_artis from ins;

    if v_tekil_artis > 0 then
        update public.hikayeler
        set tekil_goruntulenme = tekil_goruntulenme + v_tekil_artis
        where id = p_hikaye_id;
    end if;

    return (
        select json_build_object(
            'sayfa_goruntulenme', i.sayfa_goruntulenme,
            'tekil_goruntulenme', i.tekil_goruntulenme
        )
        from public.hikayeler i
        where i.id = p_hikaye_id
    );
end;
$$;

revoke all on function public.hikaye_goruntulenme_kaydet(bigint, text) from public;
grant execute on function public.hikaye_goruntulenme_kaydet(bigint, text) to anon, authenticated;
