import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Square } from 'lucide-react';
import { useLiveSession } from '@/hooks/useLiveSession';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Persistent on-air indicator shown in the operator chrome on every page.
 * Renders nothing when not live. When live, shows voting state (OPEN / CLOSED)
 * and offers a one-click End Live action that returns the operator to
 * /workspace?mode=output for cleanup.
 */
export function LiveSessionBadge() {
  const { isLive, votingState, endLive, ending } = useLiveSession();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!isLive) return null;

  const votingLabel =
    votingState === 'open' ? 'VOTING OPEN' :
    votingState === 'closed' ? 'VOTING CLOSED' :
    'VOTING NOT OPEN';
  const votingTone =
    votingState === 'open'
      ? 'bg-mako-success/20 text-mako-success'
      : 'bg-muted text-muted-foreground';

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-[60] h-7 flex items-center justify-center gap-2 border-b border-[hsl(var(--mako-live)/0.5)] bg-background/95 backdrop-blur shadow-[0_2px_18px_-4px_hsl(var(--mako-live)/0.55)] px-3"
      >
        <span className="mako-chip bg-mako-live/20 text-[hsl(var(--mako-live))] font-bold tracking-wider animate-live-pulse">
          <Radio className="w-3 h-3" />
          LIVE
        </span>
        <span className={`mako-chip text-[10px] font-mono uppercase tracking-wider ${votingTone}`}>
          {votingLabel}
        </span>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={ending}
          className="flex items-center gap-1 rounded-full bg-destructive/15 hover:bg-destructive/25 text-destructive border border-destructive/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
          title="End the live session"
        >
          <Square className="w-2.5 h-2.5 fill-current" />
          End Live
        </button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => { if (!ending) setConfirmOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End the live session?</AlertDialogTitle>
            <AlertDialogDescription>
              This takes the program off-air, closes voting, and resets the audience screen to branding.
              Viewers will stop seeing the active poll. This cannot be undone — you'll need to Go Live again to resume.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={ending}
              onClick={async (e) => {
                e.preventDefault();
                await endLive();
                setConfirmOpen(false);
                // Send the operator back to the output workspace so any
                // post-show cleanup (snapshot, scenes) is one click away.
                navigate('/workspace?mode=output');
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {ending ? 'Ending…' : 'Yes, end live'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}