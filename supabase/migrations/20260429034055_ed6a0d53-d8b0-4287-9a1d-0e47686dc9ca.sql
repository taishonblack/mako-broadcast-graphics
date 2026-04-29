CREATE OR REPLACE FUNCTION public.increment_poll_answer_live_votes(_answer_id uuid, _poll_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.poll_answers
  SET live_votes = COALESCE(live_votes, 0) + 1,
      updated_at = now()
  WHERE id = _answer_id AND poll_id = _poll_id;
$$;

REVOKE ALL ON FUNCTION public.increment_poll_answer_live_votes(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_poll_answer_live_votes(uuid, uuid) TO service_role;