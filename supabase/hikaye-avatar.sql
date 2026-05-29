-- İtiraf kartlarında profil fotoğrafı (hikaye anındaki snapshot)
alter table public.hikayeler
    add column if not exists avatar_url text;
