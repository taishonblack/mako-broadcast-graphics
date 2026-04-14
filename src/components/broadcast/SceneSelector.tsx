import { scenes, SceneType } from '@/lib/scenes';
import { Monitor, Columns2, QrCode, Trophy } from 'lucide-react';

const sceneIcons: Record<SceneType, React.ElementType> = {
  fullscreen: Monitor,
  lowerThird: Columns2,
  qr: QrCode,
  results: Trophy,
};

interface SceneSelectorProps {
  previewScene: SceneType;
  programScene: SceneType;
  onSceneChange: (scene: SceneType) => void;
  onTake: () => void;
  onCut: () => void;
}

export function SceneSelector({ previewScene, programScene, onSceneChange, onTake, onCut }: SceneSelectorProps) {
  return (
    <div className="flex items-center gap-3 w-full">
      {/* Scene buttons */}
      <div className="flex items-center gap-1.5">
        {scenes.map((scene) => {
          const Icon = sceneIcons[scene.id];
          const isProgram = programScene === scene.id;
          const isPreview = previewScene === scene.id;
          return (
            <button
              key={scene.id}
              onClick={() => onSceneChange(scene.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border relative ${
                isProgram
                  ? 'bg-mako-live/15 border-mako-live/50 text-[hsl(var(--mako-live))] shadow-[0_0_16px_-2px_hsl(var(--mako-live)/0.4)]'
                  : isPreview
                  ? 'bg-primary/15 border-primary/40 text-primary shadow-[0_0_12px_-2px_hsl(var(--primary)/0.3)]'
                  : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              }`}
            >
              {isProgram && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[hsl(var(--mako-live))] animate-live-pulse" />
              )}
              <Icon className="w-3.5 h-3.5" />
              {scene.shortLabel}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-border/50" />

      {/* Transition controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onTake}
          className="px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase bg-mako-live/20 border border-mako-live/50 text-[hsl(var(--mako-live))] hover:bg-mako-live/30 transition-all duration-200 shadow-[0_0_12px_-4px_hsl(var(--mako-live)/0.3)] hover:shadow-[0_0_20px_-4px_hsl(var(--mako-live)/0.5)]"
        >
          TAKE
        </button>
        <button
          onClick={onCut}
          className="px-3 py-2 rounded-lg text-xs font-bold font-mono uppercase bg-accent/30 border border-border/50 text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-all duration-200"
        >
          CUT
        </button>
      </div>

      {/* Hotkey hints */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-[9px] font-mono text-muted-foreground/50">1-4 scenes · SPACE take</span>
      </div>
    </div>
  );
}
