import { Poll, VotingState } from '@/lib/types';
import { VotingStatusChip } from './VotingStatusChip';
import { GripVertical } from 'lucide-react';

interface PollQueueProps {
  polls: Poll[];
  activePollId: string;
  onSelectPoll: (pollId: string) => void;
}

export function PollQueue({ polls, activePollId, onSelectPoll }: PollQueueProps) {
  return (
    <div className="flex flex-col gap-1">
      {polls.map((poll, index) => {
        const isActive = poll.id === activePollId;
        return (
          <button
            key={poll.id}
            onClick={() => onSelectPoll(poll.id)}
            className={`w-full text-left p-3 rounded-xl transition-all border ${
              isActive
                ? 'bg-primary/10 border-primary/30'
                : 'bg-accent/20 border-border/50 hover:bg-accent/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <GripVertical className="w-3 h-3 text-muted-foreground/40 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-medium truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
                    {poll.internalName}
                  </span>
                  <VotingStatusChip state={poll.votingState} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{poll.question}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
