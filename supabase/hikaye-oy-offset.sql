-- Master manuel oy sayisini dogrudan up_votes/down_votes alanlarina yazar.
-- Gercek kullanici oylari geldiginde sayilar sifirlanmaz; trigger sadece fark kadar artirir/azaltir.
-- SQL Editor'da bir kez Run.

alter table public.hikayeler
    drop constraint if exists hikayeler_status_check;

alter table public.hikayeler
    add constraint hikayeler_status_check
    check (status in ('kulis', 'podyum', 'silindi'));

update public.hikayeler
set status = 'silindi'
where silindi_at is not null
  and status <> 'silindi';

alter table public.hikayeler
    drop column if exists oy_offset_up,
    drop column if exists oy_offset_down;

drop function if exists public.hikaye_oy_sayilarini_uygula(bigint);

create or replace function public.hikaye_oy_sayaci()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'INSERT' then
        update public.hikayeler
        set
            up_votes = up_votes + case when new.oy = 1 then 1 else 0 end,
            down_votes = down_votes + case when new.oy = -1 then 1 else 0 end
        where id = new.hikaye_id;
        perform public.hikaye_puan_guncelle(new.hikaye_id);
    elsif tg_op = 'UPDATE' then
        if new.hikaye_id = old.hikaye_id then
            update public.hikayeler
            set
                up_votes = greatest(
                    0,
                    up_votes
                        + case when new.oy = 1 then 1 else 0 end
                        - case when old.oy = 1 then 1 else 0 end
                ),
                down_votes = greatest(
                    0,
                    down_votes
                        + case when new.oy = -1 then 1 else 0 end
                        - case when old.oy = -1 then 1 else 0 end
                )
            where id = new.hikaye_id;
            perform public.hikaye_puan_guncelle(new.hikaye_id);
        else
            update public.hikayeler
            set
                up_votes = greatest(0, up_votes - case when old.oy = 1 then 1 else 0 end),
                down_votes = greatest(0, down_votes - case when old.oy = -1 then 1 else 0 end)
            where id = old.hikaye_id;

            update public.hikayeler
            set
                up_votes = up_votes + case when new.oy = 1 then 1 else 0 end,
                down_votes = down_votes + case when new.oy = -1 then 1 else 0 end
            where id = new.hikaye_id;

            perform public.hikaye_puan_guncelle(old.hikaye_id);
            perform public.hikaye_puan_guncelle(new.hikaye_id);
        end if;
    else
        update public.hikayeler
        set
            up_votes = greatest(0, up_votes - case when old.oy = 1 then 1 else 0 end),
            down_votes = greatest(0, down_votes - case when old.oy = -1 then 1 else 0 end)
        where id = old.hikaye_id;
        perform public.hikaye_puan_guncelle(old.hikaye_id);
    end if;
    return coalesce(new, old);
end;
$$;

revoke all on function public.hikaye_oy_sayaci() from public, anon, authenticated;

create or replace function public.hikaye_oy_sayaclarini_yenile(p_ids bigint[] default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id bigint;
begin
    for v_id in
        select i.id
        from public.hikayeler i
        where (p_ids is null or i.id = any (p_ids))
          and i.silindi_at is null
    loop
        perform public.hikaye_puan_guncelle(v_id);
    end loop;
end;
$$;

revoke all on function public.hikaye_oy_sayaclarini_yenile(bigint[]) from public, anon, authenticated;
grant execute on function public.hikaye_oy_sayaclarini_yenile(bigint[]) to service_role;

-- Mevcut kartlar: görünen sayaç aynen korunur.
update public.hikayeler i
set
    up_votes = coalesce(i.up_votes, 0),
    down_votes = coalesce(i.down_votes, 0)
where i.silindi_at is null;

-- master_hikaye_islem → oylar: up_votes/down_votes doğrudan yazılır
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
    v_age int;
    v_gender text;
    v_yer text;
    v_yurtdisi text;
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

    if v_islem = 'meta' then
        if p_body ? 'age' then
            v_age := (p_body->>'age')::int;
            if v_age < 18 or v_age > 120 then
                return jsonb_build_object('ok', false, 'hata', 'yas 18-120 arasi olmali');
            end if;
            update public.hikayeler set age = v_age where id = v_id;
        end if;
        if p_body ? 'gender' then
            v_gender := lower(trim(coalesce(p_body->>'gender', '')));
            if v_gender not in ('male', 'female') then
                return jsonb_build_object('ok', false, 'hata', 'gecersiz cinsiyet');
            end if;
            update public.hikayeler set gender = v_gender where id = v_id;
        end if;
        if p_body ? 'yasadigi_yer' then
            v_yer := nullif(trim(coalesce(p_body->>'yasadigi_yer', '')), '');
            update public.hikayeler set yasadigi_yer = v_yer where id = v_id;
            if v_yer is distinct from 'yurtdisi' then
                update public.hikayeler set yurtdisi_sehir = null where id = v_id;
            end if;
        end if;
        if p_body ? 'yurtdisi_sehir' then
            v_yurtdisi := nullif(left(trim(coalesce(p_body->>'yurtdisi_sehir', '')), 80), '');
            update public.hikayeler set yurtdisi_sehir = v_yurtdisi where id = v_id;
        end if;
    elsif v_islem = 'guncelle' then
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
            'content_short', v_row.content_short,
            'age', v_row.age,
            'gender', v_row.gender,
            'yasadigi_yer', v_row.yasadigi_yer,
            'yurtdisi_sehir', v_row.yurtdisi_sehir,
            'username', v_row.username
        )
    );
end;
$$;

revoke all on function public.master_hikaye_islem(jsonb) from public, anon;
grant execute on function public.master_hikaye_islem(jsonb) to authenticated;

notify pgrst, 'reload schema';
