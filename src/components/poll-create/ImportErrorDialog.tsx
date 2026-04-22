import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, FileWarning, FileText, ListChecks, Palette, Settings, HelpCircle } from 'lucide-react';
import { ImportIssue, ImportSection, SECTION_ORDER } from '@/lib/poll-import-schema';

const SECTION_ICON: Record<ImportSection, typeof FileText> = {
  'Poll Details': FileText,
  'Answers': ListChecks,
  'Theming': Palette,
  'Behavior': Settings,
  'Other': HelpCircle,
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fileName?: string;
  parseError?: string;
  issues: ImportIssue[];
  /** Optional: called when user clicks "Jump to" on an issue. Receives field name. */
  onJumpToField?: (field: string, section: ImportSection) => void;
}

export function ImportErrorDialog({ open, onOpenChange, fileName, parseError, issues, onJumpToField }: Props) {
  const isParseError = !!parseError;

  // Group issues by section
  const grouped = SECTION_ORDER
    .map((section) => ({
      section,
      items: issues.filter((i) => i.section === section),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
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
          <div className="max-h-[28rem] overflow-auto space-y-3 pr-1">
            {grouped.map(({ section, items }) => {
              const Icon = SECTION_ICON[section];
              const affectedFields = Array.from(new Set(items.map((i) => i.field)));
              return (
                <div key={section} className="rounded-md border border-destructive/30 bg-destructive/5 overflow-hidden">
                  <div className="px-3 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-destructive" />
                      <span className="text-xs font-semibold text-destructive">{section}</span>
                      <span className="text-[10px] font-mono text-destructive/70">
                        {items.length} {items.length === 1 ? 'issue' : 'issues'}
                      </span>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end max-w-[60%]">
                      {affectedFields.map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            if (onJumpToField) {
                              onJumpToField(f, section);
                              onOpenChange(false);
                            }
                          }}
                          disabled={!onJumpToField}
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 hover:border-destructive/50 transition-colors disabled:cursor-default disabled:hover:bg-destructive/20"
                          title={onJumpToField ? `Jump to ${f}` : f}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="divide-y divide-destructive/15">
                    {items.map((iss, i) => (
                      <div key={i} className="px-3 py-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-destructive/80">
                            {iss.path}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-muted-foreground/60 font-mono">{iss.code}</span>
                            {onJumpToField && (
                              <button
                                onClick={() => {
                                  onJumpToField(iss.field, iss.section);
                                  onOpenChange(false);
                                }}
                                className="text-[9px] font-medium text-primary hover:text-primary/80 underline-offset-2 hover:underline"
                                title={`Jump to ${iss.field}`}
                              >
                                Jump to →
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-foreground mt-0.5">{iss.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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