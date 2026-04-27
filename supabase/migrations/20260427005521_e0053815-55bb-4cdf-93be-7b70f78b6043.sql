-- Enable extensions for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Anonymous vote analytics table
CREATE TABLE public.vote_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  poll_id uuid NOT NULL,
  answer_id uuid,
  session_id text NOT NULL,
  device_type text NOT NULL DEFAULT 'unknown',
  browser text NOT NULL DEFAULT 'unknown',
  os text NOT NULL DEFAULT 'unknown',
  country text NOT NULL DEFAULT 'Unknown',
  region text NOT NULL DEFAULT 'Unknown',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vote_analytics_project_created ON public.vote_analytics(project_id, created_at DESC);
CREATE INDEX idx_vote_analytics_poll_created ON public.vote_analytics(poll_id, created_at DESC);
CREATE INDEX idx_vote_analytics_created ON public.vote_analytics(created_at);

ALTER TABLE public.vote_analytics ENABLE ROW LEVEL SECURITY;

-- Project owners can read their own analytics
CREATE POLICY "Owners can view own project analytics"
  ON public.vote_analytics FOR SELECT
  TO authenticated
  USING (public.project_owned_by_user(project_id));

-- Inserts only happen via service role (edge function); no anon/auth insert policy.
-- Owners can delete their own analytics manually if needed
CREATE POLICY "Owners can delete own project analytics"
  ON public.vote_analytics FOR DELETE
  TO authenticated
  USING (public.project_owned_by_user(project_id));

-- Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_vote_analytics()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.vote_analytics WHERE created_at < now() - interval '24 hours';
$$;

-- Hourly cleanup job
SELECT cron.schedule(
  'cleanup-vote-analytics-hourly',
  '0 * * * *',
  $$ SELECT public.cleanup_vote_analytics(); $$
);