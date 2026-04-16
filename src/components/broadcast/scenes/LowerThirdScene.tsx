import { renderChart } from '@/lib/render-chart';
import { ThemePreset, PollOption, TemplateName, QRPosition } from '@/lib/types';
import { AssetOverlay } from '@/components/broadcast/AssetOverlay';

interface LowerThirdSceneProps {
  question: string;
  options: PollOption[];
  totalVotes: number;
  colors: string[];
  theme: ThemePreset;
  template?: TemplateName;
  /** Banner height as % of frame (default 32%) */
  height?: number;
  // Asset overlays
  slug?: string;
  qrSize?: number;
  qrPosition?: QRPosition;
  showBranding?: boolean;
  brandingPosition?: QRPosition;
}

/**
 * Broadcast-style lower third banner.
 * - Spans full frame width
 * - Adjustable height (defaults to ~1/3 of frame)
 * - Anchored to bottom edge
 */
export function LowerThirdScene({
  question,
  options,
  totalVotes,
  colors,
  theme,
  template = 'horizontal-bar',
  height = 32,
  slug,
  qrSize,
  qrPosition = 'top-right',
  showBranding = false,
  brandingPosition = 'top-left',
}: LowerThirdSceneProps) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${theme.tintColor}, hsl(220, 25%, 6%))`,
      }}
    >
      <div
        className="absolute left-0 right-0 bottom-0 z-20 animate-slide-up flex flex-col"
        style={{
          height: `${height}%`,
          background: `linear-gradient(to top, hsla(220, 20%, 6%, 0.96), hsla(220, 20%, 6%, 0.88))`,
          backdropFilter: 'blur(16px)',
          borderTop: `2px solid ${colors[0]}`,
        }}
      >
        {/* Top accent stripe */}
        <div
          className="h-2 w-full shrink-0"
          style={{
            background: `linear-gradient(to right, ${colors[0]}, ${colors[1] || colors[0]})`,
          }}
        />

        <div className="flex items-center gap-12 px-16 py-8 flex-1 min-h-0">
          {/* Question column */}
          <div className="shrink-0 max-w-[38%] flex flex-col justify-center">
            <h2
              className="font-bold leading-tight"
              style={{
                color: theme.textPrimary,
                fontSize: '52px',
              }}
            >
              {question}
            </h2>
            <span
              className="font-mono mt-3 block"
              style={{ color: theme.textSecondary, fontSize: '20px' }}
            >
              {totalVotes.toLocaleString()} votes
            </span>
          </div>

          {/* Vertical divider */}
          <div
            className="w-px shrink-0 self-stretch"
            style={{ background: 'hsla(210, 20%, 92%, 0.18)' }}
          />

          {/* Chart column — fills remaining width */}
          <div className="flex-1 min-w-0 self-stretch flex items-center">
            {renderChart({ template, options, totalVotes, colors })}
          </div>
        </div>
      </div>

      {/* Asset overlay sits in the upper area outside the banner */}
      {(qrSize !== undefined || showBranding) && (
        <AssetOverlay
          showQR={qrSize !== undefined && qrSize > 0}
          qrSlug={slug ?? ''}
          qrSize={qrSize ?? 0}
          qrPosition={qrPosition}
          showBranding={showBranding}
          brandingPosition={brandingPosition}
          theme={theme}
        />
      )}
    </div>
  );
}
