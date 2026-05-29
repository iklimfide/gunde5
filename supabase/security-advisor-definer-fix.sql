-- Security Advisor — 10 WARN (0028/0029) → SQL Editor'da bu dosyanın TAMAMINI bir kez çalıştırın.
-- Sadece REVOKE yetmez; aşağıdaki CREATE OR REPLACE (security invoker) satırları şart.
-- Sonra Dashboard → Security Advisor → Rerun.
--
-- Düzeltilenler: hikaye_ara, trg_hikaye_*_bildirim, hikaye_oy_sayaclarini_yenile,
-- master_durum, master_hikaye_islem, master_uye_ara, master_uye_bul, master_uye_islem

alter table public.hikayeler
    drop constraint if exists hikayeler_status_check;

alter table public.hikayeler
    add constraint hikayeler_status_check
    check (status in ('kulis', 'podyum', 'silindi'));

update public.hikayeler
set status = 'silindi'
where silindi_at is not null
  and status <> 'silindi';

-- ---------------------------------------------------------------------------
-- Master: invoker kontrol + RLS (DEFINER RPC uyarısı kalkar)
-- ---------------------------------------------------------------------------
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

drop policy if exists hikayeler_update_master on public.hikayeler;
create policy hikayeler_update_master on public.hikayeler
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

create or replace function public.master_hikaye_islem(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_id bigint;
    v_islem text;
    v_row public.hikayeler%rowtype;
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

    v_id := (p_body->>'hikaye_id')::bigint;
    v_islem := lower(trim(coalesce(p_body->>'islem', '')));
    if v_id is null or v_islem = '' then
        return jsonb_build_object('ok', false, 'hata', 'hikaye_id ve islem gerekli');
    end if;

    select * into v_row from public.hikayeler where id = v_id;
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
        update public.hikayeler
        set content_full = v_tam, content_short = v_kisa
        where id = v_id;
    elsif v_islem = 'gizle' then
        update public.hikayeler set is_gizli = true where id = v_id;
    elsif v_islem = 'goster' then
        update public.hikayeler set is_gizli = false where id = v_id;
    elsif v_islem = 'sil' then
        update public.hikayeler
        set silindi_at = now(),
            status = 'silindi'
        where id = v_id;
    elsif v_islem = 'geri_al' then
        update public.hikayeler
        set silindi_at = null,
            status = 'kulis'
        where id = v_id;
    elsif v_islem = 'oylar' then
        v_up := coalesce((p_body->>'up_votes')::int, v_row.up_votes);
        v_down := coalesce((p_body->>'down_votes')::int, v_row.down_votes);
        if v_up < 0 or v_down < 0 then
            return jsonb_build_object('ok', false, 'hata', 'oy sayisi negatif olamaz');
        end if;
        update public.hikayeler
        set up_votes = v_up, down_votes = v_down
        where id = v_id;
        perform public.hikaye_puan_guncelle(v_id);
    elsif v_islem = 'status' then
        v_status := lower(trim(coalesce(p_body->>'status', '')));
        if v_status not in ('kulis', 'podyum', 'silindi') then
            return jsonb_build_object('ok', false, 'hata', 'status kulis, podyum veya silindi olmali');
        end if;
        update public.hikayeler
        set status = v_status,
            silindi_at = case
                when v_status = 'silindi' then coalesce(silindi_at, now())
                else null
            end
        where id = v_id;
    else
        return jsonb_build_object('ok', false, 'hata', 'bilinmeyen islem');
    end if;

    select * into v_row from public.hikayeler where id = v_id;
    return jsonb_build_object(
        'ok', true,
        'hikaye', jsonb_build_object(
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
        update public.hikayeler
        set is_gizli = true, username = 'Gizli Üye'
        where user_id = v_uid and silindi_at is null;
    elsif v_islem = 'gizli_kaldir' then
        update public.uye set zorunlu_gizli = false where id = v_uid;
        update public.hikayeler i
        set is_gizli = false, username = v_row.username
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

-- Dahili (REST yok)
revoke all on function public.master_email_hedef() from public, anon, authenticated;
revoke all on function public.master_mi() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Arama: SECURITY INVOKER (RLS: hikayeler + cevaplar zaten herkese açık SELECT)
-- ---------------------------------------------------------------------------
create or replace function public.hikaye_ara(
    p_q text,
    p_status text default 'kulis',
    p_limit int default 40
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_q text;
    v_status text;
    v_lim int;
    v_pattern text;
    v_adet int;
    v_sonuc jsonb;
begin
    v_q := trim(coalesce(p_q, ''));
    v_status := lower(trim(coalesce(p_status, 'kulis')));
    v_lim := least(greatest(coalesce(p_limit, 40), 1), 80);

    if char_length(v_q) < 2 then
        return jsonb_build_object('ok', false, 'hata', 'en az 2 karakter');
    end if;

    if v_status not in ('kulis', 'podyum') then
        v_status := 'kulis';
    end if;

    v_q := regexp_replace(v_q, '[%_\\]', '', 'g');
    v_pattern := '%' || lower(v_q) || '%';

    select count(*)::int into v_adet
    from public.hikayeler i
    where i.status = v_status
      and i.silindi_at is null
      and (
          lower(i.username) like v_pattern
          or lower(coalesce(i.content_full, '')) like v_pattern
          or lower(coalesce(i.content_short, '')) like v_pattern
          or exists (
              select 1 from public.hikaye_cevaplar c
              where c.hikaye_id = i.id and lower(c.content) like v_pattern
          )
      );

    with eslesen as (
        select distinct on (i.id) i.*
        from public.hikayeler i
        where i.status = v_status
          and i.silindi_at is null
          and (
              lower(i.username) like v_pattern
              or lower(coalesce(i.content_full, '')) like v_pattern
              or lower(coalesce(i.content_short, '')) like v_pattern
              or exists (
                  select 1 from public.hikaye_cevaplar c
                  where c.hikaye_id = i.id and lower(c.content) like v_pattern
              )
          )
        order by i.id, i.created_at desc
    ),
    sinirli as (
        select * from eslesen
        order by created_at desc
        limit v_lim
    )
    select coalesce(
        (select jsonb_agg(to_jsonb(s) order by s.created_at desc) from sinirli s),
        '[]'::jsonb
    ) into v_sonuc;

    return jsonb_build_object(
        'ok', true,
        'adet', coalesce(v_adet, 0),
        'gosterilen', coalesce(jsonb_array_length(v_sonuc), 0),
        'sonuc', coalesce(v_sonuc, '[]'::jsonb)
    );
end;
$$;

revoke all on function public.hikaye_ara(text, text, int) from public, anon, authenticated;
grant execute on function public.hikaye_ara(text, text, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger / dahili: REST ile çağrılmasın
-- ---------------------------------------------------------------------------
revoke all on function public.trg_hikaye_oy_bildirim() from public, anon, authenticated;
revoke all on function public.trg_hikaye_cevap_bildirim() from public, anon, authenticated;
revoke all on function public.hikaye_oy_sayaci() from public, anon, authenticated;
revoke all on function public.hikaye_cevap_puan_sayaci() from public, anon, authenticated;
revoke all on function public.hikaye_puan_guncelle(bigint) from public, anon, authenticated;
revoke all on function public.bildirim_olustur(uuid, text, bigint, uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Bakım RPC: yalnızca service_role (Dashboard / cron)
revoke all on function public.hikaye_oy_sayaclarini_yenile(bigint[]) from public, anon, authenticated;
grant execute on function public.hikaye_oy_sayaclarini_yenile(bigint[]) to service_role;

-- Kamikaze (panel kaldırıldıysa kamikaze-drop.sql; aksi halde service_role anahtarı gerekir)
do $$
declare
    r record;
begin
    for r in
        select p.oid::regprocedure as func
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname like 'kamikaze_%'
    loop
        execute format('revoke all on function %s from public, anon, authenticated', r.func);
        execute format('grant execute on function %s to service_role', r.func);
    end loop;
end;
$$;

notify pgrst, 'reload schema';

-- Doğrulama (prosecdef = f → INVOKER; trigger'lar t olabilir ama REST kapalı):
-- select p.proname, p.prosecdef, p.proacl::text
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'hikaye_ara', 'master_durum', 'master_hikaye_islem', 'master_uye_ara',
--     'master_uye_bul', 'master_uye_islem', 'trg_hikaye_oy_bildirim', 'trg_hikaye_cevap_bildirim'
--   );
