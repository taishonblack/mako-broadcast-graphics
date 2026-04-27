-- 1. poll_scenes table
CREATE TABLE public.poll_scenes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Scene',
  preset TEXT NOT NULL DEFAULT 'fullScreen' CHECK (preset IN ('fullScreen', 'liveResults', 'final')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_poll_scenes_poll_id ON public.poll_scenes(poll_id, sort_order);

ALTER TABLE public.poll_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own poll scenes"
  ON public.poll_scenes
  FOR ALL
  USING (public.poll_owned_by_user(poll_id))
  WITH CHECK (public.poll_owned_by_user(poll_id));

CREATE TRIGGER touch_poll_scenes_updated_at
  BEFORE UPDATE ON public.poll_scenes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. poll_scene_assets join table
CREATE TABLE public.poll_scene_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scene_id UUID NOT NULL REFERENCES public.poll_scenes(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scene_id, asset_id)
);

CREATE INDEX idx_poll_scene_assets_scene_id ON public.poll_scene_assets(scene_id);

ALTER TABLE public.poll_scene_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own poll scene assets"
  ON public.poll_scene_assets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.poll_scenes ps
      WHERE ps.id = scene_id
        AND public.poll_owned_by_user(ps.poll_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.poll_scenes ps
      WHERE ps.id = scene_id
        AND public.poll_owned_by_user(ps.poll_id)
    )
  );

CREATE TRIGGER touch_poll_scene_assets_updated_at
  BEFORE UPDATE ON public.poll_scene_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Backfill existing polls with one default Full Screen scene
INSERT INTO public.poll_scenes (poll_id, name, preset, sort_order)
SELECT p.id, 'Scene 1', 'fullScreen', 0
FROM public.polls p
WHERE NOT EXISTS (
  SELECT 1 FROM public.poll_scenes ps WHERE ps.poll_id = p.id
);