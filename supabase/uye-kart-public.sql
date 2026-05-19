-- İtiraf kartları: profil (PP, şehir, meslek vb.) canlı uye tablosundan okunur.
-- En az bir herkese açık (gizli olmayan) itirafı olan üyelerin kart alanları herkese okunabilir.
-- E-posta yalnızca kendi profilinde (uye_select_own) görünür.

grant select on public.uye to anon;

drop policy if exists uye_select_kart on public.uye;
create policy uye_select_kart on public.uye
    for select to anon, authenticated
    using (
        exists (
            select 1
            from public.itiraflar i
            where i.user_id = uye.id
              and i.is_gizli = false
        )
    );
