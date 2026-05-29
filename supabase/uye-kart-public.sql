-- İtiraf kartları: tam uye satırı public açılmaz.
-- Kartlarda gereken güvenli alanlar için daraltılmış RPC kullanılır.

revoke all on public.uye from anon;
grant select on public.uye to authenticated;

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
