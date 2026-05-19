-- Üye kendi itiraflarını düzenleyebilir
grant update on public.itiraflar to authenticated;

drop policy if exists itiraflar_update_own on public.itiraflar;
create policy itiraflar_update_own on public.itiraflar for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
