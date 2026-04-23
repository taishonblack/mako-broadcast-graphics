import { ThemePreset, PollOption, TemplateName, QRPosition } from '@/lib/types';
import { AssetOverlay } from '@/components/broadcast/AssetOverlay';
import { AssetTransformMap } from '@/components/poll-create/polling-assets/types';

interface LowerThirdSceneProps {
  question: string;
  options: PollOption[];
  totalVotes: number;
  colors: string[];
  theme: ThemePreset;
  template?: TemplateName;
  /** Banner height as % of frame (default 32%) */
  height?: number;
  slug?: string;
  qrSize?: number;
  qrPosition?: QRPosition;
  qrVisible?: boolean;
  debugVoteUrl?: string;
  showBranding?: boolean;
  brandingPosition?: QRPosition;
  enabledAssetIds?: Array<'question' | 'answers' | 'subheadline' | 'background' | 'qr' | 'logo' | 'voterTally'>;
  transforms?: AssetTransformMap;
}

/**
 * LOWER THIRD — independent bottom-anchored broadcast composition.
 * NOT a scaled-down Fullscreen. Has its own layout system:
 *   - bottom-anchored, full width
 *   - left: question + answers
 *   - right: vote total (and QR via AssetOverlay if positioned bottom-right)
 */
export function LowerThirdScene({
  question,
  options,
  totalVotes,
  colors,
  theme,
  height = 32,
  slug,
  qrSize,
  qrPosition = 'top-right',
  qrVisible = true,
  debugVoteUrl,
  showBranding = false,
  brandingPosition = 'top-left',
  enabledAssetIds,
  transforms,
}: LowerThirdSceneProps) {
  // Clamp height to broadcast-safe range (20%-45%)
  const bannerHeight = Math.max(20, Math.min(45, height));
  const visibleAssets = new Set(enabledAssetIds ?? ['question', 'answers', 'logo']);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${theme.tintColor}, hsl(220, 25%, 6%))`,
      }}
    >
      {/* Bottom-anchored banner */}
      <div
        className="absolute left-0 right-0 bottom-0 z-20 animate-slide-up flex flex-col"
        style={{
          height: `${bannerHeight}%`,
          background: `linear-gradient(to top, hsla(220, 20%, 6%, 0.97), hsla(220, 20%, 6%, 0.90))`,
          backdropFilter: 'blur(16px)',
          borderTop: `2px solid ${colors[0]}`,
        }}
      >
        {/* Accent stripe */}
        <div
          className="h-2 w-full shrink-0"
          style={{
            background: `linear-gradient(to right, ${colors[0]}, ${colors[1] || colors[0]})`,
          }}
        />

        {/* Safe-area padded layout: left = Q+answers, right = totals */}
        <div className="flex-1 min-h-0 flex items-center gap-16 px-24 py-8">
          {/* LEFT: Question + Answers stacked */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-6 h-full py-2">
            {visibleAssets.has('question') && (
            <h2
              className="font-bold leading-tight truncate"
              style={{
                color: theme.textPrimary,
                fontSize: '56px',
              }}
            >
              {question}
            </h2>
            )}

            {/* Answer rows — thick, broadcast-readable bars */}
            {visibleAssets.has('answers') && (
            <div className="flex flex-col gap-3">
              {options.slice(0, 4).map((option, i) => {
                const pct = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                const color = colors[i % colors.length];
                return (
                  <div key={option.id} className="flex items-center gap-6">
                    <span
                      className="font-semibold shrink-0 truncate"
                      style={{
                        color: theme.textPrimary,
                        fontSize: '28px',
                        width: '280px',
                      }}
                    >
                      {option.text}
                    </span>
                    <div
                      className="flex-1 rounded-full overflow-hidden"
                      style={{
                        height: '22px',
                        background: 'hsla(210, 20%, 92%, 0.1)',
                      }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: color,
                          boxShadow: `0 0 16px -4px ${color}`,
                          transition: 'width 0.5s ease-out',
                        }}
                      />
                    </div>
                    <span
                      className="font-mono font-bold tabular-nums shrink-0 text-right"
                      style={{ color, fontSize: '32px', width: '90px' }}
                    >
                      {Math.round(pct)}%
                    </span>
                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* Divider */}
          <div
            className="w-px shrink-0 self-stretch my-4"
            style={{ background: 'hsla(210, 20%, 92%, 0.18)' }}
          />

          {/* RIGHT: Vote total */}
          {visibleAssets.has('voterTally') && (
          <div className="shrink-0 flex flex-col items-center justify-center" style={{ width: '220px' }}>
            <span
              className="font-bold font-mono tabular-nums leading-none"
              style={{ color: theme.textPrimary, fontSize: '64px' }}
            >
              {totalVotes.toLocaleString()}
            </span>
            <span
              className="font-mono mt-2 tracking-widest uppercase"
              style={{ color: theme.textSecondary, fontSize: '16px' }}
            >
              Total Votes
            </span>
          </div>
          )}
        </div>
      </div>

      {/* Asset overlay (QR + bug). Default positions are top corners so they
          sit above the banner and don't overlap content. */}
      {((visibleAssets.has('qr') && qrVisible && qrSize !== undefined) || (visibleAssets.has('logo') && showBranding)) && (
        <AssetOverlay
          showQR={visibleAssets.has('qr') && qrVisible && qrSize !== undefined && qrSize > 0}
          qrSlug={slug ?? ''}
          qrSize={qrSize ?? 0}
          qrPosition={qrPosition}
          debugVoteUrl={debugVoteUrl}
          showBranding={visibleAssets.has('logo') && showBranding}
          brandingPosition={brandingPosition}
          theme={theme}
          qrTransform={transforms?.qr}
          logoTransform={transforms?.logo}
        />
      )}
    </div>
  );
}
