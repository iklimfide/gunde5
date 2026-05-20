-- Bot/seed itirafları: city → yasadigi_yer (UI yasadigi_yer okur)
-- Supabase SQL Editor'da bir kez çalıştır.

update public.itiraflar
set yasadigi_yer = case city
    when 'İstanbul' then 'istanbul_avrupa'
    when 'İzmir' then 'izmir'
    when 'Ankara' then 'ankara'
    when 'Kocaeli' then 'kocaeli'
    when 'Edirne' then 'edirne'
    when 'Bursa' then 'bursa'
    when 'Antalya' then 'antalya'
    else yasadigi_yer
end
where user_id is null
  and yasadigi_yer is null
  and city is not null;
