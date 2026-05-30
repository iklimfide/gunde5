-- Kulis → podyum otomasyonu ve koruma trigger'ları kaldır
-- Canlı şema: public.itiraflar (hikayeler yoksa da çalışır)
-- Supabase SQL Editor'da bir kez Run

create extension if not exists pg_cron;

do $$
begin
    perform cron.unschedule('gunde5_podyum_1312_tr');
exception
    when others then null;
end;
$$;

do $$
declare
    v_jobid bigint;
begin
    select jobid into v_jobid
    from cron.job
    where jobname = 'gunde5_podyum_1312_tr'
    limit 1;
    if v_jobid is not null then
        perform cron.unschedule(v_jobid);
    end if;
exception
    when undefined_table then null;
    when others then null;
end;
$$;

drop function if exists public.podyum_gunluk_gecis();

do $$
begin
    if to_regclass('public.hikayeler') is not null then
        execute 'drop trigger if exists trg_hikayeler_podyum_koruma on public.hikayeler';
    end if;
    if to_regclass('public.itiraflar') is not null then
        execute 'drop trigger if exists trg_hikayeler_podyum_koruma on public.itiraflar';
        execute 'drop trigger if exists trg_itiraflar_podyum_koruma on public.itiraflar';
    end if;
end;
$$;

drop function if exists public.hikayeler_podyum_koruma();
drop function if exists public.itiraflar_podyum_koruma();

notify pgrst, 'reload schema';
