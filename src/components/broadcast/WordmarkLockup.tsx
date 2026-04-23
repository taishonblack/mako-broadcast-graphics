import { ThemePreset } from '@/lib/types';
import { TITLE_SAFE_INSET } from '@/lib/preview-overlays';
import { AssetState } from '@/components/poll-create/polling-assets/types';

interface WordmarkLockupProps {
  theme: ThemePreset;
  weight: AssetState['wordmarkWeight'];
  tracking: number;
  scale?: number;
  showGuides?: boolean;
  subtitle?: string;
}

const fontWeightMap: Record<AssetState['wordmarkWeight'], number> = {
  medium: 500,
  semibold: 600,
  bold: 700,
};

export function WordmarkLockup({
  theme,
  weight,
  tracking,
  scale = 1,
  showGuides = false,
  subtitle = 'Start building your poll to preview the graphic',
}: WordmarkLockupProps) {
  const wordWidth = `${6.4 * scale}ch`;
  const wordmarkSize = `clamp(${54 * scale}px, ${7.2 * scale}vw, ${92 * scale}px)`;
  const subtitleSize = `clamp(${18 * scale}px, ${1.8 * scale}vw, ${32 * scale}px)`;

  return (
    <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-[clamp(28px,3vh,40px)] px-[clamp(48px,6vw,96px)] text-center">
      {showGuides && (
        <>
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2" style={{ background: 'hsla(199, 89%, 60%, 0.7)' }} />
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2" style={{ background: 'hsla(199, 89%, 60%, 0.35)' }} />
          <div className="absolute inset-y-[10%] left-[10%] right-[10%] border pointer-events-none" style={{ borderColor: 'hsla(199, 89%, 65%, 0.45)' }} />
          <span
            className="absolute font-mono uppercase pointer-events-none"
            style={{
              top: `calc(${TITLE_SAFE_INSET}% - 18px)`,
              left: `${TITLE_SAFE_INSET}%`,
              fontSize: '9px',
              letterSpacing: '0.1em',
              color: 'hsla(199, 89%, 65%, 0.45)',
            }}
          >
            Title Safe
          </span>
        </>
      )}

      <div
        className="flex items-baseline justify-center leading-none select-none"
        style={{
          fontWeight: fontWeightMap[weight],
          letterSpacing: `${tracking}em`,
        }}
      >
        <span
          className="text-right"
          style={{
            width: wordWidth,
            fontSize: wordmarkSize,
            color: theme.textPrimary,
            textShadow: '0 8px 32px rgba(0,0,0,0.45)',
            opacity: 0.92,
          }}
        >
          Mako
        </span>
        <span
          className="text-left"
          style={{
            width: wordWidth,
            fontSize: wordmarkSize,
            color: theme.primaryColor,
            textShadow: '0 8px 32px rgba(0,0,0,0.45)',
          }}
        >
          Vote
        </span>
      </div>

      <p
        className="font-mono uppercase text-center"
        style={{
          color: theme.textSecondary,
          fontSize: subtitleSize,
          opacity: 0.72,
          letterSpacing: '0.2em',
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}