import { GraphicLayer, LayerType } from '@/lib/layers';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Compact numeric input with optional secondary readout (e.g. px). */
function NumericField({
  label, value, onChange, min, max, step, suffix, secondary, disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  secondary?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value.toFixed(1));
  // Re-sync when the source value changes externally (drag, snap).
  useEffect(() => { setText(value.toFixed(1)); }, [value]);
  const commit = () => {
    const n = parseFloat(text);
    if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
    else setText(value.toFixed(1));
  };
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-mono">{label}</span>
        {secondary && <span className="text-[9px] text-muted-foreground/60 font-mono">{secondary}</span>}
      </div>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="h-7 text-[11px] font-mono pr-5"
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/60 font-mono pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/** Broadcast canvas reference resolution for the px readout. */
const REF_WIDTH = 1920;
const REF_HEIGHT = 1080;

interface LayerInspectorProps {
  layer: GraphicLayer | null;
  onUpdateLayer: (id: LayerType, changes: Partial<GraphicLayer>) => void;
}

export function LayerInspector({ layer, onUpdateLayer }: LayerInspectorProps) {
  if (!layer) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/50 text-xs font-mono">
        Select a layer
      </div>
    );
  }

  const updateTransform = (changes: Partial<GraphicLayer['transform']>) => {
    onUpdateLayer(layer.id, { transform: { ...layer.transform, ...changes } });
  };

  const xPx = Math.round((layer.transform.x / 100) * REF_WIDTH);
  const yPx = Math.round((layer.transform.y / 100) * REF_HEIGHT);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <span className="text-xs font-semibold text-foreground">{layer.label}</span>
        {layer.locked && (
          <span className="mako-chip bg-muted text-muted-foreground text-[9px]">Locked</span>
        )}
      </div>

      {/* Numeric position / size readout — always visible for the selected layer. */}
      <div className="space-y-2 pb-2 border-b border-border">
        <p className="text-[10px] text-muted-foreground font-mono uppercase">Position</p>
        <div className="grid grid-cols-2 gap-2">
          <NumericField
            label="X"
            value={layer.transform.x}
            suffix="%"
            secondary={`${xPx}px`}
            min={0}
            max={100}
            step={0.1}
            disabled={layer.locked}
            onChange={(v) => updateTransform({ x: v })}
          />
          <NumericField
            label="Y"
            value={layer.transform.y}
            suffix="%"
            secondary={`${yPx}px`}
            min={0}
            max={100}
            step={0.1}
            disabled={layer.locked}
            onChange={(v) => updateTransform({ y: v })}
          />
          <NumericField
            label="Scale"
            value={layer.transform.scale * 100}
            suffix="%"
            min={10}
            max={300}
            step={1}
            disabled={layer.locked}
            onChange={(v) => updateTransform({ scale: v / 100 })}
          />
          <NumericField
            label="α"
            value={layer.transform.opacity * 100}
            suffix="%"
            min={0}
            max={100}
            step={1}
            onChange={(v) => updateTransform({ opacity: v / 100 })}
          />
        </div>
      </div>

      {/* Global Transform */}
      <div className="space-y-3">
        <p className="text-[10px] text-muted-foreground font-mono uppercase">Transform</p>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-5">X</span>
            <Slider
              value={[layer.transform.x]}
              onValueChange={([v]) => updateTransform({ x: v })}
              min={0} max={100} step={0.5}
              className="flex-1"
              disabled={layer.locked}
            />
            <span className="text-[10px] text-muted-foreground font-mono w-10">{layer.transform.x.toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-5">Y</span>
            <Slider
              value={[layer.transform.y]}
              onValueChange={([v]) => updateTransform({ y: v })}
              min={0} max={100} step={0.5}
              className="flex-1"
              disabled={layer.locked}
            />
            <span className="text-[10px] text-muted-foreground font-mono w-10">{layer.transform.y.toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-5">S</span>
            <Slider
              value={[layer.transform.scale * 100]}
              onValueChange={([v]) => updateTransform({ scale: v / 100 })}
              min={10} max={300} step={5}
              className="flex-1"
              disabled={layer.locked}
            />
            <span className="text-[10px] text-muted-foreground font-mono w-10">{(layer.transform.scale * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-5">α</span>
            <Slider
              value={[layer.transform.opacity * 100]}
              onValueChange={([v]) => updateTransform({ opacity: v / 100 })}
              min={0} max={100} step={1}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground font-mono w-10">{(layer.transform.opacity * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Text-specific controls */}
      {layer.textProps && (
        <div className="space-y-3 pt-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground font-mono uppercase">Text</p>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12">Size</span>
            <Slider
              value={[layer.textProps.fontSize]}
              onValueChange={([v]) => onUpdateLayer(layer.id, {
                textProps: { ...layer.textProps!, fontSize: v }
              })}
              min={8} max={64} step={1}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground font-mono w-10">{layer.textProps.fontSize}px</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Bold</span>
            <Switch
              checked={layer.textProps.fontWeight === 'bold'}
              onCheckedChange={(checked) => onUpdateLayer(layer.id, {
                textProps: { ...layer.textProps!, fontWeight: checked ? 'bold' : 'normal' }
              })}
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground mr-1">Align</span>
            {(['left', 'center', 'right'] as const).map((align) => {
              const AlignIcon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
              return (
                <button
                  key={align}
                  onClick={() => onUpdateLayer(layer.id, {
                    textProps: { ...layer.textProps!, textAlign: align }
                  })}
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors border ${
                    layer.textProps!.textAlign === align
                      ? 'bg-primary/20 border-primary/30 text-primary'
                      : 'bg-muted border-border text-muted-foreground'
                  }`}
                >
                  <AlignIcon className="w-3 h-3" />
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12">Width</span>
            <Slider
              value={[layer.textProps.maxWidth]}
              onValueChange={([v]) => onUpdateLayer(layer.id, {
                textProps: { ...layer.textProps!, maxWidth: v }
              })}
              min={20} max={100} step={5}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground font-mono w-10">{layer.textProps.maxWidth}%</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12">Leading</span>
            <Slider
              value={[layer.textProps.lineHeight * 10]}
              onValueChange={([v]) => onUpdateLayer(layer.id, {
                textProps: { ...layer.textProps!, lineHeight: v / 10 }
              })}
              min={8} max={24} step={1}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground font-mono w-10">{layer.textProps.lineHeight.toFixed(1)}</span>
          </div>
        </div>
      )}

      {/* Bar-specific controls */}
      {layer.barProps && (
        <div className="space-y-3 pt-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground font-mono uppercase">Bars</p>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12">Height</span>
            <Slider
              value={[layer.barProps.barThickness]}
              onValueChange={([v]) => onUpdateLayer(layer.id, {
                barProps: { ...layer.barProps!, barThickness: v }
              })}
              min={12} max={64} step={2}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground font-mono w-10">{layer.barProps.barThickness}px</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12">Gap</span>
            <Slider
              value={[layer.barProps.spacing]}
              onValueChange={([v]) => onUpdateLayer(layer.id, {
                barProps: { ...layer.barProps!, spacing: v }
              })}
              min={2} max={24} step={1}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground font-mono w-10">{layer.barProps.spacing}px</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Smoothing</span>
            <Switch
              checked={layer.barProps.smoothing}
              onCheckedChange={(checked) => onUpdateLayer(layer.id, {
                barProps: { ...layer.barProps!, smoothing: checked }
              })}
            />
          </div>
        </div>
      )}

      {/* QR-specific controls */}
      {layer.qrProps && (
        <div className="space-y-3 pt-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground font-mono uppercase">QR Code</p>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12">Size</span>
            <Slider
              value={[layer.qrProps.size]}
              onValueChange={([v]) => onUpdateLayer(layer.id, {
                qrProps: { ...layer.qrProps!, size: v }
              })}
              min={60} max={240} step={5}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground font-mono w-10">{layer.qrProps.size}px</span>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] text-muted-foreground">Anchor</span>
            <div className="flex items-center gap-1 flex-wrap">
              {(['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'] as const).map((anchor) => (
                <button
                  key={anchor}
                  onClick={() => onUpdateLayer(layer.id, {
                    qrProps: { ...layer.qrProps!, anchor }
                  })}
                  className={`px-2 py-1 rounded text-[9px] font-mono transition-colors ${
                    layer.qrProps!.anchor === anchor
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {anchor === 'center' ? 'C' : anchor.split('-').map(w => w[0].toUpperCase()).join('')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12">Pad</span>
            <Slider
              value={[layer.qrProps.padding]}
              onValueChange={([v]) => onUpdateLayer(layer.id, {
                qrProps: { ...layer.qrProps!, padding: v }
              })}
              min={0} max={60} step={2}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground font-mono w-10">{layer.qrProps.padding}px</span>
          </div>
        </div>
      )}
    </div>
  );
}
