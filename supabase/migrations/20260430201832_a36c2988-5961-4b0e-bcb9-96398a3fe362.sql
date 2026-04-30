CREATE OR REPLACE FUNCTION public.recount_poll_votes(_poll_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _total integer := 0;
BEGIN
  IF NOT public.poll_owned_by_user(_poll_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- Reset all answer tallies for this poll to 0.
  UPDATE public.poll_answers
  SET live_votes = 0, updated_at = now()
  WHERE poll_id = _poll_id;

  -- Recompute from the votes table (single source of truth for who voted).
  WITH counts AS (
    SELECT answer_id, COUNT(*)::int AS c
    FROM public.votes
    WHERE poll_id = _poll_id
    GROUP BY answer_id
  )
  UPDATE public.poll_answers pa
  SET live_votes = counts.c, updated_at = now()
  FROM counts
  WHERE pa.id = counts.answer_id AND pa.poll_id = _poll_id;

  SELECT COALESCE(SUM(live_votes), 0)::int INTO _total
  FROM public.poll_answers WHERE poll_id = _poll_id;

  RETURN jsonb_build_object('ok', true, 'poll_id', _poll_id, 'total', _total);
END;
$function$;