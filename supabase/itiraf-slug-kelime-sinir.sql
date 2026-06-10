-- Slug kelime sınırı (60 karakter, kelime ortasında kesme yok) + slug_hint-only güncelleme + updated_at
-- Mevcut slug değerlerini TOPLU değiştirmez — paylaşılmış URL'ler korunur.
-- Supabase SQL Editor'da bir kez Run (itiraf-slug.sql sonrası).

-- ---------------------------------------------------------------------------
-- 1) updated_at — sitemap lastmod için
-- ---------------------------------------------------------------------------
alter table public.itiraflar
    add column if not exists updated_at timestamptz not null default now();

-- NOT NULL DEFAULT now() tüm mevcut satırlara migration anını yazar; IS NULL asla tetiklenmez.
update public.itiraflar
set updated_at = created_at;

-- ---------------------------------------------------------------------------
-- 2) Slug yardımcıları (api/_lib/slug.js ile aynı mantık)
-- ---------------------------------------------------------------------------
create or replace function public.itiraf_slug_stop_kelime(p_word text)
returns boolean
language sql
immutable
as $$
    select coalesce(p_word, '') = any (array[
        'bir','bu','su','ben','bana','beni','benim','biz','bizim','siz','sizin',
        'gecen','guncen','gun','gunde','birkac','once','sonra','aslinda','falan','yani',
        'diye','gibi','kadar','beri','cok','daha','yine','sey','hicbir','hic',
        'ya','o','da','de','ki','mi','mu','mü','mı','icin','ile','ve','ama','hem',
        'ne','var','yok','en','her','ise','olan','olur','kendi','onun','ona','onu',
        'sen','sana','seni','bize','onlar','nasil','neden','boyle','simdi','bile',
        'sadece','artik','zaten','hala','hep','bazi','butun','tum','cunku','eger',
        'olarak','degil','uzerine','gore','arada','arasinda','hani','iste','tabi',
        'tabii','yoksa','belki','keske','baya','bayagi','filan','sanki','galiba'
    ]::text[]);
$$;

create or replace function public.itiraf_slug_kelime_gecerli(p_word text, p_stop_filtre boolean default true)
returns boolean
language sql
immutable
as $$
    select case
        when coalesce(p_word, '') = '' then false
        when p_stop_filtre and public.itiraf_slug_stop_kelime(p_word) then false
        when p_word ~ '^[0-9]+$' then true
        when length(p_word) = 1 and p_word ~ '^[a-z]$' then false
        when p_word ~ '^[a-z0-9]+$' then true
        else false
    end;
$$;

create or replace function public.itiraf_slug_kelimelerden_base(
    p_words text[],
    p_max_kelime int default 7,
    p_max_uzunluk int default 60,
    p_stop_filtre boolean default true
)
returns text
language plpgsql
immutable
as $$
declare
    v_secilen text[] := '{}';
    v_fallback text[] := '{}';
    v_word text;
    v_parcalar text[] := '{}';
    v_deneme text;
    v_i int;
begin
    if p_words is null then
        return 'hikaye';
    end if;

    foreach v_word in array p_words loop
        if v_word is null or v_word = '' then
            continue;
        end if;
        if public.itiraf_slug_kelime_gecerli(v_word, p_stop_filtre) then
            v_secilen := array_append(v_secilen, v_word);
            if coalesce(array_length(v_secilen, 1), 0) >= p_max_kelime then
                exit;
            end if;
        end if;
    end loop;

    if coalesce(array_length(v_secilen, 1), 0) = 0 then
        foreach v_word in array p_words loop
            if v_word is null or v_word = '' then
                continue;
            end if;
            if v_word ~ '^[a-z0-9]{2,}$' then
                v_fallback := array_append(v_fallback, v_word);
                if coalesce(array_length(v_fallback, 1), 0) >= least(3, p_max_kelime) then
                    exit;
                end if;
            end if;
        end loop;
        v_secilen := v_fallback;
    end if;

    if coalesce(array_length(v_secilen, 1), 0) = 0 then
        return 'hikaye';
    end if;

    for v_i in 1..coalesce(array_length(v_secilen, 1), 0) loop
        if coalesce(array_length(v_parcalar, 1), 0) = 0 then
            v_deneme := v_secilen[v_i];
        else
            v_deneme := array_to_string(v_parcalar, '-') || '-' || v_secilen[v_i];
        end if;
        if length(v_deneme) > p_max_uzunluk then
            exit;
        end if;
        v_parcalar := array_append(v_parcalar, v_secilen[v_i]);
    end loop;

    if coalesce(array_length(v_parcalar, 1), 0) > 0 then
        return array_to_string(v_parcalar, '-');
    end if;

    if length(v_secilen[1]) <= p_max_uzunluk then
        return v_secilen[1];
    end if;

    return 'hikaye';
end;
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
    v_words text[];
begin
    if p_id is null then
        return null;
    end if;

    if nullif(trim(coalesce(p_hint, '')), '') is not null then
        v_words := regexp_split_to_array(
            public.itiraf_slug_normalize(trim(p_hint)),
            '-'
        );
        v_base := public.itiraf_slug_kelimelerden_base(v_words, 7, 60, false);
    else
        v_raw := left(coalesce(p_content, ''), 400);
        v_raw := lower(translate(v_raw, 'çÇğĞıİöÖşŞüÜ', 'cCgGiIoOsSuU'));
        v_clean := regexp_replace(v_raw, '[^a-z0-9\s]+', ' ', 'g');
        v_words := regexp_split_to_array(trim(v_clean), '\s+');
        v_base := public.itiraf_slug_kelimelerden_base(v_words, 7, 60, true);
    end if;

    if coalesce(v_base, '') = '' then
        v_base := 'hikaye';
    end if;

    return v_base || '-' || p_id::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Trigger — yalnızca slug_hint değişince slug yenile; metin düzenlemesi sabit
-- ---------------------------------------------------------------------------
create or replace function public.itiraf_slug_tetik()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'UPDATE' and old.slug is not null then
        if new.slug_hint is not distinct from old.slug_hint then
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

-- ---------------------------------------------------------------------------
-- 4) updated_at — içerik / slug_hint değişince
-- ---------------------------------------------------------------------------
create or replace function public.itiraf_updated_at_tetik()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'UPDATE' then
        if new.content_full is distinct from old.content_full
           or new.content_short is distinct from old.content_short
           or new.slug_hint is distinct from old.slug_hint
           or new.baslik is distinct from old.baslik
           or new.username is distinct from old.username then
            new.updated_at := now();
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_itiraf_updated_at on public.itiraflar;
create trigger trg_itiraf_updated_at
    before update on public.itiraflar
    for each row
    execute function public.itiraf_updated_at_tetik();

notify pgrst, 'reload schema';
