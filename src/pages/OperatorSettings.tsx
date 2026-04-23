import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { Button } from '@/components/ui/button';
import { AUTOSAVE_MINUTE_OPTIONS, DEFAULT_AUTOSAVE_MINUTES, loadAutosaveMinutes, saveAutosaveMinutes } from '@/lib/operator-settings';
import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function OperatorSettings() {
  const [autosaveMinutes, setAutosaveMinutes] = useState(loadAutosaveMinutes());

  const handleSelect = (minutes: number) => {
    setAutosaveMinutes(minutes);
    saveAutosaveMinutes(minutes);
    toast.success(`Autosave set to every ${minutes} minute${minutes === 1 ? '' : 's'}`);
  };

  return (
    <OperatorLayout>
      <div className="flex-1 overflow-auto bg-background">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Settings2 className="h-4 w-4" />
              <span className="text-[10px] font-mono uppercase tracking-wider">Operator Settings</span>
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Workspace save timing</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Projects autosave after creation, and operators can still use Save to Project anytime for an immediate update.
            </p>
          </div>

          <section className="rounded-lg border border-border bg-card/40 p-6">
            <div className="flex flex-col gap-5">
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-foreground">Automatic save interval</h2>
                <p className="text-sm text-muted-foreground">
                  Current setting: every {autosaveMinutes} minute{autosaveMinutes === 1 ? '' : 's'}.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {AUTOSAVE_MINUTE_OPTIONS.map((minutes) => {
                  const isActive = autosaveMinutes === minutes;
                  return (
                    <Button
                      key={minutes}
                      type="button"
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleSelect(minutes)}
                      className="min-w-24"
                    >
                      {minutes} min
                    </Button>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                Default timing is {DEFAULT_AUTOSAVE_MINUTES} minutes for new operator sessions.
              </p>
            </div>
          </section>
        </div>
      </div>
    </OperatorLayout>
  );
}