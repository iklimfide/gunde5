-- İtiraf şikayetleri
create table if not exists public.itiraf_sikayetler (
    id bigserial primary key,
    itiraf_id bigint not null references public.itiraflar (id) on delete cascade,
    reporter_id uuid references auth.users (id) on delete set null,
    sebep varchar(40) not null,
    aciklama text,
    created_at timestamptz not null default now(),
    unique (itiraf_id, reporter_id)
);

create index if not exists itiraf_sikayetler_itiraf_idx on public.itiraf_sikayetler (itiraf_id, created_at desc);

grant insert on public.itiraf_sikayetler to authenticated;
grant usage, select on sequence public.itiraf_sikayetler_id_seq to authenticated;

alter table public.itiraf_sikayetler enable row level security;

drop policy if exists itiraf_sikayetler_insert_auth on public.itiraf_sikayetler;
create policy itiraf_sikayetler_insert_auth on public.itiraf_sikayetler for insert
    to authenticated
    with check (auth.uid() = reporter_id);

drop policy if exists itiraf_sikayetler_select_own on public.itiraf_sikayetler;
create policy itiraf_sikayetler_select_own on public.itiraf_sikayetler for select
    to authenticated
    using (auth.uid() = reporter_id);
