-- Profil alanları + avatar depolama (SQL Editor'da bir kez çalıştırın)

alter table public.uye
    add column if not exists avatar_url text,
    add column if not exists yasadigi_yer varchar(40),
    add column if not exists yurtdisi_sehir varchar(80),
    add column if not exists meslek varchar(40),
    add column if not exists medeni_durum varchar(40);

grant update on public.uye to authenticated;

-- Avatar bucket (public okuma)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'avatars',
    'avatars',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Geniş SELECT politikası yok (Security Advisor 0025 — bucket listeleme).
-- public bucket: doğrudan object URL ile okuma devam eder.

drop policy if exists avatars_public_read on storage.objects;

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
    for update to authenticated
    using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    );
