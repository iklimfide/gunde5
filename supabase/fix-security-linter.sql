-- Eski dosya — güncel düzeltmeler: security-advisor-fix.sql (bir kez çalıştırın)
-- Aşağıdaki trigger revoke satırları security-advisor-fix.sql içinde de var.

-- Supabase linter — güvenlik düzeltmeleri (bir kez çalıştırın)

-- 1) Rumuz→e-posta RPC kaldır (giriş artık e-posta + şifre)
drop function if exists public.eposta_rumuzdan(text);
drop function if exists public.oy_ver(bigint, integer);

-- 2) Trigger fonksiyonu: REST/RPC ile çağrılmasın (trigger çalışmaya devam eder)
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
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_itiraf_oy_sayaci on public.itiraf_oylar;
create trigger trg_itiraf_oy_sayaci
after insert or update or delete on public.itiraf_oylar
for each row execute function public.itiraf_oy_sayaci();

revoke all on function public.itiraf_oy_sayaci() from public;
revoke all on function public.itiraf_oy_sayaci() from anon, authenticated;

-- 3) uye: anon yalnızca kart profili (RLS ile); tam profil kendi oturumunda
grant select on public.uye to anon;

drop policy if exists uye_select_all on public.uye;
drop policy if exists uye_select_own on public.uye;
create policy uye_select_own on public.uye for select to authenticated
    using (auth.uid() = id);

drop policy if exists uye_select_kart on public.uye;
create policy uye_select_kart on public.uye
    for select to anon, authenticated
    using (
        exists (
            select 1 from public.itiraflar i
            where i.user_id = uye.id and i.is_gizli = false
        )
    );

drop policy if exists itiraf_oylar_update_own on public.itiraf_oylar;
create policy itiraf_oylar_update_own on public.itiraf_oylar for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
