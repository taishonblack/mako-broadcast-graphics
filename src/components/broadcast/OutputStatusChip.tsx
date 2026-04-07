import { OutputState } from '@/lib/types';

const stateConfig: Record<OutputState, { label: string; className: string }> = {
  standby: { label: 'STANDBY', className: 'bg-muted text-muted-foreground' },
  previewing: { label: 'PREVIEW', className: 'bg-mako-warning/20 text-mako-warning' },
  live_output: { label: 'ON AIR', className: 'bg-mako-success/20 text-mako-success' },
  disconnected: { label: 'DISCONNECTED', className: 'bg-destructive/20 text-destructive' },
};

export function OutputStatusChip({ state }: { state: OutputState }) {
  const config = stateConfig[state];
  return (
    <span className={`mako-chip ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        state === 'live_output' ? 'bg-mako-success' :
        state === 'disconnected' ? 'bg-destructive' :
        'bg-muted-foreground'
      }`} />
      {config.label}
    </span>
  );
}
