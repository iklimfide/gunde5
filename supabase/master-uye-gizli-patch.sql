-- Mevcut kurulum: üye gizliliği + master işlemleri (bir kez)

alter table public.uye
    add column if not exists zorunlu_gizli boolean not null default false;

create or replace function public.master_uye_islem(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid;
    v_islem text;
    v_not text;
    v_row public.uye%rowtype;
begin
    if not public.master_mi() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_uid := (p_body->>'uye_id')::uuid;
    v_islem := lower(trim(coalesce(p_body->>'islem', '')));
    v_not := left(trim(coalesce(p_body->>'not', '')), 500);
    if v_uid is null or v_islem = '' then
        return jsonb_build_object('ok', false, 'hata', 'uye_id ve islem gerekli');
    end if;

    if v_islem not in ('aktif', 'askida', 'ban', 'gizli_uye', 'gizli_kaldir') then
        return jsonb_build_object('ok', false, 'hata', 'gecersiz islem');
    end if;

    select * into v_row from public.uye where id = v_uid;
    if not found then
        return jsonb_build_object('ok', false, 'hata', 'uye bulunamadi');
    end if;

    perform set_config('gunde5.master_bypass', '1', true);

    if v_islem = 'gizli_uye' then
        update public.uye set zorunlu_gizli = true where id = v_uid;
        update public.hikayeler
        set is_gizli = true, username = 'Gizli Üye'
        where user_id = v_uid and silindi_at is null;
    elsif v_islem = 'gizli_kaldir' then
        update public.uye set zorunlu_gizli = false where id = v_uid;
        update public.hikayeler i
        set is_gizli = false,
            username = v_row.username
        where i.user_id = v_uid and silindi_at is null;
    else
        update public.uye
        set durum = v_islem,
            durum_notu = case when v_not = '' then durum_notu else v_not end
        where id = v_uid;
    end if;

    select * into v_row from public.uye where id = v_uid;
    return jsonb_build_object(
        'ok', true,
        'uye', jsonb_build_object(
            'id', v_row.id,
            'username', v_row.username,
            'email', v_row.email,
            'durum', coalesce(v_row.durum, 'aktif'),
            'zorunlu_gizli', coalesce(v_row.zorunlu_gizli, false)
        )
    );
end;
$$;

-- Arama sonucunda zorunlu_gizli
create or replace function public.master_uye_ara(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_q text;
    v_lim int;
begin
    if not public.master_mi() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_q := lower(trim(coalesce(p_body->>'q', '')));
    v_lim := least(greatest(coalesce((p_body->>'limit')::int, 30), 1), 50);
    if length(v_q) < 2 then
        return jsonb_build_object('ok', false, 'hata', 'en az 2 karakter');
    end if;

    return jsonb_build_object(
        'ok', true,
        'sonuc', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'durum', coalesce(u.durum, 'aktif'),
                'zorunlu_gizli', coalesce(u.zorunlu_gizli, false)
            ) order by u.username)
            from public.uye u
            where lower(u.username) like '%' || v_q || '%'
               or lower(u.email) like '%' || v_q || '%'
            limit v_lim
        ), '[]'::jsonb)
    );
end;
$$;

-- Rumuzdan üye (seed hikayelerde user_id null olabilir)
create or replace function public.master_uye_bul(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rumuz text;
    v_row public.uye%rowtype;
begin
    if not public.master_mi() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;
    v_rumuz := trim(coalesce(p_body->>'username', ''));
    if v_rumuz = '' or lower(v_rumuz) = 'gizli üye' then
        return jsonb_build_object('ok', false, 'hata', 'rumuz gerekli');
    end if;
    select * into v_row from public.uye u
    where lower(u.username) = lower(v_rumuz)
    limit 1;
    if not found then
        return jsonb_build_object('ok', false, 'hata', 'uye bulunamadi');
    end if;
    return jsonb_build_object(
        'ok', true,
        'uye', jsonb_build_object(
            'id', v_row.id,
            'username', v_row.username,
            'email', v_row.email,
            'durum', coalesce(v_row.durum, 'aktif'),
            'zorunlu_gizli', coalesce(v_row.zorunlu_gizli, false)
        )
    );
end;
$$;

revoke all on function public.master_uye_bul(jsonb) from public, anon;
grant execute on function public.master_uye_bul(jsonb) to authenticated;

notify pgrst, 'reload schema';
