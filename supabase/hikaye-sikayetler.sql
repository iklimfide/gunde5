-- İtiraf şikayetleri
create table if not exists public.hikaye_sikayetler (
    id bigserial primary key,
    hikaye_id bigint not null references public.hikayeler (id) on delete cascade,
    reporter_id uuid references auth.users (id) on delete set null,
    sebep varchar(40) not null,
    aciklama text,
    created_at timestamptz not null default now(),
    unique (hikaye_id, reporter_id)
);

create index if not exists hikaye_sikayetler_hikaye_idx on public.hikaye_sikayetler (hikaye_id, created_at desc);

grant insert on public.hikaye_sikayetler to authenticated;
grant usage, select on sequence public.hikaye_sikayetler_id_seq to authenticated;

alter table public.hikaye_sikayetler enable row level security;

drop policy if exists hikaye_sikayetler_insert_auth on public.hikaye_sikayetler;
create policy hikaye_sikayetler_insert_auth on public.hikaye_sikayetler for insert
    to authenticated
    with check (auth.uid() = reporter_id);

drop policy if exists hikaye_sikayetler_select_own on public.hikaye_sikayetler;
create policy hikaye_sikayetler_select_own on public.hikaye_sikayetler for select
    to authenticated
    using (auth.uid() = reporter_id);
