-- İtiraf kartlarında profil fotoğrafı (itiraf anındaki snapshot)
alter table public.itiraflar
    add column if not exists avatar_url text;
