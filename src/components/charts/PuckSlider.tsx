import { PollOption } from '@/lib/types';
import { useSmoothedVotes } from '@/hooks/useSmoothedVotes';

interface PuckSliderProps {
  options: PollOption[];
  totalVotes: number;
  colors?: string[];
  smooth?: boolean;
}

export function PuckSlider({ options, totalVotes, colors, smooth = true }: PuckSliderProps) {
  if (options.length < 2) return null;
  const smoothedOptions = useSmoothedVotes(options, smooth);
  const smoothedTotal = smoothedOptions.reduce((s, o) => s + o.votes, 0);
  const denomTotal = smooth ? Math.max(smoothedTotal, 0) : totalVotes;
  const leftPct = denomTotal > 0 ? (smoothedOptions[0].votes / denomTotal) * 100 : 50;
  const leftColor = colors?.[0] || 'hsl(24, 95%, 53%)';
  const rightColor = colors?.[1] || 'hsl(210, 70%, 50%)';

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
      <div className="flex items-center justify-between w-full">
        <span className="font-mono text-sm font-bold" style={{ color: leftColor }}>
          {options[0].shortLabel || options[0].text}
        </span>
        <span className="font-mono text-sm font-bold" style={{ color: rightColor }}>
          {options[1].shortLabel || options[1].text}
        </span>
      </div>

      <div className="relative w-full h-4 rounded-full overflow-hidden" style={{ background: 'hsla(200, 20%, 85%, 0.15)' }}>
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${smooth ? '' : 'transition-all duration-500 ease-out'}`}
          style={{ width: `${leftPct}%`, background: `linear-gradient(90deg, ${leftColor}, ${leftColor}aa)` }}
        />
        {/* Puck */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 ${smooth ? '' : 'transition-all duration-500 ease-out'}`}
          style={{
            left: `calc(${leftPct}% - 12px)`,
            background: 'hsl(220, 10%, 15%)',
            borderColor: 'hsl(0, 0%, 90%)',
            boxShadow: '0 0 12px hsla(200, 80%, 70%, 0.4)',
          }}
        />
      </div>

      <div className="flex items-center justify-between w-full font-mono text-xs text-muted-foreground">
        <span>{Math.round(leftPct)}%</span>
        <span>{Math.round(100 - leftPct)}%</span>
      </div>
    </div>
  );
}
