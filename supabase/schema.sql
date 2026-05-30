-- gunde5.com — Supabase şeması (SQL Editor'da çalıştırın)
-- Daha önce mudavimler oluşturduysanız: supabase/rename-to-uye.sql dosyasını çalıştırın.

-- Üye profilleri (Auth kullanıcısı ile 1:1)
create table if not exists public.uye (
    id uuid primary key references auth.users (id) on delete cascade,
    username varchar(50) not null unique,
    email varchar(80) not null,
    gender varchar(6) not null check (gender in ('male', 'female')),
    dogum_yili int not null,
    avatar_url text,
    yasadigi_yer varchar(40),
    yurtdisi_sehir varchar(80),
    meslek varchar(40),
    medeni_durum varchar(40),
    created_at timestamptz not null default now()
);

-- İtiraflar (.cursorrules ile uyumlu sütunlar + user_id, is_gizli)
create table if not exists public.hikayeler (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    user_id uuid references auth.users (id) on delete set null,
    username varchar(50) not null,
    age int,
    gender varchar(6) not null check (gender in ('male', 'female')),
    city varchar(50),
    yasadigi_yer varchar(40),
    yurtdisi_sehir varchar(80),
    meslek varchar(40),
    medeni_durum varchar(40),
    avatar_url text,
    content_short varchar(140) not null,
    content_full text not null,
    baslik varchar(120),
    up_votes int not null default 0,
    down_votes int not null default 0,
    -- Gizli algoritma alanları (UI'da gösterilmez)
    -- b: net oy (up - down)
    -- r: puan P = (up - down) + (yorum_sayisi * 5)
    b int not null default 0,
    r int not null default 0,
    -- soft delete (kulis temizliği için)
    silindi_at timestamptz,
    tekil_goruntulenme int not null default 0,
    sayfa_goruntulenme int not null default 0,
    status varchar(10) not null default 'kulis' check (status in ('kulis', 'podyum', 'silindi')),
    podyum_sira smallint,
    podyum_donem varchar(32),
    is_gizli boolean not null default false
);

alter table public.hikayeler
    drop constraint if exists hikayeler_status_check;

alter table public.hikayeler
    add constraint hikayeler_status_check
    check (status in ('kulis', 'podyum', 'silindi'));

update public.hikayeler
set status = 'silindi'
where silindi_at is not null
  and status <> 'silindi';

-- Günlük 13:12 geçişi — güncel tanım: supabase/saat-1312-podyum.sql

create table if not exists public.site_ayar (
    anahtar text primary key,
    deger text not null,
    updated_at timestamptz not null default now()
);
alter table public.site_ayar enable row level security;
drop policy if exists site_ayar_select_all on public.site_ayar;
create policy site_ayar_select_all on public.site_ayar for select using (true);

create index if not exists hikayeler_status_created_idx on public.hikayeler (status, created_at desc);
create index if not exists hikayeler_user_idx on public.hikayeler (user_id, created_at desc);

-- Tekil ziyaretçi kaydı (viewer_key başına bir kez)
create table if not exists public.hikaye_goruntulenmeler (
    hikaye_id bigint not null references public.hikayeler (id) on delete cascade,
    viewer_key text not null,
    created_at timestamptz not null default now(),
    primary key (hikaye_id, viewer_key)
);

create index if not exists hikaye_goruntulenmeler_hikaye_idx on public.hikaye_goruntulenmeler (hikaye_id);

alter table public.hikaye_goruntulenmeler enable row level security;
revoke all on public.hikaye_goruntulenmeler from public, anon, authenticated;

create or replace function public.hikaye_goruntulenme_kaydet(p_hikaye_id bigint, p_viewer_key text)
returns json
language plpgsql
security definer
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
    if not exists (select 1 from public.hikayeler i where i.id = p_hikaye_id) then
        return null;
    end if;

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

-- Oy kayıtları (üye başına bir oy)
create table if not exists public.hikaye_oylar (
    id bigserial primary key,
    hikaye_id bigint not null references public.hikayeler (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    oy smallint not null check (oy in (1, -1)),
    created_at timestamptz not null default now(),
    unique (hikaye_id, user_id)
);

-- Puan hesaplama: b ve r kolonlarını güncelle
create or replace function public.hikaye_puan_guncelle(p_hikaye_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_yorum int;
    v_b int;
    v_r int;
begin
    if p_hikaye_id is null then
        return;
    end if;

    select count(*)::int
    into v_yorum
    from public.hikaye_cevaplar c
    where c.hikaye_id = p_hikaye_id;

    select (coalesce(i.up_votes, 0) - coalesce(i.down_votes, 0))
    into v_b
    from public.hikayeler i
    where i.id = p_hikaye_id;

    v_r := v_b + (coalesce(v_yorum, 0) * 5);

    update public.hikayeler
    set
        b = v_b,
        r = v_r
    where id = p_hikaye_id;
end;
$$;

revoke all on function public.hikaye_puan_guncelle(bigint) from public;
revoke all on function public.hikaye_puan_guncelle(bigint) from anon, authenticated;

-- Oy sayacı (yalnızca trigger; REST/RPC ile çağrılamaz)
create or replace function public.hikaye_oy_sayaci()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
begin
    if tg_op = 'INSERT' then
        update public.hikayeler
        set
            up_votes = up_votes + case when new.oy = 1 then 1 else 0 end,
            down_votes = down_votes + case when new.oy = -1 then 1 else 0 end
        where id = new.hikaye_id;
        perform public.hikaye_puan_guncelle(new.hikaye_id);
    elsif tg_op = 'UPDATE' then
        if new.hikaye_id = old.hikaye_id then
            update public.hikayeler
            set
                up_votes = greatest(
                    0,
                    up_votes
                        + case when new.oy = 1 then 1 else 0 end
                        - case when old.oy = 1 then 1 else 0 end
                ),
                down_votes = greatest(
                    0,
                    down_votes
                        + case when new.oy = -1 then 1 else 0 end
                        - case when old.oy = -1 then 1 else 0 end
                )
            where id = new.hikaye_id;
            perform public.hikaye_puan_guncelle(new.hikaye_id);
        else
            update public.hikayeler
            set
                up_votes = greatest(0, up_votes - case when old.oy = 1 then 1 else 0 end),
                down_votes = greatest(0, down_votes - case when old.oy = -1 then 1 else 0 end)
            where id = old.hikaye_id;

            update public.hikayeler
            set
                up_votes = up_votes + case when new.oy = 1 then 1 else 0 end,
                down_votes = down_votes + case when new.oy = -1 then 1 else 0 end
            where id = new.hikaye_id;

            perform public.hikaye_puan_guncelle(old.hikaye_id);
            perform public.hikaye_puan_guncelle(new.hikaye_id);
        end if;
    else
        update public.hikayeler
        set
            up_votes = greatest(0, up_votes - case when old.oy = 1 then 1 else 0 end),
            down_votes = greatest(0, down_votes - case when old.oy = -1 then 1 else 0 end)
        where id = old.hikaye_id;
        perform public.hikaye_puan_guncelle(old.hikaye_id);
    end if;
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_hikaye_oy_sayaci on public.hikaye_oylar;
create trigger trg_hikaye_oy_sayaci
after insert or update or delete on public.hikaye_oylar
for each row execute function public.hikaye_oy_sayaci();

revoke all on function public.hikaye_oy_sayaci() from public;
revoke all on function public.hikaye_oy_sayaci() from anon, authenticated;

-- Yorum/cevap değişince puanı güncelle (hikaye_cevaplar.sql da çalıştırılıyorsa bu trigger orada da tanımlanabilir)
create or replace function public.hikaye_cevap_puan_sayaci()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_new bigint;
    v_old bigint;
begin
    v_new := case when tg_op <> 'DELETE' then new.hikaye_id else null end;
    v_old := case when tg_op <> 'INSERT' then old.hikaye_id else null end;

    if v_new is not null then
        perform public.hikaye_puan_guncelle(v_new);
    end if;
    if v_old is not null and v_old <> v_new then
        perform public.hikaye_puan_guncelle(v_old);
    end if;
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_hikaye_cevap_puan_sayaci on public.hikaye_cevaplar;
create trigger trg_hikaye_cevap_puan_sayaci
after insert or update or delete on public.hikaye_cevaplar
for each row execute function public.hikaye_cevap_puan_sayaci();

revoke all on function public.hikaye_cevap_puan_sayaci() from public;
revoke all on function public.hikaye_cevap_puan_sayaci() from anon, authenticated;

drop function if exists public.oy_ver(bigint, integer);
drop function if exists public.eposta_rumuzdan(text);

grant usage on schema public to anon, authenticated;
grant select, update on public.uye to authenticated;
grant select on public.hikayeler to anon, authenticated;
grant insert on public.uye to authenticated;
grant insert on public.hikayeler to authenticated;
grant select, insert, update on public.hikaye_oylar to authenticated;
grant usage, select on sequence public.hikayeler_id_seq to authenticated;
grant usage, select on sequence public.hikaye_oylar_id_seq to authenticated;

alter table public.uye enable row level security;
alter table public.hikayeler enable row level security;
alter table public.hikaye_oylar enable row level security;

-- uye: tam profil yalnızca kendi oturumunda; kart için daraltılmış RPC kullanılır
drop policy if exists uye_select_all on public.uye;
drop policy if exists uye_select_own on public.uye;
create policy uye_select_own on public.uye for select to authenticated
    using (auth.uid() = id);

drop policy if exists uye_select_kart on public.uye;
drop policy if exists uye_select_cevap_yazar on public.uye;

revoke all on public.uye from anon;
grant select on public.uye to authenticated;

create or replace function public.uye_kart_profilleri(p_ids uuid[])
returns table (
    id uuid,
    username varchar(50),
    gender varchar(6),
    age int,
    avatar_url text,
    yasadigi_yer varchar(40),
    yurtdisi_sehir varchar(80),
    meslek varchar(40),
    medeni_durum varchar(40)
)
language sql
security definer
set search_path = public
as $$
    select
        u.id,
        u.username,
        u.gender,
        case
            when u.dogum_yili is null then null
            else greatest(extract(year from current_date)::int - u.dogum_yili, 0)
        end as age,
        u.avatar_url,
        u.yasadigi_yer,
        u.yurtdisi_sehir,
        u.meslek,
        u.medeni_durum
    from public.uye u
    where u.id = any(coalesce(p_ids, '{}'::uuid[]))
      and (
          exists (
              select 1
              from public.hikayeler i
              where i.user_id = u.id
                and i.is_gizli = false
                and i.silindi_at is null
          )
          or exists (
              select 1
              from public.hikaye_cevaplar c
              inner join public.hikayeler i on i.id = c.hikaye_id
              where c.user_id = u.id
                and i.is_gizli = false
                and i.silindi_at is null
          )
      );
$$;

revoke all on function public.uye_kart_profilleri(uuid[]) from public;
grant execute on function public.uye_kart_profilleri(uuid[]) to anon, authenticated;

drop policy if exists uye_insert_own on public.uye;
create policy uye_insert_own on public.uye for insert to authenticated
    with check (auth.uid() = id);

-- Auth kaydı → uye profili (signUp metadata ile)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.uye (id, username, email, gender, dogum_yili)
    values (
        new.id,
        coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), 'uye_' || left(replace(new.id::text, '-', ''), 8)),
        coalesce(new.email, ''),
        case when new.raw_user_meta_data->>'gender' in ('male', 'female') then new.raw_user_meta_data->>'gender' else 'female' end,
        coalesce((new.raw_user_meta_data->>'dogum_yili')::int, extract(year from now())::int - 18)
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.handle_deleted_user_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.hikayeler
    set is_gizli = true,
        username = 'Gizli Üye'
    where user_id = old.id;

    if exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'hikaye_cevaplar'
    ) then
        update public.hikaye_cevaplar
        set username = 'Gizli Üye'
        where user_id = old.id;
    end if;

    return old;
end;
$$;

drop trigger if exists on_auth_user_deleted_content on auth.users;
create trigger on_auth_user_deleted_content
    before delete on auth.users
    for each row execute function public.handle_deleted_user_content();

revoke all on function public.handle_deleted_user_content() from public, anon, authenticated;

drop policy if exists uye_update_own on public.uye;
create policy uye_update_own on public.uye for update
    using (auth.uid() = id);

-- hikayeler: herkes okur
drop policy if exists hikayeler_select_all on public.hikayeler;
create policy hikayeler_select_all on public.hikayeler for select using (true);

drop policy if exists hikayeler_insert_auth on public.hikayeler;
create policy hikayeler_insert_auth on public.hikayeler for insert
    with check (auth.uid() = user_id);

-- oylar
drop policy if exists hikaye_oylar_select_own on public.hikaye_oylar;
create policy hikaye_oylar_select_own on public.hikaye_oylar for select
    using (auth.uid() = user_id);

drop policy if exists hikaye_oylar_insert_own on public.hikaye_oylar;
create policy hikaye_oylar_insert_own on public.hikaye_oylar for insert
    with check (auth.uid() = user_id);

drop policy if exists hikaye_oylar_update_own on public.hikaye_oylar;
create policy hikaye_oylar_update_own on public.hikaye_oylar for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
