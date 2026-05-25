-- Profil kaydet (profil.html → profil_uye_guncelle)
-- Not: Bazı kurulumlarda public INVOKER -> private DEFINER zinciri 42501
-- üretebildiği için burada tek public SECURITY DEFINER RPC kullanıyoruz.
-- SQL Editor'da TAMAMINI bir kez Run.

alter table public.uye
    add column if not exists avatar_url text,
    add column if not exists yasadigi_yer varchar(40),
    add column if not exists yurtdisi_sehir varchar(80),
    add column if not exists meslek varchar(40),
    add column if not exists medeni_durum varchar(40),
    add column if not exists durum varchar(16) not null default 'aktif',
    add column if not exists durum_notu text,
    add column if not exists zorunlu_gizli boolean not null default false;

create or replace function public.profil_uye_guncelle(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    v_uid uuid;
    v_row public.uye%rowtype;
    v_email text;
    v_meta jsonb;
    v_rumuz text;
    v_gender text;
    v_yil int;
    v_yer text;
    v_yurtdisi text;
begin
    v_uid := auth.uid();
    if v_uid is null then
        return jsonb_build_object('ok', false, 'hata', 'oturum yok');
    end if;

    if not exists (select 1 from public.uye u where u.id = v_uid) then
        select
            lower(coalesce(u.email, '')),
            coalesce(u.raw_user_meta_data, '{}'::jsonb)
        into v_email, v_meta
        from auth.users u
        where u.id = v_uid;

        if v_email is null then
            return jsonb_build_object('ok', false, 'hata', 'auth kullanici yok');
        end if;

        v_rumuz := trim(coalesce(v_meta->>'username', ''));
        if length(v_rumuz) < 5 then
            v_rumuz := 'uye_' || left(replace(v_uid::text, '-', ''), 8);
        end if;

        v_gender := case
            when v_meta->>'gender' in ('male', 'female')
                then v_meta->>'gender'
            else 'female'
        end;

        v_yil := coalesce(
            nullif(v_meta->>'dogum_yili', '')::int,
            extract(year from now())::int - 18
        );

        insert into public.uye (id, username, email, gender, dogum_yili)
        values (
            v_uid,
            left(v_rumuz, 15),
            v_email,
            v_gender,
            v_yil
        )
        on conflict (id) do nothing;
    end if;

    select * into v_row from public.uye where id = v_uid;
    if not found then
        return jsonb_build_object('ok', false, 'hata', 'uye satiri olusturulamadi');
    end if;

    if coalesce(v_row.durum, 'aktif') = 'ban' then
        return jsonb_build_object('ok', false, 'hata', 'hesap kapali');
    end if;

    if p_body is not null and p_body ? 'yasadigi_yer' then
        v_yer := nullif(trim(coalesce(p_body->>'yasadigi_yer', '')), '');
        update public.uye
        set yasadigi_yer = v_yer,
            yurtdisi_sehir = case when v_yer is distinct from 'yurtdisi' then null else yurtdisi_sehir end
        where id = v_uid;
    end if;

    if p_body is not null and p_body ? 'yurtdisi_sehir' then
        v_yurtdisi := nullif(left(trim(coalesce(p_body->>'yurtdisi_sehir', '')), 80), '');
        update public.uye set yurtdisi_sehir = v_yurtdisi where id = v_uid;
    end if;

    if p_body is not null and p_body ? 'meslek' then
        update public.uye
        set meslek = nullif(left(trim(coalesce(p_body->>'meslek', '')), 40), '')
        where id = v_uid;
    end if;

    if p_body is not null and p_body ? 'medeni_durum' then
        update public.uye
        set medeni_durum = nullif(left(trim(coalesce(p_body->>'medeni_durum', '')), 40), '')
        where id = v_uid;
    end if;

    if p_body is not null and p_body ? 'avatar_url' then
        update public.uye
        set avatar_url = nullif(trim(coalesce(p_body->>'avatar_url', '')), '')
        where id = v_uid;
    end if;

    select * into v_row from public.uye where id = v_uid;

    return jsonb_build_object(
        'ok', true,
        'uye', jsonb_build_object(
            'id', v_row.id,
            'username', v_row.username,
            'email', v_row.email,
            'gender', v_row.gender,
            'dogum_yili', v_row.dogum_yili,
            'avatar_url', v_row.avatar_url,
            'yasadigi_yer', v_row.yasadigi_yer,
            'yurtdisi_sehir', v_row.yurtdisi_sehir,
            'meslek', v_row.meslek,
            'medeni_durum', v_row.medeni_durum,
            'durum', coalesce(v_row.durum, 'aktif'),
            'durum_notu', v_row.durum_notu,
            'zorunlu_gizli', coalesce(v_row.zorunlu_gizli, false)
        )
    );
end;
$$;

revoke all on function public.profil_uye_guncelle(jsonb) from public, anon;
grant execute on function public.profil_uye_guncelle(jsonb) to authenticated;

drop function if exists private.gunde5_profil_uye_guncelle(jsonb);

-- Eski ayrı RPC (0029 uyarısı); artık kullanılmıyor
drop function if exists public.profil_uye_ensure();

grant update on public.uye to authenticated;

drop policy if exists uye_update_own on public.uye;
create policy uye_update_own on public.uye
    for update to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

notify pgrst, 'reload schema';
