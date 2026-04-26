-- Create public_viewer_state table — single source of truth for audience devices
CREATE TABLE public.public_viewer_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  viewer_slug TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'branding',
  poll_snapshot JSONB,
  slate_text TEXT NOT NULL DEFAULT 'Polling will open soon',
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT public_viewer_state_state_check CHECK (state IN ('branding', 'slate', 'voting', 'thank_you', 'closed')),
  CONSTRAINT public_viewer_state_project_unique UNIQUE (project_id)
);

CREATE INDEX idx_public_viewer_state_slug ON public.public_viewer_state (viewer_slug);

ALTER TABLE public.public_viewer_state ENABLE ROW LEVEL SECURITY;

-- Public read access — required for unauthenticated audience devices
CREATE POLICY "Anyone can view public viewer state"
ON public.public_viewer_state
FOR SELECT
TO anon, authenticated
USING (true);

-- Only project owners can write
CREATE POLICY "Project owners can insert viewer state"
ON public.public_viewer_state
FOR INSERT
TO authenticated
WITH CHECK (public.project_owned_by_user(project_id));

CREATE POLICY "Project owners can update viewer state"
ON public.public_viewer_state
FOR UPDATE
TO authenticated
USING (public.project_owned_by_user(project_id))
WITH CHECK (public.project_owned_by_user(project_id));

CREATE POLICY "Project owners can delete viewer state"
ON public.public_viewer_state
FOR DELETE
TO authenticated
USING (public.project_owned_by_user(project_id));

-- Auto-update updated_at
CREATE TRIGGER update_public_viewer_state_updated_at
BEFORE UPDATE ON public.public_viewer_state
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.public_viewer_state;
ALTER TABLE public.public_viewer_state REPLICA IDENTITY FULL;