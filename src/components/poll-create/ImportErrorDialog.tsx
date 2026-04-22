import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, FileWarning } from 'lucide-react';
import { ImportIssue } from '@/lib/poll-import-schema';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fileName?: string;
  parseError?: string;
  issues: ImportIssue[];
}

export function ImportErrorDialog({ open, onOpenChange, fileName, parseError, issues }: Props) {
  const isParseError = !!parseError;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            Import failed
          </DialogTitle>
          <DialogDescription className="text-xs">
            {fileName ? <>Could not import <span className="font-mono">{fileName}</span>.</> : 'The file could not be imported.'}
            {' '}
            {isParseError
              ? 'The file is not valid JSON.'
              : `Found ${issues.length} validation ${issues.length === 1 ? 'issue' : 'issues'}.`}
          </DialogDescription>
        </DialogHeader>

        {isParseError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <div className="flex items-start gap-2">
              <FileWarning className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
              <div className="text-[11px] font-mono text-destructive break-all">{parseError}</div>
            </div>
          </div>
        ) : (
          <div className="max-h-72 overflow-auto rounded-md border border-border/60 divide-y divide-border/40">
            {issues.map((iss, i) => (
              <div key={i} className="p-2.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {iss.path}
                </div>
                <div className="text-xs text-foreground mt-0.5">{iss.message}</div>
                <div className="text-[9px] text-muted-foreground/70 mt-0.5">{iss.code}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <Button size="sm" className="h-7 text-[10px]" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}