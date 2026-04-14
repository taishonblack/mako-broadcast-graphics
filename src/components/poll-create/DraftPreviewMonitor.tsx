import { useState, useMemo } from 'react';
import { BroadcastPreviewFrame } from '@/components/broadcast/BroadcastPreviewFrame';
import { FullscreenScene } from '@/components/broadcast/scenes/FullscreenScene';
import { LowerThirdScene } from '@/components/broadcast/scenes/LowerThirdScene';
import { renderChart } from '@/lib/render-chart';
import { PollOption, TemplateName, ThemePreset } from '@/lib/types';
import { Monitor, Smartphone, Globe } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type PreviewMode = 'program' | 'mobile' | 'desktop';

interface DraftPreviewMonitorProps {
  question: string;
  options: PollOption[];
  totalVotes: number;
  colors: string[];
  template: TemplateName;
  theme: ThemePreset;
  hasContent: boolean;
}

export function DraftPreviewMonitor({
  question, options, totalVotes, colors, template, theme, hasContent,
}: DraftPreviewMonitorProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('program');

  const isSceneTemplate = template === 'fullscreen-hero' || template === 'lower-third';

  const renderContent = () => {
    if (!hasContent) {
      return (
        <div className="flex items-center justify-center h-full bg-background/80">
          <div className="text-center space-y-2">
            <p className="text-lg font-bold text-primary font-mono tracking-wider">MakoVote</p>
            <p className="text-[10px] text-muted-foreground">Start building your poll to see a preview</p>
          </div>
        </div>
      );
    }

    if (isSceneTemplate) {
      if (template === 'fullscreen-hero') {
        return <FullscreenScene question={question} options={options} totalVotes={totalVotes} colors={colors} theme={theme} template={template} />;
      }
      return <LowerThirdScene question={question} options={options} totalVotes={totalVotes} colors={colors} theme={theme} template={template} />;
    }

    return (
      <div className="flex items-center justify-center h-full p-4" style={{ background: `linear-gradient(135deg, ${theme.tintColor}, hsla(220, 20%, 8%, 0.95))` }}>
        <div className="w-full max-w-md space-y-3">
          <p className="text-sm font-bold text-center" style={{ color: theme.textPrimary }}>{question}</p>
          {renderChart({ template, options, totalVotes, colors })}
        </div>
      </div>
    );
  };

  const modeButtons: { mode: PreviewMode; icon: typeof Monitor; label: string; tooltip: string }[] = [
    { mode: 'program', icon: Monitor, label: 'Program', tooltip: 'Program Output — what goes to air' },
    { mode: 'mobile', icon: Smartphone, label: 'Mobile', tooltip: 'Viewer Mobile — what audiences see on phone' },
    { mode: 'desktop', icon: Globe, label: 'Desktop', tooltip: 'Viewer Desktop — what audiences see in browser' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Mode toggles */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/50">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Preview</h2>
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

      {/* Preview area */}
      <div className="flex-1 flex items-center justify-center p-3 bg-background/30 min-h-0">
        {previewMode === 'program' ? (
          <BroadcastPreviewFrame showLabel className="w-full h-full">
            {renderContent()}
          </BroadcastPreviewFrame>
        ) : (
          <div className={`bg-background border border-border rounded-lg overflow-hidden shadow-xl ${
            previewMode === 'mobile' ? 'w-[280px] h-[500px]' : 'w-full max-w-lg h-[360px]'
          }`}>
            <div className="h-6 bg-card/80 border-b border-border flex items-center px-2 gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-destructive/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
              <span className="text-[8px] text-muted-foreground ml-1 font-mono truncate">/vote/{question ? 'preview' : '...'}</span>
            </div>
            <div className="h-[calc(100%-1.5rem)] overflow-auto p-4">
              {hasContent ? (
                <div className="space-y-4">
                  <p className="text-sm font-bold text-foreground">{question}</p>
                  <div className="space-y-2">
                    {options.map((opt, i) => (
                      <button key={opt.id} className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 transition-colors text-xs text-foreground bg-card/50">
                        {opt.text}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                  Voter view preview
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
