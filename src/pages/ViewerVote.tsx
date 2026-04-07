import { useState } from 'react';
import { mockPolls } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

type VoteState = 'voting' | 'submitted' | 'closed';

export default function ViewerVote() {
  const poll = mockPolls[0];
  const [state, setState] = useState<VoteState>('voting');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleVote = (optionId: string) => {
    setSelectedOption(optionId);
    setTimeout(() => setState('submitted'), 300);
  };

  if (state === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'hsl(220, 20%, 7%)' }}>
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Voting has ended</h1>
          <p className="text-sm text-muted-foreground">Thanks for participating</p>
        </div>
      </div>
    );
  }

  if (state === 'submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'hsl(220, 20%, 7%)' }}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-mako-success/20 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-mako-success" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Vote Received</h1>
          <p className="text-sm text-muted-foreground">Your vote has been counted</p>

          {/* Optional live results */}
          {poll.showLiveResults && (
            <div className="mt-8 space-y-3 max-w-sm mx-auto">
              {poll.options.map((opt) => {
                const pct = poll.totalVotes > 0 ? (opt.votes / poll.totalVotes) * 100 : 0;
                return (
                  <div key={opt.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground">{opt.text}</span>
                      <span className="font-mono text-muted-foreground">{Math.round(pct)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: 'hsl(220, 20%, 7%)' }}>
      <div className="w-full max-w-sm space-y-8">
        {/* Question */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground leading-tight">{poll.question}</h1>
          {poll.subheadline && (
            <p className="text-sm text-muted-foreground mt-2">{poll.subheadline}</p>
          )}
        </div>

        {/* Answer buttons */}
        <div className="space-y-3">
          {poll.options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              className="w-full p-4 rounded-2xl text-left font-medium text-foreground transition-all active:scale-[0.98] border border-border/50 hover:border-primary/50 hover:bg-primary/5"
              style={{
                background: 'hsla(220, 18%, 13%, 0.8)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span className="text-base">{option.text}</span>
            </button>
          ))}
        </div>

        {/* Bug */}
        <div className="flex items-center justify-center gap-2 pt-4 opacity-30">
          <div className="w-4 h-4 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-[8px]">M</span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">MakoVote</span>
        </div>
      </div>
    </div>
  );
}
