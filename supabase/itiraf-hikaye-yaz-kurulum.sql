-- Hikaye yaz: baslik sütunu + RLS + master_hikaye_ekle (tek seferde)
-- Canlı şema: public.itiraflar — SQL Editor'da bir kez Run.
-- Önce master-admin.sql veya security-advisor-definer-fix.sql (master_email_eslesir).

-- ---------------------------------------------------------------------------
-- 1) Başlık sütunu (isteğe bağlı alan)
-- ---------------------------------------------------------------------------
alter table public.itiraflar
    add column if not exists baslik varchar(120);

comment on column public.itiraflar.baslik is 'Hikaye başlığı (kart/liste üst satırı; boş olabilir)';

-- ---------------------------------------------------------------------------
-- 2) RLS: okuma + üye insert/güncelleme + master insert/güncelleme
-- ---------------------------------------------------------------------------
alter table public.itiraflar enable row level security;

grant select on public.itiraflar to anon, authenticated;
grant insert, update on public.itiraflar to authenticated;

drop policy if exists itiraflar_select_all on public.itiraflar;
create policy itiraflar_select_all on public.itiraflar
    for select
    using (true);

drop policy if exists itiraflar_insert_auth on public.itiraflar;
create policy itiraflar_insert_auth on public.itiraflar
    for insert to authenticated
    with check (auth.uid() = user_id);

drop policy if exists itiraflar_insert_master on public.itiraflar;
create policy itiraflar_insert_master on public.itiraflar
    for insert to authenticated
    with check (public.master_email_eslesir());

drop policy if exists itiraflar_update_own on public.itiraflar;
create policy itiraflar_update_own on public.itiraflar
    for update to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists itiraflar_update_master on public.itiraflar;
create policy itiraflar_update_master on public.itiraflar
    for update to authenticated
    using (public.master_email_eslesir())
    with check (public.master_email_eslesir());

-- ---------------------------------------------------------------------------
-- 3) Master: bot / planlı hikaye ekleme
-- ---------------------------------------------------------------------------
create or replace function public.master_hikaye_ekle(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_username text;
    v_age int;
    v_gender text;
    v_yer text;
    v_yurtdisi text;
    v_baslik text;
    v_tam text;
    v_kisa text;
    v_created timestamptz;
    v_row public.itiraflar%rowtype;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_username := left(trim(coalesce(p_body->>'username', '')), 50);
    if char_length(v_username) < 2 then
        return jsonb_build_object('ok', false, 'hata', 'rumuz en az 2 karakter');
    end if;

    v_age := (p_body->>'age')::int;
    if v_age is null or v_age < 18 or v_age > 120 then
        return jsonb_build_object('ok', false, 'hata', 'yas 18-120 arasi olmali');
    end if;

    v_gender := lower(trim(coalesce(p_body->>'gender', '')));
    if v_gender not in ('male', 'female') then
        return jsonb_build_object('ok', false, 'hata', 'gecersiz cinsiyet');
    end if;

    v_yer := nullif(trim(coalesce(p_body->>'yasadigi_yer', '')), '');
    v_yurtdisi := nullif(left(trim(coalesce(p_body->>'yurtdisi_sehir', '')), 80), '');
    if v_yer is distinct from 'yurtdisi' then
        v_yurtdisi := null;
    end if;

    v_tam := trim(coalesce(p_body->>'content_full', ''));
    if v_tam = '' then
        return jsonb_build_object('ok', false, 'hata', 'hikaye metni bos');
    end if;
    v_baslik := nullif(left(trim(coalesce(p_body->>'baslik', '')), 120), '');
    v_kisa := case when char_length(v_tam) <= 140 then v_tam else left(v_tam, 137) || '...' end;

    if p_body ? 'created_at' and nullif(trim(p_body->>'created_at'), '') is not null then
        v_created := (p_body->>'created_at')::timestamptz;
    else
        v_created := now();
    end if;

    perform set_config('gunde5.master_bypass', '1', true);

    insert into public.itiraflar (
        user_id,
        username,
        age,
        gender,
        yasadigi_yer,
        yurtdisi_sehir,
        baslik,
        content_short,
        content_full,
        status,
        is_gizli,
        created_at
    ) values (
        null,
        v_username,
        v_age,
        v_gender,
        v_yer,
        v_yurtdisi,
        v_baslik,
        v_kisa,
        v_tam,
        'kulis',
        false,
        v_created
    )
    returning * into v_row;

    return jsonb_build_object(
        'ok', true,
        'hikaye', to_jsonb(v_row)
    );
end;
$$;

revoke all on function public.master_hikaye_ekle(jsonb) from public, anon;
grant execute on function public.master_hikaye_ekle(jsonb) to authenticated;

notify pgrst, 'reload schema';
