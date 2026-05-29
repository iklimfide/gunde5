-- Kayıt: Auth kullanıcısı oluşunca uye satırı (mevcut projede bir kez çalıştırın)
-- schema.sql içinde de var; sadece şema eskiyse bu dosyayı kullanın.

drop policy if exists uye_insert_own on public.uye;
create policy uye_insert_own on public.uye for insert to authenticated
    with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.uye (id, username, email, gender, dogum_yili)
    values (
        new.id,
        coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), 'uye_' || left(replace(new.id::text, '-', ''), 8)),
        coalesce(new.email, ''),
        case when new.raw_user_meta_data->>'gender' in ('male', 'female') then new.raw_user_meta_data->>'gender' else 'female' end,
        coalesce((new.raw_user_meta_data->>'dogum_yili')::int, extract(year from now())::int - 18)
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.handle_deleted_user_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.hikayeler
    set is_gizli = true,
        username = 'Gizli Üye'
    where user_id = old.id;

    if exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'hikaye_cevaplar'
    ) then
        update public.hikaye_cevaplar
        set username = 'Gizli Üye'
        where user_id = old.id;
    end if;

    return old;
end;
$$;

drop trigger if exists on_auth_user_deleted_content on auth.users;
create trigger on_auth_user_deleted_content
    before delete on auth.users
    for each row execute function public.handle_deleted_user_content();

revoke all on function public.handle_deleted_user_content() from public, anon, authenticated;
