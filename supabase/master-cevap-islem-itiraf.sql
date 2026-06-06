-- master_cevap_islem → itiraf_cevaplar şeması (Kamikaze yorum düzenleme/silme)
-- SQL Editor'da bir kez Run.

create or replace function public.master_cevap_islem(p_body jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_id bigint;
    v_islem text;
    v_metin text;
    v_row public.itiraf_cevaplar%rowtype;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_id := (p_body->>'cevap_id')::bigint;
    v_islem := lower(trim(coalesce(p_body->>'islem', '')));
    if v_id is null or v_islem = '' then
        return jsonb_build_object('ok', false, 'hata', 'cevap_id ve islem gerekli');
    end if;

    select * into v_row from public.itiraf_cevaplar where id = v_id;
    if not found then
        return jsonb_build_object('ok', false, 'hata', 'cevap bulunamadi');
    end if;

    perform set_config('gunde5.master_bypass', '1', true);

    if v_islem = 'guncelle' then
        v_metin := trim(coalesce(p_body->>'content', ''));
        if char_length(v_metin) < 1 then
            return jsonb_build_object('ok', false, 'hata', 'metin bos');
        end if;
        if char_length(v_metin) > 2000 then
            return jsonb_build_object('ok', false, 'hata', 'metin cok uzun');
        end if;
        update public.itiraf_cevaplar set content = v_metin where id = v_id;
    elsif v_islem = 'sil' then
        delete from public.itiraf_cevaplar where id = v_id;
        return jsonb_build_object('ok', true, 'silindi', true);
    else
        return jsonb_build_object('ok', false, 'hata', 'bilinmeyen islem');
    end if;

    select * into v_row from public.itiraf_cevaplar where id = v_id;
    return jsonb_build_object(
        'ok', true,
        'cevap', jsonb_build_object(
            'id', v_row.id,
            'hikaye_id', v_row.itiraf_id,
            'content', v_row.content,
            'created_at', v_row.created_at
        )
    );
end;
$$;

revoke all on function public.master_cevap_islem(jsonb) from public, anon;
grant execute on function public.master_cevap_islem(jsonb) to authenticated;

notify pgrst, 'reload schema';
