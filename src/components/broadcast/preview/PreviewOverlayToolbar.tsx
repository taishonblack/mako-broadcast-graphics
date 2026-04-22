import { Crosshair, Grid3x3, Magnet, Ruler, Square, SquareDashed, Settings2, RotateCcw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PreviewOverlayState } from '@/lib/preview-overlays';

interface PreviewOverlayToolbarProps {
  state: PreviewOverlayState;
  onToggle: (key: keyof PreviewOverlayState) => void;
  onUpdate: <K extends keyof PreviewOverlayState>(key: K, value: PreviewOverlayState[K]) => void;
  onResetGuides: () => void;
  /** Show the Reset Guides button (off by default if Guides toggle is off). */
  className?: string;
}

interface ChipDef {
  key: keyof PreviewOverlayState;
  label: string;
  icon: React.ElementType;
  tip: string;
}

const CHIPS: ChipDef[] = [
  { key: 'titleSafe', label: 'Title', icon: Square, tip: 'Title Safe — keep critical text inside this guide' },
  { key: 'actionSafe', label: 'Action', icon: SquareDashed, tip: 'Action Safe — keep major visual assets inside this guide' },
  { key: 'grid', label: 'Grid', icon: Grid3x3, tip: 'Alignment grid' },
  { key: 'centerCrosshair', label: 'Center', icon: Crosshair, tip: 'Center crosshair' },
  { key: 'rulers', label: 'Rulers', icon: Ruler, tip: 'Rulers — drag from edges to add guides' },
  { key: 'snap', label: 'Snap', icon: Magnet, tip: 'Snap — magnetic alignment when dragging assets (hold Alt to bypass)' },
];

/**
 * Compact, broadcast-utility chip row mounted at the top-right of operator
 * preview frames. Persists state per-user via usePreviewOverlays. The
 * chips here only affect operator UI — never the live program output.
 */
export function PreviewOverlayToolbar({ state, onToggle, onUpdate, onResetGuides, className = '' }: PreviewOverlayToolbarProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {CHIPS.map(({ key, label, icon: Icon, tip }) => {
        const active = !!state[key];
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onToggle(key)}
                aria-pressed={active}
                className={`mako-chip cursor-pointer text-[10px] gap-1 px-2 py-0.5 transition-colors border ${
                  active
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-[220px]">{tip}</TooltipContent>
          </Tooltip>
        );
      })}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onResetGuides}
            className="mako-chip cursor-pointer text-[10px] gap-1 px-2 py-0.5 bg-muted/40 text-muted-foreground border border-border hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Clear all custom guides</TooltipContent>
      </Tooltip>

      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                className="mako-chip cursor-pointer text-[10px] gap-1 px-2 py-0.5 bg-muted/40 text-muted-foreground border border-border hover:text-foreground transition-colors"
                aria-label="Overlay options"
              >
                <Settings2 className="w-3 h-3" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Overlay opacity & grid density</TooltipContent>
        </Tooltip>
        <PopoverContent side="bottom" align="end" className="w-56 p-3 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Overlay Opacity</span>
              <span className="text-[10px] text-muted-foreground font-mono">{state.overlayOpacity}%</span>
            </div>
            <Slider
              value={[state.overlayOpacity]}
              onValueChange={([v]) => onUpdate('overlayOpacity', v)}
              min={10} max={100} step={5}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Grid Density</span>
              <span className="text-[10px] text-muted-foreground font-mono">{state.gridDensity} cols</span>
            </div>
            <Slider
              value={[state.gridDensity]}
              onValueChange={([v]) => onUpdate('gridDensity', v)}
              min={4} max={32} step={1}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}