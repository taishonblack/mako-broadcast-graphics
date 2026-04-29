import { PollOption } from '@/lib/types';
import { useSmoothedVotes } from '@/hooks/useSmoothedVotes';

interface HorizontalBarChartProps {
  options: PollOption[];
  totalVotes: number;
  colors?: string[];
  showPercent?: boolean;
  showVotes?: boolean;
  animated?: boolean;
  /**
   * When true, RAF-interpolate vote counts toward the latest target so
   * bursty realtime deltas land as continuous motion. Defaults to true to
   * keep on-air rendering buttery; pass `false` to disable for static
   * thumbnails or test-mode previews.
   */
  smooth?: boolean;
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
  smooth = true,
}: HorizontalBarChartProps) {
  const smoothedOptions = useSmoothedVotes(options, smooth);
  const smoothedTotal = smoothedOptions.reduce((s, o) => s + o.votes, 0);
  // When the caller-supplied total is meaningfully larger (e.g. tests with
  // pre-baked totalVotes), keep using it; otherwise rely on the smoothed
  // sum so percentages animate in lockstep with the bars.
  const denomTotal = smooth ? Math.max(smoothedTotal, 0) : totalVotes;
  return (
    <div className="flex flex-col gap-4 w-full">
      {smoothedOptions.map((option, i) => {
        const pct = denomTotal > 0 ? (option.votes / denomTotal) * 100 : 0;
        return (
          <div key={option.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{option.text}</span>
              <span className="font-mono text-sm text-muted-foreground">
                {showPercent && `${Math.round(pct)}%`}
                {showPercent && showVotes && ' · '}
                {showVotes && `${Math.round(option.votes).toLocaleString()}`}
              </span>
            </div>
            <div className="h-3 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: colors[i % colors.length],
                  boxShadow: pct > 0 ? `0 0 12px -2px ${colors[i % colors.length]}` : 'none',
                  // When smoothing is on we update width every frame from
                  // RAF, so a CSS transition would double-animate and lag.
                  // Disable it and let the JS interpolation drive motion.
                  transition: smooth
                    ? 'box-shadow 0.3s ease'
                    : animated
                      ? 'width 0.5s ease-out, box-shadow 0.3s ease'
                      : 'none',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
