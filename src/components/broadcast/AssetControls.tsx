import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { QRPosition } from '@/lib/types';

interface AssetControlsProps {
  qrSize: number;
  qrPosition: QRPosition;
  showBranding: boolean;
  brandingPosition: QRPosition;
  onQrSizeChange: (size: number) => void;
  onQrPositionChange: (pos: QRPosition) => void;
  onShowBrandingChange: (show: boolean) => void;
  onBrandingPositionChange: (pos: QRPosition) => void;
}

const positions: { label: string; value: QRPosition }[] = [
  { label: 'TL', value: 'top-left' },
  { label: 'TR', value: 'top-right' },
  { label: 'BL', value: 'bottom-left' },
  { label: 'BR', value: 'bottom-right' },
];

export function AssetControls({
  qrSize,
  qrPosition,
  showBranding,
  brandingPosition,
  onQrSizeChange,
  onQrPositionChange,
  onShowBrandingChange,
  onBrandingPositionChange,
}: AssetControlsProps) {
  return (
    <div className="flex items-center gap-6 flex-wrap">
      {/* QR Controls */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground font-mono uppercase">QR Size</span>
        <Slider
          value={[qrSize]}
          onValueChange={([v]) => onQrSizeChange(v)}
          min={60}
          max={200}
          step={5}
          className="w-24"
        />
        <span className="text-[10px] text-muted-foreground font-mono w-8">{qrSize}px</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground font-mono uppercase mr-1">QR Pos</span>
        {positions.map((p) => (
          <button
            key={p.value}
            onClick={() => onQrPositionChange(p.value)}
            className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
              qrPosition === p.value
                ? 'bg-primary/20 text-primary'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Branding Controls */}
      <div className="flex items-center gap-2">
        <Label className="text-[10px] text-muted-foreground font-mono uppercase">Bug</Label>
        <Switch checked={showBranding} onCheckedChange={onShowBrandingChange} />
      </div>

      {showBranding && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-mono uppercase mr-1">Bug Pos</span>
          {positions.map((p) => (
            <button
              key={p.value}
              onClick={() => onBrandingPositionChange(p.value)}
              className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                brandingPosition === p.value
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
