-- Master panel 403 (Forbidden): metrik, kamikaze, müdavimler, bildirim RPC
-- Canlı şema: public.itiraflar (hikayeler YOK)
-- SQL Editor → tek sefer Run → sayfayı yenileyin (master hesabıyla giriş)

-- 1) Master e-posta (site_ayar)
insert into public.site_ayar (anahtar, deger)
values ('master_email', 'arifguvenc@gmail.com')
on conflict (anahtar) do update set deger = excluded.deger, updated_at = now();

create or replace function public.master_email_hedef()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select lower(trim(coalesce(
        (select deger from public.site_ayar where anahtar = 'master_email' limit 1),
        'arifguvenc@gmail.com'
    )));
$$;

revoke all on function public.master_email_hedef() from public, anon, authenticated;

create or replace function public.master_email_eslesir()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
    select auth.uid() is not null
        and lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = public.master_email_hedef();
$$;

revoke all on function public.master_email_eslesir() from public, anon;
grant execute on function public.master_email_eslesir() to authenticated;

create or replace function public.master_durum()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
begin
    return jsonb_build_object(
        'master', public.master_email_eslesir(),
        'email', public.master_email_hedef()
    );
end;
$$;

revoke all on function public.master_durum() from public, anon;
grant execute on function public.master_durum() to authenticated;

-- Master → uye / itiraflar RLS
drop policy if exists uye_select_master on public.uye;
create policy uye_select_master on public.uye
    for select to authenticated
    using (public.master_email_eslesir());

grant update on public.uye to authenticated;

drop policy if exists uye_update_master on public.uye;
create policy uye_update_master on public.uye
    for update to authenticated
    using (public.master_email_eslesir())
    with check (public.master_email_eslesir());

drop policy if exists itiraflar_update_master on public.itiraflar;
create policy itiraflar_update_master on public.itiraflar
    for update to authenticated
    using (public.master_email_eslesir())
    with check (public.master_email_eslesir());

-- 2) Master gelen kutusu tablosu (footer-submissions ile uyumlu)
create table if not exists public.master_bildirimler (
    id bigserial primary key,
    baslik text not null,
    metin text not null,
    tip text not null check (tip in ('yeni_hikaye', 'yeni_mesaj')),
    link_path text not null,
    ref_id uuid,
    okundu boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.master_bildirimler enable row level security;
revoke all on public.master_bildirimler from anon, authenticated;

drop policy if exists master_bildirimler_select on public.master_bildirimler;
create policy master_bildirimler_select on public.master_bildirimler
    for select to authenticated
    using (public.master_email_eslesir());

drop policy if exists master_bildirimler_update on public.master_bildirimler;
create policy master_bildirimler_update on public.master_bildirimler
    for update to authenticated
    using (public.master_email_eslesir())
    with check (public.master_email_eslesir());

create or replace function public.master_bildirim_okunmamis_sayisi()
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.master_email_eslesir() then
        return 0;
    end if;
    return (
        select count(*)::int
        from public.master_bildirimler
        where okundu = false
    );
end;
$$;

revoke all on function public.master_bildirim_okunmamis_sayisi() from public, anon;
grant execute on function public.master_bildirim_okunmamis_sayisi() to authenticated;

-- 3) Tüm public.master_* RPC → authenticated (403 düzeltmesi)
do $$
declare
    r record;
begin
    for r in
        select
            n.nspname as ns,
            p.proname as nm,
            pg_get_function_identity_arguments(p.oid) as args
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname like 'master\_%'
    loop
        begin
            execute format(
                'grant execute on function %I.%I(%s) to authenticated',
                r.ns, r.nm, r.args
            );
        exception
            when others then
                raise notice 'grant atlandi %.%(%): %', r.ns, r.nm, r.args, sqlerrm;
        end;
    end loop;
end;
$$;

notify pgrst, 'reload schema';

-- Doğrulama: aşağıdaki fonksiyonlar listede olmalı (yoksa ilgili .sql dosyasını Run edin)
-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and proname in (
--   'master_kamikaze_panel', 'master_metrik_istatistik', 'master_mudavim_istatistik',
--   'master_trafik_istatistik', 'master_bildirim_okunmamis_sayisi', 'master_durum'
-- );
