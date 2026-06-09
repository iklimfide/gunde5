-- Kamikaze: yayın günleri listesi (SQL Editor'da bir kez Run)
-- Yıl / ay / gün süzgeçleri için — yalnızca hikayesi olan günler (İstanbul takvimi)

create or replace function public.master_kamikaze_tarihler()
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    return jsonb_build_object(
        'ok', true,
        'tarihler', coalesce((
            select jsonb_agg(gun order by gun desc)
            from (
                select distinct (i.created_at at time zone 'Europe/Istanbul')::date as gun
                from public.itiraflar i
                where i.created_at is not null
            ) t
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.master_kamikaze_tarihler() from public, anon;
grant execute on function public.master_kamikaze_tarihler() to authenticated;
