import { ChevronDown, ChevronRight, Lock, Unlock } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { AssetColorConfig, AssetId, AssetTransformConfig, TransformField } from '@/components/poll-create/polling-assets/types';
import { useState } from 'react';

interface AssetTransformControlsProps {
  assetId: AssetId | null;
  assetLabel?: string;
  transform?: AssetTransformConfig;
   colors?: AssetColorConfig;
  onChange: (field: Exclude<TransformField, never>, value: number) => void;
  onToggleLock: (field: TransformField) => void;
   onColorsChange?: (next: AssetColorConfig) => void;
}

const CONTROL_DEFS: Array<{
  field: TransformField;
  label: string;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
}> = [
  { field: 'x', label: 'X', min: -400, max: 400, step: 1, format: (v) => `${Math.round(v)}px` },
  { field: 'y', label: 'Y', min: -300, max: 300, step: 1, format: (v) => `${Math.round(v)}px` },
  { field: 'scale', label: 'Scale', min: 0.25, max: 2.5, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
  { field: 'opacity', label: 'Transparency', min: 0, max: 1, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
  { field: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1, format: (v) => `${Math.round(v)}°` },
  { field: 'cropLeft', label: 'Crop Left', min: 0, max: 0.45, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
  { field: 'cropRight', label: 'Crop Right', min: 0, max: 0.45, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
  { field: 'cropTop', label: 'Crop Top', min: 0, max: 0.45, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
  { field: 'cropBottom', label: 'Crop Bottom', min: 0, max: 0.45, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
];

export function AssetTransformControls({ assetId, assetLabel, transform, colors, onChange, onToggleLock, onColorsChange }: AssetTransformControlsProps) {
  const [transformOpen, setTransformOpen] = useState(true);
  const [colorsOpen, setColorsOpen] = useState(true);

  if (!assetId || !transform) {
    return <div className="px-4 py-3 text-[11px] text-muted-foreground">Select an asset to adjust its transform controls.</div>;
  }

  return (
    <div className="border-t border-border/60 bg-background/70 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Asset transforms</p>
          <h3 className="text-xs font-medium text-foreground">{assetLabel ?? assetId}</h3>
        </div>
      </div>

      <div className="rounded-md border border-border/50 bg-card/30">
        <button type="button" onClick={() => setTransformOpen((value) => !value)} className="flex w-full items-center justify-between px-3 py-2 text-left">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Transform</span>
          {transformOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {transformOpen && (
          <div className="grid gap-2 border-t border-border/50 px-3 py-3 md:grid-cols-2 xl:grid-cols-3">
            {CONTROL_DEFS.map((control) => {
              const locked = transform.locks[control.field];
              const value = transform[control.field];
              return (
                <div key={control.field} className="rounded-md border border-border/50 bg-card/40 px-2.5 py-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[10px] text-muted-foreground">{control.label}</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">{control.format ? control.format(Number(value)) : value}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => onToggleLock(control.field)}
                        aria-label={`${locked ? 'Unlock' : 'Lock'} ${control.label}`}
                      >
                        {locked ? <Lock className="h-3 w-3 text-primary" /> : <Unlock className="h-3 w-3 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                  <Slider
                    value={[Number(value)]}
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    disabled={locked}
                    onValueChange={([next]) => onChange(control.field, next)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-md border border-border/50 bg-card/30">
        <button type="button" onClick={() => setColorsOpen((value) => !value)} className="flex w-full items-center justify-between px-3 py-2 text-left">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Colors</span>
          {colorsOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {colorsOpen && (
          <div className="space-y-3 border-t border-border/50 px-3 py-3">
            {onColorsChange ? (
              <>
                <ColorInput label="Primary text" value={colors?.textPrimary} onChange={(value) => onColorsChange({ ...colors, textPrimary: value })} />
                <ColorInput label="Secondary text" value={colors?.textSecondary} onChange={(value) => onColorsChange({ ...colors, textSecondary: value })} />
                {Array.from({ length: 4 }).map((_, index) => (
                  <ColorInput
                    key={`bar-${index}`}
                    label={`Bar ${index + 1}`}
                    value={colors?.barColors?.[index]}
                    onChange={(value) => {
                      const nextBarColors = [...(colors?.barColors ?? [])];
                      nextBarColors[index] = value;
                      onColorsChange({ ...colors, barColors: nextBarColors });
                    }}
                  />
                ))}
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">This asset has no color overrides.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <Label className="w-24 text-[10px] text-muted-foreground">{label}</Label>
      <input
        type="color"
        value={toHex(value)}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0"
      />
      <input
        type="text"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 flex-1 rounded-md border border-input bg-background/50 px-2 text-[10px] font-mono text-foreground"
      />
    </div>
  );
}

function toHex(value?: string) {
  if (!value) return '#ffffff';
  if (value.startsWith('#')) return value;
  const match = value.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
  if (!match) return '#ffffff';
  const [, h, s, l] = match.map(Number);
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hue = h / 60;
  const x = chroma * (1 - Math.abs((hue % 2) - 1));
  const [r1, g1, b1] = hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x] : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const m = lightness - chroma / 2;
  const toChannel = (channel: number) => Math.round((channel + m) * 255).toString(16).padStart(2, '0');
  return `#${toChannel(r1)}${toChannel(g1)}${toChannel(b1)}`;
}