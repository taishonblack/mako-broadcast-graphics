import { PollOption } from '@/lib/types';

/**
 * Operator-controlled typography for the polling slate. Drives the headline
 * text rendered in the slate (both in operator previews and in the real
 * viewer page when the slate is active).
 */
export interface SlateTextStyle {
  /** CSS color string. Falls back to the design system foreground. */
  color?: string;
  /** Tailwind-compatible numeric font weight (300–900). */
  weight?: number;
  /** Headline font-size in px (rendered at native viewport scale). */
  sizePx?: number;
  /** Horizontal nudge in px (positive = right). Applied to the slate stack. */
  offsetX?: number;
  /** Vertical nudge in px (positive = down). Applied to the slate stack. */
  offsetY?: number;
}

export const DEFAULT_SLATE_TEXT_STYLE: Required<SlateTextStyle> = {
  color: '#ffffff',
  weight: 700,
  sizePx: 28,
  offsetX: 0,
  offsetY: 0,
};

/**
 * Default typography for the slate's subline ("Stay tuned…"). Lighter weight +
 * smaller size than the headline, but operators can override per-poll if the
 * subline needs to read against a busy background.
 */
export const DEFAULT_SLATE_SUBLINE_STYLE: Required<SlateTextStyle> = {
  color: '#e5e7eb',
  weight: 500,
  sizePx: 16,
  offsetX: 0,
  offsetY: 0,
};

export const DEFAULT_SLATE_SUBLINE_TEXT = '';

export interface ViewerSlatePreviewProps {
  mode: 'mobile' | 'desktop';
  bgImage?: string;
  bgColor?: string;
  slateActive: boolean;
  slateText: string;
  slateImage?: string;
  /** Optional typography overrides for the slate headline. */
  textStyle?: SlateTextStyle;
  /** Optional override for the subline ("Stay tuned …") text. */
  sublineText?: string;
  /** Optional typography overrides for the slate subline. */
  sublineStyle?: SlateTextStyle;
  /** Optional explicit frame size — defaults are tuned for the operator workspace. */
  frameWidth?: number;
  frameHeight?: number;
  /** When 'open', render the actual voting UI (question + answer buttons) instead of the slate. */
  votingOpen?: boolean;
  /** Poll question + options, used when voting is open. */
  question?: string;
  options?: PollOption[];
}

/**
 * Faithful preview of the real QR viewer's "polling slate" page. Renders the
 * actual ViewerVote slate layout (Clock icon, "Voting Will Begin Shortly",
 * subline, BrandBug) at native viewport resolution inside a scaled device
 * frame so safe-area, padding, and proportions match exactly what voters see.
 *
 * Shared between Build (DraftPreviewMonitor) and Output (OperatorOutputMode)
 * so both surfaces show the same picture for a given poll.
 *
 * - Mobile: 375 × 667 (iPhone SE viewport)
 * - Desktop: 1280 × 800 (laptop viewport)
 */
export function ViewerSlatePreview({
  mode,
  bgImage,
  bgColor,
  slateActive,
  slateText,
  slateImage,
  textStyle,
  sublineText,
  sublineStyle,
  frameWidth,
  frameHeight,
  votingOpen = false,
  question,
  options,
}: ViewerSlatePreviewProps) {
  const NATIVE_W = mode === 'mobile' ? 375 : 1280;
  const NATIVE_H = mode === 'mobile' ? 667 : 800;

  const FRAME_W = frameWidth ?? (mode === 'mobile' ? 280 : 560);
  const FRAME_H = frameHeight ?? (mode === 'mobile' ? 498 : 350);
  const scale = Math.min(FRAME_W / NATIVE_W, FRAME_H / NATIVE_H);

  const bgStyle: React.CSSProperties = bgImage
    ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: bgColor || 'hsl(220, 20%, 7%)' };

  const style = { ...DEFAULT_SLATE_TEXT_STYLE, ...textStyle };
  const sub = { ...DEFAULT_SLATE_SUBLINE_STYLE, ...sublineStyle };
  const subText = sublineText ?? DEFAULT_SLATE_SUBLINE_TEXT;

  // What's on screen?
  // 1. Voting open → actual answer buttons
  // 2. Slate active with custom text → show that text only (no extra copy)
  // 3. Otherwise → MakoVote wordmark over background
  const hasSlateText = slateActive && (slateText.trim().length > 0 || Boolean(slateImage));
  const showVoting = votingOpen && options && options.length > 0;

  return (
    <div
      className="bg-background border border-border rounded-lg overflow-hidden shadow-xl"
      style={{ width: FRAME_W, height: FRAME_H + 24 }}
    >
      <div className="h-6 bg-card/80 border-b border-border flex items-center px-2 gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-destructive/60" />
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
        <span className="text-[8px] text-muted-foreground ml-1 font-mono truncate">makovote.app/vote</span>
      </div>

      <div className="relative overflow-hidden" style={{ width: FRAME_W, height: FRAME_H }}>
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: NATIVE_W, height: NATIVE_H, transform: `scale(${scale})` }}
        >
          <div className="absolute inset-0" style={bgStyle} />
          {bgImage && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)' }}
            />
          )}

          {showVoting ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-8 gap-6">
              {question && (
                <h1
                  className="text-center leading-tight"
                  style={{ color: '#ffffff', fontWeight: 700, fontSize: mode === 'mobile' ? 28 : 40, maxWidth: '90%' }}
                >
                  {question}
                </h1>
              )}
              <div className="w-full max-w-[420px] space-y-3">
                {options!.map((opt) => (
                  <div
                    key={opt.id}
                    className="w-full p-4 rounded-2xl text-center font-medium border border-white/15"
                    style={{ background: 'hsla(220, 18%, 13%, 0.85)', backdropFilter: 'blur(8px)', color: '#ffffff' }}
                  >
                    <span style={{ fontSize: mode === 'mobile' ? 16 : 20 }}>{opt.text || 'Answer'}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : hasSlateText ? (
            <div
              className="absolute inset-0 flex items-center justify-center px-6"
              style={{ transform: `translate(${style.offsetX}px, ${style.offsetY}px)` }}
            >
              <div className="text-center space-y-4 flex flex-col items-center">
                {slateImage && (
                  <img
                    src={slateImage}
                    alt="Polling slate"
                    className="max-h-[280px] max-w-[80%] object-contain rounded-lg border border-border/40"
                  />
                )}
                {slateText.trim().length > 0 && (
                  <h1
                    className="leading-tight"
                    style={{ color: style.color, fontWeight: style.weight, fontSize: `${style.sizePx}px` }}
                  >
                    {slateText}
                  </h1>
                )}
                {subText.trim().length > 0 && (
                  <p
                    className="leading-snug"
                    style={{
                      color: sub.color,
                      fontWeight: sub.weight,
                      fontSize: `${sub.sizePx}px`,
                      transform: `translate(${sub.offsetX}px, ${sub.offsetY}px)`,
                    }}
                  >
                    {subText}
                  </p>
                )}
              </div>
            </div>
          ) : (
            // Default holding screen: MakoVote wordmark over the background.
            <div className="absolute inset-0 flex items-center justify-center select-none">
              <div className="flex items-baseline leading-none" style={{ fontWeight: 700, letterSpacing: '0.02em' }}>
                <span style={{ color: '#ffffff', fontSize: mode === 'mobile' ? 56 : 96, opacity: 0.92, textShadow: '0 8px 32px rgba(0,0,0,0.45)' }}>Mako</span>
                <span style={{ color: 'hsl(24, 95%, 53%)', fontSize: mode === 'mobile' ? 56 : 96, textShadow: '0 8px 32px rgba(0,0,0,0.45)' }}>Vote</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}