import { PollOption } from '@/lib/types';
import { AssetColorMap, AssetTransformMap } from '@/components/poll-create/polling-assets/types';
import { getAssetTransformStyle } from '@/lib/asset-transforms';

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
  /** Folder asset toggles. Drives Mirror Mode: when `answers` is not in the
   *  enabled list but `question` or `qr` is, the mobile/desktop preview
   *  renders the question + QR (matching Program) instead of the answer
   *  buttons. Mirrors the real viewer's `isMirrorMode` branch so the three
   *  surfaces (Build, Output, real Viewer) stay visually identical. */
  enabledAssetIds?: string[];
  /** Subheadline text mirrored from Program. */
  subheadline?: string;
  /** Slug used to render the Mirror Mode QR (defaults to the current page). */
  slug?: string;
  /** Per-asset color overrides authored in Build. Drives question /
   *  subheadline / answer text colors so Mobile + Desktop previews match
   *  the operator's color picks (instead of always-white). */
  assetColors?: AssetColorMap;
  /** Per-asset transform overrides (translate / scale / rotate / opacity /
   *  crop) for the *active* viewport. The voter previews apply these to
   *  question, subheadline, and answers blocks so the operator's mobile /
   *  desktop nudges in Build are reflected here in real time. Without this
   *  the preview would render at the canonical zero-transform position
   *  regardless of slider edits. */
  transforms?: AssetTransformMap;
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
  enabledAssetIds,
  subheadline,
  slug,
  assetColors,
  transforms,
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
  // Folder render rules (Build → Mobile/Desktop, Output → Mobile/Desktop):
  //
  // - QR-folder      (folder contains `qr`):  Program shows QR-only; here on
  //   mobile/desktop we render the actual vote-input buttons (Yes/No or
  //   multiple choice). The QR itself is **never** drawn on mobile/desktop —
  //   the device IS the QR destination.
  // - Bars-folder    (folder contains `answers` but NOT `qr`): Program shows
  //   live bars; mobile/desktop show the MakoVote wordmark (no polling UI
  //   to interact with — viewers are just watching results).
  // - Other          (text/branding only): MakoVote wordmark fallback.
  const enabledList = Array.isArray(enabledAssetIds) ? enabledAssetIds : null;
  const folderHasQR = enabledList ? enabledList.includes('qr') : false;
  const folderHasAnswerType = enabledList ? enabledList.includes('answerType') : false;
  const folderHasAnswers = enabledList ? enabledList.includes('answers') : true;
  // Mobile/Desktop show the vote-input buttons whenever the folder is set
  // up to collect votes — that's any folder with `qr` or `answerType`. A
  // folder with only `answers` (bars graphic) is "results display only" and
  // should fall through to the MakoVote wordmark.
  const folderCollectsVotes = folderHasQR || folderHasAnswerType;
  // Slate always wins. When the operator forces the slate (Test Viewer View
  // or "Start Slate Now"), hide the answer-types entirely so mobile/desktop
  // mirror what voters would actually see during a slate hold.
  const showVoting =
    !slateActive &&
    (votingOpen || folderCollectsVotes) &&
    folderCollectsVotes &&
    options &&
    options.length > 0;

  // Resolve colors from the active viewport's asset color map. Falls back to
  // the previous hard-coded white / light-gray values so existing previews
  // keep working when no overrides are set.
  const questionColor = assetColors?.question?.textPrimary ?? '#ffffff';
  const subheadlineColor = assetColors?.subheadline?.textPrimary ?? '#e5e7eb';
  // Voter button styling reads from the dedicated `answerType` asset so the
  // operator can theme the on-device buttons independently of the broadcast
  // results bars (`answers`). Falls back to `answers` colors, then defaults.
  const answerColor =
    assetColors?.answerType?.textPrimary ?? assetColors?.answers?.textPrimary ?? '#ffffff';
  const answerBarColors =
    assetColors?.answerType?.barColors ?? assetColors?.answers?.barColors ?? [];

  // Per-asset transform styles. Computed once per render so each block can
  // be translated / scaled / rotated independently of the others, matching
  // how the inspector's per-asset sliders behave in Program.
  const questionTransformStyle = getAssetTransformStyle(transforms?.question);
  const subheadlineTransformStyle = getAssetTransformStyle(transforms?.subheadline);
  // Voter button group reads from `answerType` transform (falls back to
  // `answers` for legacy polls authored before the split).
  const answersTransformStyle = getAssetTransformStyle(transforms?.answerType ?? transforms?.answers);

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
                  style={{ color: questionColor, fontWeight: 700, fontSize: mode === 'mobile' ? 28 : 40, maxWidth: '90%', ...questionTransformStyle }}
                >
                  {question}
                </h1>
              )}
              {subheadline && (
                <p
                  className="text-center"
                  style={{ color: subheadlineColor, fontSize: mode === 'mobile' ? 14 : 18, maxWidth: '85%', ...subheadlineTransformStyle }}
                >
                  {subheadline}
                </p>
              )}
              {(() => {
                // 2 options → side-by-side (Yes/No). >2 → stacked (MC).
                // Operators get consistent layout regardless of which scene
                // surfaces the voter buttons.
                const sideBySide = (options?.length ?? 0) === 2;
                return (
                  <div
                    className={
                      sideBySide
                        ? 'w-full max-w-[420px] grid grid-cols-2 gap-3'
                        : 'w-full max-w-[420px] space-y-3'
                    }
                    style={answersTransformStyle}
                  >
                    {options!.map((opt, i) => (
                      <div
                        key={opt.id}
                        className={
                          sideBySide
                            ? 'p-4 rounded-2xl text-center font-bold border border-white/15'
                            : 'w-full p-4 rounded-2xl text-center font-medium border border-white/15'
                        }
                        style={{ background: answerBarColors[i] ?? 'hsla(220, 18%, 13%, 0.85)', backdropFilter: 'blur(8px)', color: answerColor }}
                      >
                        <span style={{ fontSize: mode === 'mobile' ? 16 : 20, color: answerColor }}>{opt.text || 'Answer'}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
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