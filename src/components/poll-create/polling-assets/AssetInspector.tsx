import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  AnswerType, MCLabelStyle,
} from '@/components/poll-create/ContentPanel';
import { ASSET_REGISTRY } from './PollingAssetsPane';
import { AssetColorMap, AssetId, AssetState, TransformViewport } from './types';
import { POLLING_GRAPHIC_DEFAULTS as PGD } from '@/lib/polling-graphic-defaults';
import { Trash2, PlusCircle, GripVertical } from 'lucide-react';
import { BackgroundPicker } from '@/components/poll-create/BackgroundPicker';
import { MediaPicker } from '@/components/poll-create/MediaPicker';
import { Dispatch, SetStateAction, useState } from 'react';
import {
  answersFromPercents,
  EQUAL_BASE,
  percentsFromAnswers,
  rebalancePercents,
} from '@/lib/answer-percents';

interface AssetInspectorProps {
  selectedAssetId: AssetId | null;
  // Poll fields
  question: string; setQuestion: (v: string) => void;
  subheadline: string; setSubheadline: (v: string) => void;
  internalName: string; setInternalName: (v: string) => void;
  slug: string; setSlug: (v: string) => void;
  answerType: AnswerType; setAnswerType: (v: AnswerType) => void;
  mcLabelStyle: MCLabelStyle; setMcLabelStyle: (v: MCLabelStyle) => void;
  answers: { id: string; text: string; shortLabel: string; testVotes?: number }[];
  setAnswers: (v: { id: string; text: string; shortLabel: string; testVotes?: number }[]) => void;
  // Background lives in PollCreate
  bgColor: string; setBgColor: (v: string) => void;
  bgImage?: string;
  setBgImage: (v: string | undefined) => void;
  imageMissing?: boolean;
  onImageMissing?: () => void;
  // New asset state
  assetState: AssetState;
  setAssetState: Dispatch<SetStateAction<AssetState>>;
  /** When set, the inspector pulses the matching control to draw operator attention */
  highlightField?: string | null;
  /**
   * Reset an asset's X/Y transform offset to 0. Called when the operator picks a
   * Quick Placement preset so the new anchor (TL/TR/BL/BR) actually shows the
   * asset at that corner instead of leaving a stale center/translate offset
   * that traps it on one side of the 1920x1080 stage.
   */
  onResetAssetPosition?: (assetId: AssetId) => void;
  /** Fires the Convert-to-Bars action on the active folder. Shown only on
   *  the Answer Type asset panel. */
  onConvertAnswerTypeToBars?: () => void;
  /** Fires the reverse Convert-to-Answer-Type action. Shown only on the
   *  Answer Bars asset panel so the operator can flip back to vote-input
   *  mode without rebuilding the folder. */
  onConvertAnswerBarsToAnswerType?: () => void;
  /** Active viewport (program/mobile/desktop). Style edits write into the
   *  matching slice of the color set so each device can be tuned
   *  independently. */
  activeViewport?: TransformViewport;
  /** Color map for the active viewport (used to read pill-style overrides). */
  assetColors?: AssetColorMap;
  /** Writer for the active-viewport color slice. */
  setAssetColors?: (updater: (current: AssetColorMap) => AssetColorMap) => void;
}

export function AssetInspector(p: AssetInspectorProps) {
  const id = p.selectedAssetId;
  const [draggedAnswerId, setDraggedAnswerId] = useState<string | null>(null);
  // Live validation for AnswerType choices: flag empty and duplicate (case-
  // insensitive, trimmed) entries so the operator can't ship a poll with
  // ambiguous voter buttons.
  const answerTypeIssues = (() => {
    if (id !== 'answerType') return new Map<string, 'empty' | 'duplicate'>();
    const issues = new Map<string, 'empty' | 'duplicate'>();
    const seen = new Map<string, string>(); // normalized -> first answer id
    p.answers.forEach((a) => {
      const norm = a.text.trim().toLowerCase();
      if (!norm) {
        issues.set(a.id, 'empty');
        return;
      }
      if (seen.has(norm)) {
        issues.set(a.id, 'duplicate');
        const firstId = seen.get(norm)!;
        if (!issues.has(firstId)) issues.set(firstId, 'duplicate');
      } else {
        seen.set(norm, a.id);
      }
    });
    return issues;
  })();
  const hl = (field: string) =>
    p.highlightField === field
      ? 'ring-2 ring-primary/70 animate-pulse'
      : '';
  if (!id) {
    return (
      <div className="p-4 space-y-2">
        <p className="text-xs text-muted-foreground">
          Select an asset on the left to edit its properties.
        </p>
        <p className="text-[10px] text-muted-foreground/60 italic">
          Select a block folder, then use its add-asset icon.
        </p>
      </div>
    );
  }

  const meta = ASSET_REGISTRY[id];
  const Icon = meta.icon;
  const reorderAnswers = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const next = [...p.answers];
    const fromIndex = next.findIndex((answer) => answer.id === fromId);
    const toIndex = next.findIndex((answer) => answer.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    p.setAnswers(next);
  };

  const Header = (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/20">
      <Icon className="w-3.5 h-3.5 text-primary" />
      <span className="text-[11px] font-semibold uppercase tracking-wider">{meta.label}</span>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {Header}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {id === 'question' && (
          <div className="space-y-2">
            <Label className={`text-[10px] text-muted-foreground ${p.highlightField === 'question' ? 'text-primary' : ''}`}>Question</Label>
            <Input
              value={p.question}
              onChange={(e) => p.setQuestion(e.target.value)}
              className={`bg-background/50 h-8 text-xs ${hl('question')}`}
              placeholder="Write question here"
            />
            <Label className={`text-[10px] text-muted-foreground pt-1 ${p.highlightField === 'internalName' ? 'text-primary' : ''}`}>Internal Name</Label>
            <Input
              value={p.internalName}
              onChange={(e) => p.setInternalName(e.target.value)}
              className={`bg-background/50 h-8 text-xs ${hl('internalName')}`}
              placeholder="e.g. Penalty Call Q1"
            />
            <Label className={`text-[10px] text-muted-foreground pt-1 ${p.highlightField === 'slug' ? 'text-primary' : ''}`}>Viewer Slug</Label>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground font-mono">/vote/</span>
              <Input
                value={p.slug}
                onChange={(e) => p.setSlug(e.target.value)}
                className={`bg-background/50 h-8 text-xs ${hl('slug')}`}
                placeholder="penalty-call"
              />
            </div>
            {(p.highlightField === 'blockLetter' || p.highlightField === 'blockPosition') && (
              <p className={`text-[10px] mt-1 px-2 py-1 rounded bg-primary/10 text-primary border border-primary/30 ${hl(p.highlightField)}`}>
                Open the block folder controls in Polling Assets to fix <span className="font-mono">{p.highlightField}</span>.
              </p>
            )}
          </div>
        )}

        {id === 'subheadline' && (
          <div className="space-y-2">
            <Label className={`text-[10px] text-muted-foreground ${p.highlightField === 'subheadline' ? 'text-primary' : ''}`}>Subheadline Text</Label>
            <Input
              value={p.subheadline}
              onChange={(e) => p.setSubheadline(e.target.value)}
              className={`bg-background/50 h-8 text-xs ${hl('subheadline')}`}
              placeholder="Optional secondary line"
            />
            <p className="text-[9px] text-muted-foreground">
              Renders directly beneath the question in the preview.
            </p>
          </div>
        )}

        {(id === 'answers' || id === 'answerType') && (
          <div className="space-y-3">
            {id === 'answerType' && p.onConvertAnswerTypeToBars && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 space-y-1.5">
                <p className="text-[10px] text-muted-foreground leading-tight">
                  This is the on-device vote input. When you're ready to reveal results, convert it to Answer Bars — the QR in this folder will be muted.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-[10px]"
                  onClick={p.onConvertAnswerTypeToBars}
                >
                  Convert to Answer Bars
                </Button>
              </div>
            )}
            {id === 'answers' && p.onConvertAnswerBarsToAnswerType && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 space-y-1.5">
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Need to collect votes again? Convert back to Answer Type — the on-device vote buttons return and the QR in this folder is re-activated.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-[10px]"
                  onClick={p.onConvertAnswerBarsToAnswerType}
                >
                  Convert to Answer Type
                </Button>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Answer Type</Label>
              <div className="grid grid-cols-3 gap-1">
                {(['yes-no', 'multiple-choice', 'custom'] as AnswerType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => { if (t !== 'custom') p.setAnswerType(t); }}
                    disabled={t === 'custom'}
                    title={t === 'custom' ? 'Coming soon — reserved for future customization.' : undefined}
                    className={`p-1.5 rounded-md text-[10px] font-medium transition-all border ${
                      t === 'custom'
                        ? 'bg-muted/30 border-border/40 text-muted-foreground/40 cursor-not-allowed'
                        : p.answerType === t
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/50'
                    }`}
                  >
                    {t === 'yes-no' ? 'Y/N' : t === 'multiple-choice' ? 'MC' : 'Custom'}
                  </button>
                ))}
              </div>
            </div>

            {p.answerType === 'multiple-choice' && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Label Style</Label>
                <div className="grid grid-cols-3 gap-1">
                  {(['letters', 'numbers', 'custom'] as MCLabelStyle[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => { if (s !== 'custom') p.setMcLabelStyle(s); }}
                      disabled={s === 'custom'}
                      title={s === 'custom' ? 'Coming soon — reserved for future customization.' : undefined}
                      className={`p-1.5 rounded-md text-[10px] font-medium transition-all border ${
                        s === 'custom'
                          ? 'bg-muted/30 border-border/40 text-muted-foreground/40 cursor-not-allowed'
                          : p.mcLabelStyle === s
                            ? 'bg-primary/10 border-primary/30 text-primary'
                            : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/50'
                      }`}
                    >
                      {s === 'letters' ? 'A/B/C' : s === 'numbers' ? '1/2/3' : 'Custom'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">
                {id === 'answerType' ? 'Choices' : 'Answers · Test Votes'}
              </Label>
              {p.answers.map((a, i) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-1.5 rounded-md border bg-accent/30 p-1.5 ${
                    answerTypeIssues.has(a.id)
                      ? 'border-destructive/60 ring-1 ring-destructive/30'
                      : 'border-border/40'
                  }`}
                  onDragOver={(event) => {
                    if (!draggedAnswerId) return;
                    event.preventDefault();
                  }}
                  onDrop={() => {
                    if (!draggedAnswerId) return;
                    reorderAnswers(draggedAnswerId, a.id);
                    setDraggedAnswerId(null);
                  }}
                >
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      setDraggedAnswerId(a.id);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => setDraggedAnswerId(null)}
                    className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded border border-border/50 bg-background/40 text-muted-foreground/60 transition-colors hover:text-foreground active:cursor-grabbing"
                    aria-label={`Reorder answer ${i + 1}`}
                    title={`Drag to reorder answer ${i + 1}`}
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                  <Input
                    value={a.text}
                    onChange={(e) => {
                      const next = [...p.answers];
                      next[i] = { ...next[i], text: e.target.value };
                      p.setAnswers(next);
                    }}
                    placeholder={id === 'answerType' ? `Choice ${i + 1}` : `Answer ${i + 1}`}
                    disabled={id !== 'answerType' && p.answerType === 'yes-no'}
                    className={`bg-background/50 h-7 text-[11px] flex-1 ${
                      answerTypeIssues.has(a.id) ? 'border-destructive/60' : ''
                    }`}
                    aria-invalid={answerTypeIssues.has(a.id) || undefined}
                  />
                  {id === 'answers' && (
                  <div className="flex items-center gap-0.5">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={(percentsFromAnswers(p.answers)[i] ?? 0)}
                      onChange={(e) => {
                        const currentPercents = percentsFromAnswers(p.answers);
                        const nextPercents = rebalancePercents(currentPercents, i, Number(e.target.value));
                        p.setAnswers(answersFromPercents(p.answers, nextPercents));
                      }}
                      title="Bar percentage of total votes. Editing one re-balances the others to keep the sum at 100%."
                      className="bg-primary/5 border-primary/30 h-7 text-[10px] w-14 font-mono text-right"
                    />
                    <span className="text-[10px] text-muted-foreground">%</span>
                  </div>
                  )}
                  <button
                    onClick={() => {
                      const min = id === 'answerType' ? 1 : 2;
                      if (p.answers.length > min) p.setAnswers(p.answers.filter((x) => x.id !== a.id));
                    }}
                    disabled={
                      id === 'answerType'
                        ? p.answers.length <= 1
                        : p.answers.length <= 2 || p.answerType === 'yes-no'
                    }
                    className="text-muted-foreground/50 hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {id === 'answerType' && answerTypeIssues.size > 0 && (
                <ul className="space-y-0.5 text-[9px] text-destructive">
                  {p.answers.map((a, i) => {
                    const issue = answerTypeIssues.get(a.id);
                    if (!issue) return null;
                    return (
                      <li key={a.id} className="leading-tight">
                        Choice {i + 1}: {issue === 'empty' ? 'text is required.' : 'duplicate of another choice.'}
                      </li>
                    );
                  })}
                </ul>
              )}
              {(id === 'answerType' || (p.answerType !== 'yes-no' && p.answers.length < 4)) && (
                <Button
                  variant="outline" size="sm"
                  onClick={() => {
                    const next = [
                      ...p.answers,
                      { id: String(Date.now()), text: '', shortLabel: '', testVotes: EQUAL_BASE },
                    ].map((a) => ({ ...a, testVotes: EQUAL_BASE }));
                    p.setAnswers(next);
                  }}
                  className="w-full h-7 text-[10px] gap-1"
                >
                  <PlusCircle className="w-3 h-3" /> {id === 'answerType' ? 'Add Choice' : 'Add Answer'}
                </Button>
              )}
              {id === 'answerType' && (
                <p className="text-[9px] text-muted-foreground/70 leading-tight">
                  These are the choices voters tap on mobile/desktop. Add as many as you need.
                </p>
              )}
            </div>

            {/* ----------------------------------------------------------
               Style — per-viewport pill padding + radius. Writes into the
               active viewport's color slice so Mobile / Desktop / Program
               can each be tuned independently. Edits flow automatically
               through Answer Bars (Program) and the voter buttons
               (Mobile / Desktop) because every renderer reads from the
               same `answers` color slice with PGD fallbacks.
               ---------------------------------------------------------- */}
            {p.setAssetColors && (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Style
                  </Label>
                  <span className="text-[9px] font-mono uppercase text-primary/80">
                    {p.activeViewport ?? 'program'}
                  </span>
                </div>
                {(() => {
                  // Style is stored under the `answers` key so a single edit
                  // drives both Answer Bars AND the voter buttons (the voter
                  // renderer reads `answers` first). Operators can still
                  // override `answerType` separately if they want device-only
                  // styling — but the default is unified.
                  const cfg = p.assetColors?.answers ?? {};
                  const padY = cfg.barPaddingY ?? PGD.answerButtonPaddingY;
                  const padX = cfg.barPaddingX ?? 32;
                  const radius = cfg.barBorderRadius ?? PGD.answerBorderRadius;
                  const setStyle = (patch: Partial<typeof cfg>) =>
                    p.setAssetColors!((current) => ({
                      ...current,
                      answers: { ...(current.answers ?? {}), ...patch },
                    }));
                  return (
                    <>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-muted-foreground">Padding Y</Label>
                          <span className="text-[10px] font-mono text-muted-foreground">{padY}px</span>
                        </div>
                        <Slider
                          min={0}
                          max={80}
                          step={1}
                          value={[padY]}
                          onValueChange={([v]) => setStyle({ barPaddingY: v })}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-muted-foreground">Padding X</Label>
                          <span className="text-[10px] font-mono text-muted-foreground">{padX}px</span>
                        </div>
                        <Slider
                          min={0}
                          max={80}
                          step={1}
                          value={[padX]}
                          onValueChange={([v]) => setStyle({ barPaddingX: v })}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-muted-foreground">Border Radius</Label>
                          <span className="text-[10px] font-mono text-muted-foreground">{radius}px</span>
                        </div>
                        <Slider
                          min={0}
                          max={48}
                          step={1}
                          value={[radius]}
                          onValueChange={([v]) => setStyle({ barBorderRadius: v })}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-[10px]"
                        onClick={() =>
                          setStyle({
                            barPaddingY: undefined,
                            barPaddingX: undefined,
                            barBorderRadius: undefined,
                          })
                        }
                      >
                        Reset to default
                      </Button>
                      <p className="text-[9px] text-muted-foreground/70 leading-tight">
                        Applies to <span className="font-mono">{p.activeViewport ?? 'program'}</span>. Switch the preview tab (Program / Mobile / Desktop) to tune each device.
                      </p>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {id === 'background' && (
          <BackgroundPicker
            bgColor={p.bgColor}
            setBgColor={p.setBgColor}
            bgImage={p.bgImage}
            setBgImage={p.setBgImage}
            imageMissing={p.imageMissing}
            onImageMissing={p.onImageMissing}
          />
        )}

        {id === 'qr' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-2.5 py-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Show QR in scene</Label>
                <p className="text-[10px] text-muted-foreground/70">Confirms the QR asset is enabled for this poll scene.</p>
              </div>
              <Switch
                checked={p.assetState.qrVisible}
                onCheckedChange={(checked) => p.setAssetState((current) => ({ ...current, qrVisible: checked }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-2.5 py-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Show URL label</Label>
                <p className="text-[10px] text-muted-foreground/70">Toggles the visible vote URL beneath the QR code.</p>
              </div>
              <Switch
                checked={p.assetState.qrUrlVisible}
                onCheckedChange={(checked) => p.setAssetState((current) => ({ ...current, qrUrlVisible: checked }))}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Quick placement</Label>
                <span className="text-[10px] font-mono uppercase text-primary">{p.assetState.qrPosition.replace('-', ' ')}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => {
                      p.setAssetState((current) => ({ ...current, qrPosition: pos }));
                      p.onResetAssetPosition?.('qr');
                    }}
                    className={`p-1.5 rounded-md text-[10px] font-medium border transition-all ${
                      p.assetState.qrPosition === pos
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/50'
                    }`}
                  >
                    {pos === 'top-left' ? 'TL' : pos === 'top-right' ? 'TR' : pos === 'bottom-left' ? 'BL' : 'BR'}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border/50 bg-background/30 px-2.5 py-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Quick test checklist</p>
              <ul className="mt-1.5 space-y-1 text-[10px] text-muted-foreground/80">
                <li>• Turn off Show URL label, switch templates, and confirm it stays off.</li>
                <li>• Toggle Show QR in scene off/on, close and reopen the inspector, and confirm it holds.</li>
                <li>• Move the QR with a preset button, switch templates, and confirm the same corner stays selected.</li>
              </ul>
            </div>
          </div>
        )}

        {id === 'logo' && (
          <div className="space-y-3">
            <MediaPicker
              kind="logo"
              value={p.assetState.logoUrl}
              onChange={(url) => p.setAssetState((s) => ({ ...s, logoUrl: url }))}
            />
            <p className="text-[10px] text-muted-foreground/80">
              Use Theme &amp; Graphics to tune the split Mako Vote wordmark and verify center alignment guides.
            </p>
            <Label className="text-[10px] text-muted-foreground pt-1">Bug Position</Label>
            <div className="grid grid-cols-2 gap-1">
              {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => {
                    p.setAssetState({ ...p.assetState, logoPosition: pos });
                    p.onResetAssetPosition?.('logo');
                  }}
                  className={`p-1.5 rounded-md text-[10px] font-medium border transition-all ${
                    p.assetState.logoPosition === pos
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/50'
                  }`}
                >
                  {pos.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
        )}

        {id === 'voterTally' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Show on broadcast</Label>
              <Switch
                checked={p.assetState.voterTallyShow}
                onCheckedChange={(v) => p.setAssetState({ ...p.assetState, voterTallyShow: v })}
              />
            </div>
            <Label className="text-[10px] text-muted-foreground">Format</Label>
            <div className="grid grid-cols-3 gap-1">
              {(['number', 'compact', 'percent'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => p.setAssetState({ ...p.assetState, voterTallyFormat: fmt })}
                  className={`p-1.5 rounded-md text-[10px] font-medium border capitalize transition-all ${
                    p.assetState.voterTallyFormat === fmt
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/50'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        )}

        {id === 'image' && (
          <div className="space-y-3">
            <MediaPicker
              kind="image"
              value={p.assetState.imageUrl}
              onChange={(url) => p.setAssetState((s) => ({ ...s, imageUrl: url }))}
              emptyHint="No image selected"
            />
            <Label className="text-[10px] text-muted-foreground pt-1">Position</Label>
            <div className="grid grid-cols-3 gap-1">
              {(['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => {
                    p.setAssetState({ ...p.assetState, imagePosition: pos });
                    p.onResetAssetPosition?.('image');
                  }}
                  className={`p-1.5 rounded-md text-[10px] font-medium border transition-all ${
                    p.assetState.imagePosition === pos
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/50'
                  }`}
                >
                  {pos.replace('-', ' ')}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              Drop in a player headshot, sponsor mark, or any custom photo. Re-open the
              "Add asset → Image" menu any time to swap or update.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
