import { useState, useEffect } from 'react';
import { ThemePreset, PollOption, QRPosition } from '@/lib/types';
import { AssetOverlay } from '@/components/broadcast/AssetOverlay';
import { AssetColorMap, AssetTransformMap } from '@/components/poll-create/polling-assets/types';
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
  enabledAssetIds?: Array<'question' | 'answers' | 'subheadline' | 'background' | 'qr' | 'logo' | 'voterTally'>;
  transforms?: AssetTransformMap;
  assetColors?: AssetColorMap;
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
}: ResultsSceneProps) {
  const [animProgress, setAnimProgress] = useState(0);
  const visibleAssets = new Set(enabledAssetIds ?? ['question', 'answers', 'logo']);

  useEffect(() => {
    setAnimProgress(0);
    const start = performance.now();
    const duration = 1200;
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimProgress(eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [totalVotes]);

  const maxVotes = Math.max(...options.map((o) => o.votes));

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
            const pct = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
            const isWinner = option.votes === maxVotes;
            const color = colors[i % colors.length];
            const animatedPct = pct * animProgress;

            return (
              <div key={option.id} className="flex flex-col gap-3">
                <div className="flex items-end justify-between">
                  <span
                    className="font-semibold"
                    style={{ color: assetColors?.answers?.textPrimary ?? theme.textPrimary, fontSize: '44px' }}
                  >
                    {option.text}
                    {isWinner && (
                      <span className="ml-6 font-mono" style={{ color: colors[0], fontSize: '24px' }}>
                        ★ WINNER
                      </span>
                    )}
                  </span>
                  <span
                    className="font-bold font-mono tabular-nums"
                    style={{ color, fontSize: '72px' }}
                  >
                    {Math.round(animatedPct)}%
                  </span>
                </div>
                <div
                  className="rounded-full overflow-hidden"
                  style={{ height: '32px', background: 'hsla(210, 20%, 92%, 0.1)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${animatedPct}%`,
                      backgroundColor: color,
                      boxShadow: isWinner ? `0 0 32px ${color}` : 'none',
                      transition: 'box-shadow 0.3s ease',
                    }}
                  />
                </div>
                <span
                  className="font-mono"
                  style={{ color: assetColors?.answers?.textSecondary ?? theme.textSecondary, fontSize: '22px' }}
                >
                  {Math.round(option.votes * animProgress).toLocaleString()} votes
                </span>
              </div>
            );
          })}
        </div>
        )}

        {visibleAssets.has('voterTally') && (
          <div data-layer="votesText" className="mt-10 text-center" style={getAssetTransformStyle(transforms?.voterTally)}>
            <span className="font-mono" style={{ color: assetColors?.voterTally?.textSecondary ?? theme.textSecondary, fontSize: '28px' }}>
              {totalVotes.toLocaleString()} total votes
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
