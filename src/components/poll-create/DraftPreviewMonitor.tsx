import { useState } from 'react';
import { BroadcastPreviewFrame } from '@/components/broadcast/BroadcastPreviewFrame';
import { LowerThirdScene } from '@/components/broadcast/scenes/LowerThirdScene';
import { FullscreenScene } from '@/components/broadcast/scenes/FullscreenScene';
import { PollOption, TemplateName, ThemePreset } from '@/lib/types';
import { Monitor, Smartphone, Globe, Copy, Link2, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { AnswerType, MCLabelStyle, PreviewDataMode, getMCLabel } from './ContentPanel';

type PreviewMode = 'program' | 'mobile' | 'desktop';

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
  fullUrl: string;
  shortUrl: string;
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

function FullFrameChart({
  template, options, totalVotes, colors,
}: {
  template: TemplateName; options: PollOption[]; totalVotes: number; colors: string[];
}) {
  // Each chart gets a generously sized container so it fills the broadcast frame.
  switch (template) {
    case 'vertical-bar':
      return (
        <div className="w-full h-full flex items-center justify-center px-12">
          <div className="w-full max-w-3xl h-3/4">
            <VerticalBarChart options={options} totalVotes={totalVotes} colors={colors} />
          </div>
        </div>
      );
    case 'pie-donut':
      return (
        <div className="w-full h-full flex items-center justify-center">
          <DonutChart options={options} totalVotes={totalVotes} colors={colors} size={320} />
        </div>
      );
    case 'progress-bar':
      return (
        <div className="w-full h-full flex items-center justify-center px-16">
          <div className="w-full max-w-3xl">
            <HorizontalBarChart options={options} totalVotes={totalVotes} colors={colors} showPercent />
          </div>
        </div>
      );
    case 'puck-slider':
      return (
        <div className="w-full h-full flex items-center justify-center px-16">
          <div className="w-full max-w-3xl">
            <PuckSlider options={options} totalVotes={totalVotes} colors={colors} />
          </div>
        </div>
      );
    case 'horizontal-bar':
    default:
      return (
        <div className="w-full h-full flex items-center justify-center px-16">
          <div className="w-full max-w-3xl">
            <HorizontalBarChart options={options} totalVotes={totalVotes} colors={colors} showPercent showVotes />
          </div>
        </div>
      );
  }
}

export function DraftPreviewMonitor({
  question, subheadline, options, totalVotes, colors, template, theme, hasContent,
  answerType, mcLabelStyle, previewDataMode, answers, bgColor, bgImage, fullUrl, shortUrl,
}: DraftPreviewMonitorProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('program');
  const [copied, setCopied] = useState<'full' | 'short' | null>(null);

  const labelledOptions = resolveOptionLabels(options, answerType, mcLabelStyle, answers);
  const isLowerThird = template === 'lower-third';

  const copyUrl = (url: string, kind: 'full' | 'short') => {
    navigator.clipboard?.writeText(url);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

  // ---- BROADCAST PROGRAM CONTENT ----
  const renderProgramContent = () => {
    if (!hasContent) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="text-center space-y-2">
            <p className="text-lg font-bold text-primary font-mono tracking-wider">MakoVote</p>
            <p className="text-[10px] text-muted-foreground">Start building your poll to see a preview</p>
          </div>
        </div>
      );
    }

    // Real Mode + zero votes = zero-state for chart area, but layout still rendered
    const isZeroState = previewDataMode === 'real' && totalVotes === 0;

    const bgStyle: React.CSSProperties = bgImage
      ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { background: `linear-gradient(135deg, ${bgColor || theme.tintColor}, hsla(220, 20%, 8%, 0.95))` };

    if (isLowerThird) {
      return (
        <div className="absolute inset-0" style={bgStyle}>
          <LowerThirdScene
            question={question}
            options={labelledOptions}
            totalVotes={totalVotes}
            colors={colors}
            theme={theme}
            template={template}
          />
        </div>
      );
    }

    // Full-frame composition: Question + subheadline at top, chart filling remaining frame
    return (
      <div className="absolute inset-0 flex flex-col" style={bgStyle}>
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          <div className="text-center space-y-1.5 mb-4">
            <h1 className="text-3xl font-bold leading-tight" style={{ color: theme.textPrimary }}>
              {question}
            </h1>
            {subheadline && (
              <p className="text-base font-medium opacity-80" style={{ color: theme.textSecondary }}>
                {subheadline}
              </p>
            )}
          </div>
          <div className="flex-1 min-h-0">
            {isZeroState ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center space-y-1">
                  <p className="text-sm font-mono uppercase tracking-wider opacity-60" style={{ color: theme.textSecondary }}>
                    Awaiting live votes
                  </p>
                  <p className="text-xs opacity-40" style={{ color: theme.textSecondary }}>
                    Switch to Test Mode to simulate vote counts
                  </p>
                </div>
              </div>
            ) : (
              <FullFrameChart template={template} options={labelledOptions} totalVotes={totalVotes} colors={colors} />
            )}
          </div>
        </div>
      </div>
    );
  };

  // ---- VIEWER (mobile/desktop) CONTENT — reflects answerType ----
  const renderViewerButtons = () => {
    if (!hasContent) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
          Voter view preview
        </div>
      );
    }

    if (answerType === 'yes-no') {
      return (
        <div className="space-y-4">
          <div className="text-center space-y-1.5">
            <h2 className="text-base font-bold text-foreground">{question}</h2>
            {subheadline && <p className="text-xs text-muted-foreground">{subheadline}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button className="py-6 rounded-2xl bg-primary/10 border border-primary/40 hover:bg-primary/20 transition-colors text-base font-bold text-foreground">
              YES
            </button>
            <button className="py-6 rounded-2xl bg-muted/40 border border-border hover:bg-muted/60 transition-colors text-base font-bold text-foreground">
              NO
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="text-center space-y-1.5">
          <h2 className="text-base font-bold text-foreground">{question}</h2>
          {subheadline && <p className="text-xs text-muted-foreground">{subheadline}</p>}
        </div>
        <div className="space-y-2">
          {labelledOptions.map((opt, i) => {
            const showLabelChip = answerType === 'multiple-choice';
            const buttonText = answerType === 'custom'
              ? (opt.text || `Answer ${i + 1}`)
              : (opt.text || `Answer ${i + 1}`);
            return (
              <button
                key={opt.id}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left text-sm text-foreground bg-card/50"
              >
                {showLabelChip && (
                  <span className="w-7 h-7 rounded-md bg-primary/15 text-primary font-mono text-xs font-bold flex items-center justify-center shrink-0">
                    {opt.shortLabel}
                  </span>
                )}
                <span className="flex-1">{buttonText}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const modeButtons: { mode: PreviewMode; icon: typeof Monitor; label: string; tooltip: string }[] = [
    { mode: 'program', icon: Monitor, label: 'Program', tooltip: 'Broadcast Output — what goes to air' },
    { mode: 'mobile', icon: Smartphone, label: 'Mobile', tooltip: 'Viewer Mobile — what audiences see on phone' },
    { mode: 'desktop', icon: Globe, label: 'Desktop', tooltip: 'Viewer Desktop — what audiences see in browser' },
  ];

  const previewLabel = previewMode === 'program' ? 'Broadcast Preview' : 'Viewer Preview';

  return (
    <div className="flex flex-col h-full">
      {/* Mode toggles */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">{previewLabel}</h2>
          {previewDataMode === 'test' && (
            <span className="mako-chip text-[9px] bg-primary/15 text-primary border border-primary/30">Test Data</span>
          )}
          {previewDataMode === 'real' && (
            <span className="mako-chip text-[9px] bg-muted/40 text-muted-foreground border border-border">Real Data</span>
          )}
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
      <div className="flex-1 flex flex-col items-center justify-start pt-2 px-4 pb-4 bg-background/30 min-h-0 overflow-auto gap-2">
        {previewMode === 'program' ? (
          <MonitorContainer variant="draft">
            <BroadcastPreviewFrame showLabel>
              {renderProgramContent()}
            </BroadcastPreviewFrame>
          </MonitorContainer>
        ) : (
          <div className={`bg-background border border-border rounded-lg overflow-hidden shadow-xl ${
            previewMode === 'mobile' ? 'w-[280px] h-[500px]' : 'w-full max-w-lg h-[420px]'
          }`}>
            <div className="h-6 bg-card/80 border-b border-border flex items-center px-2 gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-destructive/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
              <span className="text-[8px] text-muted-foreground ml-1 font-mono truncate">{shortUrl}</span>
            </div>
            <div className="h-[calc(100%-1.5rem)] overflow-auto p-5">
              {renderViewerButtons()}
            </div>
          </div>
        )}

        {/* URL display beneath preview */}
        <div className="w-full max-w-[880px] space-y-1.5">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-card/50 border border-border">
            <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-[10px] font-mono text-foreground truncate flex-1">{fullUrl}</span>
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