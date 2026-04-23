import { ChevronDown, ChevronRight, Lock, RotateCcw, Unlock } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AssetColorConfig, AssetColorMap, AssetId, AssetTransformMap, DEFAULT_ASSET_COLORS, TransformField } from '@/components/poll-create/polling-assets/types';
import { useState } from 'react';

interface AssetTransformControlsProps {
  assetId: AssetId | null;
  assetLabel?: string;
  folderLabel?: string;
  folderAssetIds?: AssetId[];
  transforms: AssetTransformMap;
  colors: AssetColorMap;
  answerCount: number;
  onChange: (assetId: AssetId, field: TransformField, value: number) => void;
  onToggleLock: (assetId: AssetId, field: TransformField) => void;
  onColorsChange: (assetId: AssetId, next: AssetColorConfig) => void;
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

interface ColorFieldConfig {
  key: 'textPrimary' | 'textSecondary' | 'barColors';
  label: string;
  value?: string;
  index?: number;
  apply: (value: string) => AssetColorConfig;
  reset: () => AssetColorConfig;
}

interface ColorSection {
  assetId: AssetId;
  label: string;
  fields: ColorFieldConfig[];
}

export function AssetTransformControls({ assetId, assetLabel, folderLabel, folderAssetIds, transforms, colors, answerCount, onChange, onToggleLock, onColorsChange }: AssetTransformControlsProps) {
  const [transformOpen, setTransformOpen] = useState(true);
  const [colorsOpen, setColorsOpen] = useState(true);

  const visibleAssetIds = assetId ? [assetId] : (folderAssetIds ?? []);
  const title = assetId ? (assetLabel ?? assetId) : (folderLabel ?? 'Selected folder');
  const transformSections = visibleAssetIds
    .map((id) => ({ id, label: assetId ? (assetLabel ?? id) : getAssetLabel(id), transform: transforms[id] }))
    .filter((section) => Boolean(section.transform));
  const colorSections: ColorSection[] = visibleAssetIds.flatMap((id) => buildColorSections(id, colors[id], answerCount));
  const visibleColorFieldCount = colorSections.reduce((total, section) => total + section.fields.length, 0);

  if (visibleAssetIds.length === 0) {
    return <div className="px-4 py-3 text-[11px] text-muted-foreground">Select an asset or folder to adjust transforms and colors.</div>;
  }

  const resetAllVisibleColors = () => {
    const uniqueIds = Array.from(new Set<AssetId>(colorSections.map((section) => section.assetId)));
    uniqueIds.forEach((id) => onColorsChange(id, getTemplateColors(id, answerCount)));
  };

  return (
    <div className="border-t border-border/60 bg-background/70 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Transform & colors</p>
          <h3 className="text-xs font-medium text-foreground">{title}</h3>
        </div>
      </div>

      <div className="rounded-md border border-border/50 bg-card/30">
        <button type="button" onClick={() => setTransformOpen((value) => !value)} className="flex w-full items-center justify-between px-3 py-2 text-left">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Transform</span>
          {transformOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {transformOpen && (
          <div className="space-y-3 border-t border-border/50 px-3 py-3">
            {transformSections.map((section) => (
              <div key={section.id} className="space-y-2 rounded-md border border-border/50 bg-card/30 p-2.5">
                {transformSections.length > 1 && <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{section.label}</p>}
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {CONTROL_DEFS.map((control) => {
                    const locked = section.transform.locks[control.field];
                    const value = section.transform[control.field];
                    return (
                      <div key={`${section.id}-${control.field}`} className="rounded-md border border-border/50 bg-card/40 px-2.5 py-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-[10px] text-muted-foreground">{control.label}</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-muted-foreground">{control.format ? control.format(Number(value)) : value}</span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => onToggleLock(section.id, control.field)}
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
                          onValueChange={([next]) => onChange(section.id, control.field, next)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-md border border-border/50 bg-card/30">
        <button type="button" onClick={() => setColorsOpen((value) => !value)} className="flex w-full items-center justify-between px-3 py-2 text-left">
          <span className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Colors</span>
            {visibleColorFieldCount > 0 && (
              <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                {visibleColorFieldCount} field{visibleColorFieldCount === 1 ? '' : 's'}
              </Badge>
            )}
          </span>
          {colorsOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {colorsOpen && (
          <div className="space-y-3 border-t border-border/50 px-3 py-3">
            {colorSections.length > 0 ? (
              <>
                <div className="flex items-center justify-end">
                  <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[10px] text-muted-foreground" onClick={resetAllVisibleColors}>
                    <RotateCcw className="h-3 w-3" />
                    Reset visible to template
                  </Button>
                </div>
                {colorSections.map((section) => (
                  <div key={`${section.assetId}-${section.label}`} className="space-y-2 rounded-md border border-border/50 bg-card/30 p-2.5">
                    {(colorSections.length > 1 || !assetId) && <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{section.label}</p>}
                    <div className="space-y-2">
                      {section.fields.map((field) => (
                        <ColorInput
                          key={`${section.assetId}-${field.key}-${field.index ?? 'single'}`}
                          label={field.label}
                          value={field.value}
                          onChange={(value) => onColorsChange(section.assetId, field.apply(value))}
                          onReset={() => onColorsChange(section.assetId, field.reset())}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">This selection has no color overrides.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange, onReset }: { label: string; value?: string; onChange: (value: string) => void; onReset: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <Label className="w-24 text-[10px] text-muted-foreground">{label}</Label>
      <input
        type="color"
        value={toHex(value)}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0"
      />
      <Input
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 flex-1 bg-background/50 px-2 text-[10px] font-mono"
      />
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-muted-foreground" onClick={onReset}>
        Reset
      </Button>
    </div>
  );
}

function getAssetLabel(assetId: AssetId) {
  switch (assetId) {
    case 'question': return 'Question Text';
    case 'answers': return 'Answer Bars';
    case 'subheadline': return 'Subheadline';
    case 'background': return 'Background';
    case 'qr': return 'QR Code';
    case 'logo': return 'Logo';
    case 'voterTally': return 'Voter Tally';
  }
}

function getTemplateBarColor(index: number) {
  const defaults = DEFAULT_ASSET_COLORS.answers.barColors ?? ['hsl(0 0% 100%)'];
  return defaults[index % defaults.length] ?? defaults[0];
}

function getTemplateColors(assetId: AssetId, answerCount: number): AssetColorConfig {
  const base = DEFAULT_ASSET_COLORS[assetId] ?? {};
  if (assetId !== 'answers') return { ...base };

  return {
    ...base,
    barColors: Array.from({ length: Math.max(answerCount, 1) }, (_, index) => getTemplateBarColor(index)),
  };
}

function buildColorSections(assetId: AssetId, colors: AssetColorConfig | undefined, answerCount: number): ColorSection[] {
  const resolvedColors = { ...getTemplateColors(assetId, answerCount), ...colors };
  const textPrimary = resolvedColors.textPrimary;
  const textSecondary = resolvedColors.textSecondary;
  const barColors = Array.from({ length: Math.max(answerCount, 1) }, (_, index) => resolvedColors.barColors?.[index] ?? getTemplateBarColor(index));

  const createField = (config: {
    key: 'textPrimary' | 'textSecondary' | 'barColors';
    label: string;
    value?: string;
    index?: number;
  }): ColorFieldConfig => ({
    ...config,
    apply: (value: string) => {
      if (config.key === 'barColors') {
        const nextBarColors = [...barColors];
        nextBarColors[config.index ?? 0] = value;
        return { ...resolvedColors, barColors: nextBarColors };
      }

      return { ...resolvedColors, [config.key]: value };
    },
    reset: () => {
      if (config.key === 'barColors') {
        const nextBarColors = [...barColors];
        nextBarColors[config.index ?? 0] = getTemplateBarColor(config.index ?? 0);
        return { ...resolvedColors, barColors: nextBarColors };
      }

      return { ...resolvedColors, [config.key]: getTemplateColors(assetId, answerCount)[config.key] };
    },
  });

  switch (assetId) {
    case 'question':
      return [{ assetId, label: 'Question text', fields: [createField({ key: 'textPrimary', label: 'Text', value: textPrimary })] }];
    case 'answers':
      return [{
        assetId,
        label: 'Answer bars',
        fields: barColors.map((value, index) => createField({ key: 'barColors', label: `Bar ${index + 1}`, value, index })),
      }];
    case 'subheadline':
      return [{ assetId, label: 'Subheadline', fields: [createField({ key: 'textSecondary', label: 'Text', value: textSecondary })] }];
    case 'qr':
      return [{ assetId, label: 'QR URL label', fields: [createField({ key: 'textSecondary', label: 'Label', value: textSecondary })] }];
    case 'logo':
      return [{ assetId, label: 'Logo', fields: [createField({ key: 'textSecondary', label: 'Accent', value: textSecondary })] }];
    case 'voterTally':
      return [{
        assetId,
        label: 'Voter tally',
        fields: [
          createField({ key: 'textPrimary', label: 'Primary', value: textPrimary }),
          createField({ key: 'textSecondary', label: 'Secondary', value: textSecondary }),
        ],
      }];
    default:
      return [];
  }
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