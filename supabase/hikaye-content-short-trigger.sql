-- İsteğe bağlı: yalnızca INSERT’te content_short üretir (mevcut satırlara dokunmaz).
-- Uygulama ve seed-kulis-sablon.sql zaten short üretir; trigger olmadan da çalışır.

create or replace function public.hikaye_content_short_uret()
returns trigger
language plpgsql
as $$
declare
    v_tam text;
begin
    v_tam := trim(coalesce(new.content_full, ''));
    if v_tam = '' then
        return new;
    end if;
    if char_length(v_tam) <= 140 then
        new.content_short := v_tam;
    else
        new.content_short := left(v_tam, 137) || '...';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_hikayeler_content_short on public.hikayeler;
create trigger trg_hikayeler_content_short
    before insert on public.hikayeler
    for each row
    execute function public.hikaye_content_short_uret();
