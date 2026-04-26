-- ============================================================
-- Lock down realtime tables exposed to anon voters.
-- Replace blanket public SELECT policies with narrow,
-- live-state-gated policies so anon users can only see
-- data for polls that are intentionally open/closed for voting.
-- ============================================================

-- Helper: is a given poll currently the active poll on a live
-- (open or closed) project_live_state row? Used by RLS on
-- poll_answers and poll_viewer_configs.
CREATE OR REPLACE FUNCTION public.poll_is_publicly_live(_poll_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_live_state pls
    WHERE pls.active_poll_id = _poll_id
      AND pls.voting_state IN ('open', 'closed')
  );
$$;

GRANT EXECUTE ON FUNCTION public.poll_is_publicly_live(uuid) TO anon, authenticated;

-- ---------- project_live_state ----------
DROP POLICY IF EXISTS "Public can view project live state" ON public.project_live_state;

-- Anon/authenticated viewers may only see live-state rows that
-- are currently driving a public vote. Operator-managed rows
-- in 'not_open' (idle) state stay private.
CREATE POLICY "Public can view live state when voting is active"
ON public.project_live_state
FOR SELECT
TO anon, authenticated
USING (voting_state IN ('open', 'closed'));

-- ---------- poll_answers ----------
DROP POLICY IF EXISTS "Public can view poll answers" ON public.poll_answers;

-- Voters can only read answers for the poll that is currently
-- live on its project — prevents enumeration of unrelated polls.
CREATE POLICY "Public can view answers for publicly live polls"
ON public.poll_answers
FOR SELECT
TO anon, authenticated
USING (public.poll_is_publicly_live(poll_id));

-- ---------- poll_viewer_configs ----------
DROP POLICY IF EXISTS "Public can view poll viewer configs" ON public.poll_viewer_configs;

CREATE POLICY "Public can view viewer configs for publicly live polls"
ON public.poll_viewer_configs
FOR SELECT
TO anon, authenticated
USING (public.poll_is_publicly_live(poll_id));

-- ============================================================
-- Realtime: restrict subscriptions to realtime.messages so
-- users can only join channels for resources they own, and
-- anon voters can only join the channel of a publicly-live poll.
-- Topic conventions used in the app:
--   viewer-poll-<poll_id>          (voter, anon-friendly)
--   operator-project-<project_id>  (operator only)
-- ============================================================

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read own resource channels" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can write own resource channels" ON realtime.messages;
DROP POLICY IF EXISTS "Anon can read publicly live poll channels" ON realtime.messages;

-- Operators: read/write channels scoped to polls or projects they own.
CREATE POLICY "Authenticated can read own resource channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- viewer-poll-<uuid> for an owned poll
  (
    realtime.topic() LIKE 'viewer-poll-%'
    AND public.poll_owned_by_user(
      NULLIF(substring(realtime.topic() FROM 'viewer-poll-(.*)'), '')::uuid
    )
  )
  OR (
    realtime.topic() LIKE 'operator-project-%'
    AND public.project_owned_by_user(
      NULLIF(substring(realtime.topic() FROM 'operator-project-(.*)'), '')::uuid
    )
  )
);

CREATE POLICY "Authenticated can write own resource channels"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (
    realtime.topic() LIKE 'viewer-poll-%'
    AND public.poll_owned_by_user(
      NULLIF(substring(realtime.topic() FROM 'viewer-poll-(.*)'), '')::uuid
    )
  )
  OR (
    realtime.topic() LIKE 'operator-project-%'
    AND public.project_owned_by_user(
      NULLIF(substring(realtime.topic() FROM 'operator-project-(.*)'), '')::uuid
    )
  )
);

-- Voters (anon): only the viewer-poll-<id> channel of a poll
-- whose project_live_state is open/closed.
CREATE POLICY "Anon can read publicly live poll channels"
ON realtime.messages
FOR SELECT
TO anon, authenticated
USING (
  realtime.topic() LIKE 'viewer-poll-%'
  AND public.poll_is_publicly_live(
    NULLIF(substring(realtime.topic() FROM 'viewer-poll-(.*)'), '')::uuid
  )
);
