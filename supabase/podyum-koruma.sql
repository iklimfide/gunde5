-- Podyum kayıtları asla kulise inmez, soft-delete olmaz.
-- Supabase SQL Editor'da bir kez çalıştır.

create or replace function public.hikayeler_podyum_koruma()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if tg_op = 'UPDATE' and old.status = 'podyum' then
        if new.status is distinct from 'podyum' then
            raise exception 'Podyum hikayeleri kulise indirilemez (id=%)', old.id;
        end if;
        if new.silindi_at is not null then
            raise exception 'Podyum hikayeleri silinemez (id=%)', old.id;
        end if;
    end if;
    if tg_op = 'DELETE' and old.status = 'podyum' then
        raise exception 'Podyum hikayeleri silinemez (id=%)', old.id;
    end if;
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_hikayeler_podyum_koruma on public.hikayeler;
create trigger trg_hikayeler_podyum_koruma
    before update or delete on public.hikayeler
    for each row
    execute function public.hikayeler_podyum_koruma();
