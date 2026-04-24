import { useNavigate } from 'react-router-dom';
import { MonitorContainer } from '@/components/broadcast/BroadcastPreviewFrame';
import { PreviewWithOverlays } from '@/components/broadcast/preview/PreviewWithOverlays';
import { LiveStatusIndicator } from '@/components/broadcast/LiveStatusIndicator';
import { PollStatusChip } from '@/components/broadcast/PollStatusChip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { BLOCK_LETTERS, BlockLetter, DEFAULT_BLOCK_LABELS, SavedPoll } from '@/lib/poll-persistence';
import { LiveState, Poll, QRPosition, VotingState } from '@/lib/types';
import { SceneType } from '@/lib/scenes';
import { Copy, Eye, Monitor, Pin, PinOff, Play, RefreshCw, RotateCcw, Square, StopCircle, Vote, XCircle } from 'lucide-react';

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
  onSelectBlock: (block: BlockLetter) => void;
  onSelectPoll: (pollId: string) => void;
  onSceneChange: (scene: SceneType) => void;
  onTake: () => void;
  onCut: () => void;
  onOpenOutput: () => void;
  onGoLive: () => void;
  onEndPoll: () => void;
  onOpenVoting: () => void;
  onCloseVoting: () => void;
  onDuplicatePoll: () => void;
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
  onDuplicatePoll,
  onRescanPolls,
  onQrSizeChange,
  onQrPositionChange,
  onShowBrandingChange,
  onBrandingPositionChange,
  testVoteRunning = false,
  onStartTestVotes,
  onStopTestVotes,
  onResetTestVotes,
}: OperatorOutputModeProps) {
  const navigate = useNavigate();
  // Suppress unused-prop warnings until those features come back. Kept in the
  // signature for parent compatibility.
  void previewScene; void programScene; void qrSize; void qrPosition;
  void showBranding; void brandingPosition; void votingState;
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
              <h2 className="text-sm font-semibold text-foreground">Program Preview</h2>
            </div>
            <span className="mako-chip bg-muted text-muted-foreground">1920×1080</span>
          </div>

          <MonitorContainer variant="operator">
            <PreviewWithOverlays showLabel label="1920×1080">
              {previewNode}
            </PreviewWithOverlays>
          </MonitorContainer>

          {/* Test-vote runner — inject N votes over T seconds and watch the
              bars + counters animate in the preview above. Useful for QA'ing
              the chart animation without opening a viewer browser. */}
          {(onStartTestVotes || onStopTestVotes) && (
            <div className="mako-panel p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Test Vote Runner</p>
                {testVoteRunning && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> running
                  </span>
                )}
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
              {answerCount > 0 && (
                <div className="space-y-1.5 border-t border-border/60 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-muted-foreground">Target % per bar</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {targetPercents.reduce((s, v) => s + v, 0).toFixed(0)}%
                    </span>
                  </div>
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
                </div>
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
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={onOpenOutput}>
                <Monitor className="h-3.5 w-3.5" /> Open Output
              </Button>
              {liveState === 'not_live' ? (
                <Button size="sm" className="w-full justify-start gap-2 text-xs" onClick={onGoLive}>
                  <Play className="h-3.5 w-3.5" /> Go Live
                </Button>
              ) : (
                <Button variant="destructive" size="sm" className="w-full justify-start gap-2 text-xs" onClick={onEndPoll}>
                  <Square className="h-3.5 w-3.5" /> End Poll
                </Button>
              )}
              {votingState !== 'open' ? (
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={onOpenVoting}>
                  <Vote className="h-3.5 w-3.5" /> Open Voting
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={onCloseVoting}>
                  <XCircle className="h-3.5 w-3.5" /> Close Voting
                </Button>
              )}
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={onDuplicatePoll}>
                <Copy className="h-3.5 w-3.5" /> Duplicate Poll
              </Button>
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
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                <Eye className="h-3.5 w-3.5" /> Preview Slate
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={() => navigate(`/polls/${currentPoll.id}?mode=build`)}>
                <Eye className="h-3.5 w-3.5" /> Open Build Mode
              </Button>
            </div>
          </div>

          <div className="mako-panel p-4 space-y-3">
            <h2 className="text-xs font-semibold font-mono uppercase text-foreground">Active Poll</h2>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground">{currentPoll.internalName}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{currentPoll.question || 'No on-air question yet'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-2">
              <div>
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Total Votes</p>
                <p className="text-lg font-bold text-foreground">{currentPoll.totalVotes.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Votes/sec</p>
                <p className="text-lg font-bold text-primary">{currentPoll.votesPerSecond}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}