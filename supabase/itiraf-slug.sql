-- Hikaye URL slug: slug_hint (isteğe bağlı) + otomatik üretim + slug (benzersiz, -{id} soneki)
-- Supabase SQL Editor'da bir kez Run.
-- master_hikaye_ekle / master_hikaye_islem / master_submission_planla güncellenir.

-- ---------------------------------------------------------------------------
-- 1) Sütunlar
-- ---------------------------------------------------------------------------
alter table public.itiraflar
    add column if not exists slug_hint varchar(80);

alter table public.itiraflar
    add column if not exists slug varchar(120);

comment on column public.itiraflar.slug_hint is 'İsteğe bağlı URL adı (3-5 kelime); boşsa metinden otomatik slug';
comment on column public.itiraflar.slug is 'Tam paylaşım yolu: kelimeler-{id}, örn. nesil-telefonsuz-1842';

create unique index if not exists itiraflar_slug_unique_idx
    on public.itiraflar (slug)
    where slug is not null and silindi_at is null;

-- ---------------------------------------------------------------------------
-- 2) Slug üretim fonksiyonları
-- ---------------------------------------------------------------------------
create or replace function public.itiraf_slug_normalize(p_text text)
returns text
language sql
immutable
as $$
    select trim(both '-' from regexp_replace(
        regexp_replace(
            lower(translate(
                coalesce(p_text, ''),
                'çÇğĞıİöÖşŞüÜ',
                'cCgGiIoOsSuU'
            )),
            '[^a-z0-9]+', '-', 'g'
        ),
        '-+', '-', 'g'
    ));
$$;

create or replace function public.itiraf_slug_stop_kelime(p_word text)
returns boolean
language sql
immutable
as $$
    select coalesce(p_word, '') = any (array[
        'gecen','guncen','gun','gunde','ben','bana','beni','bir','bu','su','ya',
        'gibi','diye','falan','aslinda','o','da','de','ki','mi','mu','mü','mı',
        'icin','ile','ve','ama','hem','ne','var','yok','cok','daha','en','her','hic',
        'ise','olan','olur','sey','kendi','onun','ona','onu','sen','sana','seni',
        'biz','bize','siz','onlar','nasil','neden','boyle','simdi','sonra','once',
        'bile','sadece','artik','yani','zaten','hala','hep','bazi','butun','tum',
        'cunku','eger','olarak','degil','uzerine','kadar','beri','gore','arada',
        'arasinda','hani','iste','tabi','tabii','yoksa','belki','keske',
        'baya','bayagi','filan','sanki','galiba'
    ]::text[]);
$$;

create or replace function public.itiraf_slug_uret(
    p_hint text,
    p_content text,
    p_id bigint
)
returns text
language plpgsql
immutable
as $$
declare
    v_base text;
    v_raw text;
    v_clean text;
    v_word text;
    v_filtered text[] := '{}';
    v_words text[];
begin
    if p_id is null then
        return null;
    end if;

    if nullif(trim(coalesce(p_hint, '')), '') is not null then
        v_base := left(public.itiraf_slug_normalize(trim(p_hint)), 80);
    else
        v_raw := left(coalesce(p_content, ''), 250);
        v_raw := lower(translate(v_raw, 'çÇğĞıİöÖşŞüÜ', 'cCgGiIoOsSuU'));
        v_clean := regexp_replace(v_raw, '[^a-z0-9\s]+', ' ', 'g');
        v_words := regexp_split_to_array(trim(v_clean), '\s+');

        if v_words is not null then
            foreach v_word in array v_words loop
                if v_word is null or v_word = '' then
                    continue;
                end if;
                if public.itiraf_slug_stop_kelime(v_word) then
                    continue;
                end if;
                v_filtered := array_append(v_filtered, v_word);
                if coalesce(array_length(v_filtered, 1), 0) >= 7 then
                    exit;
                end if;
            end loop;
        end if;

        if coalesce(array_length(v_filtered, 1), 0) = 0 then
            v_base := 'hikaye';
        else
            v_base := left(array_to_string(v_filtered, '-'), 80);
        end if;
    end if;

    if coalesce(v_base, '') = '' then
        v_base := 'hikaye';
    end if;

    return v_base || '-' || p_id::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Trigger — slug_hint veya content_full değişince yenile; aksi halde sabit tut
-- ---------------------------------------------------------------------------
create or replace function public.itiraf_slug_tetik()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'UPDATE' then
        if old.slug is not null
           and new.slug_hint is not distinct from old.slug_hint
           and new.content_full is not distinct from old.content_full then
            new.slug := old.slug;
            return new;
        end if;
    end if;

    new.slug := public.itiraf_slug_uret(new.slug_hint, new.content_full, new.id);
    return new;
end;
$$;

drop trigger if exists trg_itiraf_slug on public.itiraflar;
create trigger trg_itiraf_slug
    before insert or update on public.itiraflar
    for each row
    execute function public.itiraf_slug_tetik();

-- Mevcut kayıtlar
update public.itiraflar
set slug = public.itiraf_slug_uret(slug_hint, content_full, id)
where slug is null
  and silindi_at is null;

-- ---------------------------------------------------------------------------
-- 4) master_hikaye_ekle — slug_hint desteği
-- ---------------------------------------------------------------------------
create or replace function public.master_hikaye_ekle(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_username text;
    v_age int;
    v_gender text;
    v_yer text;
    v_yurtdisi text;
    v_baslik text;
    v_slug_hint text;
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
    v_slug_hint := nullif(left(trim(coalesce(p_body->>'slug_hint', '')), 80), '');

    v_kisa := case when char_length(v_tam) <= 140 then v_tam else left(v_tam, 137) || '...' end;

    if p_body ? 'created_at' and nullif(trim(p_body->>'created_at'), '') is not null then
        begin
            v_created := (p_body->>'created_at')::timestamptz;
        exception
            when others then
                return jsonb_build_object('ok', false, 'hata', 'gecersiz yayin tarihi');
        end;
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
        slug_hint,
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
        v_slug_hint,
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

-- ---------------------------------------------------------------------------
-- 5) master_hikaye_islem — slug_hint güncelleme (master-hikaye-kart-meta.sql + slug)
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
    v_age int;
    v_gender text;
    v_yer text;
    v_yurtdisi text;
    v_rumuz text;
    v_created timestamptz;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
    end if;

    v_id := coalesce(
        nullif(trim(coalesce(p_body->>'itiraf_id', '')), '')::bigint,
        nullif(trim(coalesce(p_body->>'hikaye_id', '')), '')::bigint
    );
    v_islem := lower(trim(coalesce(p_body->>'islem', '')));
    if v_id is null or v_islem = '' then
        return jsonb_build_object('ok', false, 'hata', 'itiraf_id ve islem gerekli');
    end if;

    select * into v_row from public.itiraflar where id = v_id;
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
            update public.itiraflar set age = v_age where id = v_id;
        end if;
        if p_body ? 'gender' then
            v_gender := lower(trim(coalesce(p_body->>'gender', '')));
            if v_gender not in ('male', 'female') then
                return jsonb_build_object('ok', false, 'hata', 'gecersiz cinsiyet');
            end if;
            update public.itiraflar set gender = v_gender where id = v_id;
        end if;
        if p_body ? 'yasadigi_yer' then
            v_yer := nullif(trim(coalesce(p_body->>'yasadigi_yer', '')), '');
            update public.itiraflar set yasadigi_yer = v_yer where id = v_id;
            if v_yer is distinct from 'yurtdisi' then
                update public.itiraflar set yurtdisi_sehir = null where id = v_id;
            end if;
        end if;
        if p_body ? 'yurtdisi_sehir' then
            v_yurtdisi := nullif(left(trim(coalesce(p_body->>'yurtdisi_sehir', '')), 80), '');
            update public.itiraflar set yurtdisi_sehir = v_yurtdisi where id = v_id;
        end if;
    elsif v_islem = 'guncelle' then
        v_tam := trim(coalesce(p_body->>'content_full', ''));
        if v_tam = '' then
            return jsonb_build_object('ok', false, 'hata', 'metin bos');
        end if;
        v_kisa := case when char_length(v_tam) <= 140 then v_tam else left(v_tam, 137) || '...' end;
        update public.itiraflar
        set content_full = v_tam, content_short = v_kisa
        where id = v_id;
        if p_body ? 'baslik' then
            update public.itiraflar
            set baslik = nullif(left(trim(coalesce(p_body->>'baslik', '')), 120), '')
            where id = v_id;
        end if;
        if p_body ? 'slug_hint' then
            update public.itiraflar
            set slug_hint = nullif(left(trim(coalesce(p_body->>'slug_hint', '')), 80), '')
            where id = v_id;
        end if;
        if p_body ? 'username' then
            v_rumuz := nullif(left(trim(coalesce(p_body->>'username', '')), 50), '');
            if v_rumuz is null then
                return jsonb_build_object('ok', false, 'hata', 'rumuz bos olamaz');
            end if;
            update public.itiraflar set username = v_rumuz where id = v_id;
        end if;
    elsif v_islem = 'gizle' then
        update public.itiraflar set is_gizli = true where id = v_id;
    elsif v_islem = 'goster' then
        update public.itiraflar set is_gizli = false where id = v_id;
    elsif v_islem = 'sil' then
        update public.itiraflar
        set silindi_at = now(),
            status = 'silindi'
        where id = v_id;
    elsif v_islem = 'geri_al' then
        update public.itiraflar
        set silindi_at = null,
            status = 'kulis'
        where id = v_id;
    elsif v_islem = 'oylar' then
        v_up := coalesce((p_body->>'up_votes')::int, v_row.up_votes);
        v_down := coalesce((p_body->>'down_votes')::int, v_row.down_votes);
        if v_up < 0 or v_down < 0 then
            return jsonb_build_object('ok', false, 'hata', 'oy sayisi negatif olamaz');
        end if;
        update public.itiraflar
        set up_votes = v_up, down_votes = v_down
        where id = v_id;
        if to_regprocedure('public.itiraf_puan_guncelle(bigint)') is not null then
            perform public.itiraf_puan_guncelle(v_id);
        elsif to_regprocedure('public.hikaye_puan_guncelle(bigint)') is not null then
            perform public.hikaye_puan_guncelle(v_id);
        end if;
    elsif v_islem = 'status' then
        v_status := lower(trim(coalesce(p_body->>'status', '')));
        if v_status not in ('kulis', 'podyum', 'silindi') then
            return jsonb_build_object('ok', false, 'hata', 'status kulis, podyum veya silindi olmali');
        end if;
        update public.itiraflar
        set status = v_status,
            silindi_at = case
                when v_status = 'silindi' then coalesce(silindi_at, now())
                else null
            end
        where id = v_id;
    elsif v_islem = 'yayin_tarihi' then
        if not p_body ? 'created_at' or nullif(trim(coalesce(p_body->>'created_at', '')), '') is null then
            return jsonb_build_object('ok', false, 'hata', 'created_at gerekli');
        end if;
        begin
            v_created := (p_body->>'created_at')::timestamptz;
        exception
            when others then
                return jsonb_build_object('ok', false, 'hata', 'gecersiz yayin tarihi');
        end;
        update public.itiraflar set created_at = v_created where id = v_id;
    else
        return jsonb_build_object('ok', false, 'hata', 'bilinmeyen islem');
    end if;

    select * into v_row from public.itiraflar where id = v_id;
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
            'baslik', v_row.baslik,
            'slug_hint', v_row.slug_hint,
            'slug', v_row.slug,
            'username', v_row.username,
            'age', v_row.age,
            'gender', v_row.gender,
            'yasadigi_yer', v_row.yasadigi_yer,
            'yurtdisi_sehir', v_row.yurtdisi_sehir,
            'created_at', v_row.created_at
        )
    );
end;
$$;

revoke all on function public.master_hikaye_islem(jsonb) from public, anon;
grant execute on function public.master_hikaye_islem(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) master_submission_planla — slug_hint (title alanından)
-- ---------------------------------------------------------------------------
create or replace function public.master_submission_planla(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
    v_row public.user_submissions%rowtype;
    v_username text;
    v_age int;
    v_gender text;
    v_yer text;
    v_baslik text;
    v_slug_hint text;
    v_tam text;
    v_kisa text;
    v_created timestamptz;
    v_itiraf public.itiraflar%rowtype;
begin
    if not public.master_email_eslesir() then
        return jsonb_build_object('ok', false, 'hata', 'Yetkisiz');
    end if;

    v_id := (p_body->>'id')::uuid;
    if v_id is null then
        return jsonb_build_object('ok', false, 'hata', 'id gerekli');
    end if;

    select * into v_row from public.user_submissions where id = v_id;
    if not found then
        return jsonb_build_object('ok', false, 'hata', 'Kayıt bulunamadı');
    end if;

    if v_row.published_story_id is not null then
        return jsonb_build_object(
            'ok', false,
            'hata', 'Bu gönderi zaten planlandı',
            'published_story_id', v_row.published_story_id
        );
    end if;

    v_username := left(trim(coalesce(p_body->>'username', '')), 50);
    if char_length(v_username) < 2 then
        return jsonb_build_object('ok', false, 'hata', 'rumuz en az 2 karakter');
    end if;

    v_age := coalesce((p_body->>'age')::int, v_row.age);
    if v_age is null or v_age < 18 or v_age > 120 then
        return jsonb_build_object('ok', false, 'hata', 'yas 18-120 arasi olmali');
    end if;

    v_gender := lower(trim(coalesce(p_body->>'gender', '')));
    if v_gender not in ('male', 'female') then
        return jsonb_build_object('ok', false, 'hata', 'gecersiz cinsiyet');
    end if;

    v_tam := trim(coalesce(nullif(trim(p_body->>'content'), ''), v_row.content));
    if v_tam = '' or char_length(v_tam) < 50 then
        return jsonb_build_object('ok', false, 'hata', 'hikaye en az 50 karakter');
    end if;
    if char_length(v_tam) > 12000 then
        return jsonb_build_object('ok', false, 'hata', 'hikaye cok uzun');
    end if;

    v_slug_hint := left(trim(coalesce(
        nullif(trim(p_body->>'slug_hint'), ''),
        nullif(trim(p_body->>'title'), ''),
        coalesce(v_row.title, '')
    )), 80);
    if v_slug_hint = '' then
        v_slug_hint := null;
    end if;

    v_baslik := null;

    v_yer := left(trim(coalesce(nullif(trim(p_body->>'city'), ''), coalesce(v_row.city, ''))), 80);
    if v_yer = '' then
        v_yer := null;
    end if;

    if not (p_body ? 'created_at') or nullif(trim(p_body->>'created_at'), '') is null then
        return jsonb_build_object('ok', false, 'hata', 'yayin tarihi gerekli');
    end if;

    begin
        v_created := (p_body->>'created_at')::timestamptz;
    exception
        when others then
            return jsonb_build_object('ok', false, 'hata', 'gecersiz yayin tarihi');
    end;

    v_kisa := case when char_length(v_tam) <= 140 then v_tam else left(v_tam, 137) || '...' end;

    perform set_config('gunde5.master_bypass', '1', true);

    insert into public.itiraflar (
        user_id,
        username,
        age,
        gender,
        yasadigi_yer,
        yurtdisi_sehir,
        baslik,
        slug_hint,
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
        null,
        v_baslik,
        v_slug_hint,
        v_kisa,
        v_tam,
        'kulis',
        false,
        v_created
    )
    returning * into v_itiraf;

    update public.user_submissions
    set
        status = 'approved',
        title = coalesce(v_slug_hint, title),
        content = v_tam,
        age = v_age,
        city = v_yer,
        gender = case v_gender when 'male' then 'Erkek' when 'female' then 'Kadın' else gender end,
        reviewed_at = now(),
        published_story_id = v_itiraf.id
    where id = v_id;

    return jsonb_build_object(
        'ok', true,
        'published_story_id', v_itiraf.id,
        'slug', v_itiraf.slug
    );
end;
$$;

notify pgrst, 'reload schema';
