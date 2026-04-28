import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AUTOSAVE_MINUTE_OPTIONS, DEFAULT_AUTOSAVE_MINUTES, loadAutosaveMinutes, loadConfirmationlessMode, saveAutosaveMinutes, saveConfirmationlessMode } from '@/lib/operator-settings';
import { useColorSwatches, MAX_SWATCHES } from '@/lib/color-swatches';
import { Palette, Plus, Settings2, ShieldCheck, Trash2, Zap } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function OperatorSettings() {
  const [autosaveMinutes, setAutosaveMinutes] = useState(loadAutosaveMinutes());
  const { swatches, addSwatch, renameSwatch, updateSwatchValue, removeSwatch, clearSwatches } = useColorSwatches();
  const [quickSwitch, setQuickSwitch] = useState(loadConfirmationlessMode());
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('#3B82F6');

  const handleSelect = (minutes: number) => {
    setAutosaveMinutes(minutes);
    saveAutosaveMinutes(minutes);
    toast.success(`Autosave set to every ${minutes} minute${minutes === 1 ? '' : 's'}`);
  };

  const handleCreate = () => {
    const value = newValue.trim();
    if (!value) {
      toast.error('Enter a color value (hex, rgb, or hsl).');
      return;
    }
    if (swatches.length >= MAX_SWATCHES) {
      toast.error(`Swatch limit reached (${MAX_SWATCHES}). Delete one to add another.`);
      return;
    }
    addSwatch(value, newName.trim() || undefined);
    setNewName('');
    toast.success('Swatch saved');
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

          {/* ── Quick Switch (confirmationless TAKE/CUT) ──────────────────
              Lets operators fire scene cuts during Go Live without the
              confirm() dialog. Requires a per-show "Bus Safe" arm switch
              from the workspace header — enabling here only opens the
              capability; the arm gate prevents stray hotkeys from going
              to air mid-VO. */}
          <section className="rounded-lg border border-border bg-card/40 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-foreground">
                  <Zap className="h-4 w-4 text-[hsl(var(--mako-live))]" />
                  <h2 className="text-sm font-medium">Quick Switch (confirmationless TAKE / CUT)</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Skip the on-air confirmation dialog when cutting between scenes during Go Live.
                  Each show requires a manual <span className="font-mono text-foreground">Bus Safe</span> arm switch
                  in the workspace header before any confirmationless cut will fire — and arming
                  auto-clears on End Poll so it never carries into the next show.
                </p>
                <p className="text-xs text-muted-foreground">
                  Hotkeys: <span className="font-mono text-foreground">SPACE</span> or <span className="font-mono text-foreground">T</span> = TAKE · <span className="font-mono text-foreground">C</span> = CUT.
                </p>
              </div>
              <Switch
                checked={quickSwitch}
                onCheckedChange={(v) => {
                  const next = Boolean(v);
                  setQuickSwitch(next);
                  saveConfirmationlessMode(next);
                  toast.success(next ? 'Quick Switch enabled' : 'Quick Switch disabled');
                }}
                aria-label="Enable Quick Switch"
              />
            </div>
          </section>

          {/* ── Swatch Manager ───────────────────────────────────────────
              Operator's personal color palette. Available everywhere the
              "Use Swatch" dropdown appears (QR fill, backgrounds, voter
              buttons, answer bars, text). Stored locally on this device.
          */}
          <section className="rounded-lg border border-border bg-card/40 p-6">
            <div className="flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-foreground">
                    <Palette className="h-4 w-4" />
                    <h2 className="text-sm font-medium">Color swatches</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Saved swatches are available in every color field's "Use Swatch" dropdown across the workspace.
                  </p>
                </div>
                <span className="shrink-0 rounded-md border border-border bg-background/50 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {swatches.length} / {MAX_SWATCHES}
                </span>
              </div>

              {/* Create row */}
              <div className="flex flex-wrap items-end gap-2 rounded-md border border-border/60 bg-background/40 p-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(newValue) ? newValue : '#3B82F6'}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0"
                      aria-label="Pick color"
                    />
                    <Input
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="#3B82F6 or hsl(217 91% 60%)"
                      className="h-9 w-56 font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Name</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Brand Blue"
                    className="h-9 w-56 text-xs"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                  />
                </div>
                <Button type="button" size="sm" className="h-9 gap-1.5" onClick={handleCreate}>
                  <Plus className="h-3.5 w-3.5" />
                  Add swatch
                </Button>
              </div>

              {/* List */}
              {swatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No swatches yet. Add one above or save a color from the workspace.</p>
              ) : (
                <ul className="space-y-2">
                  {swatches.map((sw) => (
                    <li
                      key={sw.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background/40 p-2.5"
                    >
                      <span
                        className="h-9 w-9 shrink-0 rounded-md border border-border/70"
                        style={{ background: sw.value }}
                        title={sw.value}
                      />
                      <Input
                        value={sw.name}
                        onChange={(e) => renameSwatch(sw.id, e.target.value)}
                        placeholder="Untitled swatch"
                        className="h-8 w-48 text-xs"
                        aria-label="Swatch name"
                      />
                      <Input
                        value={sw.value}
                        onChange={(e) => updateSwatchValue(sw.id, e.target.value)}
                        placeholder="#000000"
                        className="h-8 w-48 font-mono text-xs"
                        aria-label="Swatch value"
                      />
                      <input
                        type="color"
                        value={/^#[0-9a-fA-F]{6}$/.test(sw.value) ? sw.value : '#000000'}
                        onChange={(e) => updateSwatchValue(sw.id, e.target.value)}
                        className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0"
                        aria-label="Pick color for swatch"
                      />
                      <div className="ml-auto flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 px-2 text-[11px] text-muted-foreground"
                          onClick={() => {
                            navigator.clipboard?.writeText(sw.value).catch(() => {});
                            toast.success(`Copied ${sw.value}`);
                          }}
                        >
                          Copy
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeSwatch(sw.id)}
                          aria-label={`Delete ${sw.name || 'swatch'}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {swatches.length > 0 && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[11px] text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (window.confirm('Delete all saved swatches? This cannot be undone.')) {
                        clearSwatches();
                        toast.success('All swatches cleared');
                      }
                    }}
                  >
                    Clear all swatches
                  </Button>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card/40 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Security audit
                </h2>
                <p className="text-sm text-muted-foreground">
                  Review every public route, anon-accessible policy, and run live verification checks.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/settings/security-audit">Open audit</Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </OperatorLayout>
  );
}