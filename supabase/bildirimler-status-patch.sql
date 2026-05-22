-- Mevcut kurulum: bildirim linkleri için hikaye durumu (bir kez)
alter table public.bildirimler
    add column if not exists itiraf_status varchar(10);

update public.bildirimler b
set itiraf_status = i.status
from public.itiraflar i
where i.id = b.itiraf_id and b.itiraf_status is null;

-- bildirim_olustur güncellemesi için bildirimler.sql dosyasını yeniden çalıştırın
