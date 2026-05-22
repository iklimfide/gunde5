-- Supabase Security Advisor — uyarıları kapat (SQL Editor'da bir kez çalıştırın)
-- 0011 search_path · 0025 avatars listeleme · 0028 anon + SECURITY DEFINER

-- ---------------------------------------------------------------------------
-- 0011 Function search path mutable (podyum-koruma.sql ile aynı mantık)
-- ---------------------------------------------------------------------------
create or replace function public.itiraflar_podyum_koruma()
returns trigger
language plpgsql
set search_path = public
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

-- ---------------------------------------------------------------------------
-- 0025 Public bucket allows listing — geniş SELECT politikası kaldırılır
-- (public bucket: doğrudan URL ile okuma; Storage API ile listeleme kısıtlanır)
-- ---------------------------------------------------------------------------
drop policy if exists avatars_public_read on storage.objects;

-- ---------------------------------------------------------------------------
-- Trigger / dahili fonksiyonlar: REST ile çağrılmasın
-- ---------------------------------------------------------------------------
revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke all on function public.itiraf_oy_sayaci() from public, anon, authenticated;

-- Eski / kullanılmayan RPC
drop function if exists public.itiraf_istatistikleri(bigint[]);

-- ---------------------------------------------------------------------------
-- 0028 itiraf_cevap_sayilari: SECURITY INVOKER (anon SELECT RLS ile)
-- ---------------------------------------------------------------------------
create or replace function public.itiraf_cevap_sayilari(p_ids bigint[])
returns table (itiraf_id bigint, adet int)
language sql
stable
security invoker
set search_path = public
as $$
    select c.itiraf_id, count(*)::int as adet
    from public.itiraf_cevaplar c
    where c.itiraf_id = any (p_ids)
    group by c.itiraf_id;
$$;

revoke all on function public.itiraf_cevap_sayilari(bigint[]) from public;
grant execute on function public.itiraf_cevap_sayilari(bigint[]) to anon, authenticated;

-- Bakım RPC: yalnızca oturumlu / service role
revoke all on function public.itiraf_oy_sayaclarini_yenile(bigint[]) from public, anon, authenticated;
grant execute on function public.itiraf_oy_sayaclarini_yenile(bigint[]) to service_role;

-- ---------------------------------------------------------------------------
-- itiraf_goruntulenme_kaydet: SECURITY INVOKER + geçici RLS bayrağı
-- ---------------------------------------------------------------------------
drop policy if exists itiraf_goruntulenme_sayac on public.itiraflar;
create policy itiraf_goruntulenme_sayac on public.itiraflar
    for update to anon, authenticated
    using (
        silindi_at is null
        and coalesce(current_setting('app.goruntulenme', true), '') = '1'
    )
    with check (
        coalesce(current_setting('app.goruntulenme', true), '') = '1'
    );

drop policy if exists itiraf_goruntulenmeler_insert_anon on public.itiraf_goruntulenmeler;
create policy itiraf_goruntulenmeler_insert_anon on public.itiraf_goruntulenmeler
    for insert to anon, authenticated
    with check (
        exists (
            select 1 from public.itiraflar i
            where i.id = itiraf_id and i.silindi_at is null
        )
    );

grant insert on public.itiraf_goruntulenmeler to anon, authenticated;

create or replace function public.itiraf_goruntulenme_kaydet(p_itiraf_id bigint, p_viewer_key text)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_key text;
    v_tekil_artis int;
begin
    if p_itiraf_id is null then return null; end if;
    v_key := left(trim(coalesce(p_viewer_key, '')), 128);
    if length(v_key) < 8 then return null; end if;
    if not exists (select 1 from public.itiraflar i where i.id = p_itiraf_id and i.silindi_at is null) then
        return null;
    end if;

    perform set_config('app.goruntulenme', '1', true);

    update public.itiraflar
    set sayfa_goruntulenme = sayfa_goruntulenme + 1
    where id = p_itiraf_id;

    with ins as (
        insert into public.itiraf_goruntulenmeler (itiraf_id, viewer_key)
        values (p_itiraf_id, v_key)
        on conflict (itiraf_id, viewer_key) do nothing
        returning 1
    )
    select count(*)::int into v_tekil_artis from ins;

    if v_tekil_artis > 0 then
        update public.itiraflar
        set tekil_goruntulenme = tekil_goruntulenme + v_tekil_artis
        where id = p_itiraf_id;
    end if;

    return (
        select json_build_object(
            'sayfa_goruntulenme', i.sayfa_goruntulenme,
            'tekil_goruntulenme', i.tekil_goruntulenme
        )
        from public.itiraflar i
        where i.id = p_itiraf_id
    );
end;
$$;

revoke all on function public.itiraf_goruntulenme_kaydet(bigint, text) from public;
grant execute on function public.itiraf_goruntulenme_kaydet(bigint, text) to anon, authenticated;

notify pgrst, 'reload schema';
