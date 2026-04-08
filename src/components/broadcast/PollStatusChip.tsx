import { PollState } from '@/lib/types';

const stateConfig: Record<PollState, { label: string; className: string }> = {
  draft: { label: 'DRAFT', className: 'bg-muted text-muted-foreground' },
  ready: { label: 'READY', className: 'bg-mako-warning/20 text-mako-warning' },
  live: { label: 'LIVE', className: 'bg-mako-live/20 text-mako-live animate-live-pulse' },
  closed: { label: 'CLOSED', className: 'bg-muted text-muted-foreground' },
  archived: { label: 'ARCHIVED', className: 'bg-muted/50 text-muted-foreground/60' },
};

export function PollStatusChip({ state }: { state: PollState }) {
  const config = stateConfig[state];
  return (
    <span className={`mako-chip ${config.className}`}>
      {state === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-mako-live" />}
      {config.label}
    </span>
  );
}
