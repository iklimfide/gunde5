-- Eski dosya — güncel düzeltmeler: security-advisor-fix.sql (bir kez çalıştırın)
-- Aşağıdaki trigger revoke satırları security-advisor-fix.sql içinde de var.

-- Supabase linter — güvenlik düzeltmeleri (bir kez çalıştırın)

-- 1) Rumuz→e-posta RPC kaldır (giriş artık e-posta + şifre)
drop function if exists public.eposta_rumuzdan(text);
drop function if exists public.oy_ver(bigint, integer);

create or replace function public.hikaye_oy_sayaci()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

-- 3) uye: tam profil yalnızca kendi oturumunda; kart için daraltılmış RPC
revoke all on public.uye from anon;
grant select on public.uye to authenticated;

drop policy if exists uye_select_all on public.uye;
drop policy if exists uye_select_own on public.uye;
create policy uye_select_own on public.uye for select to authenticated
    using (auth.uid() = id);

drop policy if exists uye_select_kart on public.uye;
drop policy if exists uye_select_cevap_yazar on public.uye;

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
              select 1 from public.hikayeler i
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

drop policy if exists hikaye_oylar_update_own on public.hikaye_oylar;
create policy hikaye_oylar_update_own on public.hikaye_oylar for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
