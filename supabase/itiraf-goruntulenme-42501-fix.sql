-- 42501: itiraf_goruntulenme_kaydet (anon görüntülenme sayacı)
-- Sebep: anon rolünün itiraflar / itiraf_goruntulenmeler üzerinde UPDATE/INSERT yetkisi yok.
-- Canlı şema: public.itiraflar — SQL Editor'da bir kez Run.

-- Önce tam kurulum (RPC + policy); itiraf-goruntulenme-canli.sql ile aynı gövde + ek grant'lar
alter table public.itiraflar
    add column if not exists tekil_goruntulenme integer not null default 0,
    add column if not exists sayfa_goruntulenme integer not null default 0;

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

-- 42501 düzeltmesi: tablo/sütun düzeyi yetki (yalnızca sayaç alanları)
grant update (sayfa_goruntulenme, tekil_goruntulenme) on public.itiraflar to anon;
grant insert on public.itiraf_goruntulenmeler to anon, authenticated;

create or replace function public.itiraf_goruntulenme_kaydet(
    p_itiraf_id bigint,
    p_viewer_key text
)
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

    if not exists (
        select 1 from public.itiraflar i
        where i.id = p_itiraf_id and i.silindi_at is null
    ) then
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

create or replace function public.hikaye_goruntulenme_kaydet(
    p_hikaye_id bigint,
    p_viewer_key text
)
returns json
language plpgsql
security invoker
set search_path = public
as $$
begin
    return public.itiraf_goruntulenme_kaydet(p_hikaye_id, p_viewer_key);
end;
$$;

revoke all on function public.hikaye_goruntulenme_kaydet(bigint, text) from public;
grant execute on function public.hikaye_goruntulenme_kaydet(bigint, text) to anon, authenticated;

notify pgrst, 'reload schema';
