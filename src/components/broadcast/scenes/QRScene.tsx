import { ThemePreset } from '@/lib/types';
import { QRCodeSVG } from 'qrcode.react';

interface QRSceneProps {
  slug: string;
  theme: ThemePreset;
}

export function QRScene({ slug, theme }: QRSceneProps) {
  const url = `https://makovote.tv/vote/${slug}`;

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${theme.tintColor}, hsl(220, 25%, 6%))`,
      }}
    >
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <h1
          className="text-5xl font-bold tracking-tight"
          style={{ color: theme.textPrimary }}
        >
          Vote Now
        </h1>

        <div
          className="p-6 rounded-3xl"
          style={{ backgroundColor: 'hsla(0, 0%, 100%, 0.95)' }}
        >
          <QRCodeSVG value={url} size={240} level="H" />
        </div>

        <p
          className="font-mono text-lg tracking-wide"
          style={{ color: theme.textSecondary }}
        >
          {url}
        </p>
      </div>

      {/* Bug */}
      <div className="absolute bottom-8 left-8 flex items-center gap-2 opacity-50 z-20">
        <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-[10px]">M</span>
        </div>
        <span className="font-mono text-[10px]" style={{ color: theme.textSecondary }}>MakoVote</span>
      </div>
    </div>
  );
}
