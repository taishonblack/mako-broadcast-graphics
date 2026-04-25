-- Public read access for the viewer-facing poll page.
-- The viewer route /vote/:slug must work without authentication.
-- We expose only what the voter needs: the poll, its answers, the live state of
-- its project, and viewer config. Writes remain owner-only via existing policies.

CREATE POLICY "Public can view polls by slug"
  ON public.polls
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view poll answers"
  ON public.poll_answers
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view project live state"
  ON public.project_live_state
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view poll viewer configs"
  ON public.poll_viewer_configs
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Index to make slug lookup fast
CREATE INDEX IF NOT EXISTS polls_viewer_slug_idx ON public.polls(viewer_slug);