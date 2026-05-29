-- Üye kendi hikayelerını düzenleyebilir
grant update on public.hikayeler to authenticated;

drop policy if exists hikayeler_update_own on public.hikayeler;
create policy hikayeler_update_own on public.hikayeler for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
