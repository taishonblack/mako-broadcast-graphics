import { ThemePreset, PollOption, TemplateName, QRPosition } from '@/lib/types';
import { GraphicLayer } from '@/lib/layers';
import { AssetOverlay } from '@/components/broadcast/AssetOverlay';
import { renderChart } from '@/lib/render-chart';
import { AssetColorMap, AssetState, AssetTransformMap, AssetId } from '@/components/poll-create/polling-assets/types';
import { getAssetTransformStyle } from '@/lib/asset-transforms';
import { WordmarkLockup } from '@/components/broadcast/WordmarkLockup';
import { POLLING_GRAPHIC_DEFAULTS as PGD } from '@/lib/polling-graphic-defaults';

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
  qrVisible?: boolean;
  qrUrlVisible?: boolean;
  debugVoteUrl?: string;
  showBranding?: boolean;
  brandingPosition?: QRPosition;
  enabledAssetIds?: AssetId[];
  transforms?: AssetTransformMap;
  assetColors?: AssetColorMap;
  wordmarkWeight?: AssetState['wordmarkWeight'];
  wordmarkTracking?: number;
  wordmarkScale?: number;
  /** When provided, the scene root becomes transparent so a background
   *  image set by the parent (DraftPreviewMonitor / ProgramOutput) shows
   *  through instead of being covered by the theme tint gradient. */
  bgImage?: string;
  bgColor?: string;
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
  qrVisible = true,
  qrUrlVisible = true,
  debugVoteUrl,
  showBranding = false,
  brandingPosition = 'bottom-left',
  enabledAssetIds,
  transforms,
  assetColors,
  wordmarkWeight = 'semibold',
  wordmarkTracking = 0,
  wordmarkScale = 1,
  layers,
  bgImage,
  bgColor,
}: FullscreenSceneProps) {
  const useNativeChart = template === 'pie-donut' || template === 'puck-slider' || template === 'vertical-bar';
  const showWordmarkPlaceholder = !question.trim() && options.every((option) => !option.text.trim()) && totalVotes === 0;
  const visibleAssets = new Set(enabledAssetIds ?? ['question', 'answers', 'logo']);

  // Look up per-layer text settings (lineHeight, maxWidth%) so the
  // inspector can control wrapped-line spacing on the live composition.
  // Action Safe is inset 5% on each side of the 1920px canvas → 1728px usable.
  // We clamp the wrap width to action-safe so long question text breaks to a
  // new line BEFORE touching the action-safe guide instead of overflowing it.
  const questionLayer = layers?.find((l) => l.id === 'question');
  const ACTION_SAFE_PX = 1728;
  const questionMaxWidthPx = Math.min(
    ACTION_SAFE_PX,
    Math.round(((questionLayer?.textProps?.maxWidth ?? PGD.questionMaxWidthPct) / 100) * 1920),
  );
  const questionLineHeight = questionLayer?.textProps?.lineHeight ?? 1.1;

  return (
    <div
      data-layer="background"
      className="absolute inset-0 overflow-hidden"
      style={{
        background: bgImage
          ? 'transparent'
          : `linear-gradient(135deg, ${bgColor || theme.tintColor}, hsl(220, 25%, 6%))`,
        ...getAssetTransformStyle(transforms?.background),
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
        {showWordmarkPlaceholder ? (
          <WordmarkLockup
            theme={theme}
            weight={wordmarkWeight}
            tracking={wordmarkTracking}
            scale={wordmarkScale}
          />
        ) : (
          <>
            {visibleAssets.has('question') && (
            <h1
              data-layer="question"
              className="font-bold text-center mb-20"
              style={{
                color: assetColors?.question?.textPrimary ?? theme.textPrimary,
                fontSize: `${PGD.questionFontSize}px`,
                maxWidth: `${questionMaxWidthPx}px`,
                lineHeight: questionLineHeight,
                overflowWrap: 'break-word',
                wordBreak: 'normal',
                ...getAssetTransformStyle(transforms?.question),
              }}
            >
              {question}
            </h1>
            )}

            <div className="w-full" style={{ maxWidth: `${PGD.pollGraphicWidth}px` }}>
              {/* NOTE: `answerType` is a voter-input-only asset. It must NOT
                  render on Program / Output / Fullscreen. Voter buttons live
                  exclusively in the Mobile/Desktop voter previews and the
                  real /vote page. Program shows Answer Bars (`answers`). */}

              {visibleAssets.has('answers') && (useNativeChart ? (
                <div
                  data-layer="answerBars"
                  className="flex w-full items-center justify-center"
                  style={{
                    minHeight: template === 'pie-donut' ? '520px' : template === 'vertical-bar' ? '620px' : undefined,
                    ...getAssetTransformStyle(transforms?.answers),
                  }}
                >
                  <div
                  style={{
                      transform: template === 'pie-donut' ? 'scale(2.75)' : template === 'vertical-bar' ? 'scale(2.1)' : 'scale(2.4)',
                      transformOrigin: 'center center',
                    }}
                  >
                    {renderChart({ template, options, totalVotes, colors })}
                  </div>
                </div>
              ) : (
                <div
                  data-layer="answerBars"
                  className="flex flex-col"
                  style={{ gap: `${PGD.answerSpacing}px`, ...getAssetTransformStyle(transforms?.answers) }}
                >
                  {options.map((option, i) => {
                    const pct = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                    // Default to neutral white. Only honor the palette
                    // (`colors[]`) when the operator has explicitly set
                    // per-bar colors via the inspector.
                    const operatorBarColors = assetColors?.answers?.barColors;
                    const color = operatorBarColors?.[i] ?? PGD.answerTextColor;
                    const labelColor = assetColors?.answers?.textPrimary ?? PGD.answerTextColor;
                    return (
                      <div key={option.id} className="flex flex-col gap-2">
                        <div className="flex items-end justify-between">
                          <span className="font-semibold" style={{ color: labelColor, fontSize: `${PGD.answerFontSize}px` }}>
                            {option.text}
                          </span>
                          <span className="font-bold font-mono tabular-nums" style={{ color: labelColor, fontSize: '56px' }}>
                            {Math.round(pct)}%
                          </span>
                        </div>
                        <div className="overflow-hidden" style={{ height: `${PGD.answerBarHeight}px`, borderRadius: `${PGD.answerBorderRadius}px`, background: PGD.answerButtonIdleBg, border: `1px solid ${PGD.answerBorderColor}` }}>
                          <div
                            className="h-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: color,
                              borderRadius: `${PGD.answerBorderRadius}px`,
                              boxShadow: 'none',
                              transition: 'width 0.5s ease-out',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {visibleAssets.has('voterTally') && (
              <div data-layer="votesText" className="mt-12 text-center">
                <span className="font-mono" style={{ color: assetColors?.voterTally?.textSecondary ?? theme.textSecondary, fontSize: '28px', ...getAssetTransformStyle(transforms?.voterTally) }}>
                  {totalVotes.toLocaleString()} total votes
                </span>
              </div>
              )}
            </div>
          </>
        )}
      </div>

      {((visibleAssets.has('qr') && qrVisible && qrSize !== undefined) || (visibleAssets.has('logo') && showBranding)) && (
        <AssetOverlay
          showQR={visibleAssets.has('qr') && qrVisible && qrSize !== undefined && qrSize > 0}
          qrSlug={slug ?? ''}
          qrSize={qrSize ?? 0}
          qrPosition={qrPosition ?? 'bottom-right'}
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
