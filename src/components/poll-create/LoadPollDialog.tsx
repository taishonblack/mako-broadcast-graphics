import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { listPolls, SavedPoll } from '@/lib/poll-persistence';
import { Loader2, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (poll: SavedPoll) => void;
}

export function LoadPollDialog({ open, onOpenChange, onSelect }: Props) {
  const [loading, setLoading] = useState(false);
  const [polls, setPolls] = useState<SavedPoll[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listPolls()
      .then(setPolls)
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = polls.filter((p) => {
    const t = q.toLowerCase();
    if (!t) return true;
    return (
      p.internalName?.toLowerCase().includes(t) ||
      p.question?.toLowerCase().includes(t) ||
      p.slug?.toLowerCase().includes(t)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Load Poll</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search by name, question, or slug…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 text-xs"
        />
        <div className="max-h-80 overflow-auto border border-border/60 rounded-md divide-y divide-border/40">
          {loading ? (
            <div className="p-6 flex items-center justify-center text-muted-foreground text-xs">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading polls…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No polls found.
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onSelect(p);
                  onOpenChange(false);
                }}
                className="w-full text-left p-2.5 hover:bg-accent/40 transition-colors flex items-start gap-2"
              >
                <FileText className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">
                    {p.internalName || p.question || 'Untitled poll'}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {p.question || '—'}
                  </div>
                  <div className="text-[9px] text-muted-foreground/70 mt-0.5 flex gap-2">
                    <span className="uppercase">{p.status}</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}