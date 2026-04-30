import { useEffect } from 'react';
import { SceneType } from '@/lib/scenes';
import {
  BROADCAST_SCENES,
  BroadcastSceneId,
  broadcastSceneFromSceneType,
} from '@/lib/scene-presets';
import { QrCode, BarChart3, Columns2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { loadHotkeys, formatHotkey, OperatorHotkeys } from '@/lib/operator-settings';

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

  // Hotkeys are operator-remappable in Settings → live-refreshed via the
  // 'mako:hotkeys-changed' window event so we don't need a remount.
  const [hotkeys, setHotkeys] = useState<OperatorHotkeys>(() => loadHotkeys());
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<OperatorHotkeys>).detail;
      setHotkeys(detail ?? loadHotkeys());
    };
    window.addEventListener('mako:hotkeys-changed', onChange);
    return () => window.removeEventListener('mako:hotkeys-changed', onChange);
  }, []);

  // Broadcast hotkeys — operator standard (defaults: T=TAKE, C=CUT, SPACE=TAKE).
  // Ignored when typing in form fields, with modifier keys, or when the
  // user has a dialog/menu open (Radix sets aria-hidden on body siblings).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // Match against remapped bindings. Single-char keys compare on the
      // lowercased printable; 'Space' / 'Enter' use e.code / e.key.
      const matches = (binding: string) => {
        if (!binding) return false;
        if (binding === 'Space') return e.code === 'Space';
        if (binding === 'Enter') return e.key === 'Enter';
        return e.key.toLowerCase() === binding;
      };
      const spaceOnFocusedToggle = hotkeys.spaceTakesOnFocusedToggle;
      // SPACE on a focused interactive control is suppressed unless the
      // operator opted in — protects accidental TAKE while toggling a switch.
      if (t && e.code === 'Space' && !spaceOnFocusedToggle) {
        const tag = t.tagName;
        const role = t.getAttribute('role');
        if (tag === 'BUTTON' || tag === 'SELECT' || role === 'switch' || role === 'checkbox' || role === 'menuitem' || role === 'option') return;
      }
      const isTake = matches(hotkeys.takeKey);
      const isCut = matches(hotkeys.cutKey);
      if (!isTake && !isCut) return;
      e.preventDefault();
      if (isTake) onTake();
      else onCut();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onTake, onCut, hotkeys]);

  const takeLabel = formatHotkey(hotkeys.takeKey);
  const cutLabel = formatHotkey(hotkeys.cutKey);

  // Brief click-flash so operators get a visual confirmation that
  // TAKE / CUT actually fired. TAKE flashes green (success), CUT
  // flashes red (program-hot) — both default colors per spec are
  // red (TAKE) and yellow (CUT).
  const [takeFlash, setTakeFlash] = useState(false);
  const [cutFlash, setCutFlash] = useState(false);
  const flashTimer = useRef<{ take: number | null; cut: number | null }>({ take: null, cut: null });
  const fireTake = () => {
    onTake();
    setTakeFlash(true);
    if (flashTimer.current.take) window.clearTimeout(flashTimer.current.take);
    flashTimer.current.take = window.setTimeout(() => setTakeFlash(false), 260);
  };
  const fireCut = () => {
    onCut();
    setCutFlash(true);
    if (flashTimer.current.cut) window.clearTimeout(flashTimer.current.cut);
    flashTimer.current.cut = window.setTimeout(() => setCutFlash(false), 260);
  };

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
                title={isDisabled ? 'Coming soon' : undefined}
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
                {isDisabled && (
                  <span className="ml-1 text-[8px] font-mono uppercase tracking-wider opacity-70">Soon</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-border/50" />

        {/* Transition controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={fireTake}
            title={`TAKE — animated cut to program (Hotkey: ${takeLabel})`}
            aria-label={`TAKE (hotkey ${takeLabel})`}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase border transition-all duration-200 ${
              takeFlash
                ? 'bg-mako-success/30 border-mako-success/80 text-mako-success shadow-[0_0_18px_-2px_hsl(var(--mako-success)/0.6)]'
                : dirty
                  ? 'bg-destructive/25 border-destructive/70 text-destructive shadow-[0_0_16px_-2px_hsl(var(--destructive)/0.5)] hover:bg-destructive/35'
                  : 'bg-destructive/15 border-destructive/40 text-destructive hover:bg-destructive/25'
            }`}
          >
            TAKE
          </button>
          <button
            onClick={fireCut}
            title={`CUT — instant cut to program (Hotkey: ${cutLabel})`}
            aria-label={`CUT (hotkey ${cutLabel})`}
            className={`px-3 py-2 rounded-lg text-xs font-bold font-mono uppercase border transition-all duration-200 ${
              cutFlash
                ? 'bg-destructive/30 border-destructive/80 text-destructive shadow-[0_0_18px_-2px_hsl(var(--destructive)/0.6)]'
                : 'bg-amber-500/20 border-amber-500/60 text-amber-400 hover:bg-amber-500/30'
            }`}
          >
            CUT
          </button>
        </div>

        {/* Hotkey hints */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] font-mono text-muted-foreground/50">{takeLabel} = TAKE · {cutLabel} = CUT</span>
        </div>
      </div>
    </div>
  );
}
