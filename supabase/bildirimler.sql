-- Bildirimler: hikayene beğeni (👍) ve yorum — dislike bildirimi yok
-- SQL Editor'da bir kez çalıştırın. İsteğe bağlı: bildirim-realtime.sql

create table if not exists public.bildirimler (
    id bigserial primary key,
    alici_id uuid not null references auth.users (id) on delete cascade,
    tip varchar(10) not null check (tip in ('begeni', 'yorum')),
    hikaye_id bigint not null references public.hikayeler (id) on delete cascade,
    yapan_id uuid not null references auth.users (id) on delete cascade,
    yapan_username varchar(50) not null,
    cevap_id bigint references public.hikaye_cevaplar (id) on delete set null,
    hikaye_status varchar(10),
    okundu boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.bildirimler
    add column if not exists hikaye_status varchar(10);

create index if not exists bildirimler_alici_okundu_idx
    on public.bildirimler (alici_id, okundu, created_at desc);

create index if not exists bildirimler_alici_created_idx
    on public.bildirimler (alici_id, created_at desc);

alter table public.bildirimler enable row level security;

grant select, update on public.bildirimler to authenticated;

drop policy if exists bildirimler_select_own on public.bildirimler;
create policy bildirimler_select_own on public.bildirimler
    for select to authenticated
    using (auth.uid() = alici_id);

drop policy if exists bildirimler_update_own on public.bildirimler;
create policy bildirimler_update_own on public.bildirimler
    for update to authenticated
    using (auth.uid() = alici_id)
    with check (auth.uid() = alici_id);

-- Yalnızca trigger içinden (REST ile insert yok)
create or replace function public.bildirim_olustur(
    p_alici_id uuid,
    p_tip text,
    p_hikaye_id bigint,
    p_yapan_id uuid,
    p_yapan_username text,
    p_cevap_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_status varchar(10);
begin
    if p_alici_id is null or p_yapan_id is null or p_alici_id = p_yapan_id then
        return;
    end if;
    if p_tip not in ('begeni', 'yorum') then
        return;
    end if;

    select i.status into v_status
    from public.hikayeler i
    where i.id = p_hikaye_id and i.silindi_at is null;

    if not found then
        return;
    end if;

    insert into public.bildirimler (
        alici_id, tip, hikaye_id, yapan_id, yapan_username, cevap_id, hikaye_status
    )
    values (
        p_alici_id,
        p_tip,
        p_hikaye_id,
        p_yapan_id,
        coalesce(nullif(trim(p_yapan_username), ''), 'uye'),
        p_cevap_id,
        v_status
    );
end;
$$;

revoke all on function public.bildirim_olustur(uuid, text, bigint, uuid, text, bigint) from public, anon, authenticated;

create or replace function public.trg_hikaye_oy_bildirim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_alici uuid;
    v_rumuz text;
begin
    if coalesce(NEW.oy, 0) <> 1 then
        return NEW;
    end if;
    if tg_op = 'UPDATE' and coalesce(OLD.oy, 0) = 1 then
        return NEW;
    end if;

    select i.user_id into v_alici
    from public.hikayeler i
    where i.id = NEW.hikaye_id;

    if v_alici is null or v_alici = NEW.user_id then
        return NEW;
    end if;

    select u.username into v_rumuz
    from public.uye u
    where u.id = NEW.user_id;

    perform public.bildirim_olustur(
        v_alici, 'begeni', NEW.hikaye_id, NEW.user_id, v_rumuz, null
    );
    return NEW;
end;
$$;

drop trigger if exists trg_hikaye_oy_bildirim on public.hikaye_oylar;
create trigger trg_hikaye_oy_bildirim
    after insert or update of oy on public.hikaye_oylar
    for each row
    execute function public.trg_hikaye_oy_bildirim();

create or replace function public.trg_hikaye_cevap_bildirim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_alici uuid;
begin
    select i.user_id into v_alici
    from public.hikayeler i
    where i.id = NEW.hikaye_id;

    if v_alici is null or v_alici = NEW.user_id then
        return NEW;
    end if;

    perform public.bildirim_olustur(
        v_alici,
        'yorum',
        NEW.hikaye_id,
        NEW.user_id,
        NEW.username,
        NEW.id
    );
    return NEW;
end;
$$;

drop trigger if exists trg_hikaye_cevap_bildirim on public.hikaye_cevaplar;
create trigger trg_hikaye_cevap_bildirim
    after insert on public.hikaye_cevaplar
    for each row
    execute function public.trg_hikaye_cevap_bildirim();

revoke all on function public.trg_hikaye_oy_bildirim() from public, anon, authenticated;
revoke all on function public.trg_hikaye_cevap_bildirim() from public, anon, authenticated;

notify pgrst, 'reload schema';
