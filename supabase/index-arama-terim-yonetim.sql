-- Anasayfa arama terimleri: master ekle / düzenle / sil + öneri birleşimi
-- SQL Editor'da bir kez Run (index-arama-oneri.sql sonrası).

create table if not exists public.index_arama_terimler (
    id bigserial primary key,
    terim text not null unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint index_arama_terimler_terim_len check (char_length(trim(terim)) >= 2)
);

create table if not exists public.index_arama_terim_engelli (
    terim text primary key,
    created_at timestamptz not null default now()
);

alter table public.index_arama_terimler enable row level security;
alter table public.index_arama_terim_engelli enable row level security;
revoke all on public.index_arama_terimler from anon, authenticated;
revoke all on public.index_arama_terim_engelli from anon, authenticated;

drop policy if exists index_arama_terimler_master on public.index_arama_terimler;
create policy index_arama_terimler_master on public.index_arama_terimler
    for all to authenticated using (public.master_email_eslesir()) with check (public.master_email_eslesir());

drop policy if exists index_arama_terim_engelli_master on public.index_arama_terim_engelli;
create policy index_arama_terim_engelli_master on public.index_arama_terim_engelli
    for all to authenticated using (public.master_email_eslesir()) with check (public.master_email_eslesir());

create or replace function private.arama_terim_norm(p text)
returns text
language sql
immutable
set search_path = public
as $$
    select lower(trim(coalesce(p, '')));
$$;

revoke all on function private.arama_terim_norm(text) from public;
grant execute on function private.arama_terim_norm(text) to postgres, service_role;

-- Öneri: manuel terimler + analytics (engelli hariç)
create or replace function public.index_arama_oneri_getir(
    p_onek text,
    p_limit int default 6
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    v_onek text;
    v_lim int;
    v_rows jsonb;
begin
    v_onek := private.arama_terim_norm(p_onek);
    v_lim := least(greatest(coalesce(p_limit, 6), 1), 8);

    if length(v_onek) < 3 then
        return '[]'::jsonb;
    end if;

    select coalesce(jsonb_agg(u.terim order by u.oncelik desc, u.adet desc, u.son desc nulls last, u.terim asc), '[]'::jsonb)
    into v_rows
    from (
        select
            s.terim,
            s.adet,
            s.son,
            s.oncelik
        from (
            select
                t.terim,
                999999::int as adet,
                t.updated_at as son,
                2 as oncelik
            from public.index_arama_terimler t
            where length(t.terim) >= 3
              and t.terim like v_onek || '%'
              and t.terim not in (select e.terim from public.index_arama_terim_engelli e)

            union all

            select
                q.terim,
                q.adet,
                q.son,
                1 as oncelik
            from (
                select
                    private.arama_terim_norm(e.payload->>'query') as terim,
                    count(*)::int as adet,
                    max(e.created_at) as son
                from public.site_analytics_events e
                where e.event_type = 'index_search'
                  and length(private.arama_terim_norm(e.payload->>'query')) >= 3
                  and private.arama_terim_norm(e.payload->>'query') like v_onek || '%'
                  and private.arama_terim_norm(e.payload->>'query') not in (
                      select x.terim from public.index_arama_terim_engelli x
                  )
                  and private.arama_terim_norm(e.payload->>'query') not in (
                      select m.terim from public.index_arama_terimler m
                  )
                group by 1
            ) q
        ) s
        order by s.oncelik desc, s.adet desc, s.son desc nulls last, s.terim asc
        limit v_lim
    ) u;

    return coalesce(v_rows, '[]'::jsonb);
end;
$$;

revoke all on function public.index_arama_oneri_getir(text, int) from public;
grant execute on function public.index_arama_oneri_getir(text, int) to anon, authenticated;

create or replace function public.master_arama_terim_ekle(p_terim text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_terim text;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_terim := private.arama_terim_norm(p_terim);
    if length(v_terim) < 2 then
        return jsonb_build_object('ok', false, 'hata', 'Terim en az 2 karakter olmalı');
    end if;
    if length(v_terim) > 120 then
        return jsonb_build_object('ok', false, 'hata', 'Terim çok uzun');
    end if;

    delete from public.index_arama_terim_engelli where terim = v_terim;

    insert into public.index_arama_terimler (terim, updated_at)
    values (v_terim, now())
    on conflict (terim) do update set updated_at = now();

    return jsonb_build_object('ok', true, 'terim', v_terim);
end;
$$;

create or replace function public.master_arama_terim_guncelle(p_eski text, p_yeni text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_eski text;
    v_yeni text;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_eski := private.arama_terim_norm(p_eski);
    v_yeni := private.arama_terim_norm(p_yeni);
    if length(v_eski) < 2 or length(v_yeni) < 2 then
        return jsonb_build_object('ok', false, 'hata', 'Terim en az 2 karakter olmalı');
    end if;
    if length(v_yeni) > 120 then
        return jsonb_build_object('ok', false, 'hata', 'Terim çok uzun');
    end if;
    if v_eski = v_yeni then
        return jsonb_build_object('ok', true, 'terim', v_yeni);
    end if;

    delete from public.index_arama_terimler where terim = v_eski;
    delete from public.index_arama_terim_engelli where terim = v_yeni;

    insert into public.index_arama_terim_engelli (terim) values (v_eski)
    on conflict (terim) do nothing;

    insert into public.index_arama_terimler (terim, updated_at)
    values (v_yeni, now())
    on conflict (terim) do update set updated_at = now();

    return jsonb_build_object('ok', true, 'terim', v_yeni);
end;
$$;

create or replace function public.master_arama_terim_sil(p_terim text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_terim text;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_terim := private.arama_terim_norm(p_terim);
    if length(v_terim) < 2 then
        return jsonb_build_object('ok', false, 'hata', 'Geçersiz terim');
    end if;

    delete from public.index_arama_terimler where terim = v_terim;

    insert into public.index_arama_terim_engelli (terim) values (v_terim)
    on conflict (terim) do nothing;

    return jsonb_build_object('ok', true, 'terim', v_terim);
end;
$$;

create or replace function public.master_arama_terim_toplu_sil(p_terimler text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_raw text;
    v_terim text;
    v_silinen int := 0;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    if p_terimler is null or array_length(p_terimler, 1) is null then
        return jsonb_build_object('ok', false, 'hata', 'Terim seçilmedi');
    end if;

    if array_length(p_terimler, 1) > 100 then
        return jsonb_build_object('ok', false, 'hata', 'En fazla 100 terim silinebilir');
    end if;

    foreach v_raw in array p_terimler loop
        v_terim := private.arama_terim_norm(v_raw);
        if length(v_terim) < 2 then
            continue;
        end if;

        delete from public.index_arama_terimler where terim = v_terim;

        insert into public.index_arama_terim_engelli (terim) values (v_terim)
        on conflict (terim) do nothing;

        v_silinen := v_silinen + 1;
    end loop;

    if v_silinen = 0 then
        return jsonb_build_object('ok', false, 'hata', 'Geçerli terim bulunamadı');
    end if;

    return jsonb_build_object('ok', true, 'silinen', v_silinen);
end;
$$;

revoke all on function public.master_arama_terim_ekle(text) from public;
revoke all on function public.master_arama_terim_guncelle(text, text) from public;
revoke all on function public.master_arama_terim_sil(text) from public;
revoke all on function public.master_arama_terim_toplu_sil(text[]) from public;
grant execute on function public.master_arama_terim_ekle(text) to authenticated;
grant execute on function public.master_arama_terim_guncelle(text, text) to authenticated;
grant execute on function public.master_arama_terim_sil(text) to authenticated;
grant execute on function public.master_arama_terim_toplu_sil(text[]) to authenticated;

notify pgrst, 'reload schema';
