-- Mevcut kurulum: bildirim linkleri için hikaye durumu (bir kez)
alter table public.bildirimler
    add column if not exists hikaye_status varchar(10);

update public.bildirimler b
set hikaye_status = i.status
from public.hikayeler i
where i.id = b.hikaye_id and b.hikaye_status is null;

-- bildirim_olustur güncellemesi için bildirimler.sql dosyasını yeniden çalıştırın
