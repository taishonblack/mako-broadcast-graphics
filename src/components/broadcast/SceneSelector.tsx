import { useEffect } from 'react';
import { SceneType } from '@/lib/scenes';
import {
  BROADCAST_SCENES,
  BroadcastSceneId,
  broadcastSceneFromSceneType,
} from '@/lib/scene-presets';
import { QrCode, BarChart3, Columns2 } from 'lucide-react';

const sceneIcons: Record<BroadcastSceneId, React.ElementType> = {
  questionQr: QrCode,
  liveResults: BarChart3,
  lowerThird: Columns2,
};

interface SceneSelectorProps {
  previewScene: SceneType;
  programScene: SceneType;
  onSceneChange: (scene: SceneType) => void;
  onTake: () => void;
  onCut: () => void;
}

export function SceneSelector({ previewScene, programScene, onSceneChange, onTake, onCut }: SceneSelectorProps) {
  const previewId = broadcastSceneFromSceneType(previewScene);
  const programId = broadcastSceneFromSceneType(programScene);
  const dirty = previewId !== programId;

  // Broadcast hotkeys — operator standard.
  //   SPACE / T  → TAKE (animated cut to program)
  //   C          → CUT  (instant cut to program)
  // Ignored when typing in form fields, with modifier keys, or when the
  // user has a dialog/menu open (Radix sets aria-hidden on body siblings).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // Don't hijack SPACE when a button/switch/role-checkbox has focus —
      // the operator is interacting with that control, not staging a TAKE.
      if (t && e.code === 'Space') {
        const tag = t.tagName;
        const role = t.getAttribute('role');
        if (tag === 'BUTTON' || tag === 'SELECT' || role === 'switch' || role === 'checkbox' || role === 'menuitem' || role === 'option') return;
      }
      const isTake = e.code === 'Space' || e.key === 't' || e.key === 'T';
      const isCut = e.key === 'c' || e.key === 'C';
      if (!isTake && !isCut) return;
      e.preventDefault();
      if (isTake) onTake();
      else onCut();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onTake, onCut]);

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-3 w-full">
        {/* Scene buttons — broadcast scene presets */}
        <div className="flex items-center gap-1.5">
          {BROADCAST_SCENES.map((scene) => {
            const Icon = sceneIcons[scene.id];
            const isProgram = programId === scene.id;
            const isPreview = previewId === scene.id;
            const isDisabled = scene.disabled;
            return (
              <button
                key={scene.id}
                onClick={() => !isDisabled && onSceneChange(scene.sceneType)}
                disabled={isDisabled}
                title={isDisabled ? 'Not available yet' : undefined}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border relative ${
                  isDisabled
                    ? 'bg-accent/10 border-border/30 text-muted-foreground/40 cursor-not-allowed opacity-50'
                    : isProgram && isPreview
                    ? 'bg-mako-live/15 border-mako-live/60 text-[hsl(var(--mako-live))] shadow-[0_0_16px_-2px_hsl(var(--mako-live)/0.4)]'
                    : isProgram
                    ? 'bg-mako-live/10 border-mako-live/50 text-[hsl(var(--mako-live))]'
                    : isPreview
                    ? 'bg-primary/15 border-primary/50 text-primary shadow-[0_0_12px_-2px_hsl(var(--primary)/0.3)]'
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
            className={`px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase border transition-all duration-200 ${
              dirty
                ? 'bg-mako-live/25 border-mako-live/70 text-[hsl(var(--mako-live))] shadow-[0_0_16px_-2px_hsl(var(--mako-live)/0.5)] hover:bg-mako-live/35'
                : 'bg-mako-live/15 border-mako-live/40 text-[hsl(var(--mako-live))] hover:bg-mako-live/25'
            }`}
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
          <span className="text-[9px] font-mono text-muted-foreground/50">SPACE/T = TAKE · C = CUT</span>
        </div>
      </div>
    </div>
  );
}
