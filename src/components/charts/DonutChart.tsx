import { PollOption } from '@/lib/types';

interface DonutChartProps {
  options: PollOption[];
  totalVotes: number;
  colors?: string[];
  size?: number;
}

const defaultColors = [
  'hsl(24, 95%, 53%)',
  'hsl(210, 70%, 50%)',
  'hsl(142, 71%, 45%)',
  'hsl(280, 65%, 55%)',
];

export function DonutChart({ options, totalVotes, colors = defaultColors, size = 200 }: DonutChartProps) {
  const radius = size / 2 - 20;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {options.map((option, i) => {
          const pct = totalVotes > 0 ? option.votes / totalVotes : 0;
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
              className="transition-all duration-500 ease-out"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-bold text-foreground">
          {totalVotes.toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground">votes</span>
      </div>
    </div>
  );
}
