import { useNavigate } from 'react-router-dom';
import { MonitorContainer } from '@/components/broadcast/BroadcastPreviewFrame';
import { PreviewWithOverlays } from '@/components/broadcast/preview/PreviewWithOverlays';
import { LiveStatusIndicator } from '@/components/broadcast/LiveStatusIndicator';
import { PollStatusChip } from '@/components/broadcast/PollStatusChip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  ViewerSlatePreview,
  SlateTextStyle,
  DEFAULT_SLATE_TEXT_STYLE,
  DEFAULT_SLATE_SUBLINE_STYLE,
  DEFAULT_SLATE_SUBLINE_TEXT,
} from '@/components/broadcast/preview/ViewerSlatePreview';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useEffect, useRef, useState } from 'react';
import { BLOCK_LETTERS, BlockLetter, DEFAULT_BLOCK_LABELS, SavedPoll } from '@/lib/poll-persistence';
import { LiveState, Poll, QRPosition, VotingState } from '@/lib/types';
import { SceneType } from '@/lib/scenes';
import { ChevronDown, ChevronRight, Clock, Eye, EyeOff, Globe, Image as ImageIcon, Monitor, Pin, PinOff, Play, RefreshCw, RotateCcw, Smartphone, Square, StopCircle, Type as TypeIcon, Vote, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { percentsFromAnswers, rebalancePercents, answersFromPercents, AnswerLite } from '@/lib/answer-percents';

export type OutputBlockSource = 'pinned' | 'manual' | 'auto-first-populated' | 'auto-promoted' | 'default';

const BLOCK_SOURCE_COPY: Record<OutputBlockSource, { label: string; reason: string }> = {
  pinned:                  { label: 'PINNED',     reason: 'Operator pinned this block — auto-promotion disabled.' },
  manual:                  { label: 'MANUAL',     reason: 'Selected manually by operator.' },
  'auto-first-populated':  { label: 'AUTO',       reason: 'Previous block was empty — jumped to first populated block.' },
  'auto-promoted':         { label: 'AUTO',       reason: 'A higher-priority block (A→E) gained polls and was promoted.' },
  default:                 { label: 'DEFAULT',    reason: 'Default starting block.' },
};

interface OperatorOutputModeProps {
  projectName?: string;
  currentPoll: Poll;
  projectPolls: SavedPoll[];
  folders?: Array<{ id: string; name: string; blockLetter: BlockLetter }>;
  activeFolderId?: string | null;
  onSelectFolder?: (folderId: string) => void;
  activeBlock: BlockLetter;
  blockSource?: OutputBlockSource;
  blockPinned?: boolean;
  onTogglePinBlock?: () => void;
  liveState: LiveState;
  votingState: VotingState;
  previewScene: SceneType;
  programScene: SceneType;
  qrSize: number;
  qrPosition: QRPosition;
  showBranding: boolean;
  brandingPosition: QRPosition;
  previewNode: React.ReactNode;
  /** Whether the active folder includes the Answer Bars asset. Controls
      visibility of the per-bar target % editor in the Vote Runner. */
  hasAnswerBars?: boolean;
  onSelectBlock: (block: BlockLetter) => void;
  onSelectPoll: (pollId: string) => void;
  onSceneChange: (scene: SceneType) => void;
  onTake: () => void;
  onCut: () => void;
  /** Returning the popup window lets us watch for `closed` so the ACTIVE
   *  indicator on the Open Output button clears when the operator dismisses
   *  the fullscreen surface. */
  onOpenOutput: () => Window | null | void;
  onGoLive: () => void;
  onEndPoll: () => void;
  onOpenVoting: () => void;
  onCloseVoting: () => void;
  onRescanPolls?: () => void;
  onQrSizeChange: (size: number) => void;
  onQrPositionChange: (position: QRPosition) => void;
  onShowBrandingChange: (show: boolean) => void;
  onBrandingPositionChange: (position: QRPosition) => void;
  /** Test-vote runner: inject N votes over T seconds across the active poll's answers. */
  testVoteRunning?: boolean;
  onStartTestVotes?: (totalVotes: number, durationSeconds: number, targetPercents?: number[]) => void;
  onStopTestVotes?: () => void;
  /** Reset live/test vote tallies on the current poll back to zero. */
  onResetTestVotes?: () => void;
  /**
   * Live answer-bar editing. Receives the canonical answers list (with
   * testVotes already re-derived from the new percentages) and writes it
   * back into the same Build state, so the inspector and output stay in
   * lockstep without any extra plumbing.
   */
  answers?: AnswerLite[];
  onSetAnswers?: (next: AnswerLite[]) => void;
}

export function OperatorOutputMode({
  projectName,
  currentPoll,
  projectPolls,
  folders = [],
  activeFolderId,
  onSelectFolder,
  activeBlock,
  blockSource = 'default',
  blockPinned = false,
  onTogglePinBlock,
  liveState,
  votingState,
  previewScene,
  programScene,
  qrSize,
  qrPosition,
  showBranding,
  brandingPosition,
  previewNode,
  hasAnswerBars = false,
  onSelectBlock,
  onSelectPoll,
  onSceneChange,
  onTake,
  onCut,
  onOpenOutput,
  onGoLive,
  onEndPoll,
  onOpenVoting,
  onCloseVoting,
  onRescanPolls,
  onQrSizeChange,
  onQrPositionChange,
  onShowBrandingChange,
  onBrandingPositionChange,
  testVoteRunning = false,
  onStartTestVotes,
  onStopTestVotes,
  onResetTestVotes,
  answers,
  onSetAnswers,
}: OperatorOutputModeProps) {
  const navigate = useNavigate();
  // Suppress unused-prop warnings until those features come back. Kept in the
  // signature for parent compatibility.
  void previewScene; void programScene; void qrSize; void qrPosition;
  void showBranding; void brandingPosition;
  void onSceneChange; void onTake; void onCut;
  void onQrSizeChange; void onQrPositionChange;
  void onShowBrandingChange; void onBrandingPositionChange;

  const pollsByBlock = BLOCK_LETTERS.reduce<Record<BlockLetter, SavedPoll[]>>((acc, letter) => {
    acc[letter] = projectPolls
      .filter((poll) => (poll.blockLetter ?? 'A') === letter)
      .sort((a, b) => (a.blockPosition ?? 999) - (b.blockPosition ?? 999));
    return acc;
  }, { A: [], B: [], C: [], D: [], E: [] });

  // Map a poll → its folder name (folders define what the operator sees as the
  // organizational label for each block, e.g. "1st Com"). Folder names are looked
  // up by blockLetter; if multiple folders share a block, the first one wins.
  const folderNameByBlock = folders.reduce<Record<BlockLetter, string | undefined>>((acc, f) => {
    if (!acc[f.blockLetter]) acc[f.blockLetter] = f.name;
    return acc;
  }, { A: undefined, B: undefined, C: undefined, D: undefined, E: undefined });

  // Group folders by block so they appear in the output even when no polls
  // have been created yet. This is what the operator sees as the "block
  // contents" — folder-first, then any polls saved into that block.
  const foldersByBlock = BLOCK_LETTERS.reduce<Record<BlockLetter, Array<{ id: string; name: string }>>>((acc, letter) => {
    acc[letter] = folders.filter((f) => f.blockLetter === letter).map((f) => ({ id: f.id, name: f.name }));
    return acc;
  }, { A: [], B: [], C: [], D: [], E: [] });

  // Counts shown in the Blocks list and Block pane reflect folders only,
  // since polls live inside folders and are not surfaced as block entries.
  const blockEntryCount = (letter: BlockLetter) => foldersByBlock[letter].length;

  // Local controlled inputs for the test-vote runner.
  const [testVoteTotal, setTestVoteTotal] = useState(100);
  const [testVoteDuration, setTestVoteDuration] = useState(30);
  const [targetsOpen, setTargetsOpen] = useState(false);

  // ─── Output Inspector state ────────────────────────────────────────────
  // Polling Slate: a still image / message shown to mobile voters (and on
  // program output) until voting opens. Toggle-only — no countdown. Mobile
  // QR landing renders the slate while `slateActive` is true.
  const [slateText, setSlateText] = useState('Polling will open soon');
  const [slateImage, setSlateImage] = useState<string | undefined>(undefined);
  const [slateActive, setSlateActive] = useState(false);
  // Slate typography — color, weight, size, X/Y nudge. Used in both the
  // operator's mobile/desktop previews and (when wired into ViewerVote) the
  // real public viewer page.
  const [slateTextStyle, setSlateTextStyle] = useState<SlateTextStyle>(DEFAULT_SLATE_TEXT_STYLE);
  // Subline ("Stay tuned…") is editable too — operators reach for this when
  // the default copy is hard to read against a busy background.
  const [slateSublineText, setSlateSublineText] = useState<string>(DEFAULT_SLATE_SUBLINE_TEXT);
  const [slateSublineStyle, setSlateSublineStyle] = useState<SlateTextStyle>(DEFAULT_SLATE_SUBLINE_STYLE);
  // "Test viewer view" — when ON the Program monitor renders the viewer
  // (mobile or desktop) instead of the broadcast composition so the operator
  // can sanity-check what voters will see before going on-air.
  const [testViewerView, setTestViewerView] = useState(false);
  const [testViewerMode, setTestViewerMode] = useState<'mobile' | 'desktop'>('mobile');

  // Tracks whether the operator has opened the fullscreen Output window.
  // Drives the green "ACTIVE" state on the Open Output quick action so
  // operators can see at a glance that a fullscreen surface is live.
  const [outputOpen, setOutputOpen] = useState(false);
  // Track the popup so we can detect close and flip the ACTIVE indicator off.
  const outputWindowRef = useRef<Window | null>(null);

  // Confirmation dialogs for destructive / on-air actions.
  const [confirmGoLive, setConfirmGoLive] = useState(false);
  const [confirmOpenVoting, setConfirmOpenVoting] = useState(false);
  const [goLivePending, setGoLivePending] = useState(false);
  const [openVotingPending, setOpenVotingPending] = useState(false);

  // Program / Mobile / Desktop preview toggle — mirrors Build's preview tabs
  // so operators can sanity-check what mobile and desktop voters currently
  // see (background + slate) without leaving the output workspace.
  const [previewMode, setPreviewMode] = useState<'program' | 'mobile' | 'desktop'>('program');

  // Open Vote scheduling. 'now' opens immediately. 'in' opens after N
  // minutes. 'at' opens at a specific HH:MM (local time).
  const [voteSchedule, setVoteSchedule] = useState<'now' | 'in' | 'at'>('now');
  const [voteInMinutes, setVoteInMinutes] = useState(10);
  const [voteAtTime, setVoteAtTime] = useState(''); // HH:MM
  const [voteScheduledFor, setVoteScheduledFor] = useState<number | null>(null);
  const voteTimerRef = useRef<number | null>(null);

  // Wait for the scheduled Open Vote moment, then trigger onOpenVoting once.
  useEffect(() => {
    if (voteScheduledFor === null) return;
    const ms = Math.max(0, voteScheduledFor - Date.now());
    voteTimerRef.current = window.setTimeout(() => {
      // Dismiss the polling slate so voters immediately see the voting UI
      // instead of the "polling will open soon" holding screen.
      setSlateActive(false);
      onOpenVoting();
      setVoteScheduledFor(null);
    }, ms);
    return () => {
      if (voteTimerRef.current) window.clearTimeout(voteTimerRef.current);
    };
  }, [voteScheduledFor, onOpenVoting]);

  const handleToggleSlate = () => setSlateActive((v) => !v);

  const handleOpenOutputClick = () => {
    const win = onOpenOutput();
    if (win && typeof win === 'object') {
      outputWindowRef.current = win as Window;
    }
    setOutputOpen(true);
  };

  // Poll the popup's `closed` flag so the ACTIVE indicator on Open Output
  // turns off the moment the operator dismisses the fullscreen surface.
  useEffect(() => {
    if (!outputOpen) return;
    const id = window.setInterval(() => {
      const win = outputWindowRef.current;
      if (win && win.closed) {
        outputWindowRef.current = null;
        setOutputOpen(false);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [outputOpen]);

  const handleScheduleVote = () => {
    if (voteSchedule === 'now') {
      // Confirm before opening voting immediately — operator could change
      // their mind. Scheduled votes skip this since there's a built-in
      // delay during which the schedule can be cancelled.
      setConfirmOpenVoting(true);
      return;
    }
    let target = Date.now();
    if (voteSchedule === 'in') {
      target += Math.max(0, voteInMinutes) * 60_000;
    } else if (voteSchedule === 'at' && voteAtTime) {
      const [h, m] = voteAtTime.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1); // tomorrow if past
      target = d.getTime();
    }
    setVoteScheduledFor(target);
  };
  const handleCancelVoteSchedule = () => setVoteScheduledFor(null);

  const slateActiveClass = slateActive
    ? 'border-mako-success/60 bg-mako-success/15 text-mako-success hover:bg-mako-success/25'
    : '';
  // ACTIVE = the fullscreen Output window is currently open. Closing the
  // popup window flips this off (poll on `window.closed` above), regardless
  // of liveState — operators want the indicator to mirror the surface only.
  const outputActiveClass = outputOpen
    ? 'border-mako-success/60 bg-mako-success/15 text-mako-success hover:bg-mako-success/25'
    : '';
  const votingActiveClass = votingState === 'open'
    ? 'border-mako-success/60 bg-mako-success/15 text-mako-success hover:bg-mako-success/25'
    : '';

  // Per-answer target percentages for the test-vote runner. Initialized to
  // an even split across the active poll's answers; auto-rebalances so the
  // sum is always exactly 100. When the operator edits one bar, the other
  // bars share the remaining percentage proportionally to their current
  // values (or evenly if they are all zero).
  const answerCount = currentPoll.options.length;
  const [targetPercents, setTargetPercents] = useState<number[]>(() =>
    answerCount > 0 ? Array.from({ length: answerCount }, () => +(100 / answerCount).toFixed(1)) : [],
  );
  // Keep the array length in sync if the operator switches polls.
  if (targetPercents.length !== answerCount) {
    const next = answerCount > 0
      ? Array.from({ length: answerCount }, () => +(100 / answerCount).toFixed(1))
      : [];
    // Defer to the next render to avoid setting state during render.
    queueMicrotask(() => setTargetPercents(next));
  }

  const handleTargetChange = (index: number, raw: number) => {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));
    setTargetPercents((prev) => {
      if (prev.length <= 1) return [100];
      const next = [...prev];
      next[index] = clamped;
      const remainder = Math.max(0, 100 - clamped);
      const others = prev.map((v, i) => (i === index ? 0 : v));
      const otherSum = others.reduce((s, v) => s + v, 0);
      for (let i = 0; i < next.length; i += 1) {
        if (i === index) continue;
        next[i] = otherSum > 0
          ? +((others[i] / otherSum) * remainder).toFixed(1)
          : +(remainder / (next.length - 1)).toFixed(1);
      }
      // Fix any rounding drift on the last non-edited slot.
      const drift = +(100 - next.reduce((s, v) => s + v, 0)).toFixed(1);
      if (drift !== 0) {
        const lastOther = next.findIndex((_, i) => i !== index);
        if (lastOther >= 0) next[lastOther] = +(next[lastOther] + drift).toFixed(1);
      }
      return next;
    });
  };

  return (
    <div className="h-full overflow-hidden">
      <div className="grid h-full grid-cols-[280px_minmax(0,1fr)_320px] gap-3 p-3">
        <div className="min-h-0 overflow-auto space-y-3">
          <div className="mako-panel p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold font-mono uppercase text-foreground">Blocks</h2>
                <p className="text-[10px] text-muted-foreground mt-1">{projectName ?? 'Current project'} grouped by block</p>
              </div>
              <LiveStatusIndicator state={liveState} />
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">On Output</span>
                  <span className="text-xs font-bold text-primary">Block {activeBlock}</span>
                  <span className="mako-chip bg-muted text-[9px] text-muted-foreground">{BLOCK_SOURCE_COPY[blockSource].label}</span>
                </div>
                {onTogglePinBlock ? (
                  <button
                    type="button"
                    onClick={onTogglePinBlock}
                    title={blockPinned ? 'Unpin — allow auto-promotion' : 'Pin this block across reloads'}
                    className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      blockPinned
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-border bg-transparent text-muted-foreground hover:bg-accent/30'
                    }`}
                  >
                    {blockPinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
                    {blockPinned ? 'Pinned' : 'Pin'}
                  </button>
                ) : null}
              </div>
              <p className="text-[10px] leading-snug text-muted-foreground">{BLOCK_SOURCE_COPY[blockSource].reason}</p>
            </div>
            <div className="space-y-1">
              {BLOCK_LETTERS.map((letter) => (
                <button
                  key={letter}
                  onClick={() => onSelectBlock(letter)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    activeBlock === letter
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-transparent bg-transparent text-muted-foreground hover:bg-accent/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">Block {letter}</span>
                    <span className="font-mono text-[10px]">{blockEntryCount(letter)}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {foldersByBlock[letter][0]?.name ?? DEFAULT_BLOCK_LABELS[letter]}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="mako-panel p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold font-mono uppercase text-foreground">Block {activeBlock}</h2>
              <span className="text-[10px] font-mono text-muted-foreground">{blockEntryCount(activeBlock)} entries</span>
            </div>
            <div className="space-y-1.5">
              {foldersByBlock[activeBlock].length === 0 ? (
                <p className="text-[11px] italic text-muted-foreground">No folders assigned to this block.</p>
              ) : (
                <>
                  {/* Block pane only lists folders assigned to this block.
                      Polls live inside folders and are not surfaced here. */}
                  {foldersByBlock[activeBlock].map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => onSelectFolder?.(folder.id)}
                      disabled={!onSelectFolder}
                      className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                        activeFolderId === folder.id
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-dashed border-border/60 bg-accent/10 hover:bg-accent/25'
                      } ${onSelectFolder ? '' : 'cursor-default'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`truncate text-xs font-medium ${activeFolderId === folder.id ? 'text-primary' : 'text-foreground'}`}>{folder.name}</p>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            {activeFolderId === folder.id ? 'On Air · Folder' : 'Folder · Block ' + activeBlock}
                          </p>
                        </div>
                        <span className="mako-chip bg-muted text-[9px] text-muted-foreground">FOLDER</span>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 overflow-auto space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                {previewMode === 'program' ? 'Program Preview' : 'Viewer Preview'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
                {([
                  { mode: 'program' as const, icon: Monitor, label: 'Program', tooltip: 'Broadcast Output — what goes to air' },
                  { mode: 'mobile' as const, icon: Smartphone, label: 'Mobile', tooltip: 'Viewer Mobile — what voters see on phone' },
                  { mode: 'desktop' as const, icon: Globe, label: 'Desktop', tooltip: 'Viewer Desktop — what voters see in browser' },
                ]).map(({ mode, icon: Icon, label, tooltip }) => (
                  <Tooltip key={mode}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setPreviewMode(mode)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                          previewMode === mode
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{tooltip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
              {previewMode === 'program' && (
                <span className="mako-chip bg-muted text-muted-foreground">1920×1080</span>
              )}
            </div>
          </div>

          {previewMode === 'program' ? (
            testViewerView ? (
              <div className="space-y-2">
                <div className="flex items-center justify-end gap-1 px-1">
                  {(['mobile', 'desktop'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTestViewerMode(m)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${
                        testViewerMode === m
                          ? 'border-primary/40 bg-primary/15 text-primary'
                          : 'border-border bg-transparent text-muted-foreground hover:bg-accent/30'
                      }`}
                    >
                      {m === 'mobile' ? <Smartphone className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                      {m === 'mobile' ? 'Mobile' : 'Desktop'}
                    </button>
                  ))}
                </div>
                <div className="flex justify-center">
                  <ViewerSlatePreview
                    mode={testViewerMode}
                    bgImage={currentPoll.bgImage}
                    bgColor={currentPoll.bgColor}
                    slateActive={slateActive}
                    slateText={slateText}
                    slateImage={slateImage}
                    textStyle={slateTextStyle}
                  />
                </div>
              </div>
            ) : (
              <MonitorContainer variant="operator">
                <PreviewWithOverlays showLabel label="1920×1080">
                  {previewNode}
                </PreviewWithOverlays>
              </MonitorContainer>
            )
          ) : (
            <div className="flex justify-center">
              <ViewerSlatePreview
                mode={previewMode}
                bgImage={currentPoll.bgImage}
                bgColor={currentPoll.bgColor}
                slateActive={slateActive}
                slateText={slateText}
                slateImage={slateImage}
                textStyle={slateTextStyle}
              />
            </div>
          )}

          {/* Live answer-bar percentages. Edits write back into the same Build
              state that the inspector reads from, so Build and Output stay in
              perfect sync without any extra storage layer. */}
          {answers && onSetAnswers && answers.length > 0 && (
            <div className="mako-panel p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Answer Bars · Live %</p>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {percentsFromAnswers(answers).reduce((s, v) => s + v, 0).toFixed(0)}%
                </span>
              </div>
              <div className="space-y-1.5">
                {answers.map((a, i) => {
                  const livePercents = percentsFromAnswers(answers);
                  return (
                    <div key={a.id} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-primary/70" />
                      <span className="flex-1 truncate text-[11px] text-foreground">{a.text || `Answer ${i + 1}`}</span>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={livePercents[i] ?? 0}
                        onChange={(e) => {
                          const next = rebalancePercents(livePercents, i, Number(e.target.value));
                          onSetAnswers(answersFromPercents(answers, next));
                        }}
                        className="h-7 w-16 text-right text-xs"
                      />
                      <span className="text-[10px] text-muted-foreground">%</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Edits sync to Build's inspector instantly.
              </p>
            </div>
          )}

          {/* Test-vote runner — inject N votes over T seconds and watch the
              bars + counters animate in the preview above. Useful for QA'ing
              the chart animation without opening a viewer browser. */}
          {(onStartTestVotes || onStopTestVotes) && (
            <div className="mako-panel p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Vote Runner</p>
                {testVoteRunning && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> running
                  </span>
                )}
              </div>
              {/* Active Poll summary — merged from the standalone Active Poll
                  panel so the right column has room for the Output Inspector. */}
              <div className="rounded-md border border-border/60 bg-accent/10 p-2 space-y-1.5">
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground truncate">{currentPoll.internalName}</p>
                  <p className="text-xs font-semibold text-foreground line-clamp-2">{currentPoll.question || 'No on-air question yet'}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-1.5">
                  <div>
                    <p className="text-[9px] font-mono uppercase text-muted-foreground">Total</p>
                    <p className="text-sm font-bold text-foreground">{currentPoll.totalVotes.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase text-muted-foreground">Votes/sec</p>
                    <p className="text-sm font-bold text-primary">{currentPoll.votesPerSecond}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[10px] uppercase text-muted-foreground">Total votes</span>
                  <Input
                    type="number"
                    min={1}
                    value={testVoteTotal}
                    onChange={(e) => setTestVoteTotal(Math.max(1, Number(e.target.value) || 0))}
                    className="h-7 text-xs"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] uppercase text-muted-foreground">Duration (s)</span>
                  <Input
                    type="number"
                    min={1}
                    value={testVoteDuration}
                    onChange={(e) => setTestVoteDuration(Math.max(1, Number(e.target.value) || 0))}
                    className="h-7 text-xs"
                  />
                </label>
              </div>
              {hasAnswerBars && answerCount > 0 && (
                <Collapsible open={targetsOpen} onOpenChange={setTargetsOpen} className="border-t border-border/60 pt-2">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-accent/30">
                    <span className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                      {targetsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      Target % per bar
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {targetPercents.reduce((s, v) => s + v, 0).toFixed(0)}%
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 pt-2">
                    {currentPoll.options.map((opt, i) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-primary/70" />
                        <span className="flex-1 truncate text-[11px] text-foreground">{opt.text || `Option ${i + 1}`}</span>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={targetPercents[i] ?? 0}
                          onChange={(e) => handleTargetChange(i, Number(e.target.value))}
                          disabled={testVoteRunning}
                          className="h-7 w-16 text-right text-xs"
                        />
                        <span className="text-[10px] text-muted-foreground">%</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground">
                      Editing one bar auto-rebalances the others so the total is always 100%.
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  disabled={testVoteRunning}
                  onClick={() => onStartTestVotes?.(testVoteTotal, testVoteDuration, targetPercents)}
                >
                  <Play className="h-3.5 w-3.5" /> Run
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5 text-xs"
                  disabled={!testVoteRunning}
                  onClick={() => onStopTestVotes?.()}
                >
                  <StopCircle className="h-3.5 w-3.5" /> Stop
                </Button>
              </div>
              {onResetTestVotes && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onResetTestVotes()}
                  title="Zero out test/live vote tallies on this poll. The build will also reflect zero values."
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset votes to 0%
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="min-h-0 overflow-auto space-y-3">
          <div className="mako-panel p-4 space-y-3">
            <h2 className="text-xs font-semibold font-mono uppercase text-foreground">Quick Actions</h2>
            <div className="space-y-1.5">
              <Button
                variant="outline"
                size="sm"
                className={`w-full justify-start gap-2 text-xs ${outputActiveClass}`}
                onClick={handleOpenOutputClick}
              >
                <Monitor className="h-3.5 w-3.5" /> Open Output
                {outputOpen && <span className="ml-auto text-[9px] font-mono">ACTIVE</span>}
              </Button>
              {liveState === 'not_live' ? (
                <Button size="sm" className="w-full justify-start gap-2 text-xs" onClick={() => setConfirmGoLive(true)}>
                  <Play className="h-3.5 w-3.5" /> Go Live
                </Button>
              ) : (
                <Button variant="destructive" size="sm" className="w-full justify-start gap-2 text-xs" onClick={onEndPoll}>
                  <Square className="h-3.5 w-3.5" /> End Poll
                </Button>
              )}
              {votingState !== 'open' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full justify-start gap-2 text-xs ${votingActiveClass}`}
                  onClick={() => setConfirmOpenVoting(true)}
                >
                  <Vote className="h-3.5 w-3.5" /> Open Voting
                  {voteScheduledFor !== null && <span className="ml-auto text-[9px] font-mono text-muted-foreground">SCHEDULED</span>}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full justify-start gap-2 text-xs ${votingActiveClass}`}
                  onClick={onCloseVoting}
                >
                  <XCircle className="h-3.5 w-3.5" /> Close Voting
                  <span className="ml-auto text-[9px] font-mono">ACTIVE</span>
                </Button>
              )}
              {onRescanPolls ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-xs"
                  onClick={onRescanPolls}
                  title="Reload polls from the database to clear phantom or stale entries"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Re-scan Polls
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className={`w-full justify-start gap-2 text-xs ${slateActiveClass}`}
                onClick={handleToggleSlate}
              >
                <Eye className="h-3.5 w-3.5" />
                {slateActive ? 'Stop Polling Slate' : 'Polling Slate'}
                {slateActive && (
                  <span className="ml-auto text-[9px] font-mono">ACTIVE</span>
                )}
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={() => navigate(`/polls/${currentPoll.id}?mode=build`)}>
                <Eye className="h-3.5 w-3.5" /> Open Build Mode
              </Button>
            </div>
          </div>

          {/* ─── Output Inspector ──────────────────────────────────────────
              Polling Slate (image/text + countdown) and Open Vote scheduler.
              Replaces the standalone Active Poll panel — that data now lives
              at the top of Vote Runner, freeing this slot for live controls. */}
          <div className="mako-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold font-mono uppercase text-foreground">Output Inspector</h2>
              {slateActive && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-mako-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-mako-success animate-pulse" /> slate
                </span>
              )}
            </div>

            {/* Test viewer view — swap the Program monitor between the
                broadcast composition and a viewer-eye render so the operator
                can QA exactly what mobile / desktop voters will see before
                going on-air. */}
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Test viewer view</p>
                <p className="text-[10px] text-muted-foreground/70 leading-snug">
                  {testViewerView ? `Program monitor → ${testViewerMode}` : 'Program monitor shows broadcast'}
                </p>
              </div>
              <Switch checked={testViewerView} onCheckedChange={setTestViewerView} />
            </div>

            {/* Polling Slate */}
            <div className="space-y-2 rounded-md border border-border/60 p-2">
              <p className="text-[10px] font-mono uppercase text-muted-foreground">Polling Slate</p>
              <Textarea
                value={slateText}
                onChange={(e) => setSlateText(e.target.value)}
                placeholder="Polling will open soon"
                rows={2}
                className="text-xs"
              />
              {/* Slate typography controls — color, weight, size, X/Y nudge.
                  Operators reach for these when their custom slate text is
                  hard to read against a busy background. */}
              <div className="space-y-1.5 rounded-md border border-border/40 bg-background/40 p-2">
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Slate Text Style</p>
                <div className="flex items-center gap-2">
                  <Label className="w-16 text-[10px] text-muted-foreground">Color</Label>
                  <input
                    type="color"
                    value={slateTextStyle.color ?? '#ffffff'}
                    onChange={(e) => setSlateTextStyle((s) => ({ ...s, color: e.target.value }))}
                    className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent p-0"
                  />
                  <Input
                    value={slateTextStyle.color ?? '#ffffff'}
                    onChange={(e) => setSlateTextStyle((s) => ({ ...s, color: e.target.value }))}
                    className="h-7 flex-1 px-2 text-[10px] font-mono"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-16 text-[10px] text-muted-foreground">Weight</Label>
                  <Slider
                    value={[slateTextStyle.weight ?? 700]}
                    min={300}
                    max={900}
                    step={100}
                    onValueChange={([v]) => setSlateTextStyle((s) => ({ ...s, weight: v }))}
                    className="flex-1"
                  />
                  <span className="w-10 text-right text-[10px] font-mono text-muted-foreground">{slateTextStyle.weight ?? 700}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-16 text-[10px] text-muted-foreground">Size</Label>
                  <Slider
                    value={[slateTextStyle.sizePx ?? 28]}
                    min={14}
                    max={72}
                    step={1}
                    onValueChange={([v]) => setSlateTextStyle((s) => ({ ...s, sizePx: v }))}
                    className="flex-1"
                  />
                  <span className="w-10 text-right text-[10px] font-mono text-muted-foreground">{slateTextStyle.sizePx ?? 28}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-16 text-[10px] text-muted-foreground">X</Label>
                  <Slider
                    value={[slateTextStyle.offsetX ?? 0]}
                    min={-160}
                    max={160}
                    step={1}
                    onValueChange={([v]) => setSlateTextStyle((s) => ({ ...s, offsetX: v }))}
                    className="flex-1"
                  />
                  <span className="w-10 text-right text-[10px] font-mono text-muted-foreground">{slateTextStyle.offsetX ?? 0}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-16 text-[10px] text-muted-foreground">Y</Label>
                  <Slider
                    value={[slateTextStyle.offsetY ?? 0]}
                    min={-200}
                    max={200}
                    step={1}
                    onValueChange={([v]) => setSlateTextStyle((s) => ({ ...s, offsetY: v }))}
                    className="flex-1"
                  />
                  <span className="w-10 text-right text-[10px] font-mono text-muted-foreground">{slateTextStyle.offsetY ?? 0}px</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-full text-[10px] text-muted-foreground"
                  onClick={() => setSlateTextStyle(DEFAULT_SLATE_TEXT_STYLE)}
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Reset slate text style
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-border/60 px-2 py-1.5 text-[10px] text-muted-foreground hover:bg-accent/20">
                  <ImageIcon className="h-3 w-3" />
                  {slateImage ? 'Replace image' : 'Upload image'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setSlateImage(typeof reader.result === 'string' ? reader.result : undefined);
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {slateImage && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => setSlateImage(undefined)}>
                    Clear
                  </Button>
                )}
              </div>
              <Button
                size="sm"
                variant={slateActive ? 'outline' : 'default'}
                className={`w-full gap-1.5 text-xs ${slateActive ? slateActiveClass : ''}`}
                onClick={handleToggleSlate}
              >
                {slateActive ? (
                  <>
                    <StopCircle className="h-3.5 w-3.5" /> Stop Slate
                    <span className="ml-auto font-mono">ACTIVE</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> Start Slate Now
                  </>
                )}
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Mobile voters who scan the QR see this slate until voting opens.
              </p>
            </div>

            {/* Open Vote scheduler */}
            <div className="space-y-2 rounded-md border border-border/60 p-2">
              <p className="text-[10px] font-mono uppercase text-muted-foreground">Open Vote</p>
              <div className="grid grid-cols-3 gap-1">
                {(['now', 'in', 'at'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setVoteSchedule(opt)}
                    disabled={voteScheduledFor !== null}
                    className={`rounded-md border px-2 py-1 text-[10px] font-medium capitalize transition-colors ${
                      voteSchedule === opt
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-border bg-transparent text-muted-foreground hover:bg-accent/30'
                    } disabled:opacity-50`}
                  >
                    {opt === 'in' ? 'In…' : opt === 'at' ? 'At…' : 'Now'}
                  </button>
                ))}
              </div>
              {voteSchedule === 'in' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase text-muted-foreground">Minutes</span>
                  <Input
                    type="number"
                    min={1}
                    value={voteInMinutes}
                    onChange={(e) => setVoteInMinutes(Math.max(1, Number(e.target.value) || 0))}
                    disabled={voteScheduledFor !== null}
                    className="ml-auto h-7 w-20 text-right text-xs"
                  />
                </div>
              )}
              {voteSchedule === 'at' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase text-muted-foreground">Time</span>
                  <Input
                    type="time"
                    value={voteAtTime}
                    onChange={(e) => setVoteAtTime(e.target.value)}
                    disabled={voteScheduledFor !== null}
                    className="ml-auto h-7 w-28 text-xs"
                  />
                </div>
              )}
              {voteScheduledFor !== null ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 rounded-md border border-mako-success/40 bg-mako-success/10 px-2 py-1 text-[10px] text-mako-success">
                    <Clock className="h-3 w-3" />
                    Scheduled for {new Date(voteScheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={handleCancelVoteSchedule}>
                    <XCircle className="h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  className={`w-full gap-1.5 text-xs ${votingState === 'open' ? votingActiveClass : ''}`}
                  variant={votingState === 'open' ? 'outline' : 'default'}
                  onClick={handleScheduleVote}
                >
                  <Vote className="h-3.5 w-3.5" />
                  {voteSchedule === 'now' ? 'Open Voting Now' : voteSchedule === 'in' ? `Open in ${voteInMinutes}m` : voteAtTime ? `Open at ${voteAtTime}` : 'Pick a time'}
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground">
                Bars reset to 0% when voting opens.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation: Go Live ─────────────────────────────────────────── */}
      <AlertDialog
        open={confirmGoLive}
        onOpenChange={(open) => { if (!goLivePending) setConfirmGoLive(open); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Go live with this poll?</AlertDialogTitle>
            <AlertDialogDescription>
              This will push the current poll to the program output. Make sure the
              right block, folder, and assets are queued before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={goLivePending}>No, cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={goLivePending}
              onClick={(e) => {
                e.preventDefault();
                if (goLivePending) return;
                setGoLivePending(true);
                try { onGoLive(); } finally {
                  setTimeout(() => {
                    setGoLivePending(false);
                    setConfirmGoLive(false);
                  }, 600);
                }
              }}
            >
              {goLivePending ? 'Going live…' : 'Yes, go live'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation: Open Voting Now ──────────────────────────────────── */}
      <AlertDialog
        open={confirmOpenVoting}
        onOpenChange={(open) => { if (!openVotingPending) setConfirmOpenVoting(open); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Open voting now?</AlertDialogTitle>
            <AlertDialogDescription>
              Voters will immediately be able to submit responses. Scheduled
              opens (in N minutes / at a time) skip this confirmation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={openVotingPending}>No, wait</AlertDialogCancel>
            <AlertDialogAction
              disabled={openVotingPending}
              onClick={(e) => {
                e.preventDefault();
                if (openVotingPending) return;
                setOpenVotingPending(true);
                try {
                  // Take down the slate the moment voting opens so mobile/
                  // desktop voters transition straight into the voting screen.
                  setSlateActive(false);
                  onOpenVoting();
                } finally {
                  setTimeout(() => {
                    setOpenVotingPending(false);
                    setConfirmOpenVoting(false);
                  }, 600);
                }
              }}
            >
              {openVotingPending ? 'Opening…' : 'Yes, open voting'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
