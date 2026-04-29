import { PollOption } from '@/lib/types';
import { useSmoothedVotes } from '@/hooks/useSmoothedVotes';

interface DonutChartProps {
  options: PollOption[];
  totalVotes: number;
  colors?: string[];
  size?: number;
  smooth?: boolean;
}

const defaultColors = [
  'hsl(24, 95%, 53%)',
  'hsl(210, 70%, 50%)',
  'hsl(142, 71%, 45%)',
  'hsl(280, 65%, 55%)',
];

export function DonutChart({ options, totalVotes, colors = defaultColors, size = 200, smooth = true }: DonutChartProps) {
  const smoothedOptions = useSmoothedVotes(options, smooth);
  const smoothedTotal = smoothedOptions.reduce((s, o) => s + o.votes, 0);
  const denomTotal = smooth ? Math.max(smoothedTotal, 0) : totalVotes;
  const radius = size / 2 - 20;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {smoothedOptions.map((option, i) => {
          const pct = denomTotal > 0 ? option.votes / denomTotal : 0;
          const strokeLength = circumference * pct;
          const offset = circumference * cumulativeOffset;
          cumulativeOffset += pct;

          return (
            <circle
              key={option.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth={size * 0.12}
              strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
              strokeDashoffset={-offset}
              className={smooth ? '' : 'transition-all duration-500 ease-out'}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-bold text-foreground">
          {Math.round(smooth ? smoothedTotal : totalVotes).toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground">votes</span>
      </div>
    </div>
  );
}
