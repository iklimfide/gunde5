-- İtiraf kartlarında profil özeti (itiraf anındaki snapshot)
alter table public.itiraflar
    add column if not exists yasadigi_yer varchar(40),
    add column if not exists yurtdisi_sehir varchar(80),
    add column if not exists meslek varchar(40),
    add column if not exists medeni_durum varchar(40);
