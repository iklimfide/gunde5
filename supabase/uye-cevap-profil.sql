-- Cevap/yorum yazan üyelerin gender bilgisi kartlarda renklensin (anon okuyabilir).
-- Mevcut uye_select_kart yalnızca herkese açık itiraf sahibi üyeleri kapsar.

drop policy if exists uye_select_cevap_yazar on public.uye;
create policy uye_select_cevap_yazar on public.uye
    for select to anon, authenticated
    using (
        exists (
            select 1
            from public.itiraf_cevaplar c
            inner join public.itiraflar i on i.id = c.itiraf_id
            where c.user_id = uye.id
              and i.is_gizli = false
              and i.silindi_at is null
        )
    );
