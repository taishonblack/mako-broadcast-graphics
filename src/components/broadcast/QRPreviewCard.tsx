import { QRCodeSVG } from 'qrcode.react';

interface QRPreviewCardProps {
  url: string;
  size?: number;
  frameColor?: string;
}

export function QRPreviewCard({ url, size = 120, frameColor = 'hsl(0, 0%, 100%)' }: QRPreviewCardProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="p-3 rounded-xl"
        style={{ backgroundColor: frameColor }}
      >
        <QRCodeSVG value={url} size={size} level="M" />
      </div>
      <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[160px]">{url}</span>
    </div>
  );
}
