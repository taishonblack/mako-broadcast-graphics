import { CSSProperties } from 'react';
import { POLLING_GRAPHIC_DEFAULTS as PGD } from '@/lib/polling-graphic-defaults';
import { AssetColorConfig } from '@/components/poll-create/polling-assets/types';

/**
 * SHARED ANSWER CHOICES RENDERER.
 *
 * Single source of truth for the "answer pill list" used by:
 *   - Answer Type (voter input on Mobile / Desktop)
 *   - Answer Bars (results graphic on Program / Mobile / Desktop)
 *
 * If the operator wires identical style settings (padding, radius, color
 * palette) into both assets, the two MUST render identically. Layout math
 * (gap, container width, alignment) is keyed off the active surface so the
 * pill family scales appropriately for 1920×1080 vs a 375×667 voter device.
 *
 * Variants:
 *   - `bars`  → shows the percent fill behind the label + "%" text.
 *   - `voter` → no fill, no percent. Just the choice text (Yes / No / etc.).
 *
 * The component intentionally does NOT apply any X/Y transform — the parent
 * SceneAssetTransformFrame is responsible for positioning the entire group.
 */

export type AnswerSurface = 'program' | 'mobile' | 'desktop';
export type AnswerVariant = 'bars' | 'voter';
export type AnswerLayout = 'stacked' | 'side-by-side';

export interface AnswerChoiceOption {
  id: string;
  text: string;
  votes?: number;
  /** Optional label chip text (e.g. "A", "1"). Empty string = no chip. */
  label?: string;
}

interface SurfaceTokens {
  /** Container width for the pill list (px). */
  groupWidthPx: number;
  /** Default pill horizontal padding (px). */
  padX: number;
  /** Default pill vertical padding (px). */
  padY: number;
  /** Vertical gap between rows (px). */
  gap: number;
  /** Default font size (px). */
  fontSize: number;
}

function getSurfaceTokens(surface: AnswerSurface): SurfaceTokens {
  // Program tokens come straight from PGD so a single change there flows to
  // every program-side renderer. Mobile / Desktop are sized for the native
  // voter viewport (375×667 / 1280×800).
  if (surface === 'program') {
    return {
      groupWidthPx: (PGD.pollGraphicWidth * PGD.answerGroupWidthPercent) / 100,
      padX: 32,
      padY: PGD.answerButtonPaddingY,
      gap: PGD.answerGap,
      fontSize: PGD.answerFontSize,
    };
  }
  if (surface === 'mobile') {
    return { groupWidthPx: (375 * PGD.answerGroupWidthPercent) / 100, padX: 20, padY: 18, gap: PGD.answerSpacingVoter, fontSize: 16 };
  }
  return { groupWidthPx: (1280 * PGD.answerGroupWidthPercent) / 100, padX: 28, padY: 22, gap: PGD.answerSpacingVoter, fontSize: PGD.answerFontSizeVoter };
}

export interface AnswerChoicesProps {
  surface: AnswerSurface;
  variant: AnswerVariant;
  layout?: AnswerLayout;
  options: AnswerChoiceOption[];
  totalVotes?: number;
  /** Animation progress for `bars` variant (0 → 1). */
  progress?: number;
  /** Style overrides resolved from the active viewport's color slice. */
  style?: AssetColorConfig;
  /** Per-option fill color (used as bar fill for `bars`, button background
   *  for `voter`). Index-aligned with `options`. */
  optionColors?: string[];
  /** Text color for the choice label and percent. */
  textColor?: string;
  /** Secondary text color (vote count under the bar). */
  secondaryTextColor?: string;
}

export function AnswerChoices({
  surface,
  variant,
  layout = 'stacked',
  options,
  totalVotes = 0,
  progress = 1,
  style,
  optionColors,
  textColor,
  secondaryTextColor,
}: AnswerChoicesProps) {
  const tokens = getSurfaceTokens(surface);
  const padX = style?.barPaddingX ?? tokens.padX;
  const padY = style?.barPaddingY ?? tokens.padY;
  const radius = style?.barBorderRadius ?? PGD.answerBorderRadius;
  const explicitHeight = style?.barHeight;
  const labelColor = textColor ?? PGD.answerTextColor;
  const textAlign: 'left' | 'center' | 'right' =
    style?.textAlign ?? (PGD.answerTextAlign as 'left' | 'center' | 'right');

  // When the operator pins an explicit pill height, scale the font down so
  // text fits inside the constrained box. This makes the Bar Height slider
  // feel like a true continuous adjustment instead of jumping between
  // "natural" and "min content" states.
  const naturalContentHeight = tokens.fontSize + tokens.padY * 2;
  const effectiveFontSize = explicitHeight && explicitHeight < naturalContentHeight
    ? Math.max(10, Math.round(explicitHeight * 0.55))
    : tokens.fontSize;

  const containerStyle: CSSProperties = {
    width: `${tokens.groupWidthPx}px`,
    gap: `${tokens.gap}px`,
    textAlign,
  };

  const containerClass = layout === 'side-by-side' ? 'grid grid-cols-2' : 'flex flex-col';

  return (
    <div className={containerClass} style={containerStyle}>
      {options.map((option, i) => {
        const finalPct = totalVotes > 0 ? ((option.votes ?? 0) / totalVotes) * 100 : 0;
        const pct = finalPct * progress;
        const fill = optionColors?.[i];
        const buttonBg = variant === 'voter'
          ? (fill ?? PGD.answerButtonIdleBg)
          : PGD.answerButtonIdleBg;

        return (
          <div key={option.id} className={variant === 'bars' ? 'flex flex-col gap-2' : ''}>
            <div
              className="relative w-full overflow-hidden border"
              style={{
                background: buttonBg,
                borderColor: PGD.answerBorderColor,
                borderRadius: `${radius}px`,
                padding: explicitHeight
                  ? `0px ${padX}px`
                  : `${padY}px ${padX}px`,
                height: explicitHeight ? `${explicitHeight}px` : undefined,
                display: explicitHeight ? 'flex' : undefined,
                alignItems: explicitHeight ? 'center' : undefined,
                backdropFilter: 'blur(8px)',
              }}
            >
              {variant === 'bars' && (
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: fill ?? PGD.answerTextColor,
                    opacity: 0.35,
                    transition: 'width 0.5s ease-out',
                  }}
                />
              )}
              <div
                className="relative flex items-center gap-3"
                style={{
                  justifyContent:
                    variant === 'bars'
                      ? 'space-between'
                      : textAlign === 'center'
                        ? 'center'
                        : textAlign === 'right'
                          ? 'flex-end'
                          : 'flex-start',
                }}
              >
                {option.label ? (
                  <span
                    className="font-mono font-bold inline-flex items-center justify-center shrink-0 border"
                    style={{
                      color: labelColor,
                      fontSize: `${Math.round(effectiveFontSize * 0.7)}px`,
                      width: `${Math.round(effectiveFontSize * 1.6)}px`,
                      height: `${Math.round(effectiveFontSize * 1.6)}px`,
                      borderRadius: '6px',
                      borderColor: 'rgba(255,255,255,0.2)',
                      background: 'rgba(0,0,0,0.25)',
                    }}
                  >
                    {option.label}
                  </span>
                ) : null}
                <span
                  className={variant === 'bars' ? 'font-semibold' : 'font-medium'}
                  style={{
                    color: labelColor,
                    fontSize: `${effectiveFontSize}px`,
                    flex: variant === 'bars' || textAlign === 'left' ? 1 : undefined,
                    textAlign,
                  }}
                >
                  {option.text || (variant === 'voter' ? 'Answer' : '')}
                </span>
                {variant === 'bars' && (
                  <span
                    className="font-bold font-mono tabular-nums"
                    style={{ color: labelColor, fontSize: `${effectiveFontSize}px` }}
                  >
                    {Math.round(pct)}%
                  </span>
                )}
              </div>
            </div>
            {variant === 'bars' && (
              <span
                className="font-mono"
                style={{ color: secondaryTextColor ?? PGD.answerTextColor, fontSize: '22px', opacity: 0.75, paddingLeft: '12px' }}
              >
                {Math.round((option.votes ?? 0) * progress).toLocaleString()} votes
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
