import { useState, useEffect } from 'react';
import { ThemePreset, PollOption } from '@/lib/types';

interface ResultsSceneProps {
  question: string;
  options: PollOption[];
  totalVotes: number;
  colors: string[];
  theme: ThemePreset;
}

export function ResultsScene({ question, options, totalVotes, colors, theme }: ResultsSceneProps) {
  const [animProgress, setAnimProgress] = useState(0);

  useEffect(() => {
    setAnimProgress(0);
    const start = performance.now();
    const duration = 1200;
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimProgress(eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [totalVotes]);

  const maxVotes = Math.max(...options.map(o => o.votes));

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

      <div className="relative z-20 flex flex-col items-center w-full max-w-3xl px-16">
        <h1
          className="text-5xl font-bold mb-12 text-center"
          style={{ color: theme.textPrimary }}
        >
          {question}
        </h1>

        <div className="w-full space-y-6">
          {options.map((option, i) => {
            const pct = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
            const isWinner = option.votes === maxVotes;
            const color = colors[i % colors.length];
            const animatedPct = pct * animProgress;

            return (
              <div key={option.id} className="flex flex-col gap-2">
                <div className="flex items-end justify-between">
                  <span
                    className="text-2xl font-semibold"
                    style={{ color: theme.textPrimary }}
                  >
                    {option.text}
                    {isWinner && (
                      <span className="ml-3 text-sm font-mono" style={{ color: colors[0] }}>
                        ★ WINNER
                      </span>
                    )}
                  </span>
                  <span
                    className="text-4xl font-bold font-mono tabular-nums"
                    style={{ color }}
                  >
                    {Math.round(animatedPct)}%
                  </span>
                </div>
                <div className="h-5 rounded-full overflow-hidden" style={{ background: 'hsla(210, 20%, 92%, 0.1)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${animatedPct}%`,
                      backgroundColor: color,
                      boxShadow: isWinner ? `0 0 20px ${color}` : 'none',
                      transition: 'box-shadow 0.3s ease',
                    }}
                  />
                </div>
                <span className="font-mono text-xs" style={{ color: theme.textSecondary }}>
                  {Math.round(option.votes * animProgress).toLocaleString()} votes
                </span>
              </div>
            );
          })}
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
