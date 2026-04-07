import { PollOption } from '@/lib/types';

interface HorizontalBarChartProps {
  options: PollOption[];
  totalVotes: number;
  colors?: string[];
  showPercent?: boolean;
  showVotes?: boolean;
  animated?: boolean;
}

const defaultColors = [
  'hsl(24, 95%, 53%)',
  'hsl(210, 70%, 50%)',
  'hsl(142, 71%, 45%)',
  'hsl(280, 65%, 55%)',
];

export function HorizontalBarChart({
  options,
  totalVotes,
  colors = defaultColors,
  showPercent = true,
  showVotes = false,
  animated = true,
}: HorizontalBarChartProps) {
  return (
    <div className="flex flex-col gap-4 w-full">
      {options.map((option, i) => {
        const pct = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
        return (
          <div key={option.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{option.text}</span>
              <span className="font-mono text-sm text-muted-foreground">
                {showPercent && `${Math.round(pct)}%`}
                {showPercent && showVotes && ' · '}
                {showVotes && `${option.votes.toLocaleString()}`}
              </span>
            </div>
            <div className="h-3 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: colors[i % colors.length],
                  transition: animated ? 'width 0.5s ease-out' : 'none',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
