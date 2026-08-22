-- Independent entity-focused article schedules. The existing general blog
-- agent settings and cadence remain unchanged.

CREATE TABLE IF NOT EXISTS public.entity_article_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('college', 'course', 'exam')),
  entity_slug text NOT NULL,
  entity_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  articles_per_day integer NOT NULL DEFAULT 1 CHECK (articles_per_day BETWEEN 1 AND 10),
  interval_minutes integer NOT NULL DEFAULT 1440 CHECK (interval_minutes IN (60, 180, 360, 720, 1440)),
  publish_status text NOT NULL DEFAULT 'Draft' CHECK (publish_status IN ('Draft', 'Published')),
  human_review_required boolean NOT NULL DEFAULT true,
  topic_focus text[] NOT NULL DEFAULT ARRAY['latest_updates', 'admissions', 'courses', 'preparation', 'evergreen_guides'],
  last_run_at timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_status text NOT NULL DEFAULT 'ready' CHECK (last_status IN ('ready', 'running', 'completed', 'skipped', 'failed', 'paused')),
  last_message text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_slug)
);

CREATE INDEX IF NOT EXISTS idx_entity_article_schedules_due
  ON public.entity_article_schedules (enabled, next_run_at)
  WHERE enabled = true;

CREATE TABLE IF NOT EXISTS public.entity_article_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.entity_article_schedules(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('college', 'course', 'exam')),
  entity_slug text NOT NULL,
  topic_kind text NOT NULL DEFAULT 'evergreen_guide',
  generated_for_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_article_publications_daily
  ON public.entity_article_publications (schedule_id, generated_for_date);
CREATE INDEX IF NOT EXISTS idx_entity_article_publications_entity
  ON public.entity_article_publications (entity_type, entity_slug, created_at DESC);

ALTER TABLE public.entity_article_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_article_publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage entity article schedules" ON public.entity_article_schedules;
CREATE POLICY "Admins manage entity article schedules"
  ON public.entity_article_schedules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins read entity article publications" ON public.entity_article_publications;
CREATE POLICY "Admins read entity article publications"
  ON public.entity_article_publications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_entity_article_schedules_updated_at ON public.entity_article_schedules;
CREATE TRIGGER update_entity_article_schedules_updated_at
  BEFORE UPDATE ON public.entity_article_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_due_entity_article_schedule()
RETURNS SETOF public.entity_article_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT schedule.id
    FROM public.entity_article_schedules AS schedule
    WHERE schedule.enabled = true
      AND schedule.next_run_at <= now()
      AND schedule.last_status <> 'running'
    ORDER BY schedule.next_run_at, schedule.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.entity_article_schedules AS schedule
  SET last_status = 'running',
      last_message = 'Claimed by scheduled article worker',
      next_run_at = now() + make_interval(mins => schedule.interval_minutes),
      updated_at = now()
  FROM candidate
  WHERE schedule.id = candidate.id
  RETURNING schedule.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_entity_article_schedule() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_entity_article_schedule() TO service_role;

ALTER TABLE public.blog_auto_agent_runs
  DROP CONSTRAINT IF EXISTS blog_auto_agent_runs_trigger_type_check;
ALTER TABLE public.blog_auto_agent_runs
  ADD CONSTRAINT blog_auto_agent_runs_trigger_type_check
  CHECK (trigger_type IN ('manual', 'schedule', 'entity_research', 'entity_schedule'));

ALTER TABLE public.blog_auto_agent_runs
  ADD COLUMN IF NOT EXISTS entity_schedule_id uuid REFERENCES public.entity_article_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_mode text NOT NULL DEFAULT 'general';

-- A frequent lightweight tick lets each entity keep its own cadence. The Edge
-- function locks one due schedule per call, so overlapping cron requests cannot
-- publish the same slot twice.
DO $block$
DECLARE
  existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job FROM cron.job WHERE jobname = 'dekhocampus-entity-article-agent-tick' LIMIT 1;
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;

  PERFORM cron.schedule(
    'dekhocampus-entity-article-agent-tick',
    '*/15 * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://kozdctbbvrnyddlftmvf.supabase.co/functions/v1/admin-blog-agent',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'sb_publishable_XeGGxsGIdsWpU0u3L3xSTg_I775axzd',
          'x-blog-agent-secret', (SELECT scheduler_token FROM public.blog_auto_agent_settings WHERE id = 'default')
        ),
        body := '{"trigger_type":"schedule","mode":"entity_schedule"}'::jsonb,
        timeout_milliseconds := 300000
      );
    $cron$
  );
END
$block$;

NOTIFY pgrst, 'reload schema';
