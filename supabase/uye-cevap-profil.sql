-- Cevap/yorum yazan üyeler için de tam uye satırı public açılmaz.
-- Ön yüz artık public.uye yerine public.uye_kart_profilleri(uuid[]) RPC'sini kullanır.

revoke all on public.uye from anon;
grant select on public.uye to authenticated;

drop policy if exists uye_select_cevap_yazar on public.uye;
