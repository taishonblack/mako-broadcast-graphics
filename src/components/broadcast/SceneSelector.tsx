import { scenes, SceneType } from '@/lib/scenes';
import { Monitor, Columns2, QrCode, Trophy } from 'lucide-react';

const sceneIcons: Record<SceneType, React.ElementType> = {
  fullscreen: Monitor,
  lowerThird: Columns2,
  qr: QrCode,
  results: Trophy,
};

interface SceneSelectorProps {
  activeScene: SceneType;
  onSceneChange: (scene: SceneType) => void;
}

export function SceneSelector({ activeScene, onSceneChange }: SceneSelectorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {scenes.map((scene) => {
        const Icon = sceneIcons[scene.id];
        const isActive = activeScene === scene.id;
        return (
          <button
            key={scene.id}
            onClick={() => onSceneChange(scene.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border ${
              isActive
                ? 'bg-primary/15 border-primary/40 text-primary shadow-[0_0_12px_-2px_hsl(var(--primary)/0.3)]'
                : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {scene.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
