ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS project_date date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_background_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.projects
SET
  account_id = COALESCE(account_id, user_id),
  created_by = COALESCE(created_by, user_id),
  project_date = COALESCE(project_date, current_date),
  tags = COALESCE(tags, '{}'),
  notes = COALESCE(notes, '')
WHERE account_id IS NULL
   OR created_by IS NULL
   OR project_date IS NULL
   OR tags IS NULL
   OR notes IS NULL;

ALTER TABLE public.projects
  ALTER COLUMN account_id SET NOT NULL;

ALTER TABLE public.backgrounds
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS thumbnail_path text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.backgrounds
SET
  account_id = COALESCE(account_id, user_id),
  file_path = COALESCE(file_path, image_url),
  thumbnail_path = COALESCE(thumbnail_path, thumbnail_url),
  tags = COALESCE(tags, '{}'),
  created_by = COALESCE(created_by, user_id)
WHERE account_id IS NULL
   OR file_path IS NULL
   OR tags IS NULL
   OR created_by IS NULL;

ALTER TABLE public.backgrounds
  ALTER COLUMN account_id SET NOT NULL,
  ALTER COLUMN file_path SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_default_background_id_fkey'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_default_background_id_fkey
      FOREIGN KEY (default_background_id)
      REFERENCES public.backgrounds(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS on_air_question text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS viewer_slug text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS label_style text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS template_type text NOT NULL DEFAULT 'horizontal_bar',
  ADD COLUMN IF NOT EXISTS scene_type text NOT NULL DEFAULT 'fullscreen',
  ADD COLUMN IF NOT EXISTS autosaved_at timestamptz,
  ALTER COLUMN block_letter SET DEFAULT 'A',
  ALTER COLUMN block_position SET DEFAULT 1;

UPDATE public.polls
SET
  on_air_question = COALESCE(NULLIF(on_air_question, ''), question, ''),
  viewer_slug = COALESCE(NULLIF(viewer_slug, ''), slug, ''),
  label_style = CASE COALESCE(mc_label_style, '')
    WHEN 'letters' THEN 'abc'
    WHEN 'numbers' THEN 'numeric'
    ELSE 'custom'
  END,
  template_type = CASE COALESCE(template, '')
    WHEN 'horizontal-bar' THEN 'horizontal_bar'
    WHEN 'vertical-bar' THEN 'vertical_bar'
    WHEN 'pie-donut' THEN 'pie_donut'
    WHEN 'progress-bar' THEN 'progress_bar'
    WHEN 'puck-slider' THEN 'puck_slider'
    WHEN 'lower-third' THEN 'lower_third'
    ELSE 'horizontal_bar'
  END,
  scene_type = CASE COALESCE(template, '')
    WHEN 'lower-third' THEN 'lower_third'
    ELSE 'fullscreen'
  END,
  autosaved_at = COALESCE(autosaved_at, updated_at),
  block_letter = COALESCE(block_letter, 'A')
WHERE on_air_question IS DISTINCT FROM COALESCE(NULLIF(on_air_question, ''), question, '')
   OR viewer_slug IS DISTINCT FROM COALESCE(NULLIF(viewer_slug, ''), slug, '')
   OR autosaved_at IS NULL
   OR block_letter IS NULL;

WITH ranked AS (
  SELECT id,
         project_id,
         COALESCE(block_letter, 'A') AS resolved_block_letter,
         ROW_NUMBER() OVER (
           PARTITION BY project_id, COALESCE(block_letter, 'A')
           ORDER BY COALESCE(block_position, 9999), created_at, id
         ) AS next_position
  FROM public.polls
)
UPDATE public.polls p
SET block_position = ranked.next_position
FROM ranked
WHERE p.id = ranked.id
  AND (p.block_position IS NULL OR p.block_position <> ranked.next_position);

ALTER TABLE public.polls
  ALTER COLUMN block_letter SET NOT NULL,
  ALTER COLUMN block_position SET NOT NULL,
  ALTER COLUMN on_air_question SET NOT NULL,
  ALTER COLUMN viewer_slug SET NOT NULL,
  ALTER COLUMN label_style SET NOT NULL,
  ALTER COLUMN template_type SET NOT NULL,
  ALTER COLUMN scene_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'polls_block_letter_check'
  ) THEN
    ALTER TABLE public.polls
      ADD CONSTRAINT polls_block_letter_check
      CHECK (block_letter IN ('A','B','C','D','E'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'polls_block_position_check'
  ) THEN
    ALTER TABLE public.polls
      ADD CONSTRAINT polls_block_position_check
      CHECK (block_position BETWEEN 1 AND 99);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'polls_answer_type_check_v2'
  ) THEN
    ALTER TABLE public.polls
      ADD CONSTRAINT polls_answer_type_check_v2
      CHECK (answer_type IN ('yes_no','multiple_choice','custom','multiple-choice'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'polls_label_style_check'
  ) THEN
    ALTER TABLE public.polls
      ADD CONSTRAINT polls_label_style_check
      CHECK (label_style IN ('abc','numeric','custom'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'polls_template_type_check'
  ) THEN
    ALTER TABLE public.polls
      ADD CONSTRAINT polls_template_type_check
      CHECK (template_type IN ('horizontal_bar','vertical_bar','pie_donut','progress_bar','puck_slider','lower_third'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'polls_scene_type_check'
  ) THEN
    ALTER TABLE public.polls
      ADD CONSTRAINT polls_scene_type_check
      CHECK (scene_type IN ('fullscreen','lower_third','qr','results'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS polls_project_viewer_slug_unique
  ON public.polls(project_id, viewer_slug);

CREATE UNIQUE INDEX IF NOT EXISTS polls_project_block_position_unique
  ON public.polls(project_id, block_letter, block_position);

CREATE TABLE IF NOT EXISTS public.poll_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  short_label text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  is_correct boolean NOT NULL DEFAULT false,
  test_votes integer NOT NULL DEFAULT 0 CHECK (test_votes >= 0),
  live_votes integer NOT NULL DEFAULT 0 CHECK (live_votes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS poll_answers_poll_id_sort_order_idx
  ON public.poll_answers(poll_id, sort_order);

CREATE TABLE IF NOT EXISTS public.poll_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('question_text','subheadline','answer_bars','voter_tally','qr_code','logo','background')),
  visible boolean NOT NULL DEFAULT true,
  locked boolean NOT NULL DEFAULT false,
  z_index integer NOT NULL DEFAULT 0,
  x_pct numeric(6,3) NOT NULL DEFAULT 50,
  y_pct numeric(6,3) NOT NULL DEFAULT 50,
  width_pct numeric(6,3) NOT NULL DEFAULT 20,
  height_pct numeric(6,3) NOT NULL DEFAULT 10,
  scale numeric(6,3) NOT NULL DEFAULT 1,
  opacity numeric(6,3) NOT NULL DEFAULT 1,
  anchor text NOT NULL DEFAULT 'center' CHECK (anchor IN ('top_left','top_center','top_right','center_left','center','center_right','bottom_left','bottom_center','bottom_right')),
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS poll_assets_poll_id_idx
  ON public.poll_assets(poll_id);

CREATE UNIQUE INDEX IF NOT EXISTS poll_assets_poll_id_asset_type_unique
  ON public.poll_assets(poll_id, asset_type);

CREATE TABLE IF NOT EXISTS public.poll_viewer_configs (
  poll_id uuid PRIMARY KEY REFERENCES public.polls(id) ON DELETE CASCADE,
  mobile_enabled boolean NOT NULL DEFAULT true,
  desktop_enabled boolean NOT NULL DEFAULT true,
  show_results_live boolean NOT NULL DEFAULT false,
  show_thank_you boolean NOT NULL DEFAULT true,
  show_results_after_close boolean NOT NULL DEFAULT true,
  auto_close_seconds integer CHECK (auto_close_seconds IS NULL OR auto_close_seconds >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_test_data (
  poll_id uuid PRIMARY KEY REFERENCES public.polls(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test','live')),
  total_votes integer NOT NULL DEFAULT 0 CHECK (total_votes >= 0),
  per_answer_votes jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_backgrounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  background_id uuid NOT NULL REFERENCES public.backgrounds(id) ON DELETE CASCADE,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, background_id)
);

CREATE TABLE IF NOT EXISTS public.workspace_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'build' CHECK (mode IN ('build','edit','output')),
  complexity text NOT NULL DEFAULT 'simple' CHECK (complexity IN ('simple','advanced')),
  left_pane_width integer,
  right_pane_width integer,
  center_pane_height integer,
  preview_overlays jsonb NOT NULL DEFAULT '{}'::jsonb,
  layout_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

CREATE TABLE IF NOT EXISTS public.project_live_state (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  active_poll_id uuid REFERENCES public.polls(id) ON DELETE SET NULL,
  preview_poll_id uuid REFERENCES public.polls(id) ON DELETE SET NULL,
  output_state text NOT NULL DEFAULT 'preview' CHECK (output_state IN ('preview','program_live')),
  voting_state text NOT NULL DEFAULT 'not_open' CHECK (voting_state IN ('not_open','open','closed')),
  transition_type text NOT NULL DEFAULT 'cut' CHECK (transition_type IN ('cut','take')),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_owned_by_user(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = _project_id
      AND (account_id = auth.uid() OR user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.poll_owned_by_user(_poll_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.polls
    WHERE id = _poll_id
      AND user_id = auth.uid()
  );
$$;

ALTER TABLE public.poll_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_viewer_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_test_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_backgrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_live_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Users view own projects via account'
  ) THEN
    CREATE POLICY "Users view own projects via account"
    ON public.projects
    FOR SELECT
    USING (auth.uid() = account_id OR auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Users create own projects via account'
  ) THEN
    CREATE POLICY "Users create own projects via account"
    ON public.projects
    FOR INSERT
    WITH CHECK (auth.uid() = account_id OR auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Users edit own projects via account'
  ) THEN
    CREATE POLICY "Users edit own projects via account"
    ON public.projects
    FOR UPDATE
    USING (auth.uid() = account_id OR auth.uid() = user_id)
    WITH CHECK (auth.uid() = account_id OR auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Users remove own projects via account'
  ) THEN
    CREATE POLICY "Users remove own projects via account"
    ON public.projects
    FOR DELETE
    USING (auth.uid() = account_id OR auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'backgrounds' AND policyname = 'Users view own backgrounds via account'
  ) THEN
    CREATE POLICY "Users view own backgrounds via account"
    ON public.backgrounds
    FOR SELECT
    USING (auth.uid() = account_id OR auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'backgrounds' AND policyname = 'Users create own backgrounds via account'
  ) THEN
    CREATE POLICY "Users create own backgrounds via account"
    ON public.backgrounds
    FOR INSERT
    WITH CHECK (auth.uid() = account_id OR auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'backgrounds' AND policyname = 'Users edit own backgrounds via account'
  ) THEN
    CREATE POLICY "Users edit own backgrounds via account"
    ON public.backgrounds
    FOR UPDATE
    USING (auth.uid() = account_id OR auth.uid() = user_id)
    WITH CHECK (auth.uid() = account_id OR auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'backgrounds' AND policyname = 'Users remove own backgrounds via account'
  ) THEN
    CREATE POLICY "Users remove own backgrounds via account"
    ON public.backgrounds
    FOR DELETE
    USING (auth.uid() = account_id OR auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'poll_answers' AND policyname = 'Users manage own poll answers'
  ) THEN
    CREATE POLICY "Users manage own poll answers"
    ON public.poll_answers
    FOR ALL
    USING (public.poll_owned_by_user(poll_id))
    WITH CHECK (public.poll_owned_by_user(poll_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'poll_assets' AND policyname = 'Users manage own poll assets'
  ) THEN
    CREATE POLICY "Users manage own poll assets"
    ON public.poll_assets
    FOR ALL
    USING (public.poll_owned_by_user(poll_id))
    WITH CHECK (public.poll_owned_by_user(poll_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'poll_viewer_configs' AND policyname = 'Users manage own poll viewer configs'
  ) THEN
    CREATE POLICY "Users manage own poll viewer configs"
    ON public.poll_viewer_configs
    FOR ALL
    USING (public.poll_owned_by_user(poll_id))
    WITH CHECK (public.poll_owned_by_user(poll_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'poll_test_data' AND policyname = 'Users manage own poll test data'
  ) THEN
    CREATE POLICY "Users manage own poll test data"
    ON public.poll_test_data
    FOR ALL
    USING (public.poll_owned_by_user(poll_id))
    WITH CHECK (public.poll_owned_by_user(poll_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_backgrounds' AND policyname = 'Users manage own project backgrounds'
  ) THEN
    CREATE POLICY "Users manage own project backgrounds"
    ON public.project_backgrounds
    FOR ALL
    USING (public.project_owned_by_user(project_id))
    WITH CHECK (public.project_owned_by_user(project_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_preferences' AND policyname = 'Users manage own workspace preferences'
  ) THEN
    CREATE POLICY "Users manage own workspace preferences"
    ON public.workspace_preferences
    FOR ALL
    USING (auth.uid() = user_id AND (project_id IS NULL OR public.project_owned_by_user(project_id)))
    WITH CHECK (auth.uid() = user_id AND (project_id IS NULL OR public.project_owned_by_user(project_id)));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_live_state' AND policyname = 'Users manage own project live state'
  ) THEN
    CREATE POLICY "Users manage own project live state"
    ON public.project_live_state
    FOR ALL
    USING (public.project_owned_by_user(project_id))
    WITH CHECK (public.project_owned_by_user(project_id));
  END IF;
END $$;

INSERT INTO public.poll_answers (poll_id, sort_order, label, short_label, test_votes, live_votes)
SELECT
  p.id,
  COALESCE((answer.value->>'order')::integer, answer.ordinality - 1) AS sort_order,
  COALESCE(answer.value->>'text', '') AS label,
  COALESCE(answer.value->>'shortLabel', '') AS short_label,
  GREATEST(COALESCE((answer.value->>'testVotes')::integer, COALESCE((answer.value->>'votes')::integer, 0)), 0) AS test_votes,
  0 AS live_votes
FROM public.polls p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.answers, '[]'::jsonb)) WITH ORDINALITY AS answer(value, ordinality)
WHERE NOT EXISTS (
  SELECT 1 FROM public.poll_answers pa WHERE pa.poll_id = p.id
);

INSERT INTO public.poll_assets (poll_id, asset_type, z_index, width_pct, height_pct, config_json)
SELECT p.id, seeded.asset_type, seeded.z_index, seeded.width_pct, seeded.height_pct, seeded.config_json
FROM public.polls p
CROSS JOIN LATERAL (
  VALUES
    ('question_text', 10, 70::numeric, 12::numeric, jsonb_build_object('source', 'question')),
    ('answer_bars', 20, 76::numeric, 34::numeric, jsonb_build_object('source', 'answers'))
) AS seeded(asset_type, z_index, width_pct, height_pct, config_json)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.poll_assets pa
  WHERE pa.poll_id = p.id
    AND pa.asset_type = seeded.asset_type
);

INSERT INTO public.poll_assets (poll_id, asset_type, z_index, width_pct, height_pct, visible, config_json)
SELECT p.id, 'subheadline', 15, 64, 8, true, jsonb_build_object('source', 'subheadline')
FROM public.polls p
WHERE COALESCE(p.subheadline, '') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.poll_assets pa WHERE pa.poll_id = p.id AND pa.asset_type = 'subheadline'
  );

INSERT INTO public.poll_assets (poll_id, asset_type, z_index, width_pct, height_pct, visible, config_json)
SELECT p.id, 'background', 0, 100, 100, true, jsonb_build_object('bgColor', p.bg_color, 'bgImage', p.bg_image)
FROM public.polls p
WHERE (COALESCE(p.bg_color, '') <> '' OR p.bg_image IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.poll_assets pa WHERE pa.poll_id = p.id AND pa.asset_type = 'background'
  );

INSERT INTO public.poll_viewer_configs (poll_id, mobile_enabled, desktop_enabled, show_results_live, show_thank_you, show_results_after_close, auto_close_seconds)
SELECT
  p.id,
  true,
  true,
  COALESCE(p.show_live_results, false),
  COALESCE(p.show_thank_you, true),
  COALESCE(p.show_final_results, true),
  p.auto_close_seconds
FROM public.polls p
WHERE NOT EXISTS (
  SELECT 1 FROM public.poll_viewer_configs pvc WHERE pvc.poll_id = p.id
);

INSERT INTO public.poll_test_data (poll_id, mode, total_votes, per_answer_votes)
SELECT
  p.id,
  CASE WHEN COALESCE(p.preview_data_mode, 'test') = 'live' THEN 'live' ELSE 'test' END,
  COALESCE((
    SELECT SUM(GREATEST(COALESCE((answer.value->>'testVotes')::integer, COALESCE((answer.value->>'votes')::integer, 0)), 0))
    FROM jsonb_array_elements(COALESCE(p.answers, '[]'::jsonb)) AS answer(value)
  ), 0),
  COALESCE((
    SELECT jsonb_agg(GREATEST(COALESCE((answer.value->>'testVotes')::integer, COALESCE((answer.value->>'votes')::integer, 0)), 0) ORDER BY answer.ordinality)
    FROM jsonb_array_elements(COALESCE(p.answers, '[]'::jsonb)) WITH ORDINALITY AS answer(value, ordinality)
  ), '[]'::jsonb)
FROM public.polls p
WHERE NOT EXISTS (
  SELECT 1 FROM public.poll_test_data ptd WHERE ptd.poll_id = p.id
);

DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_polls_updated_at ON public.polls;
CREATE TRIGGER set_polls_updated_at
BEFORE UPDATE ON public.polls
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_poll_answers_updated_at ON public.poll_answers;
CREATE TRIGGER set_poll_answers_updated_at
BEFORE UPDATE ON public.poll_answers
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_poll_assets_updated_at ON public.poll_assets;
CREATE TRIGGER set_poll_assets_updated_at
BEFORE UPDATE ON public.poll_assets
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_poll_viewer_configs_updated_at ON public.poll_viewer_configs;
CREATE TRIGGER set_poll_viewer_configs_updated_at
BEFORE UPDATE ON public.poll_viewer_configs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_poll_test_data_updated_at ON public.poll_test_data;
CREATE TRIGGER set_poll_test_data_updated_at
BEFORE UPDATE ON public.poll_test_data
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_backgrounds_updated_at ON public.backgrounds;
CREATE TRIGGER set_backgrounds_updated_at
BEFORE UPDATE ON public.backgrounds
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_workspace_preferences_updated_at ON public.workspace_preferences;
CREATE TRIGGER set_workspace_preferences_updated_at
BEFORE UPDATE ON public.workspace_preferences
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_project_live_state_updated_at ON public.project_live_state;
CREATE TRIGGER set_project_live_state_updated_at
BEFORE UPDATE ON public.project_live_state
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();