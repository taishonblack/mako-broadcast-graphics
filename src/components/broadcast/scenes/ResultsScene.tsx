import { useEffect, useRef, useState } from 'react';
import { ThemePreset, PollOption, QRPosition } from '@/lib/types';
import { GraphicLayer } from '@/lib/layers';
import { AssetOverlay } from '@/components/broadcast/AssetOverlay';
import { AssetColorMap, AssetTransformMap, AssetId } from '@/components/poll-create/polling-assets/types';
import { getAssetTransformStyle } from '@/lib/asset-transforms';

interface ResultsSceneProps {
  question: string;
  options: PollOption[];
  totalVotes: number;
  colors: string[];
  theme: ThemePreset;
  slug?: string;
  qrSize?: number;
  qrPosition?: QRPosition;
  qrVisible?: boolean;
  qrUrlVisible?: boolean;
  debugVoteUrl?: string;
  showBranding?: boolean;
  brandingPosition?: QRPosition;
  enabledAssetIds?: AssetId[];
  transforms?: AssetTransformMap;
  assetColors?: AssetColorMap;
  /** `animated` (default) reveals bars/percentages from 0 over
   *  `resultsAnimationMs`. `static` paints the final state immediately. */
  resultsMode?: 'animated' | 'static';
  resultsAnimationMs?: number;
  /** Bumping this number re-triggers the animated reveal without changing
   *  any vote data — used by the operator "Replay" button. */
  resultsReplayKey?: number;
  /** Per-layer text overrides so the inspector controls (line spacing,
   *  wrap width) feed through to the live composition. */
  layers?: GraphicLayer[];
}

export function ResultsScene({
  question,
  options,
  totalVotes,
  colors,
  theme,
  slug,
  qrSize,
  qrPosition = 'bottom-right',
  qrVisible = true,
  qrUrlVisible = true,
  debugVoteUrl,
  showBranding = false,
  brandingPosition = 'bottom-left',
  enabledAssetIds,
  transforms,
  assetColors,
  resultsMode = 'animated',
  resultsAnimationMs = 1200,
  resultsReplayKey = 0,
}: ResultsSceneProps) {
  const visibleAssets = new Set(enabledAssetIds ?? ['question', 'answers', 'logo']);

  // Animated reveal: drive a 0 → 1 progress value with rAF over the
   // configured duration. We re-trigger whenever the scene mounts, the
   // mode flips, the duration changes, or the operator presses "Replay"
   // (which bumps `resultsReplayKey`). Vote data changes mid-reveal do
   // NOT restart the animation — the bars simply slide toward the new
   // target on the next frame, which feels right for live results.
  const [progress, setProgress] = useState(resultsMode === 'static' ? 1 : 0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (resultsMode === 'static') {
      setProgress(1);
      return;
    }
    setProgress(0);
    startRef.current = null;
    const dur = Math.max(50, resultsAnimationMs);
    let raf = 0;
    const tick = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / dur);
      // easeOutCubic — quick rise, gentle settle (broadcast-friendly).
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [resultsMode, resultsAnimationMs, resultsReplayKey]);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${theme.tintColor}, hsl(220, 25%, 6%))`,
        ...getAssetTransformStyle(transforms?.background),
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      <div className="relative z-20 flex flex-col items-center w-full px-32" style={{ maxWidth: '1600px' }}>
        {visibleAssets.has('question') && (
        <h1
          className="font-bold mb-16 text-center leading-tight"
          style={{ color: assetColors?.question?.textPrimary ?? theme.textPrimary, fontSize: '88px', ...getAssetTransformStyle(transforms?.question) }}
        >
          {question}
        </h1>
        )}

        {visibleAssets.has('answers') && (
        <div className="w-full space-y-10" style={getAssetTransformStyle(transforms?.answers)}>
          {options.map((option, i) => {
            const finalPct = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
            const pct = finalPct * progress;
            const displayVotes = Math.round(option.votes * progress);
            const color = colors[i % colors.length];

            return (
              <div key={option.id} className="flex flex-col gap-3">
                <div className="flex items-end justify-between">
                  <span
                    className="font-semibold"
                    style={{ color: assetColors?.answers?.textPrimary ?? theme.textPrimary, fontSize: '44px' }}
                  >
                    {option.text}
                  </span>
                  <span
                    className="font-bold font-mono tabular-nums"
                    style={{ color, fontSize: '72px' }}
                  >
                    {Math.round(pct)}%
                  </span>
                </div>
                <div
                  className="rounded-full overflow-hidden"
                  style={{ height: '32px', background: 'hsla(210, 20%, 92%, 0.1)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: color,
                      boxShadow: 'none',
                    }}
                  />
                </div>
                <span
                  className="font-mono"
                  style={{ color: assetColors?.answers?.textSecondary ?? theme.textSecondary, fontSize: '22px' }}
                >
                  {displayVotes.toLocaleString()} votes
                </span>
              </div>
            );
          })}
        </div>
        )}

        {visibleAssets.has('voterTally') && (
          <div data-layer="votesText" className="mt-10 text-center" style={getAssetTransformStyle(transforms?.voterTally)}>
            <span className="font-mono" style={{ color: assetColors?.voterTally?.textSecondary ?? theme.textSecondary, fontSize: '28px' }}>
              {Math.round(totalVotes * progress).toLocaleString()} total votes
            </span>
          </div>
        )}
      </div>

      {((visibleAssets.has('qr') && qrVisible && qrSize !== undefined) || (visibleAssets.has('logo') && showBranding)) && (
        <AssetOverlay
          showQR={visibleAssets.has('qr') && qrVisible && qrSize !== undefined && qrSize > 0}
          qrSlug={slug ?? ''}
          qrSize={qrSize ?? 0}
          qrPosition={qrPosition}
          debugVoteUrl={debugVoteUrl}
          showQrUrl={qrUrlVisible}
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
