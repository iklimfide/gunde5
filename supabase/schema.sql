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
create table if not exists public.itiraflar (
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
    status varchar(10) not null default 'kulis' check (status in ('kulis', 'podyum')),
    podyum_sira smallint,
    podyum_donem varchar(32),
    is_gizli boolean not null default false
);

-- Günlük 13:12 geçişi — güncel tanım: supabase/saat-1312-podyum.sql

create table if not exists public.site_ayar (
    anahtar text primary key,
    deger text not null,
    updated_at timestamptz not null default now()
);
alter table public.site_ayar enable row level security;
drop policy if exists site_ayar_select_all on public.site_ayar;
create policy site_ayar_select_all on public.site_ayar for select using (true);

create index if not exists itiraflar_status_created_idx on public.itiraflar (status, created_at desc);
create index if not exists itiraflar_user_idx on public.itiraflar (user_id, created_at desc);

-- Tekil ziyaretçi kaydı (viewer_key başına bir kez)
create table if not exists public.itiraf_goruntulenmeler (
    itiraf_id bigint not null references public.itiraflar (id) on delete cascade,
    viewer_key text not null,
    created_at timestamptz not null default now(),
    primary key (itiraf_id, viewer_key)
);

create index if not exists itiraf_goruntulenmeler_itiraf_idx on public.itiraf_goruntulenmeler (itiraf_id);

alter table public.itiraf_goruntulenmeler enable row level security;
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

-- Oy kayıtları (üye başına bir oy)
create table if not exists public.itiraf_oylar (
    id bigserial primary key,
    itiraf_id bigint not null references public.itiraflar (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    oy smallint not null check (oy in (1, -1)),
    created_at timestamptz not null default now(),
    unique (itiraf_id, user_id)
);

-- Puan hesaplama: b ve r kolonlarını güncelle
create or replace function public.itiraf_puan_guncelle(p_itiraf_id bigint)
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
    if p_itiraf_id is null then
        return;
    end if;

    select count(*)::int
    into v_yorum
    from public.itiraf_cevaplar c
    where c.itiraf_id = p_itiraf_id;

    select (coalesce(i.up_votes, 0) - coalesce(i.down_votes, 0))
    into v_b
    from public.itiraflar i
    where i.id = p_itiraf_id;

    v_r := v_b + (coalesce(v_yorum, 0) * 5);

    update public.itiraflar
    set
        b = v_b,
        r = v_r
    where id = p_itiraf_id;
end;
$$;

revoke all on function public.itiraf_puan_guncelle(bigint) from public;
revoke all on function public.itiraf_puan_guncelle(bigint) from anon, authenticated;

-- Oy sayacı (yalnızca trigger; REST/RPC ile çağrılamaz)
create or replace function public.itiraf_oy_sayaci()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_itiraf_id bigint;
begin
    v_itiraf_id := coalesce(new.itiraf_id, old.itiraf_id);
    update public.itiraflar i
    set
        up_votes = (select count(*)::int from public.itiraf_oylar o where o.itiraf_id = v_itiraf_id and o.oy = 1),
        down_votes = (select count(*)::int from public.itiraf_oylar o where o.itiraf_id = v_itiraf_id and o.oy = -1)
    where i.id = v_itiraf_id;
    perform public.itiraf_puan_guncelle(v_itiraf_id);
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_itiraf_oy_sayaci on public.itiraf_oylar;
create trigger trg_itiraf_oy_sayaci
after insert or update or delete on public.itiraf_oylar
for each row execute function public.itiraf_oy_sayaci();

revoke all on function public.itiraf_oy_sayaci() from public;
revoke all on function public.itiraf_oy_sayaci() from anon, authenticated;

-- Yorum/cevap değişince puanı güncelle (itiraf_cevaplar.sql da çalıştırılıyorsa bu trigger orada da tanımlanabilir)
create or replace function public.itiraf_cevap_puan_sayaci()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_new bigint;
    v_old bigint;
begin
    v_new := case when tg_op <> 'DELETE' then new.itiraf_id else null end;
    v_old := case when tg_op <> 'INSERT' then old.itiraf_id else null end;

    if v_new is not null then
        perform public.itiraf_puan_guncelle(v_new);
    end if;
    if v_old is not null and v_old <> v_new then
        perform public.itiraf_puan_guncelle(v_old);
    end if;
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_itiraf_cevap_puan_sayaci on public.itiraf_cevaplar;
create trigger trg_itiraf_cevap_puan_sayaci
after insert or update or delete on public.itiraf_cevaplar
for each row execute function public.itiraf_cevap_puan_sayaci();

revoke all on function public.itiraf_cevap_puan_sayaci() from public;
revoke all on function public.itiraf_cevap_puan_sayaci() from anon, authenticated;

drop function if exists public.oy_ver(bigint, integer);
drop function if exists public.eposta_rumuzdan(text);

grant usage on schema public to anon, authenticated;
grant select, update on public.uye to authenticated;
grant select on public.itiraflar to anon, authenticated;
grant insert on public.uye to authenticated;
grant insert on public.itiraflar to authenticated;
grant select, insert, update on public.itiraf_oylar to authenticated;
grant usage, select on sequence public.itiraflar_id_seq to authenticated;
grant usage, select on sequence public.itiraf_oylar_id_seq to authenticated;

alter table public.uye enable row level security;
alter table public.itiraflar enable row level security;
alter table public.itiraf_oylar enable row level security;

-- uye: anon doğrudan okuyamaz (giriş: e-posta + şifre, Auth)
drop policy if exists uye_select_all on public.uye;
drop policy if exists uye_select_own on public.uye;
create policy uye_select_own on public.uye for select to authenticated
    using (auth.uid() = id);

grant select on public.uye to anon;

drop policy if exists uye_select_kart on public.uye;
create policy uye_select_kart on public.uye
    for select to anon, authenticated
    using (
        exists (
            select 1 from public.itiraflar i
            where i.user_id = uye.id and i.is_gizli = false
        )
    );

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

drop policy if exists uye_update_own on public.uye;
create policy uye_update_own on public.uye for update
    using (auth.uid() = id);

-- itiraflar: herkes okur
drop policy if exists itiraflar_select_all on public.itiraflar;
create policy itiraflar_select_all on public.itiraflar for select using (true);

drop policy if exists itiraflar_insert_auth on public.itiraflar;
create policy itiraflar_insert_auth on public.itiraflar for insert
    with check (auth.uid() = user_id);

-- oylar
drop policy if exists itiraf_oylar_select_own on public.itiraf_oylar;
create policy itiraf_oylar_select_own on public.itiraf_oylar for select
    using (auth.uid() = user_id);

drop policy if exists itiraf_oylar_insert_own on public.itiraf_oylar;
create policy itiraf_oylar_insert_own on public.itiraf_oylar for insert
    with check (auth.uid() = user_id);

drop policy if exists itiraf_oylar_update_own on public.itiraf_oylar;
create policy itiraf_oylar_update_own on public.itiraf_oylar for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
