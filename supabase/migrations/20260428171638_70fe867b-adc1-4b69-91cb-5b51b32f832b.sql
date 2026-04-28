ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_analytics;
ALTER TABLE public.vote_analytics REPLICA IDENTITY FULL;