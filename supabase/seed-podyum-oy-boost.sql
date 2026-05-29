-- Podyumdaki tüm hikayeler: up_votes >= 50, biraz down_votes (doğal görünsün), b/r senkron.

with hedef as (
    select
        i.id,
        (50 + floor(random() * 96))::int as up_v,
        case
            when random() < 0.22 then 0
            when random() < 0.7 then (1 + floor(random() * 8))::int
            else (6 + floor(random() * 13))::int
        end as down_v
    from public.hikayeler i
    where i.status = 'podyum'
      and i.silindi_at is null
)
update public.hikayeler i
set
    up_votes = h.up_v,
    down_votes = h.down_v
from hedef h
where i.id = h.id;

do $$
declare
    v_id bigint;
begin
    for v_id in
        select i.id from public.hikayeler i
        where i.status = 'podyum' and i.silindi_at is null
    loop
        perform public.hikaye_puan_guncelle(v_id);
    end loop;
end;
$$;

select
    count(*)::int as guncellenen,
    min(up_votes) as min_up,
    max(up_votes) as max_up,
    min(down_votes) as min_down,
    max(down_votes) as max_down,
    round(avg(up_votes)::numeric, 1) as ort_up,
    round(avg(down_votes)::numeric, 1) as ort_down
from public.hikayeler
where status = 'podyum' and silindi_at is null;
