-- Make Google Trends a first-class daily editorial source and allow admins to
-- add official/public research inputs without reintroducing competitor feeds.

ALTER TABLE public.blog_auto_agent_settings
  ADD COLUMN IF NOT EXISTS google_trends_daily_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS google_trends_daily_posts integer NOT NULL DEFAULT 3;

ALTER TABLE public.blog_auto_agent_settings
  DROP CONSTRAINT IF EXISTS blog_auto_agent_settings_google_trends_daily_posts_check;
ALTER TABLE public.blog_auto_agent_settings
  ADD CONSTRAINT blog_auto_agent_settings_google_trends_daily_posts_check
  CHECK (google_trends_daily_posts BETWEEN 1 AND 3);

ALTER TABLE public.blog_research_sources
  DROP CONSTRAINT IF EXISTS blog_research_sources_source_type_check;
ALTER TABLE public.blog_research_sources
  ADD CONSTRAINT blog_research_sources_source_type_check
  CHECK (source_type IN ('official', 'public_signal', 'own', 'competitor'));

INSERT INTO public.blog_research_sources (name, url, source_type, is_active, display_order)
VALUES ('Google Trends India', 'https://trends.google.com/trending/rss?geo=IN', 'public_signal', true, 5)
ON CONFLICT (url) DO UPDATE
SET name = EXCLUDED.name,
    source_type = EXCLUDED.source_type,
    display_order = EXCLUDED.display_order,
    updated_at = now();

NOTIFY pgrst, 'reload schema';
