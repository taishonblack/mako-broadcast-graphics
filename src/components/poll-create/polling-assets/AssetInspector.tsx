import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  AnswerType, MCLabelStyle,
} from '@/components/poll-create/ContentPanel';
import { ASSET_REGISTRY } from './PollingAssetsPane';
import { AssetId, AssetState } from './types';
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
}

export function AssetInspector(p: AssetInspectorProps) {
  const id = p.selectedAssetId;
  const [draggedAnswerId, setDraggedAnswerId] = useState<string | null>(null);
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
              placeholder="On-air question…"
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
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Answer Type</Label>
              <div className="grid grid-cols-3 gap-1">
                {(['yes-no', 'multiple-choice', 'custom'] as AnswerType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => p.setAnswerType(t)}
                    className={`p-1.5 rounded-md text-[10px] font-medium transition-all border ${
                      p.answerType === t
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
                      onClick={() => p.setMcLabelStyle(s)}
                      className={`p-1.5 rounded-md text-[10px] font-medium transition-all border ${
                        p.mcLabelStyle === s
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
              <Label className="text-[10px] text-muted-foreground">Answers · Test Votes</Label>
              {p.answers.map((a, i) => (
                <div
                  key={a.id}
                  className="flex items-center gap-1.5 rounded-md border border-border/40 bg-accent/30 p-1.5"
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
                    placeholder={`Answer ${i + 1}`}
                    disabled={p.answerType === 'yes-no'}
                    className="bg-background/50 h-7 text-[11px] flex-1"
                  />
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
                  <button
                    onClick={() => {
                      if (p.answers.length > 2) p.setAnswers(p.answers.filter((x) => x.id !== a.id));
                    }}
                    disabled={p.answers.length <= 2 || p.answerType === 'yes-no'}
                    className="text-muted-foreground/50 hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {p.answerType !== 'yes-no' && p.answers.length < 4 && (
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
                  <PlusCircle className="w-3 h-3" /> Add Answer
                </Button>
              )}
            </div>
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
