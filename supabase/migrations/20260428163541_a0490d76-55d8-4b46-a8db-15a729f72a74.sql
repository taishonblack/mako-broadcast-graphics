CREATE TABLE public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL,
  answer_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT votes_unique_session_per_poll UNIQUE (poll_id, session_id)
);

CREATE INDEX idx_votes_poll_id ON public.votes(poll_id);
CREATE INDEX idx_votes_answer_id ON public.votes(answer_id);

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view votes for own polls"
ON public.votes FOR SELECT TO authenticated
USING (public.poll_owned_by_user(poll_id));

CREATE POLICY "Owners can delete votes for own polls"
ON public.votes FOR DELETE TO authenticated
USING (public.poll_owned_by_user(poll_id));

CREATE OR REPLACE FUNCTION public.cast_vote(
  _poll_id UUID,
  _answer_id UUID,
  _session_id TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_live BOOLEAN;
  _answer_belongs BOOLEAN;
BEGIN
  IF _session_id IS NULL OR length(_session_id) < 8 OR length(_session_id) > 64 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.project_live_state pls
    WHERE pls.active_poll_id = _poll_id
      AND pls.voting_state = 'open'
  ) INTO _is_live;

  IF NOT _is_live THEN
    RETURN jsonb_build_object('ok', false, 'error', 'voting_closed');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.poll_answers
    WHERE id = _answer_id AND poll_id = _poll_id
  ) INTO _answer_belongs;

  IF NOT _answer_belongs THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_answer');
  END IF;

  BEGIN
    INSERT INTO public.votes (poll_id, answer_id, session_id)
    VALUES (_poll_id, _answer_id, _session_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_voted');
  END;

  UPDATE public.poll_answers
  SET live_votes = live_votes + 1,
      updated_at = now()
  WHERE id = _answer_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cast_vote(UUID, UUID, TEXT) TO anon, authenticated;

ALTER TABLE public.poll_answers REPLICA IDENTITY FULL;