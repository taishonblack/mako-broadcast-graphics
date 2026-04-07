import { useState, useEffect } from 'react';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { QRPreviewCard } from '@/components/broadcast/QRPreviewCard';
import { mockPolls } from '@/lib/mock-data';
import { themePresets } from '@/lib/themes';
import { QRCodeSVG } from 'qrcode.react';

export default function ProgramOutput() {
  const poll = mockPolls[0];
  const theme = themePresets[0];
  const [liveVotes, setLiveVotes] = useState(poll.options.map(o => o.votes));
  const [total, setTotal] = useState(poll.totalVotes);

  // Simulate live vote updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveVotes(prev => {
        const next = prev.map(v => v + Math.floor(Math.random() * 5));
        setTotal(next.reduce((a, b) => a + b, 0));
        return next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const liveOptions = poll.options.map((o, i) => ({ ...o, votes: liveVotes[i] }));
  const colors = [theme.chartColorA, theme.chartColorB, theme.chartColorC, theme.chartColorD];

  return (
    <div
      className="w-screen h-screen overflow-hidden relative flex flex-col items-center justify-center"
      style={{
        background: `linear-gradient(135deg, ${theme.tintColor}, hsl(220, 25%, 6%))`,
        cursor: 'none',
      }}
    >
      {/* Question */}
      <div className="text-center mb-10 px-16">
        <h1
          className="text-4xl md:text-5xl font-bold leading-tight"
          style={{ color: theme.textPrimary }}
        >
          {poll.question}
        </h1>
      </div>

      {/* Chart */}
      <div className="w-full max-w-2xl px-16">
        <HorizontalBarChart
          options={liveOptions}
          totalVotes={total}
          colors={colors}
          showPercent
          showVotes
        />
      </div>

      {/* Total votes */}
      <div className="mt-8">
        <span className="font-mono text-sm" style={{ color: theme.textSecondary }}>
          {total.toLocaleString()} total votes
        </span>
      </div>

      {/* QR Code — bottom right */}
      <div className="absolute bottom-8 right-8">
        <div className="p-2 rounded-xl" style={{ backgroundColor: 'hsla(0, 0%, 100%, 0.95)' }}>
          <QRCodeSVG value="https://makovote.tv/vote/penalty-call" size={80} level="M" />
        </div>
      </div>

      {/* Bug — bottom left */}
      <div className="absolute bottom-8 left-8 flex items-center gap-2 opacity-50">
        <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-[10px]">M</span>
        </div>
        <span className="font-mono text-[10px]" style={{ color: theme.textSecondary }}>MakoVote</span>
      </div>
    </div>
  );
}
