import { useState } from 'react';
import { Check, X, Loader2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { PreflightResult } from '@/lib/go-live-preflight';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Latest preflight result. `null` while the first check is in flight. */
  result: PreflightResult | null;
  /** What the operator was trying to do — drives the title copy. */
  intent: 'go_live' | 'open_voting';
  /**
   * Sync scene choices to poll_answers and re-run the preflight.
   * Should resolve once the new result is in `result`. If sync succeeds
   * the parent typically auto-proceeds with Go Live and closes the modal.
   */
  onSyncAndRetry: () => Promise<void>;
}

/**
 * Modal blocking Go Live / Open Voting when one or more pipeline
 * preconditions are not met. Renders the full checklist (✓ / ✗) so the
 * operator sees exactly what's wrong, and exposes a "Sync Answers and
 * Try Again" shortcut for the most common recoverable failure: the
 * Voter Selection scene was edited but the change never made it into
 * `poll_answers`.
 */
export function GoLivePreflightDialog({
  open,
  onOpenChange,
  result,
  intent,
  onSyncAndRetry,
}: Props) {
  const [syncing, setSyncing] = useState(false);

  const title = intent === 'go_live' ? "Can't go live yet" : "Can't open voting yet";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            One or more pipeline checks failed. Fix the items below so viewer
            votes can flow end-to-end.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="space-y-2 text-sm">
          {result?.checks.map((c) => (
            <li key={c.key} className="flex items-start gap-2">
              {c.ok ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              )}
              <div className="flex-1">
                <div className={c.ok ? 'text-foreground' : 'font-medium text-foreground'}>
                  {c.label}
                </div>
                {!c.ok && c.detail && (
                  <div className="text-xs text-muted-foreground">{c.detail}</div>
                )}
              </div>
            </li>
          ))}
          {!result && (
            <li className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Running checks…
            </li>
          )}
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={syncing}>Close</AlertDialogCancel>
          {result?.canSyncAndRetry && (
            <Button
              disabled={syncing}
              onClick={async () => {
                setSyncing(true);
                try {
                  await onSyncAndRetry();
                } finally {
                  setSyncing(false);
                }
              }}
            >
              {syncing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing…
                </>
              ) : (
                'Sync Answers and Try Again'
              )}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}