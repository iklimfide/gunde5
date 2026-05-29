-- İtiraf cevapları (parent_id null) ve cevaba yanıtlar (parent_id → cevap)
create table if not exists public.hikaye_cevaplar (
    id bigserial primary key,
    hikaye_id bigint not null references public.hikayeler (id) on delete cascade,
    parent_id bigint references public.hikaye_cevaplar (id) on delete cascade,
    user_id uuid references auth.users (id) on delete set null,
    username varchar(50) not null,
    content text not null check (char_length(content) between 1 and 2000),
    created_at timestamptz not null default now()
);

alter table public.hikaye_cevaplar
    alter column user_id drop not null;

alter table public.hikaye_cevaplar
    drop constraint if exists hikaye_cevaplar_user_id_fkey;

alter table public.hikaye_cevaplar
    add constraint hikaye_cevaplar_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete set null;

create index if not exists hikaye_cevaplar_hikaye_idx on public.hikaye_cevaplar (hikaye_id, created_at desc);
create index if not exists hikaye_cevaplar_parent_idx on public.hikaye_cevaplar (parent_id, created_at asc);
create index if not exists hikaye_cevaplar_kok_idx on public.hikaye_cevaplar (hikaye_id, created_at desc)
    where parent_id is null;

grant select on public.hikaye_cevaplar to anon, authenticated;
grant insert on public.hikaye_cevaplar to authenticated;
grant usage, select on sequence public.hikaye_cevaplar_id_seq to authenticated;

alter table public.hikaye_cevaplar enable row level security;

drop policy if exists hikaye_cevaplar_select_all on public.hikaye_cevaplar;
create policy hikaye_cevaplar_select_all on public.hikaye_cevaplar for select
    using (true);

drop policy if exists hikaye_cevaplar_insert_auth on public.hikaye_cevaplar;
create policy hikaye_cevaplar_insert_auth on public.hikaye_cevaplar for insert
    to authenticated
    with check (auth.uid() = user_id);
