DROP FUNCTION IF EXISTS public.get_viewer_poll_by_slug(text);

CREATE OR REPLACE FUNCTION public.get_viewer_poll_by_slug(_slug text)
 RETURNS TABLE(id uuid, project_id uuid, question text, subheadline text, bg_color text, bg_image text, show_live_results boolean, show_thank_you boolean, show_final_results boolean, slate_text text, slate_subline_text text, slate_image text, post_vote_delay_ms integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    p.slate_image,
    p.post_vote_delay_ms
  FROM public.polls p
  WHERE p.viewer_slug = _slug
  LIMIT 1;
$function$;