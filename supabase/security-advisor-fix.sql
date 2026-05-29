-- Supabase Security Advisor — uyarıları kapat (SQL Editor'da bir kez çalıştırın)
-- 0011 search_path · 0025 avatars listeleme · 0028 anon + SECURITY DEFINER

-- ---------------------------------------------------------------------------
-- 0011 Function search path mutable (podyum-koruma.sql ile aynı mantık)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0025 Public bucket allows listing — geniş SELECT politikası kaldırılır
-- (public bucket: doğrudan URL ile okuma; Storage API ile listeleme kısıtlanır)
-- ---------------------------------------------------------------------------
drop policy if exists avatars_public_read on storage.objects;

-- ---------------------------------------------------------------------------
-- Trigger / dahili fonksiyonlar: REST ile çağrılmasın
-- ---------------------------------------------------------------------------
revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke all on function public.hikaye_oy_sayaci() from public, anon, authenticated;

-- Eski / kullanılmayan RPC
drop function if exists public.hikaye_istatistikleri(bigint[]);

-- ---------------------------------------------------------------------------
-- 0028 hikaye_cevap_sayilari: SECURITY INVOKER (anon SELECT RLS ile)
-- ---------------------------------------------------------------------------
create or replace function public.hikaye_cevap_sayilari(p_ids bigint[])
returns table (hikaye_id bigint, adet int)
language sql
stable
security invoker
set search_path = public
as $$
    select c.hikaye_id, count(*)::int as adet
    from public.hikaye_cevaplar c
    where c.hikaye_id = any (p_ids)
    group by c.hikaye_id;
$$;

revoke all on function public.hikaye_cevap_sayilari(bigint[]) from public;
grant execute on function public.hikaye_cevap_sayilari(bigint[]) to anon, authenticated;

-- Bakım RPC: yalnızca oturumlu / service role
revoke all on function public.hikaye_oy_sayaclarini_yenile(bigint[]) from public, anon, authenticated;
grant execute on function public.hikaye_oy_sayaclarini_yenile(bigint[]) to service_role;

-- ---------------------------------------------------------------------------
-- hikaye_goruntulenme_kaydet: SECURITY INVOKER + geçici RLS bayrağı
-- ---------------------------------------------------------------------------
drop policy if exists hikaye_goruntulenme_sayac on public.hikayeler;
create policy hikaye_goruntulenme_sayac on public.hikayeler
    for update to anon, authenticated
    using (
        silindi_at is null
        and coalesce(current_setting('app.goruntulenme', true), '') = '1'
    )
    with check (
        coalesce(current_setting('app.goruntulenme', true), '') = '1'
    );

drop policy if exists hikaye_goruntulenmeler_insert_anon on public.hikaye_goruntulenmeler;
create policy hikaye_goruntulenmeler_insert_anon on public.hikaye_goruntulenmeler
    for insert to anon, authenticated
    with check (
        exists (
            select 1 from public.hikayeler i
            where i.id = hikaye_id and i.silindi_at is null
        )
    );

grant insert on public.hikaye_goruntulenmeler to anon, authenticated;

create or replace function public.hikaye_goruntulenme_kaydet(p_hikaye_id bigint, p_viewer_key text)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_key text;
    v_tekil_artis int;
begin
    if p_hikaye_id is null then return null; end if;
    v_key := left(trim(coalesce(p_viewer_key, '')), 128);
    if length(v_key) < 8 then return null; end if;
    if not exists (select 1 from public.hikayeler i where i.id = p_hikaye_id and i.silindi_at is null) then
        return null;
    end if;

    perform set_config('app.goruntulenme', '1', true);

    update public.hikayeler
    set sayfa_goruntulenme = sayfa_goruntulenme + 1
    where id = p_hikaye_id;

    with ins as (
        insert into public.hikaye_goruntulenmeler (hikaye_id, viewer_key)
        values (p_hikaye_id, v_key)
        on conflict (hikaye_id, viewer_key) do nothing
        returning 1
    )
    select count(*)::int into v_tekil_artis from ins;

    if v_tekil_artis > 0 then
        update public.hikayeler
        set tekil_goruntulenme = tekil_goruntulenme + v_tekil_artis
        where id = p_hikaye_id;
    end if;

    return (
        select json_build_object(
            'sayfa_goruntulenme', i.sayfa_goruntulenme,
            'tekil_goruntulenme', i.tekil_goruntulenme
        )
        from public.hikayeler i
        where i.id = p_hikaye_id
    );
end;
$$;

revoke all on function public.hikaye_goruntulenme_kaydet(bigint, text) from public;
grant execute on function public.hikaye_goruntulenme_kaydet(bigint, text) to anon, authenticated;

notify pgrst, 'reload schema';
