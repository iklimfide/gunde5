-- Kamikaze panel kaldırıldı — canlı DB temizliği (SQL Editor'da bir kez, isteğe bağlı)

drop function if exists public.kamikaze_panel(text);
drop function if exists public.kamikaze_hikaye_ara(jsonb);
drop function if exists public.kamikaze_hikaye_ara(text, jsonb);
drop function if exists public.kamikaze_hikaye_islem(jsonb);
drop function if exists public.kamikaze_hikaye_islem(text, jsonb);
drop function if exists public.kamikaze_uye_ara(jsonb);
drop function if exists public.kamikaze_uye_ara(text, jsonb);
drop function if exists public.kamikaze_uye_islem(jsonb);
drop function if exists public.kamikaze_uye_islem(text, jsonb);
drop function if exists public.kamikaze_token_gecerli(text);
drop function if exists public.kamikaze_donem_normalize(text);
drop function if exists public.kamikaze_hikaye_json(public.itiraflar);

delete from public.site_ayar where anahtar = 'kamikaze_token';

-- Podyum koruması (master-admin.sql ile aynı: master bypass korunur)
create or replace function public.itiraflar_podyum_koruma()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if current_setting('gunde5.master_bypass', true) = '1' then
        return coalesce(new, old);
    end if;
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

notify pgrst, 'reload schema';
