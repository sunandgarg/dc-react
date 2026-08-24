-- Editorial automation lifecycle, quality controls, brand assets, and
-- multi-category support for the Upgrade Yourself catalogue.

ALTER TABLE public.promoted_programs
  ADD COLUMN IF NOT EXISTS category_slugs text[] NOT NULL DEFAULT '{}';

UPDATE public.promoted_programs
SET category_slugs = ARRAY[category_slug]
WHERE category_slug <> '' AND cardinality(category_slugs) = 0;

CREATE INDEX IF NOT EXISTS idx_promoted_programs_category_slugs
  ON public.promoted_programs USING gin (category_slugs);

ALTER TABLE public.blog_auto_agent_settings
  DROP CONSTRAINT IF EXISTS blog_auto_agent_settings_posts_per_run_check;
ALTER TABLE public.blog_auto_agent_settings
  ADD CONSTRAINT blog_auto_agent_settings_posts_per_run_check
  CHECK (posts_per_run BETWEEN 1 AND 20);

ALTER TABLE public.blog_auto_agent_settings
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'Indian students and parents',
  ADD COLUMN IF NOT EXISTS tone text NOT NULL DEFAULT 'Clear, practical, trustworthy',
  ADD COLUMN IF NOT EXISTS content_goals text[] NOT NULL DEFAULT ARRAY['SEO','AEO','GEO','AIO','LLMO','LLM'],
  ADD COLUMN IF NOT EXISTS required_sections text[] NOT NULL DEFAULT ARRAY['Quick answer','Key facts','Step-by-step guidance','FAQs','Sources'],
  ADD COLUMN IF NOT EXISTS minimum_sources integer NOT NULL DEFAULT 2 CHECK (minimum_sources BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS editorial_quality_target integer NOT NULL DEFAULT 80 CHECK (editorial_quality_target BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS human_review_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS image_mode text NOT NULL DEFAULT 'generated' CHECK (image_mode IN ('generated','template','none')),
  ADD COLUMN IF NOT EXISTS image_template_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_prompt_style text NOT NULL DEFAULT 'Premium editorial, clean, credible, student-focused',
  ADD COLUMN IF NOT EXISTS include_logo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_position text NOT NULL DEFAULT 'top-center'
    CHECK (logo_position IN ('top-left','top-center','top-right','bottom-left','bottom-right')),
  ADD COLUMN IF NOT EXISTS image_aspect_ratio text NOT NULL DEFAULT '16:9'
    CHECK (image_aspect_ratio IN ('16:9','1:1','4:5')),
  ADD COLUMN IF NOT EXISTS output_resolution text NOT NULL DEFAULT '4k'
    CHECK (output_resolution IN ('web','2k','4k'));

ALTER TABLE public.blog_auto_agent_runs
  DROP CONSTRAINT IF EXISTS blog_auto_agent_runs_status_check;
ALTER TABLE public.blog_auto_agent_runs
  ADD CONSTRAINT blog_auto_agent_runs_status_check
  CHECK (status IN ('running','paused','cancelling','cancelled','aborted','completed','skipped','failed'));

ALTER TABLE public.blog_auto_agent_runs
  ADD COLUMN IF NOT EXISTS resumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS aborted_at timestamptz,
  ADD COLUMN IF NOT EXISTS control_note text NOT NULL DEFAULT '';

UPDATE public.blog_ai_provider_settings
SET text_model = 'gemini-3.6-flash',
    image_model = CASE WHEN image_model IN ('', 'gpt-image-2') THEN 'gpt-image-1' ELSE image_model END
WHERE id = 'default';

UPDATE public.ai_runtime_controls
SET provider = 'gemini', model = 'gemini-3.6-flash', updated_at = now()
WHERE feature IN ('blog-studio','blog-agent');

COMMENT ON COLUMN public.blog_auto_agent_settings.editorial_quality_target IS
  'Internal editorial completeness target. It is not an AI-detector or authorship score.';
COMMENT ON COLUMN public.blog_auto_agent_settings.human_review_required IS
  'When true, automation stores articles as Draft even if the requested publish mode is Published.';
