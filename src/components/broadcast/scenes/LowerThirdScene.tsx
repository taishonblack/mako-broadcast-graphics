import { renderChart } from '@/lib/render-chart';
import { ThemePreset, PollOption, TemplateName } from '@/lib/types';

interface LowerThirdSceneProps {
  question: string;
  options: PollOption[];
  totalVotes: number;
  colors: string[];
  theme: ThemePreset;
  template?: TemplateName;
}

export function LowerThirdScene({ question, options, totalVotes, colors, theme, template = 'horizontal-bar' }: LowerThirdSceneProps) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${theme.tintColor}, hsl(220, 25%, 6%))`,
      }}
    >
      <div className="absolute inset-0" />

      <div
        className="absolute bottom-0 left-0 right-0 z-20 animate-slide-up"
        style={{
          background: `linear-gradient(to top, hsla(220, 20%, 6%, 0.95), hsla(220, 20%, 6%, 0.85))`,
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-center gap-8 px-12 py-6 max-w-full">
          <div className="shrink-0 max-w-[35%]">
            <h2
              className="text-2xl font-bold leading-snug"
              style={{ color: theme.textPrimary }}
            >
              {question}
            </h2>
            <span className="font-mono text-xs mt-1 block" style={{ color: theme.textSecondary }}>
              {totalVotes.toLocaleString()} votes
            </span>
          </div>

          <div className="w-px h-16 shrink-0" style={{ background: 'hsla(210, 20%, 92%, 0.15)' }} />

          <div className="flex-1 min-w-0">
            {renderChart({ template, options, totalVotes, colors, compact: true })}
          </div>
        </div>

        <div className="h-1 w-full" style={{ background: `linear-gradient(to right, ${colors[0]}, ${colors[1] || colors[0]})` }} />
      </div>

      <div className="absolute top-6 left-8 flex items-center gap-2 opacity-40 z-20">
        <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-[8px]">M</span>
        </div>
        <span className="font-mono text-[9px]" style={{ color: theme.textSecondary }}>MakoVote</span>
      </div>
    </div>
  );
}
