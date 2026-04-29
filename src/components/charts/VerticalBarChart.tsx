import { PollOption } from '@/lib/types';
import { useSmoothedVotes } from '@/hooks/useSmoothedVotes';

interface VerticalBarChartProps {
  options: PollOption[];
  totalVotes: number;
  colors?: string[];
  showPercent?: boolean;
  smooth?: boolean;
}

const defaultColors = [
  'hsl(24, 95%, 53%)',
  'hsl(210, 70%, 50%)',
  'hsl(142, 71%, 45%)',
  'hsl(280, 65%, 55%)',
];

export function VerticalBarChart({ options, totalVotes, colors = defaultColors, showPercent = true, smooth = true }: VerticalBarChartProps) {
  const smoothedOptions = useSmoothedVotes(options, smooth);
  const smoothedTotal = smoothedOptions.reduce((s, o) => s + o.votes, 0);
  const denomTotal = smooth ? Math.max(smoothedTotal, 0) : totalVotes;
  const maxVotes = Math.max(...smoothedOptions.map(o => o.votes), 1);

  return (
    <div className="flex items-end justify-center gap-6 h-full min-h-[200px] px-4">
      {smoothedOptions.map((option, i) => {
        const pct = denomTotal > 0 ? (option.votes / denomTotal) * 100 : 0;
        const height = (option.votes / maxVotes) * 100;
        return (
          <div key={option.id} className="flex flex-col items-center gap-2 flex-1 max-w-[120px]">
            <span className="font-mono text-sm text-muted-foreground">
              {showPercent ? `${Math.round(pct)}%` : Math.round(option.votes).toLocaleString()}
            </span>
            <div className="w-full relative" style={{ height: '160px' }}>
              <div
                className={`absolute bottom-0 w-full rounded-t-lg ${smooth ? '' : 'transition-all duration-500 ease-out'}`}
                style={{
                  height: `${Math.max(height, 2)}%`,
                  backgroundColor: colors[i % colors.length],
                }}
              />
            </div>
            <span className="text-xs font-medium text-foreground text-center">{option.shortLabel || option.text}</span>
          </div>
        );
      })}
    </div>
  );
}
