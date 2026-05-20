-- Gizli algoritma puanı: itiraflar.b ve itiraflar.r güncelle
-- b = (up_votes - down_votes)
-- r = (up_votes - down_votes) + (yorum_sayisi * 5)
-- Parantezler bilerek korunur.

alter table public.itiraflar
    add column if not exists b int not null default 0,
    add column if not exists r int not null default 0;

create or replace function public.itiraf_puan_guncelle(p_itiraf_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_yorum int;
    v_b int;
    v_r int;
begin
    if p_itiraf_id is null then
        return;
    end if;

    select count(*)::int
    into v_yorum
    from public.itiraf_cevaplar c
    where c.itiraf_id = p_itiraf_id;

    select (coalesce(i.up_votes, 0) - coalesce(i.down_votes, 0))
    into v_b
    from public.itiraflar i
    where i.id = p_itiraf_id;

    v_r := v_b + (coalesce(v_yorum, 0) * 5);

    update public.itiraflar
    set
        b = v_b,
        r = v_r
    where id = p_itiraf_id;
end;
$$;

revoke all on function public.itiraf_puan_guncelle(bigint) from public;
revoke all on function public.itiraf_puan_guncelle(bigint) from anon, authenticated;

-- Oy sayacı zaten varsa: içine `perform itiraf_puan_guncelle(...)` eklemek yeterli.
-- Burada ayrıca yorum/cevap değişimleri için tetikleyici kuruyoruz.
create or replace function public.itiraf_cevap_puan_sayaci()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_new bigint;
    v_old bigint;
begin
    v_new := case when tg_op <> 'DELETE' then new.itiraf_id else null end;
    v_old := case when tg_op <> 'INSERT' then old.itiraf_id else null end;

    if v_new is not null then
        perform public.itiraf_puan_guncelle(v_new);
    end if;
    if v_old is not null and v_old <> v_new then
        perform public.itiraf_puan_guncelle(v_old);
    end if;
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_itiraf_cevap_puan_sayaci on public.itiraf_cevaplar;
create trigger trg_itiraf_cevap_puan_sayaci
after insert or update or delete on public.itiraf_cevaplar
for each row execute function public.itiraf_cevap_puan_sayaci();

revoke all on function public.itiraf_cevap_puan_sayaci() from public;
revoke all on function public.itiraf_cevap_puan_sayaci() from anon, authenticated;

-- İsteğe bağlı: Mevcut kayıtların hepsini bir kerelik güncelle
-- update public.itiraflar i
-- set
--   b = (coalesce(i.up_votes, 0) - coalesce(i.down_votes, 0)),
--   r = (coalesce(i.up_votes, 0) - coalesce(i.down_votes, 0)) + ((select count(*)::int from public.itiraf_cevaplar c where c.itiraf_id = i.id) * 5);

