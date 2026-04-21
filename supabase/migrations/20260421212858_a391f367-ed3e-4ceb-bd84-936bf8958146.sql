-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- Polls table
CREATE TABLE public.polls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'saved', 'live', 'closed', 'archived')),
  internal_name TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL DEFAULT '',
  subheadline TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  template TEXT NOT NULL DEFAULT 'horizontal-bar',
  answer_type TEXT NOT NULL DEFAULT 'multiple-choice',
  mc_label_style TEXT NOT NULL DEFAULT 'letters',
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  show_live_results BOOLEAN NOT NULL DEFAULT true,
  show_thank_you BOOLEAN NOT NULL DEFAULT true,
  show_final_results BOOLEAN NOT NULL DEFAULT true,
  auto_close_seconds INTEGER,
  bg_color TEXT NOT NULL DEFAULT '#1a1a2e',
  bg_image TEXT,
  preview_data_mode TEXT NOT NULL DEFAULT 'test',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_polls_user ON public.polls(user_id);
CREATE INDEX idx_polls_project ON public.polls(project_id);
CREATE INDEX idx_polls_status ON public.polls(status);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own polls" ON public.polls
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own polls" ON public.polls
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own polls" ON public.polls
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own polls" ON public.polls
  FOR DELETE USING (auth.uid() = user_id);

-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_polls_updated BEFORE UPDATE ON public.polls
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();