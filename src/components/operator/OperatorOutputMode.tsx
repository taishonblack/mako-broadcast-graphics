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
  onStartTestVotes?: (totalVotes: number, durationSeconds: number) => void;
  onStopTestVotes?: () => void;
  /** Reset live/test vote tallies on the current poll back to zero. */
  onResetTestVotes?: () => void;
}

export function OperatorOutputMode({
  projectName,
  currentPoll,
  projectPolls,
  folders = [],
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

  const blockEntryCount = (letter: BlockLetter) =>
    pollsByBlock[letter].length + foldersByBlock[letter].length;

  // Local controlled inputs for the test-vote runner.
  const [testVoteTotal, setTestVoteTotal] = useState(100);
  const [testVoteDuration, setTestVoteDuration] = useState(30);

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
              {blockEntryCount(activeBlock) === 0 ? (
                <p className="text-[11px] italic text-muted-foreground">No folders or polls assigned to this block.</p>
              ) : (
                <>
                  {/* Folders defined in Build for this block — these are the
                      organizational labels the operator sees (e.g. "1st Com").
                      They appear here even when no poll has been saved yet. */}
                  {foldersByBlock[activeBlock].map((folder) => (
                    <div
                      key={folder.id}
                      className="w-full rounded-lg border border-dashed border-border/60 bg-accent/10 p-2.5 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">{folder.name}</p>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">Folder · Block {activeBlock}</p>
                        </div>
                        <span className="mako-chip bg-muted text-[9px] text-muted-foreground">FOLDER</span>
                      </div>
                    </div>
                  ))}
                  {pollsByBlock[activeBlock].map((poll) => (
                  <button
                    key={poll.id}
                    onClick={() => onSelectPoll(poll.id)}
                    className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                      currentPoll.id === poll.id
                        ? 'border-primary/30 bg-primary/10'
                        : 'border-border/50 bg-accent/20 hover:bg-accent/35'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">
                          {poll.internalName || poll.question || folderNameByBlock[activeBlock] || 'Untitled poll'}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">Pos {String(poll.blockPosition ?? 1).padStart(2, '0')} · {poll.question || 'No on-air question yet'}</p>
                      </div>
                      <PollStatusChip state={poll.status === 'saved' ? 'ready' : poll.status} />
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
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  disabled={testVoteRunning}
                  onClick={() => onStartTestVotes?.(testVoteTotal, testVoteDuration)}
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