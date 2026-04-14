import { LiveState } from '@/lib/types';

export function LiveStatusIndicator({ state }: { state: LiveState }) {
  const isLive = state === 'live';
  return (
    <span
      className={`mako-chip font-bold tracking-wider ${
        isLive
          ? 'bg-mako-live/20 text-[hsl(var(--mako-live))] animate-live-pulse'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${isLive ? 'bg-[hsl(var(--mako-live))]' : 'bg-muted-foreground'}`}
      />
      {isLive ? 'LIVE' : 'PREVIEW'}
    </span>
  );
}
