-- Soft delete desteği: itiraflar.silindi_at
-- Bu kolon yoksa site sorguları (is('silindi_at', null)) hata verir.

alter table public.itiraflar
  add column if not exists silindi_at timestamptz;

-- İsteğe bağlı: filtrelemeyi hızlandırır
create index if not exists itiraflar_silindi_idx on public.itiraflar (silindi_at);

