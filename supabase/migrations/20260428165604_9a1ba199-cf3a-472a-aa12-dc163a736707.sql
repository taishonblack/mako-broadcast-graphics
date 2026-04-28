-- 1) Allow vote changes: same session re-voting moves the count from the old
--    answer to the new one instead of being rejected. First-time votes still
--    increment normally. Voting must still be 'open' on project_live_state.
CREATE OR REPLACE FUNCTION public.cast_vote(_poll_id uuid, _answer_id uuid, _session_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _is_live BOOLEAN;
  _answer_belongs BOOLEAN;
  _prev_answer_id uuid;
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

  SELECT answer_id INTO _prev_answer_id
  FROM public.votes
  WHERE poll_id = _poll_id AND session_id = _session_id;

  IF _prev_answer_id IS NULL THEN
    -- First vote for this session
    INSERT INTO public.votes (poll_id, answer_id, session_id)
    VALUES (_poll_id, _answer_id, _session_id);

    UPDATE public.poll_answers
    SET live_votes = live_votes + 1, updated_at = now()
    WHERE id = _answer_id;

    RETURN jsonb_build_object('ok', true, 'changed', false);
  ELSIF _prev_answer_id = _answer_id THEN
    -- Same answer re-voted — no-op, totals unchanged
    RETURN jsonb_build_object('ok', true, 'changed', false, 'unchanged', true);
  ELSE
    -- Vote change — move the count from the previous answer to the new one
    UPDATE public.votes
    SET answer_id = _answer_id, created_at = now()
    WHERE poll_id = _poll_id AND session_id = _session_id;

    UPDATE public.poll_answers
    SET live_votes = GREATEST(live_votes - 1, 0), updated_at = now()
    WHERE id = _prev_answer_id;

    UPDATE public.poll_answers
    SET live_votes = live_votes + 1, updated_at = now()
    WHERE id = _answer_id;

    RETURN jsonb_build_object('ok', true, 'changed', true);
  END IF;
END;
$function$;

-- 2) sync_poll_answers: called by the operator on Go Live to materialize the
--    options stored on polls.answers (jsonb) into the poll_answers table so
--    cast_vote has stable UUIDs to increment. Idempotent: matches existing
--    rows on (poll_id, sort_order) and updates label/short_label/color in
--    place; missing rows are inserted; rows beyond the new option count are
--    deleted (their live_votes reset to keep counts honest if the operator
--    edits the question between shows). Returns an array of
--    { client_id, id, sort_order } so the client can map its local string
--    ids → real UUIDs for the audience snapshot.
CREATE OR REPLACE FUNCTION public.sync_poll_answers(_poll_id uuid, _options jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _opt jsonb;
  _i int := 0;
  _existing_id uuid;
  _client_id text;
  _label text;
  _short_label text;
  _color text;
  _result jsonb := '[]'::jsonb;
  _new_id uuid;
BEGIN
  -- Only the poll owner may sync answers.
  IF NOT public.poll_owned_by_user(_poll_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF _options IS NULL OR jsonb_typeof(_options) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_options');
  END IF;

  FOR _opt IN SELECT * FROM jsonb_array_elements(_options) LOOP
    _client_id := COALESCE(_opt->>'client_id', _opt->>'id', _i::text);
    _label := COALESCE(_opt->>'label', _opt->>'text', '');
    _short_label := COALESCE(_opt->>'shortLabel', _opt->>'short_label', '');
    _color := COALESCE(_opt->>'color', '');

    SELECT id INTO _existing_id
    FROM public.poll_answers
    WHERE poll_id = _poll_id AND sort_order = _i
    LIMIT 1;

    IF _existing_id IS NULL THEN
      INSERT INTO public.poll_answers (poll_id, sort_order, label, short_label, color, live_votes)
      VALUES (_poll_id, _i, _label, _short_label, _color, 0)
      RETURNING id INTO _new_id;
    ELSE
      UPDATE public.poll_answers
      SET label = _label,
          short_label = _short_label,
          color = _color,
          updated_at = now()
      WHERE id = _existing_id;
      _new_id := _existing_id;
    END IF;

    _result := _result || jsonb_build_object(
      'client_id', _client_id,
      'id', _new_id,
      'sort_order', _i
    );
    _i := _i + 1;
  END LOOP;

  -- Trim any leftover rows that no longer correspond to an option.
  -- Their associated votes go too so live_votes stays consistent.
  DELETE FROM public.votes
  WHERE poll_id = _poll_id
    AND answer_id IN (
      SELECT id FROM public.poll_answers
      WHERE poll_id = _poll_id AND sort_order >= _i
    );
  DELETE FROM public.poll_answers
  WHERE poll_id = _poll_id AND sort_order >= _i;

  RETURN jsonb_build_object('ok', true, 'answers', _result);
END;
$function$;