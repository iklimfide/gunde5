-- Master yönetici: arifguvenc@gmail.com (SQL Editor'da bir kez çalıştırın)
-- Kurulumdan sonra mutlaka: security-advisor-definer-fix.sql (Security Advisor uyarıları)

-- Üye durumu (ban / askıda)
alter table public.uye
    add column if not exists durum varchar(16) not null default 'aktif',
    add column if not exists durum_notu text,
    add column if not exists zorunlu_gizli boolean not null default false;

alter table public.uye drop constraint if exists uye_durum_check;
alter table public.uye add constraint uye_durum_check
    check (durum in ('aktif', 'askida', 'ban'));

insert into public.site_ayar (anahtar, deger)
values ('master_email', 'arifguvenc@gmail.com')
on conflict (anahtar) do update set deger = excluded.deger, updated_at = now();

-- ---------------------------------------------------------------------------
-- Master kimliği (auth.users e-posta = site_ayar.master_email)
-- ---------------------------------------------------------------------------
create or replace function public.master_email_hedef()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select lower(trim(coalesce(
        (select deger from public.site_ayar where anahtar = 'master_email' limit 1),
        'arifguvenc@gmail.com'
    )));
$$;

revoke all on function public.master_email_hedef() from public, anon, authenticated;

create or replace function public.master_mi()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select auth.uid() is not null
        and exists (
            select 1
            from auth.users u
            where u.id = auth.uid()
              and lower(trim(coalesce(u.email, ''))) = public.master_email_hedef()
        );
$$;

revoke all on function public.master_mi() from public, anon, authenticated;

create or replace function public.master_email_eslesir()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
    select auth.uid() is not null
        and lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = (
            select lower(trim(coalesce(s.deger, '')))
            from public.site_ayar s
            where s.anahtar = 'master_email'
            limit 1
        );
$$;

revoke all on function public.master_email_eslesir() from public, anon;
grant execute on function public.master_email_eslesir() to authenticated;

drop policy if exists itiraflar_update_master on public.itiraflar;
create policy itiraflar_update_master on public.itiraflar
    for update to authenticated
    using (public.master_email_eslesir())
    with check (public.master_email_eslesir());

drop policy if exists uye_select_master on public.uye;
create policy uye_select_master on public.uye
    for select to authenticated
    using (public.master_email_eslesir());

grant update on public.uye to authenticated;

drop policy if exists uye_update_master on public.uye;
create policy uye_update_master on public.uye
    for update to authenticated
    using (public.master_email_eslesir())
    with check (public.master_email_eslesir());

create or replace function public.master_durum()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
begin
    return jsonb_build_object(
        'master', public.master_email_eslesir(),
        'email', (
            select lower(trim(coalesce(deger, '')))
            from public.site_ayar
            where anahtar = 'master_email'
            limit 1
        )
    );
end;
$$;

revoke all on function public.master_durum() from public, anon;
grant execute on function public.master_durum() to authenticated;

-- ---------------------------------------------------------------------------
-- Podyum koruması: master RPC güncellemelerinde bypass
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Hikaye işlemleri
-- p_body: { itiraf_id, islem, content_full?, is_gizli?, up_votes?, down_votes?, status? }
-- islem: guncelle | gizle | goster | sil | geri_al | oylar | status
-- ---------------------------------------------------------------------------
create or replace function public.master_hikaye_islem(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_id bigint;
    v_islem text;
    v_row public.itiraflar%rowtype;
    v_tam text;
    v_kisa text;
    v_up int;
    v_down int;
    v_status text;
    v_yorum int;
    v_b int;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_id := (p_body->>'itiraf_id')::bigint;
    v_islem := lower(trim(coalesce(p_body->>'islem', '')));
    if v_id is null or v_islem = '' then
        return jsonb_build_object('ok', false, 'hata', 'itiraf_id ve islem gerekli');
    end if;

    select * into v_row from public.itiraflar where id = v_id;
    if not found then
        return jsonb_build_object('ok', false, 'hata', 'hikaye bulunamadi');
    end if;

    perform set_config('gunde5.master_bypass', '1', true);

    if v_islem = 'guncelle' then
        v_tam := trim(coalesce(p_body->>'content_full', ''));
        if v_tam = '' then
            return jsonb_build_object('ok', false, 'hata', 'metin bos');
        end if;
        v_kisa := case when char_length(v_tam) <= 140 then v_tam else left(v_tam, 137) || '...' end;
        update public.itiraflar
        set content_full = v_tam, content_short = v_kisa
        where id = v_id;
    elsif v_islem = 'gizle' then
        update public.itiraflar set is_gizli = true where id = v_id;
    elsif v_islem = 'goster' then
        update public.itiraflar set is_gizli = false where id = v_id;
    elsif v_islem = 'sil' then
        update public.itiraflar set silindi_at = now() where id = v_id;
    elsif v_islem = 'geri_al' then
        update public.itiraflar set silindi_at = null where id = v_id;
    elsif v_islem = 'oylar' then
        v_up := coalesce((p_body->>'up_votes')::int, v_row.up_votes);
        v_down := coalesce((p_body->>'down_votes')::int, v_row.down_votes);
        if v_up < 0 or v_down < 0 then
            return jsonb_build_object('ok', false, 'hata', 'oy sayisi negatif olamaz');
        end if;
        select count(*)::int into v_yorum from public.itiraf_cevaplar c where c.itiraf_id = v_id;
        v_b := v_up - v_down;
        update public.itiraflar
        set up_votes = v_up, down_votes = v_down, b = v_b, r = v_b + (coalesce(v_yorum, 0) * 5)
        where id = v_id;
    elsif v_islem = 'status' then
        v_status := lower(trim(coalesce(p_body->>'status', '')));
        if v_status not in ('kulis', 'podyum') then
            return jsonb_build_object('ok', false, 'hata', 'status kulis veya podyum olmali');
        end if;
        update public.itiraflar set status = v_status where id = v_id;
    else
        return jsonb_build_object('ok', false, 'hata', 'bilinmeyen islem');
    end if;

    select * into v_row from public.itiraflar where id = v_id;
    return jsonb_build_object(
        'ok', true,
        'itiraf', jsonb_build_object(
            'id', v_row.id,
            'status', v_row.status,
            'is_gizli', v_row.is_gizli,
            'silindi_at', v_row.silindi_at,
            'up_votes', v_row.up_votes,
            'down_votes', v_row.down_votes,
            'content_full', v_row.content_full,
            'content_short', v_row.content_short
        )
    );
end;
$$;

revoke all on function public.master_hikaye_islem(jsonb) from public, anon;
grant execute on function public.master_hikaye_islem(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Üye işlemleri
-- p_body: { uye_id, islem, not? }  islem: aktif | askida | ban
-- ---------------------------------------------------------------------------
create or replace function public.master_uye_islem(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_uid uuid;
    v_islem text;
    v_not text;
    v_row public.uye%rowtype;
begin
    if not public.master_email_eslesir() then
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
        update public.itiraflar
        set is_gizli = true, username = 'Gizli Üye'
        where user_id = v_uid and silindi_at is null;
    elsif v_islem = 'gizli_kaldir' then
        update public.uye set zorunlu_gizli = false where id = v_uid;
        update public.itiraflar i
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

revoke all on function public.master_uye_islem(jsonb) from public, anon;
grant execute on function public.master_uye_islem(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Üye arama (e-posta / rumuz)
-- p_body: { q, limit? }
-- ---------------------------------------------------------------------------
create or replace function public.master_uye_ara(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_q text;
    v_lim int;
begin
    if not public.master_email_eslesir() then
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

revoke all on function public.master_uye_ara(jsonb) from public, anon;
grant execute on function public.master_uye_ara(jsonb) to authenticated;

-- Rumuz → üye (kartlarda user_id yoksa)
create or replace function public.master_uye_bul(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_rumuz text;
    v_row public.uye%rowtype;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;
    v_rumuz := trim(coalesce(p_body->>'username', ''));
    if v_rumuz = '' or lower(v_rumuz) = 'gizli üye' then
        return jsonb_build_object('ok', false, 'hata', 'rumuz gerekli');
    end if;
    select * into v_row from public.uye u
    where u.username = v_rumuz
       or lower(u.username) = lower(v_rumuz)
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

revoke all on function public.trg_itiraf_oy_bildirim() from public, anon, authenticated;
revoke all on function public.trg_itiraf_cevap_bildirim() from public, anon, authenticated;
revoke all on function public.itiraf_oy_sayaclarini_yenile(bigint[]) from public, anon, authenticated;
grant execute on function public.itiraf_oy_sayaclarini_yenile(bigint[]) to service_role;

notify pgrst, 'reload schema';
