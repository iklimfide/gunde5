-- Podyum kayıtları asla kulise inmez, soft-delete olmaz.
-- Supabase SQL Editor'da bir kez çalıştır.

create or replace function public.itiraflar_podyum_koruma()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'UPDATE' and old.status = 'podyum' then
        if new.status is distinct from 'podyum' then
            raise exception 'Podyum itiraflari kulise indirilemez (id=%)', old.id;
        end if;
        if new.silindi_at is not null then
            raise exception 'Podyum itiraflari silinemez (id=%)', old.id;
        end if;
    end if;
    if tg_op = 'DELETE' and old.status = 'podyum' then
        raise exception 'Podyum itiraflari silinemez (id=%)', old.id;
    end if;
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_itiraflar_podyum_koruma on public.itiraflar;
create trigger trg_itiraflar_podyum_koruma
    before update or delete on public.itiraflar
    for each row
    execute function public.itiraflar_podyum_koruma();
