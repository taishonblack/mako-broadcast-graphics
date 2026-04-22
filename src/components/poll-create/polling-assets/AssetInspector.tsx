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
  // New asset state
  assetState: AssetState;
  setAssetState: (next: AssetState) => void;
}

export function AssetInspector(p: AssetInspectorProps) {
  const id = p.selectedAssetId;
  if (!id) {
    return (
      <div className="p-4 space-y-2">
        <p className="text-xs text-muted-foreground">
          Select an asset on the left to edit its properties.
        </p>
        <p className="text-[10px] text-muted-foreground/60 italic">
          Tip: right-click the Polling Assets pane to add new assets.
        </p>
      </div>
    );
  }

  const meta = ASSET_REGISTRY[id];
  const Icon = meta.icon;

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
            <Label className="text-[10px] text-muted-foreground">Question</Label>
            <Input
              value={p.question}
              onChange={(e) => p.setQuestion(e.target.value)}
              className="bg-background/50 h-8 text-xs"
              placeholder="On-air question…"
            />
            <Label className="text-[10px] text-muted-foreground pt-1">Internal Name</Label>
            <Input
              value={p.internalName}
              onChange={(e) => p.setInternalName(e.target.value)}
              className="bg-background/50 h-8 text-xs"
              placeholder="e.g. Penalty Call Q1"
            />
            <Label className="text-[10px] text-muted-foreground pt-1">Viewer Slug</Label>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground font-mono">/vote/</span>
              <Input
                value={p.slug}
                onChange={(e) => p.setSlug(e.target.value)}
                className="bg-background/50 h-8 text-xs"
                placeholder="penalty-call"
              />
            </div>
          </div>
        )}

        {id === 'subheadline' && (
          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground">Subheadline Text</Label>
            <Input
              value={p.subheadline}
              onChange={(e) => p.setSubheadline(e.target.value)}
              className="bg-background/50 h-8 text-xs"
              placeholder="Optional secondary line"
            />
            <p className="text-[9px] text-muted-foreground">
              Renders directly beneath the question in the preview.
            </p>
          </div>
        )}

        {id === 'answers' && (
          <div className="space-y-3">
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
                <div key={a.id} className="flex items-center gap-1.5 p-1.5 rounded-md bg-accent/30 border border-border/40">
                  <GripVertical className="w-3 h-3 text-muted-foreground/40" />
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
                  <Input
                    type="number"
                    min={0}
                    value={a.testVotes ?? 0}
                    onChange={(e) => {
                      const next = [...p.answers];
                      next[i] = { ...next[i], testVotes: Number(e.target.value) || 0 };
                      p.setAnswers(next);
                    }}
                    className="bg-primary/5 border-primary/30 h-7 text-[10px] w-14 font-mono"
                  />
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
                  onClick={() => p.setAnswers([
                    ...p.answers,
                    { id: String(Date.now()), text: '', shortLabel: '', testVotes: 0 },
                  ])}
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
          />
        )}

        {id === 'qr' && (
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] text-muted-foreground">Position</Label>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => p.setAssetState({ ...p.assetState, qrPosition: pos })}
                    className={`p-1.5 rounded-md text-[10px] font-medium border transition-all ${
                      p.assetState.qrPosition === pos
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent/50'
                    }`}
                  >
                    {pos.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Size</Label>
                <span className="text-[10px] font-mono text-muted-foreground">{p.assetState.qrSize}px</span>
              </div>
              <Slider
                value={[p.assetState.qrSize]}
                min={64} max={240} step={8}
                onValueChange={(v) => p.setAssetState({ ...p.assetState, qrSize: v[0] })}
                className="mt-2"
              />
            </div>
          </div>
        )}

        {id === 'logo' && (
          <div className="space-y-3">
            <Label className="text-[10px] text-muted-foreground">Logo URL</Label>
            <Input
              value={p.assetState.logoUrl ?? ''}
              onChange={(e) => p.setAssetState({ ...p.assetState, logoUrl: e.target.value || undefined })}
              placeholder="https://…/logo.png"
              className="bg-background/50 h-8 text-[11px]"
            />
            <Label className="text-[10px] text-muted-foreground pt-1">Position</Label>
            <div className="grid grid-cols-2 gap-1">
              {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => p.setAssetState({ ...p.assetState, logoPosition: pos })}
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
      </div>
    </div>
  );
}
