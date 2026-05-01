CREATE OR REPLACE FUNCTION public.clone_poll(_poll_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_poll_id uuid;
  _base_slug text;
  _base_internal text;
  _new_slug text;
  _suffix int := 1;
  _scene record;
  _new_scene_id uuid;
BEGIN
  IF NOT public.poll_owned_by_user(_poll_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- Compute a unique viewer_slug. Start with "<orig>-copy", then -copy-2, -copy-3, ...
  SELECT viewer_slug, internal_name INTO _base_slug, _base_internal
  FROM public.polls WHERE id = _poll_id;

  IF _base_slug IS NULL OR _base_slug = '' THEN
    _base_slug := 'poll';
  END IF;

  _new_slug := _base_slug || '-copy';
  WHILE EXISTS (SELECT 1 FROM public.polls WHERE viewer_slug = _new_slug) LOOP
    _suffix := _suffix + 1;
    _new_slug := _base_slug || '-copy-' || _suffix;
  END LOOP;

  -- Duplicate the poll row. Reset status to draft, clear autosave timestamp,
  -- set new viewer_slug, and prefix internal_name so the operator can spot it.
  INSERT INTO public.polls (
    user_id, project_id, status, internal_name, question, subheadline,
    slug, viewer_slug, template, answer_type, mc_label_style, answers,
    show_live_results, show_thank_you, show_final_results, auto_close_seconds,
    bg_color, bg_image, preview_data_mode, block_letter, block_label, block_position,
    on_air_question, label_style, template_type, scene_type,
    slate_text, slate_image, slate_text_style, slate_subline_text, slate_subline_style,
    post_vote_delay_ms
  )
  SELECT
    user_id, project_id, 'draft', COALESCE(NULLIF(internal_name, ''), 'Untitled') || ' (copy)',
    question, subheadline,
    slug, _new_slug, template, answer_type, mc_label_style, answers,
    show_live_results, show_thank_you, show_final_results, auto_close_seconds,
    bg_color, bg_image, preview_data_mode, block_letter, block_label, block_position,
    on_air_question, label_style, template_type, scene_type,
    slate_text, slate_image, slate_text_style, slate_subline_text, slate_subline_style,
    post_vote_delay_ms
  FROM public.polls WHERE id = _poll_id
  RETURNING id INTO _new_poll_id;

  -- Copy answers (live_votes reset to 0 on the copy).
  INSERT INTO public.poll_answers (poll_id, sort_order, label, short_label, color, is_correct, test_votes, live_votes)
  SELECT _new_poll_id, sort_order, label, short_label, color, is_correct, test_votes, 0
  FROM public.poll_answers WHERE poll_id = _poll_id;

  -- Copy scenes one-by-one so we can map old→new scene ids for poll_scene_assets.
  FOR _scene IN
    SELECT id, name, preset, sort_order FROM public.poll_scenes WHERE poll_id = _poll_id
  LOOP
    INSERT INTO public.poll_scenes (poll_id, name, preset, sort_order)
    VALUES (_new_poll_id, _scene.name, _scene.preset, _scene.sort_order)
    RETURNING id INTO _new_scene_id;

    INSERT INTO public.poll_scene_assets (scene_id, asset_id, transform, visible)
    SELECT _new_scene_id, asset_id, transform, visible
    FROM public.poll_scene_assets WHERE scene_id = _scene.id;
  END LOOP;

  -- Copy poll_assets (operator-side asset placement).
  INSERT INTO public.poll_assets (
    poll_id, asset_type, locked, visible, z_index, x_pct, y_pct,
    width_pct, height_pct, scale, opacity, anchor, config_json
  )
  SELECT _new_poll_id, asset_type, locked, visible, z_index, x_pct, y_pct,
         width_pct, height_pct, scale, opacity, anchor, config_json
  FROM public.poll_assets WHERE poll_id = _poll_id;

  RETURN jsonb_build_object('ok', true, 'poll_id', _new_poll_id, 'viewer_slug', _new_slug);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clone_poll(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clone_poll(uuid) TO authenticated;