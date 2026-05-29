-- Podyum sayfası: Realtime ile oy / yorum sayıları (hibrit canlandırma).
-- Supabase Dashboard → Database → Replication ile de `hikayeler` ve `hikaye_cevaplar` için
-- Realtime açılabilir; bu betik publication'a tablo ekler.
--
-- Not: Tablo zaten `supabase_realtime` yayınındaysa "already member" benzeri hata alırsınız; o zaman atlayın.

alter publication supabase_realtime add table public.hikayeler;
alter publication supabase_realtime add table public.hikaye_cevaplar;
