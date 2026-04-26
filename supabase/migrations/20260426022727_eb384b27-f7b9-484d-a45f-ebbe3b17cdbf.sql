-- 1. Drop the over-permissive public SELECT policy on polls.
DROP POLICY IF EXISTS "Public can view polls by slug" ON public.polls;

-- 2. Safe, narrow lookup function for the public voter page.
--    Returns ONLY the columns the viewer UI actually consumes — no
--    user_id, internal_name, project_id source data, autosave timestamps,
--    or other operator-only fields are exposed.
CREATE OR REPLACE FUNCTION public.get_viewer_poll_by_slug(_slug text)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  question text,
  subheadline text,
  bg_color text,
  bg_image text,
  show_live_results boolean,
  show_thank_you boolean,
  show_final_results boolean,
  slate_text text,
  slate_subline_text text,
  post_vote_delay_ms integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.project_id,
    p.question,
    p.subheadline,
    p.bg_color,
    p.bg_image,
    p.show_live_results,
    p.show_thank_you,
    p.show_final_results,
    p.slate_text,
    p.slate_subline_text,
    p.post_vote_delay_ms
  FROM public.polls p
  WHERE p.viewer_slug = _slug
  LIMIT 1;
$$;

-- Anonymous and authenticated voters may invoke the lookup.
GRANT EXECUTE ON FUNCTION public.get_viewer_poll_by_slug(text) TO anon, authenticated;