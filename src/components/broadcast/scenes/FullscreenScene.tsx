import { renderChart } from '@/lib/render-chart';
import { ThemePreset, PollOption, TemplateName } from '@/lib/types';
import { QRCodeSVG } from 'qrcode.react';

interface FullscreenSceneProps {
  question: string;
  options: PollOption[];
  totalVotes: number;
  colors: string[];
  theme: ThemePreset;
  template?: TemplateName;
}

export function FullscreenScene({ question, options, totalVotes, colors, theme, template = 'horizontal-bar' }: FullscreenSceneProps) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${theme.tintColor}, hsl(220, 25%, 6%))`,
      }}
    >
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      <div className="relative z-20 flex flex-col items-center w-full">
        <div className="text-center mb-8 px-16">
          <h1
            className="text-5xl md:text-6xl font-bold leading-tight"
            style={{ color: theme.textPrimary }}
          >
            {question}
          </h1>
        </div>

        <div className="w-full max-w-2xl px-16">
          {renderChart({ template, options, totalVotes, colors })}
        </div>

        <div className="mt-8">
          <span className="font-mono text-sm" style={{ color: theme.textSecondary }}>
            {totalVotes.toLocaleString()} total votes
          </span>
        </div>
      </div>

      {/* QR */}
      <div className="absolute bottom-8 right-8 z-20">
        <div className="p-2 rounded-xl" style={{ backgroundColor: 'hsla(0, 0%, 100%, 0.95)' }}>
          <QRCodeSVG value="https://makovote.tv/vote/penalty-call" size={80} level="M" />
        </div>
      </div>

      {/* Bug */}
      <div className="absolute bottom-8 left-8 flex items-center gap-2 opacity-50 z-20">
        <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-[10px]">M</span>
        </div>
        <span className="font-mono text-[10px]" style={{ color: theme.textSecondary }}>MakoVote</span>
      </div>
    </div>
  );
}
