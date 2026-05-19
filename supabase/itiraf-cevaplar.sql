-- İtiraf cevapları (parent_id null) ve cevaba yanıtlar (parent_id → cevap)
create table if not exists public.itiraf_cevaplar (
    id bigserial primary key,
    itiraf_id bigint not null references public.itiraflar (id) on delete cascade,
    parent_id bigint references public.itiraf_cevaplar (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    username varchar(50) not null,
    content text not null check (char_length(content) between 1 and 2000),
    created_at timestamptz not null default now()
);

create index if not exists itiraf_cevaplar_itiraf_idx on public.itiraf_cevaplar (itiraf_id, created_at desc);
create index if not exists itiraf_cevaplar_parent_idx on public.itiraf_cevaplar (parent_id, created_at asc);
create index if not exists itiraf_cevaplar_kok_idx on public.itiraf_cevaplar (itiraf_id, created_at desc)
    where parent_id is null;

grant select on public.itiraf_cevaplar to anon, authenticated;
grant insert on public.itiraf_cevaplar to authenticated;
grant usage, select on sequence public.itiraf_cevaplar_id_seq to authenticated;

alter table public.itiraf_cevaplar enable row level security;

drop policy if exists itiraf_cevaplar_select_all on public.itiraf_cevaplar;
create policy itiraf_cevaplar_select_all on public.itiraf_cevaplar for select
    using (true);

drop policy if exists itiraf_cevaplar_insert_auth on public.itiraf_cevaplar;
create policy itiraf_cevaplar_insert_auth on public.itiraf_cevaplar for insert
    to authenticated
    with check (auth.uid() = user_id);
