import { ThemePreset, PollOption, TemplateName, QRPosition } from '@/lib/types';
import { GraphicLayer } from '@/lib/layers';
import { AssetOverlay } from '@/components/broadcast/AssetOverlay';
import { renderChart } from '@/lib/render-chart';

interface FullscreenSceneProps {
  question: string;
  options: PollOption[];
  totalVotes: number;
  colors: string[];
  theme: ThemePreset;
  template?: TemplateName;
  /** Layers are accepted for compatibility but Fullscreen now uses its own
   *  broadcast-baseline composition instead of per-layer transforms. */
  layers?: GraphicLayer[];
  slug?: string;
  qrSize?: number;
  qrPosition?: QRPosition;
  showBranding?: boolean;
  brandingPosition?: QRPosition;
}

/**
 * FULLSCREEN — the master broadcast composition.
 * Centered, large-scale, frame-filling. Other scenes (Results, Lower Third)
 * are independent layouts, NOT transforms of this one.
 *
 * Each meaningful element carries a `data-layer` attribute so the
 * LayerPreviewOverlay can map a selected layer in the panel to the
 * actual rendered DOM node and draw a tight bounding box around it.
 */
export function FullscreenScene({
  question,
  options,
  totalVotes,
  colors,
  theme,
  template = 'horizontal-bar',
  slug,
  qrSize,
  qrPosition,
  showBranding = false,
  brandingPosition = 'bottom-left',
}: FullscreenSceneProps) {
  const useNativeChart = template === 'pie-donut' || template === 'puck-slider' || template === 'vertical-bar';

  return (
    <div
      data-layer="background"
      className="absolute inset-0 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${theme.tintColor}, hsl(220, 25%, 6%))`,
      }}
    >
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      <div className="relative z-20 w-full h-full flex flex-col items-center justify-center px-32 py-24">
        {/* Question */}
        <h1
          data-layer="question"
          className="font-bold text-center leading-tight mb-20"
          style={{
            color: theme.textPrimary,
            fontSize: '88px',
            maxWidth: '1600px',
          }}
        >
          {question}
        </h1>

        {/* Content group — sized to fill the frame appropriately */}
        <div className="w-full" style={{ maxWidth: '1600px' }}>
          {useNativeChart ? (
            <div data-layer="answerBars" style={{ transform: 'scale(2.4)', transformOrigin: 'center top' }}>
              {renderChart({ template, options, totalVotes, colors })}
            </div>
          ) : (
            <div data-layer="answerBars" className="space-y-8">
              {options.map((option, i) => {
                const pct = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                const color = colors[i % colors.length];
                return (
                  <div key={option.id} className="flex flex-col gap-2">
                    <div className="flex items-end justify-between">
                      <span
                        className="font-semibold"
                        style={{ color: theme.textPrimary, fontSize: '40px' }}
                      >
                        {option.text}
                      </span>
                      <span
                        className="font-bold font-mono tabular-nums"
                        style={{ color, fontSize: '56px' }}
                      >
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <div
                      className="rounded-full overflow-hidden"
                      style={{ height: '28px', background: 'hsla(210, 20%, 92%, 0.1)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: color,
                          boxShadow: `0 0 24px -4px ${color}`,
                          transition: 'width 0.5s ease-out',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Vote total */}
          <div data-layer="votesText" className="mt-12 text-center">
            <span
              className="font-mono"
              style={{ color: theme.textSecondary, fontSize: '28px' }}
            >
              {totalVotes.toLocaleString()} total votes
            </span>
          </div>
        </div>
      </div>

      {(qrSize !== undefined || showBranding) && (
        <AssetOverlay
          showQR={qrSize !== undefined && qrSize > 0}
          qrSlug={slug ?? ''}
          qrSize={qrSize ?? 0}
          qrPosition={qrPosition ?? 'bottom-right'}
          showBranding={showBranding}
          brandingPosition={brandingPosition}
          theme={theme}
        />
      )}
    </div>
  );
}
