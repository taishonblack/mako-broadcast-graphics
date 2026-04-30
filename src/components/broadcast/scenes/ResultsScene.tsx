import { useEffect, useRef, useState } from 'react';
import { ThemePreset, PollOption, QRPosition } from '@/lib/types';
import { GraphicLayer } from '@/lib/layers';
import { AssetOverlay } from '@/components/broadcast/AssetOverlay';
import { AssetColorMap, AssetTransformMap, AssetId } from '@/components/poll-create/polling-assets/types';
import { getAssetTransformStyle } from '@/lib/asset-transforms';
import { POLLING_GRAPHIC_DEFAULTS as PGD } from '@/lib/polling-graphic-defaults';
import { SceneAssetTransformFrame } from './SceneAssetTransformFrame';
import { AnswerChoices } from '@/components/broadcast/AnswerChoices';

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
  bgImage?: string;
  bgColor?: string;
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
  layers,
  bgImage,
  bgColor,
}: ResultsSceneProps) {
  const visibleAssets = new Set(enabledAssetIds ?? ['question', 'answers', 'logo']);

  // Action-safe wrap: clamp the question width to the action-safe inset
  // (5% on each side of 1920px → 1728px) so long text drops to a new line
  // BEFORE touching the action-safe guide. Inspector "Width" shrinks it
  // further; "Leading" controls wrapped-line spacing.
  const questionLayer = layers?.find((l) => l.id === 'question');
  const ACTION_SAFE_PX = 1728;
  const questionMaxWidthPx = Math.min(
    ACTION_SAFE_PX,
    Math.round(((questionLayer?.textProps?.maxWidth ?? PGD.questionMaxWidthPct) / 100) * 1920),
  );
  const questionLineHeight = questionLayer?.textProps?.lineHeight ?? 1.1;

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
        background: bgImage
          ? 'transparent'
          : `linear-gradient(135deg, ${bgColor || theme.tintColor}, hsl(220, 25%, 6%))`,
        ...getAssetTransformStyle(transforms?.background),
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      <div className="relative z-20 w-full h-full">
        {/* All polling-family assets render through SceneAssetTransformFrame
            so X/Y/Scale apply to the same outer wrapper for every asset.
            See SceneAssetTransformFrame.tsx. */}

        {visibleAssets.has('question') && (
          <SceneAssetTransformFrame transform={transforms?.question}>
            <h1
              className="font-bold text-center"
              style={{
                color: assetColors?.question?.textPrimary ?? theme.textPrimary,
                fontSize: `${PGD.questionFontSize}px`,
                maxWidth: `${questionMaxWidthPx}px`,
                lineHeight: questionLineHeight,
                overflowWrap: 'break-word',
                wordBreak: 'normal',
              }}
            >
              {question}
            </h1>
          </SceneAssetTransformFrame>
        )}

        {/* `answerType` (Voter Selection) is voter-input only — never renders on Program. */}

        {visibleAssets.has('answers') && (
          <SceneAssetTransformFrame transform={transforms?.answers}>
            {/* Answer Bars owns its own style/color slice — no fallback to
                Voter Selection. The two assets are independent. */}
            <AnswerChoices
              surface="program"
              variant="bars"
              options={options}
              totalVotes={totalVotes}
              progress={progress}
              style={assetColors?.answers}
              optionColors={assetColors?.answers?.barColors}
              textColor={assetColors?.answers?.textPrimary ?? PGD.answerTextColor}
              secondaryTextColor={assetColors?.answers?.textSecondary ?? PGD.answerTextColor}
            />
          </SceneAssetTransformFrame>
        )}

        {visibleAssets.has('voterTally') && (
          <SceneAssetTransformFrame transform={transforms?.voterTally}>
            <div data-layer="votesText" className="text-center">
              <span className="font-mono" style={{ color: assetColors?.voterTally?.textSecondary ?? theme.textSecondary, fontSize: '28px' }}>
                {Math.round(totalVotes * progress).toLocaleString()} total votes
              </span>
            </div>
          </SceneAssetTransformFrame>
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
