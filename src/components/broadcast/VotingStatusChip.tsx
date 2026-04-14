import { VotingState } from '@/lib/types';

const stateConfig: Record<VotingState, { label: string; className: string }> = {
  not_open: { label: 'NOT OPEN', className: 'bg-muted text-muted-foreground' },
  open: { label: 'VOTING OPEN', className: 'bg-mako-success/20 text-mako-success' },
  closed: { label: 'VOTING CLOSED', className: 'bg-mako-warning/20 text-mako-warning' },
};

export function VotingStatusChip({ state }: { state: VotingState }) {
  const config = stateConfig[state];
  return (
    <span className={`mako-chip ${config.className}`}>
      {state === 'open' && <span className="w-1.5 h-1.5 rounded-full bg-mako-success animate-live-pulse" />}
      {config.label}
    </span>
  );
}
