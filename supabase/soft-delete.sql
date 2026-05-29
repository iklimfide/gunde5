-- Soft delete desteği: hikayeler.silindi_at
-- Bu kolon yoksa site sorguları (is('silindi_at', null)) hata verir.

alter table public.hikayeler
  add column if not exists silindi_at timestamptz;

-- İsteğe bağlı: filtrelemeyi hızlandırır
create index if not exists hikayeler_silindi_idx on public.hikayeler (silindi_at);

