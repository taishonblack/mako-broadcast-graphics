import { Lock, Unlock } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { AssetId, AssetTransformConfig, TransformField } from '@/components/poll-create/polling-assets/types';

interface AssetTransformControlsProps {
  assetId: AssetId | null;
  assetLabel?: string;
  transform?: AssetTransformConfig;
  onChange: (field: Exclude<TransformField, never>, value: number) => void;
  onToggleLock: (field: TransformField) => void;
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

export function AssetTransformControls({ assetId, assetLabel, transform, onChange, onToggleLock }: AssetTransformControlsProps) {
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

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
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
    </div>
  );
}