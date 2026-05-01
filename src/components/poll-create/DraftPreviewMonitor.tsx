import { useEffect, useRef, useState } from 'react';
import { PreviewWithOverlays } from '@/components/broadcast/preview/PreviewWithOverlays';
import { LowerThirdScene } from '@/components/broadcast/scenes/LowerThirdScene';
import { FullscreenScene } from '@/components/broadcast/scenes/FullscreenScene';
import { ResultsScene } from '@/components/broadcast/scenes/ResultsScene';
import type { SceneType } from '@/lib/scenes';
import {
  ViewerSlatePreview,
  SlateTextStyle,
} from '@/components/broadcast/preview/ViewerSlatePreview';
import { PollOption, TemplateName, ThemePreset } from '@/lib/types';
import { Monitor, Smartphone, Globe, Copy, Link2, Check, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { AnswerType, MCLabelStyle, PreviewDataMode, getMCLabel } from './ContentPanel';
import { AssetColorMap, AssetId, AssetState, AssetTransformMap } from './polling-assets/types';
import { QRPosition } from '@/lib/types';
import { WordmarkLockup } from '@/components/broadcast/WordmarkLockup';
import { usePreviewOverlays } from '@/lib/preview-overlays';
import { useViewerStateDrift } from '@/hooks/useViewerStateDrift';

export type PreviewMode = 'program' | 'mobile' | 'desktop';

interface AnswerItem {
  id: string; text: string; shortLabel: string; testVotes?: number;
}

interface DraftPreviewMonitorProps {
  question: string;
  subheadline: string;
  options: PollOption[];
  totalVotes: number;
  colors: string[];
  template: TemplateName;
  theme: ThemePreset;
  hasContent: boolean;
  answerType: AnswerType;
  mcLabelStyle: MCLabelStyle;
  previewDataMode: PreviewDataMode;
  answers: AnswerItem[];
  bgColor: string;
  bgImage?: string;
  slug: string;
  fullUrl: string;
  shortUrl: string;
  wordmark: Pick<AssetState, 'wordmarkWeight' | 'wordmarkTracking' | 'wordmarkScale' | 'wordmarkShowGuides'>;
  qrSize: number;
  qrPosition: QRPosition;
  showBranding: boolean;
  brandingPosition: QRPosition;
  enabledAssetIds: AssetId[];
  transforms: AssetTransformMap;
  assetColors: AssetColorMap;
  qrVisible: boolean;
  qrUrlVisible: boolean;
  /** Whether this voter URL is currently published live (voting open/closed
   *  with active poll). Drives the "Live voter link" vs "Draft link" label. */
  isLive?: boolean;
  /** The viewer slug currently published to viewers (read from
   *  `project_live_state.live_slug`). When this differs from the draft `slug`
   *  prop while live, we render a "Slug changed — Go Live again" warning so
   *  the operator can see at a glance that their edit isn't on-air. */
  liveSlug?: string | null;
  /** Project id, used by the audience-drift watcher to compare
   *  public_viewer_state vs project_live_state. */
  projectId?: string | null;
  /** Active broadcast scene template. When set, the program preview
   *  switches between Fullscreen / Results / Lower Third so Build mirrors
   *  exactly what Output renders for the same scene. */
  previewScene?: SceneType;
  /** Results playback config — forwarded to ResultsScene so the animated
   *  reveal in Build matches Output. */
  resultsMode?: 'animated' | 'static';
  resultsAnimationMs?: number;
  resultsReplayKey?: number;
  /** When provided, the preview-mode tabs become controlled. Lets the parent
   *  keep the editing viewport (Program / Mobile / Desktop) in sync with the
   *  transform inspector. */
  previewMode?: PreviewMode;
  onPreviewModeChange?: (mode: PreviewMode) => void;
  /** Optional slate preview overrides — when wired, the mobile/desktop preview
   *  uses the same ViewerSlatePreview as Output so backgrounds + slate
   *  typography render identically across surfaces. */
  slateActive?: boolean;
  slateText?: string;
  slateImage?: string;
  slateTextStyle?: SlateTextStyle;
  slateSublineText?: string;
  slateSublineStyle?: SlateTextStyle;
  /** Optional title label for the preview header. When set, replaces the
   *  default "Test Data"/"Real Data" copy — operators expect the header to
   *  read as the active folder name (e.g. "1st Com") so it's obvious which
   *  folder is being previewed. */
  folderLabel?: string;
}

/**
 * Resolve the visible label to use for an option. For MC with letters/numbers
 * we override; for custom MC or other types we fall back to shortLabel/text.
 */
function resolveOptionLabels(
  options: PollOption[],
  answerType: AnswerType,
  mcLabelStyle: MCLabelStyle,
  answers: AnswerItem[],
): PollOption[] {
  if (answerType !== 'multiple-choice') return options;
  return options.map((opt, i) => ({
    ...opt,
    shortLabel: getMCLabel(i, mcLabelStyle, answers[i]?.shortLabel),
  }));
}

export function DraftPreviewMonitor({
  question, subheadline, options, totalVotes, colors, template, theme, hasContent,
  answerType, mcLabelStyle, previewDataMode, answers, bgColor, bgImage, fullUrl, shortUrl, wordmark,
  slug,
  qrSize, qrPosition, showBranding, brandingPosition, enabledAssetIds, transforms, assetColors, qrVisible,
  qrUrlVisible,
  previewMode: previewModeProp,
  onPreviewModeChange,
  previewScene,
  resultsMode,
  resultsAnimationMs,
  resultsReplayKey,
  slateActive = false,
  slateText = '',
  slateImage,
  slateTextStyle,
  slateSublineText,
  slateSublineStyle,
  folderLabel,
  isLive = false,
  liveSlug = null,
  projectId = null,
}: DraftPreviewMonitorProps) {
  const [previewModeUncontrolled, setPreviewModeUncontrolled] = useState<PreviewMode>('program');
  const previewMode = previewModeProp ?? previewModeUncontrolled;
  const setPreviewMode = (mode: PreviewMode) => {
    if (onPreviewModeChange) onPreviewModeChange(mode);
    else setPreviewModeUncontrolled(mode);
  };
  const [copied, setCopied] = useState<'full' | 'short' | null>(null);
  const overlayApiRef = useRef<ReturnType<typeof usePreviewOverlays> | null>(null);

  const labelledOptions = resolveOptionLabels(options, answerType, mcLabelStyle, answers);
  const isLowerThird = template === 'lower-third';
  const voteUrl = `https://makovote.app/vote/${slug}`;

  useEffect(() => {
    const api = overlayApiRef.current;
    if (!api) return;
    api.update('titleSafe', wordmark.wordmarkShowGuides);
    api.update('actionSafe', wordmark.wordmarkShowGuides);
    api.update('centerCrosshair', wordmark.wordmarkShowGuides);
    api.update('snap', wordmark.wordmarkShowGuides);
  }, [wordmark.wordmarkShowGuides]);

  const copyUrl = (url: string, kind: 'full' | 'short') => {
    navigator.clipboard?.writeText(url);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

  // ---- BROADCAST PROGRAM CONTENT ----
  const renderProgramContent = () => {
    if (!hasContent) {
      return (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${theme.tintColor}, hsl(220, 25%, 6%))`,
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)',
            }}
          />
          <WordmarkLockup
            theme={theme}
            weight={wordmark.wordmarkWeight}
            tracking={wordmark.wordmarkTracking}
            scale={wordmark.wordmarkScale}
            showGuides={wordmark.wordmarkShowGuides}
          />
        </div>
      );
    }

    // Real Mode + zero votes = zero-state for chart area, but layout still rendered
    const isZeroState = previewDataMode === 'real' && totalVotes === 0;

    const bgStyle: React.CSSProperties = bgImage
      ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { background: `linear-gradient(135deg, ${bgColor || theme.tintColor}, hsla(220, 20%, 8%, 0.95))` };

    if (isLowerThird || previewScene === 'lowerThird') {
      return (
        <div className="absolute inset-0" style={bgStyle}>
          <LowerThirdScene
            question={question}
            options={labelledOptions}
            totalVotes={totalVotes}
            colors={colors}
            theme={theme}
            template={template}
            slug={slug}
            qrSize={qrSize}
            qrPosition={qrPosition}
            qrVisible={qrVisible}
            qrUrlVisible={qrUrlVisible}
            showBranding={showBranding}
            brandingPosition={brandingPosition}
            enabledAssetIds={enabledAssetIds}
            transforms={transforms}
            assetColors={assetColors}
            debugVoteUrl={voteUrl}
            bgImage={bgImage}
            bgColor={bgColor}
          />
        </div>
      );
    }

    // Results scene (Scene 2): mirror Output by rendering ResultsScene.
    // Without this branch Build would draw the Voting (Fullscreen) scene
    // even when the operator selected Results, so Program preview drifted
    // away from what Output actually airs.
    if (previewScene === 'results' && !isZeroState) {
      return (
        <div className="absolute inset-0" style={bgImage ? bgStyle : undefined}>
          <ResultsScene
            question={question}
            options={labelledOptions}
            totalVotes={totalVotes}
            colors={colors}
            theme={theme}
            slug={slug}
            qrSize={qrSize}
            qrPosition={qrPosition}
            qrVisible={qrVisible}
            qrUrlVisible={qrUrlVisible}
            showBranding={showBranding}
            brandingPosition={brandingPosition}
            enabledAssetIds={enabledAssetIds}
            transforms={transforms}
            assetColors={assetColors}
            resultsMode={resultsMode}
            resultsAnimationMs={resultsAnimationMs}
            resultsReplayKey={resultsReplayKey}
            debugVoteUrl={voteUrl}
            bgImage={bgImage}
            bgColor={bgColor}
          />
        </div>
      );
    }

    // True broadcast composition: render the same FullscreenScene used on-air.
    // Background image (if any) is layered behind so the operator sees the actual
    // poll graphic at full broadcast scale — no centered "demo" composition.
    return (
      <div className="absolute inset-0" style={bgImage ? bgStyle : undefined}>
        {isZeroState ? (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${bgColor || theme.tintColor}, hsl(220, 25%, 6%))` }}>
            <div className="text-center space-y-2">
              <p className="font-mono uppercase tracking-wider opacity-70" style={{ color: theme.textSecondary, fontSize: '40px' }}>
                Awaiting live votes
              </p>
              <p className="opacity-50" style={{ color: theme.textSecondary, fontSize: '24px' }}>
                Switch to Test Mode to simulate vote counts
              </p>
            </div>
          </div>
        ) : (
          <FullscreenScene
            question={question}
            options={labelledOptions}
            totalVotes={totalVotes}
            colors={colors}
            theme={theme}
            template={template}
            slug={slug}
            qrSize={qrSize}
            qrPosition={qrPosition}
            qrVisible={qrVisible}
            qrUrlVisible={qrUrlVisible}
            showBranding={showBranding}
            brandingPosition={brandingPosition}
            enabledAssetIds={enabledAssetIds}
            transforms={transforms}
            assetColors={assetColors}
            debugVoteUrl={voteUrl}
            bgImage={bgImage}
            bgColor={bgColor}
          />
        )}
      </div>
    );
  };

  const modeButtons: { mode: PreviewMode; icon: typeof Monitor; label: string; tooltip: string }[] = [
    { mode: 'program', icon: Monitor, label: 'Program', tooltip: 'Broadcast Output — what goes to air' },
    { mode: 'mobile', icon: Smartphone, label: 'Mobile', tooltip: 'Viewer Mobile — what audiences see on phone' },
    { mode: 'desktop', icon: Globe, label: 'Desktop', tooltip: 'Viewer Desktop — what audiences see in browser' },
  ];

  // Title reflects the active folder so the operator knows which set of
  // assets is being previewed. Falls back to the data lens (Test / Real)
  // when no folder context is available.
  const previewLabel = folderLabel ?? (previewDataMode === 'test' ? 'Test Data' : 'Real Data');

  return (
    <div className="flex flex-col">
      {/* Mode toggles */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">{previewLabel}</h2>
        </div>
        <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
          {modeButtons.map(({ mode, icon: Icon, label, tooltip }) => (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setPreviewMode(mode)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                    previewMode === mode
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{tooltip}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Preview area — tightened to lift monitor toward the header */}
      <div className="flex flex-col items-center justify-start pt-2 px-4 pb-2 bg-background/30 min-h-0 overflow-auto gap-2">
        {previewMode === 'program' ? (
          <PreviewWithOverlays showLabel label="1920×1080" onApiReady={(api) => { overlayApiRef.current = api; }}>
            {renderProgramContent()}
          </PreviewWithOverlays>
        ) : (
          // When the poll has no content yet, show the same Polling Slate
          // mock that Output renders so operators see the background + logo
          // exactly as a real voter would. Once question/answers exist, fall
          // back to the interactive voter buttons (Y/N, MC, custom) inside a
          // browser frame so the operator can verify tap targets too.
          // Mirror Output's viewer mock so backgrounds + slate typography read
          // identically across surfaces. When the slate is active or there is
          // no content yet, render the slate; otherwise render the interactive
          // voter buttons inside the same scaled device frame so tap targets
          // can be sanity-checked too.
          // Mirror Mode: folder excludes the answers asset but still has
          // question/qr/etc. We render question + QR (matching Program)
          // instead of the voter buttons, so Mobile/Desktop look identical
          // to the on-air composition.
          // Single source of truth for Mobile/Desktop voter previews:
          // ViewerSlatePreview handles slate, voting, and MakoVote fallback
          // identically to Output Mode — guarantees Build and Output match.
          <ViewerSlatePreview
            mode={previewMode}
            bgImage={bgImage}
            bgColor={bgColor}
            slateActive={slateActive}
            slateText={slateText}
            slateImage={slateImage}
            textStyle={slateTextStyle}
            sublineText={slateSublineText}
            sublineStyle={slateSublineStyle}
            votingOpen={hasContent && enabledAssetIds.includes('answerType')}
            question={question}
            subheadline={subheadline}
            options={labelledOptions}
            answerType={answerType}
            mcLabelStyle={mcLabelStyle}
            enabledAssetIds={enabledAssetIds}
            slug={slug}
            assetColors={assetColors}
            transforms={transforms}
          />
        )}

        {/* URL display beneath preview */}
        <div className="w-full max-w-[880px] space-y-1.5">
          {isLive && liveSlug && liveSlug !== slug && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-mako-warning/10 border border-mako-warning/40 text-mako-warning">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase tracking-wider font-semibold leading-tight">
                  Slug changed — not live
                </span>
                <span className="text-[10px] font-mono text-foreground/80 truncate">
                  Live: /vote/{liveSlug} · Draft: /vote/{slug}
                </span>
              </div>
            </div>
          )}
          <div className="flex items-stretch gap-2">
            <div className="shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-md bg-white border border-border">
              <QRCodeSVG value={fullUrl} size={56} level="M" />
              <span
                className={`text-[8px] font-mono uppercase tracking-wider leading-none ${
                  isLive ? 'text-mako-success' : 'text-muted-foreground'
                }`}
              >
                {isLive ? 'Live' : 'Draft'}
              </span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-card/50 border border-border flex-1 min-w-0">
              <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
              <div className="flex flex-col min-w-0 flex-1">
                <span
                  className={`text-[9px] uppercase tracking-wider font-mono leading-none ${
                    isLive ? 'text-mako-success' : 'text-muted-foreground/80'
                  }`}
                >
                  {isLive ? 'Live voter link' : 'Draft link — not live yet'}
                </span>
                <span className="text-[10px] font-mono text-foreground truncate" title={fullUrl}>{fullUrl}</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => copyUrl(fullUrl, 'full')}
                    className="h-6 px-1.5 text-[10px]"
                  >
                    {copied === 'full' ? <Check className="w-3 h-3 text-mako-success" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy full poll URL</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-muted/30 border border-border/50">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-mono">Short</span>
            <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">{shortUrl}</span>
            <Button
              variant="ghost" size="sm"
              onClick={() => copyUrl(shortUrl, 'short')}
              className="h-5 px-1 text-[10px]"
            >
              {copied === 'short' ? <Check className="w-3 h-3 text-mako-success" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}