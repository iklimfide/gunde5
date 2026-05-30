-- Analytics olay özeti (SQL Editor → Run)
-- Metrikler sıfır ama "en çok görülen" doluysa: olay türlerini karşılaştırın.
-- Beklenen (index testinden sonra): page_view, story_impression, story_vote,
-- story_share, load_more_click, heartbeat

select
    event_type,
    count(*)::int as adet,
    max(created_at) as son
from public.site_analytics_events
where created_at >= now() - interval '30 days'
group by event_type
order by adet desc, event_type;
