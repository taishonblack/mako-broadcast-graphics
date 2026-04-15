import type { DraftState } from '@/components/broadcast/GraphicsWorkspace';
import type { Poll } from '@/lib/types';
import type { GraphicLayer } from '@/lib/layers';
import { templateLabels } from '@/lib/mock-data';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRight, Plus, Minus, RefreshCw } from 'lucide-react';

interface ApplyDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poll: Poll;
  draft: DraftState;
  currentLayers: GraphicLayer[];
  draftLayers: GraphicLayer[];
  onConfirm: () => void;
}

interface DiffLine {
  label: string;
  before: string;
  after: string;
  type: 'changed' | 'added' | 'removed';
}

function formatLayerSnapshot(layer: GraphicLayer) {
  const parts = [
    `X ${layer.transform.x.toFixed(0)}%`,
    `Y ${layer.transform.y.toFixed(0)}%`,
    `Scale ${(layer.transform.scale * 100).toFixed(0)}%`,
    `Opacity ${(layer.transform.opacity * 100).toFixed(0)}%`,
    layer.visible ? 'Visible' : 'Hidden',
  ];

  if (layer.qrProps) {
    parts.push(`QR ${layer.qrProps.size}px`);
  }

  if (layer.textProps) {
    parts.push(`Text ${layer.textProps.fontSize}px`);
  }

  return parts.join(' · ');
}

function buildDiff(poll: Poll, draft: DraftState, currentLayers: GraphicLayer[], draftLayers: GraphicLayer[]): DiffLine[] {
  const diffs: DiffLine[] = [];

  if (draft.question !== poll.question) {
    diffs.push({ label: 'Question', before: poll.question, after: draft.question, type: 'changed' });
  }

  if (draft.template !== poll.template) {
    diffs.push({ label: 'Template', before: templateLabels[poll.template], after: templateLabels[draft.template], type: 'changed' });
  }

  // Answer changes
  const maxLen = Math.max(poll.options.length, draft.options.length);
  for (let i = 0; i < maxLen; i++) {
    const before = poll.options[i];
    const after = draft.options[i];
    if (!before && after) {
      diffs.push({ label: `Answer ${i + 1}`, before: '', after: after.text, type: 'added' });
    } else if (before && !after) {
      diffs.push({ label: `Answer ${i + 1}`, before: before.text, after: '', type: 'removed' });
    } else if (before && after && before.text !== after.text) {
      diffs.push({ label: `Answer ${i + 1}`, before: before.text, after: after.text, type: 'changed' });
    }
  }

  if (draft.themeId !== poll.themeId) {
    diffs.push({ label: 'Theme', before: poll.themeId, after: draft.themeId, type: 'changed' });
  }

  const currentLayerMap = new Map(currentLayers.map((layer) => [layer.id, layer]));

  for (const draftLayer of draftLayers) {
    const currentLayer = currentLayerMap.get(draftLayer.id);
    if (!currentLayer) continue;

    if (JSON.stringify(currentLayer) !== JSON.stringify(draftLayer)) {
      diffs.push({
        label: draftLayer.label,
        before: formatLayerSnapshot(currentLayer),
        after: formatLayerSnapshot(draftLayer),
        type: 'changed',
      });
    }
  }

  return diffs;
}

export function ApplyDraftDialog({ open, onOpenChange, poll, draft, currentLayers, draftLayers, onConfirm }: ApplyDraftDialogProps) {
  const diffs = buildDiff(poll, draft, currentLayers, draftLayers);

  const iconForType = (type: DiffLine['type']) => {
    switch (type) {
      case 'added': return <Plus className="w-3 h-3 text-[hsl(var(--mako-success))]" />;
      case 'removed': return <Minus className="w-3 h-3 text-destructive" />;
      case 'changed': return <RefreshCw className="w-3 h-3 text-primary" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Apply Draft to Program</DialogTitle>
          <DialogDescription className="text-xs">
            {diffs.length > 0
              ? `${diffs.length} change${diffs.length > 1 ? 's' : ''} will be applied to the live output.`
              : 'No changes detected.'}
          </DialogDescription>
        </DialogHeader>

        {diffs.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-auto py-2">
            {diffs.map((diff, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border border-border/50">
                <div className="mt-0.5 shrink-0">{iconForType(diff.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground font-mono uppercase">{diff.label}</p>
                  {diff.before && (
                    <p className="text-xs text-muted-foreground line-through truncate">{diff.before}</p>
                  )}
                  {diff.after && (
                    <div className="flex items-center gap-1.5">
                      {diff.before && <ArrowRight className="w-2.5 h-2.5 text-muted-foreground shrink-0" />}
                      <p className="text-xs text-foreground font-medium truncate">{diff.after}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" className="text-xs gap-1.5" onClick={onConfirm} disabled={diffs.length === 0}>
            Apply {diffs.length} Change{diffs.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
