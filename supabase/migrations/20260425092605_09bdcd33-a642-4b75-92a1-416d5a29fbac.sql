-- Enable realtime broadcasts on poll_answers so the viewer page can subscribe
-- to live vote totals. REPLICA IDENTITY FULL ensures UPDATE payloads carry
-- the full row (needed for postgres_changes subscriptions).
ALTER TABLE public.poll_answers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_answers;
ALTER TABLE public.project_live_state REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_live_state;