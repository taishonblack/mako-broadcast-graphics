import { useNavigate } from 'react-router-dom';
import { MonitorContainer } from '@/components/broadcast/BroadcastPreviewFrame';
import { PreviewWithOverlays } from '@/components/broadcast/preview/PreviewWithOverlays';
import { SceneSelector } from '@/components/broadcast/SceneSelector';
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
import { MediaPicker } from '@/components/poll-create/MediaPicker';
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
import { OUTPUT_PRESENCE_CHANNEL, OutputPresenceMessage } from '@/lib/output-state';
import { ChevronDown, ChevronRight, Clock, Eye, EyeOff, FlaskConical, Globe, Monitor, Pin, PinOff, Play, RefreshCw, RotateCcw, Smartphone, Square, StopCircle, Type as TypeIcon, Vote, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Check, X as XIcon } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { AnswerLite } from '@/lib/answer-percents';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PollScene } from '@/lib/poll-scenes';
import { Layers } from 'lucide-react';

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
  /** Active folder's enabled asset list — passed through to viewer
   *  previews so Mirror Mode (no-answers folders) renders correctly. */
  enabledAssetIds?: string[];
  onSelectBlock: (block: BlockLetter) => void;
  onSelectPoll: (pollId: string) => void;
  onSceneChange: (scene: SceneType) => void;
  /** Scenes belonging to the active folder/poll — listed under the
   *  "Scenes Output" panel so operators can see (and pick) which scene
   *  is staged for air. */
  scenes?: PollScene[];
  activeSceneId?: string | null;
  onSelectScene?: (sceneId: string) => void;
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
  /** Quick Switch (confirmationless TAKE/CUT) — when ON, the operator can
   *  fire scene cuts to PROGRAM during Go Live without the safety
   *  confirm() dialog, provided Bus Safe is armed. The toggle persists in
   *  operator settings; the arm switch is session-only. */
  confirmationlessMode?: boolean;
  onConfirmationlessModeChange?: (next: boolean) => void;
  busSafeArmed?: boolean;
  onBusSafeArmedChange?: (next: boolean) => void;
  onRescanPolls?: () => void;
  /** Notify parent when the operator toggles the Polling Slate on/off so it
   *  can broadcast the slate state to public viewers (mobile/desktop). */
  onSlateActiveChange?: (active: boolean, slate?: { text: string; sublineText: string; image?: string | null }) => void;
  /** Notify parent when the operator toggles "Test viewer view" so it can
   *  push a slate state to public viewers — when ON, the audience leaves
   *  the MakoVote branding and sees the slate (operator can verify what
   *  voters will see); when OFF the audience returns to branding. */
  onTestViewerViewChange?: (active: boolean, slate?: { text: string; sublineText: string; image?: string | null }) => void;
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
  /** Active folder's tally pacing — controls Live vs Stop Motion display
   *  in scenes. Operator can flip modes / adjust the interval directly
   *  from the Vote Runner panel. */
  tallyMode?: 'live' | 'stopMotion';
  tallyIntervalSeconds?: number;
  onTallyModeChange?: (mode: 'live' | 'stopMotion') => void;
  onTallyIntervalChange?: (seconds: number) => void;
  /** Results scene playback — `animated` reveals bars from 0 over
   *  `resultsAnimationMs`; `static` paints the final state immediately. */
  resultsMode?: 'animated' | 'static';
  resultsAnimationMs?: number;
  onResultsModeChange?: (mode: 'animated' | 'static') => void;
  onResultsAnimationMsChange?: (ms: number) => void;
  /** Re-trigger the animated reveal without changing vote data. */
  onReplayResults?: () => void;
  /** Per-asset color overrides authored in Build (active viewport). Passed
   *  into the mobile/desktop ViewerSlatePreview so question / subheadline /
   *  answer text colors match what the operator picked, instead of always
   *  rendering white. */
  assetColors?: import('@/components/poll-create/polling-assets/types').AssetColorMap;
  /** Per-asset transforms (active viewport) — drives mobile/desktop preview
   *  positioning so operator slider edits in Build are reflected in Output. */
  assetTransforms?: import('@/components/poll-create/polling-assets/types').AssetTransformMap;
  /** Full per-viewport color set. When provided, the mobile/desktop voter
   *  previews read the slice that matches the rendered viewport instead of
   *  whatever single slice the operator was editing in Build. */
  assetColorSet?: import('@/components/poll-create/polling-assets/types').AssetColorSet;
  /** Full per-viewport transform set — same intent as `assetColorSet`. */
  assetTransformSet?: import('@/components/poll-create/polling-assets/types').AssetTransformSet;
  /** MC label style for voter buttons (A/B/C, 1/2/3, none, custom). */
  mcLabelStyle?: import('@/components/poll-create/ContentPanel').MCLabelStyle;
}

// PostgREST will return a 400 when filtering a UUID column with a value that
// isn't a valid UUID — guard the slate hydration/save below so synthetic
// in-memory poll ids (e.g. "draft-poll" before the operator hits Save) don't
// spam the network tab and confuse autosave debugging.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string | undefined | null): v is string => !!v && UUID_RE.test(v);

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
  enabledAssetIds,
  onSelectBlock,
  onSelectPoll,
  onSceneChange,
  scenes = [],
  activeSceneId = null,
  onSelectScene,
  onTake,
  onCut,
  onOpenOutput,
  onGoLive,
  onEndPoll,
  onOpenVoting,
  onCloseVoting,
  confirmationlessMode = false,
  onConfirmationlessModeChange,
  busSafeArmed = false,
  onBusSafeArmedChange,
  onRescanPolls,
  onSlateActiveChange,
  onTestViewerViewChange,
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
  tallyMode = 'live',
  tallyIntervalSeconds = 3,
  onTallyModeChange,
  onTallyIntervalChange,
  resultsMode = 'animated',
  resultsAnimationMs = 1200,
  onResultsModeChange,
  onResultsAnimationMsChange,
  onReplayResults,
  assetColors,
  assetTransforms,
  assetColorSet,
  assetTransformSet,
  mcLabelStyle,
}: OperatorOutputModeProps) {
  const navigate = useNavigate();
  // Suppress unused-prop warnings until those features come back. Kept in the
  // signature for parent compatibility.
  void qrSize; void qrPosition;
  void showBranding; void brandingPosition;
  void onQrSizeChange; void onQrPositionChange;
  void onShowBrandingChange; void onBrandingPositionChange;
  // onSelectPoll + pollsByBlock are no longer surfaced — the right-rail
  // panel now lists Scenes (not polls) within the active block.
  void onSelectPoll; void projectPolls;
  // Vote Runner / mock-percentage panels were removed from Output Mode —
  // these props are kept in the signature for parent compatibility but are
  // intentionally not rendered. Build Mode still uses them.
  void hasAnswerBars; void answers; void onSetAnswers;
  void testVoteRunning; void onStartTestVotes; void onStopTestVotes; void onResetTestVotes;

  // (pollsByBlock removed — Scenes panel replaces the per-block polls list.)


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

  // (Removed) test-vote runner inputs and Vote Runner / Live % collapse
  // state — those panels were stripped from Output Mode so the dashboard
  // is real-data only. Test injection lives in Build Mode now.

  // ─── Output Inspector state ────────────────────────────────────────────
  // Polling Slate: a still image / message shown to mobile voters (and on
  // program output) until voting opens. Toggle-only — no countdown. Mobile
  // QR landing renders the slate while `slateActive` is true.
  //
  // Slate text + typography is persisted SERVER-SIDE on the poll record
  // (slate_text / slate_image / slate_text_style / slate_subline_text /
  // slate_subline_style) so operators keep custom styling when they switch
  // browsers or devices. The active toggle stays client-only — it's a
  // moment-to-moment broadcast decision, not a saved property of the poll.
  const [slateText, setSlateText] = useState('Polling will open soon');
  const [slateImage, setSlateImage] = useState<string | undefined>(undefined);
  const [slateActive, setSlateActive] = useState(false);
  const [slateTextStyle, setSlateTextStyle] = useState<SlateTextStyle>(DEFAULT_SLATE_TEXT_STYLE);
  const [slateSublineText, setSlateSublineText] = useState<string>(DEFAULT_SLATE_SUBLINE_TEXT);
  const [slateSublineStyle, setSlateSublineStyle] = useState<SlateTextStyle>(DEFAULT_SLATE_SUBLINE_STYLE);
  // Hydrated marks the moment the server values land so we can begin
  // auto-saving — without this a fresh mount would overwrite the saved row
  // with the in-memory defaults before the fetch resolves.
  const [slateHydrated, setSlateHydrated] = useState(false);

  // Collapsible state for the slate text/subline style sections. Operators
  // typically set these once per poll, so default them collapsed to keep the
  // inspector compact during a live show.
  const [textStyleOpen, setTextStyleOpen] = useState(false);
  const [sublineOpen, setSublineOpen] = useState(false);

  // Load slate styling from the poll record whenever the active poll
  // changes. We re-read on every poll switch because OperatorOutputMode is
  // reused across polls in the same project.
  useEffect(() => {
    let cancelled = false;
    setSlateHydrated(false);
    (async () => {
      // Skip when the active poll is a synthetic in-memory draft (id is not
      // a real UUID). Querying with `id=eq.draft-poll` returns a 400 from
      // PostgREST because the column is a UUID, which spams the console and
      // can make autosave look broken in devtools.
      if (!isUuid(currentPoll.id)) {
        setSlateHydrated(true);
        return;
      }
      const { data, error } = await supabase
        .from('polls')
        .select('slate_text, slate_image, slate_text_style, slate_subline_text, slate_subline_style')
        .eq('id', currentPoll.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setSlateHydrated(true);
        return;
      }
      setSlateText(data.slate_text || 'Polling will open soon');
      setSlateImage(data.slate_image ?? undefined);
      const ts = (data.slate_text_style ?? {}) as Partial<SlateTextStyle>;
      const ss = (data.slate_subline_style ?? {}) as Partial<SlateTextStyle>;
      setSlateTextStyle({ ...DEFAULT_SLATE_TEXT_STYLE, ...ts });
      setSlateSublineText(data.slate_subline_text || DEFAULT_SLATE_SUBLINE_TEXT);
      setSlateSublineStyle({ ...DEFAULT_SLATE_SUBLINE_STYLE, ...ss });
      setSlateHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [currentPoll.id]);

  // Debounced server save whenever any slate styling field changes. Skip
  // until the row has been hydrated so the initial defaults don't clobber
  // the saved values.
  useEffect(() => {
    if (!slateHydrated) return;
    // Same guard — never attempt a debounced PATCH against a non-UUID id.
    if (!isUuid(currentPoll.id)) return;
    const handle = window.setTimeout(() => {
      void supabase
        .from('polls')
        .update({
          slate_text: slateText,
          slate_image: slateImage ?? null,
          slate_text_style: slateTextStyle as never,
          slate_subline_text: slateSublineText,
          slate_subline_style: slateSublineStyle as never,
        })
        .eq('id', currentPoll.id);
    }, 500);
    return () => window.clearTimeout(handle);
  }, [slateHydrated, currentPoll.id, slateText, slateImage, slateTextStyle, slateSublineText, slateSublineStyle]);
  // "Test viewer view" — when ON, the Mobile / Desktop preview forces the
  // slate render (instead of the live answer-type voting UI) so the operator
  // can QA the slate copy/image without actually starting the slate on-air.
  // Has no effect in Program mode.
  const [testViewerView, setTestViewerView] = useState(false);
  // QA flip: briefly toggles the preview between slate and live answer-types
  // so the operator can confirm the transition cleanly before Go Live. Runs
  // a short scripted sequence (slate → live → slate → restore) on whichever
  // viewport (mobile/desktop) is currently being previewed.
  const [qaFlipping, setQaFlipping] = useState(false);
  const qaTimersRef = useRef<number[]>([]);
  useEffect(() => () => {
    qaTimersRef.current.forEach((id) => window.clearTimeout(id));
  }, []);
  const handleQaFlip = () => {
    if (qaFlipping) return;
    qaTimersRef.current.forEach((id) => window.clearTimeout(id));
    qaTimersRef.current = [];
    const restore = testViewerView;
    setQaFlipping(true);
    // Sequence: slate (1.2s) → live (1.2s) → slate (1.2s) → restore.
    setTestViewerView(true);
    qaTimersRef.current.push(window.setTimeout(() => setTestViewerView(false), 1200));
    qaTimersRef.current.push(window.setTimeout(() => setTestViewerView(true), 2400));
    qaTimersRef.current.push(window.setTimeout(() => {
      setTestViewerView(restore);
      setQaFlipping(false);
    }, 3600));
  };

  // ─── Run Viewer Transition Test ────────────────────────────────────────
  // Opens voting on the active poll, then polls the public viewer data
  // (project_live_state + poll_answers + the live snapshot embedded in
  // project_live_state.live_poll_snapshot.poll.options) to verify the
  // mobile / desktop voter would actually see the answer-types render
  // after Go Live. Reports pass/fail via toast. Designed to be safe to
  // run during rehearsal (it does NOT touch live_state / Go Live — it
  // only flips voting open, mirroring `Open Voting Now`).
  const [transitionTesting, setTransitionTesting] = useState(false);
  const handleRunTransitionTest = async () => {
    if (transitionTesting) return;
    setTransitionTesting(true);
    const projectId = (currentPoll as Poll & { projectId?: string }).projectId;
    const pollId = currentPoll.id;
    if (!projectId) {
      toast.error('Viewer test failed: poll has no project — save it first.');
      setTransitionTesting(false);
      return;
    }
    const startedClosed = votingState !== 'open';
    try {
      // 1. Open voting via the same handler the Open Voting button uses.
      //    This ensures the test exercises the real production path.
      if (startedClosed) onOpenVoting();

      // 2. Poll project_live_state until voting_state flips to 'open' OR
      //    we time out. The handler writes to the DB asynchronously, so
      //    we give it up to ~5s to land before declaring failure.
      const deadline = Date.now() + 5000;
      let liveRow: { voting_state?: string; live_poll_snapshot?: { poll?: { options?: unknown[] } } | null } | null = null;
      while (Date.now() < deadline) {
        const { data } = await supabase
          .from('project_live_state')
          .select('voting_state, live_poll_snapshot')
          .eq('project_id', projectId)
          .maybeSingle();
        liveRow = data as typeof liveRow;
        if (liveRow?.voting_state === 'open') break;
        await new Promise((r) => setTimeout(r, 250));
      }
      if (liveRow?.voting_state !== 'open') {
        toast.error('Viewer test FAILED: voting_state never reached "open".');
        return;
      }

      // 3. Confirm the viewer would have answer choices to render —
      //    either persisted poll_answers rows OR options inside the
      //    live snapshot (used when slugs are linked across folders).
      const { data: answerRows } = await supabase
        .from('poll_answers')
        .select('id')
        .eq('poll_id', pollId);
      const dbCount = answerRows?.length ?? 0;
      const snapshotOptions = liveRow.live_poll_snapshot?.poll?.options;
      const snapshotCount = Array.isArray(snapshotOptions) ? snapshotOptions.length : 0;
      const totalCount = Math.max(dbCount, snapshotCount);

      if (totalCount === 0) {
        toast.warning(
          'Viewer test PARTIAL: voting opened but 0 answers reachable — viewer will show "No answers loaded".',
        );
        return;
      }

      toast.success(
        `Viewer test PASSED · ${totalCount} answer${totalCount === 1 ? '' : 's'} reachable (db: ${dbCount}, snapshot: ${snapshotCount}).`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Viewer test ERRORED: ${message}`);
    } finally {
      // 4. Restore prior voting state if the test changed it. We only
      //    auto-close when the operator started in a non-open state —
      //    avoids interrupting a real live show.
      if (startedClosed) {
        onCloseVoting();
      }
      setTransitionTesting(false);
    }
  };

  // Tracks whether the operator has opened the fullscreen Output window.
  // Drives the green "ACTIVE" state on the Open Output quick action so
  // operators can see at a glance that a fullscreen surface is live.
  // Persisted across navigation: a fullscreen popup survives route changes
  // even though this React component remounts, and the operator should
  // continue to see ACTIVE without reopening (which would break fullscreen).
  const [outputOpen, setOutputOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('mako-output-open') === '1';
  });
  // Track the popup so we can detect close and flip the ACTIVE indicator off.
  const outputWindowRef = useRef<Window | null>(null);
  // Has the operator ever opened the Output window in this session? Used
  // to distinguish "never connected" (neutral) from "was connected, dropped"
  // (red) on the Program → Output sync indicator.
  const [outputEverOpened, setOutputEverOpened] = useState(false);

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

  const handleToggleSlate = () => {
    setSlateActive((v) => {
      const next = !v;
      onSlateActiveChange?.(next, {
        text: slateText,
        sublineText: slateSublineText,
        image: slateImage ?? null,
      });
      return next;
    });
  };

  // When voting opens (Go Live), force the polling slate off so viewers
  // immediately see the answer types instead of the holding screen.
  useEffect(() => {
    if (votingState === 'open' && slateActive) {
      setSlateActive(false);
    }
  }, [votingState, slateActive]);

  // NOTE: We intentionally do NOT probe for an existing popup with
  // window.open('', 'mako-output') on mount. In Chrome, calling window.open
  // against a popup that the operator has put into fullscreen drops it out
  // of fullscreen (the call is treated as a focus/navigation on the target
  // window). The `outputOpen` flag is rehydrated from sessionStorage above,
  // and the close-poller below tolerates a null window ref — when the
  // operator actually closes the popup, the heartbeat-driven flow and the
  // next user-initiated Open Output click will reconcile the ref.

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (outputOpen) sessionStorage.setItem('mako-output-open', '1');
    else sessionStorage.removeItem('mako-output-open');
  }, [outputOpen]);

  const handleOpenOutputClick = () => {
    const win = onOpenOutput();
    if (win && typeof win === 'object') {
      outputWindowRef.current = win as Window;
    }
    setOutputOpen(true);
    setOutputEverOpened(true);
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

  // Presence listener — the fullscreen Output page broadcasts 'open' on a
  // 2s heartbeat and 'closed' on unload. This is the authoritative source
  // for the ACTIVE indicator because (a) the original popup `Window`
  // reference is lost across operator route remounts, and (b) it works
  // even when the popup was opened in a previous session.
  //
  //   - On 'closed' → flip ACTIVE off immediately.
  //   - On 'open'  → ensure ACTIVE is on, and remember the last-seen ts so
  //                  we can mark stale (closed) if the heartbeat dries up.
  const lastPresenceRef = useRef<number>(0);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(OUTPUT_PRESENCE_CHANNEL);
    ch.onmessage = (ev) => {
      const msg = ev.data as OutputPresenceMessage | undefined;
      if (!msg) return;
      if (msg.type === 'closed') {
        outputWindowRef.current = null;
        lastPresenceRef.current = 0;
        setOutputOpen(false);
      } else if (msg.type === 'open') {
        lastPresenceRef.current = msg.ts || Date.now();
        setOutputOpen((prev) => prev || true);
      }
    };
    // Stale-presence sweeper: if we believe the output is open but haven't
    // heard a heartbeat in >5s, treat it as closed. Covers the case where
    // the popup crashed without firing beforeunload.
    const sweep = window.setInterval(() => {
      if (!lastPresenceRef.current) return;
      if (Date.now() - lastPresenceRef.current > 5000) {
        lastPresenceRef.current = 0;
        outputWindowRef.current = null;
        setOutputOpen(false);
      }
    }, 1000);
    return () => {
      try { ch.close(); } catch { /* ignore */ }
      window.clearInterval(sweep);
    };
  }, []);

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

  // Real-data total. Output Mode's previewOptions are stripped of any
  // mock/test injection upstream, so this is always the genuine
  // poll_answers.live_votes sum (0 pre-live, frozen final after close).
  const liveVoteTotal = currentPoll.options.reduce((s, o) => s + (o.votes ?? 0), 0);

  return (
    <div className="h-full overflow-hidden">
      {liveState === 'live' && (
        <div
          role="status"
          aria-label="Program output is locked while live"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-b border-destructive/40 bg-destructive/15 px-3 py-1.5"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-destructive">
              LIVE — Program Locked · workspace edits won't affect on-air until you End Poll
            </span>
          </div>
          {/* Quick Switch controls — confirmationless TAKE/CUT + Bus Safe arm.
              Only meaningful while Live, so we render here. */}
          <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-background/40 px-2 py-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-foreground/80 cursor-pointer">
                  <Switch
                    checked={confirmationlessMode}
                    onCheckedChange={(v) => onConfirmationlessModeChange?.(Boolean(v))}
                    className="scale-75"
                    aria-label="Quick Switch (confirmationless TAKE/CUT)"
                  />
                  Quick Switch
                </label>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                <div className="font-semibold mb-1">Quick Switch</div>
                <div className="text-muted-foreground">
                  Persistent preference. When ON, TAKE / CUT to PROGRAM fire <em>without</em> a
                  confirm dialog — but only if <span className="font-mono">Bus Safe</span> is also armed.
                  When OFF, every on-air switch shows a confirm prompt.
                </div>
              </TooltipContent>
            </Tooltip>
            <span className="h-3 w-px bg-border/60" />
            <Tooltip>
              <TooltipTrigger asChild>
                <label
                  className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider cursor-pointer transition-colors ${
                    confirmationlessMode ? 'text-foreground/90' : 'text-muted-foreground/60'
                  }`}
                >
                  <Switch
                    checked={busSafeArmed}
                    onCheckedChange={(v) => onBusSafeArmedChange?.(Boolean(v))}
                    disabled={!confirmationlessMode}
                    className="scale-75 data-[state=checked]:bg-[hsl(var(--mako-live))]"
                    aria-label="Bus Safe armed"
                  />
                  {busSafeArmed && confirmationlessMode ? (
                    <span className="text-[hsl(var(--mako-live))]">BUS SAFE · ARMED</span>
                  ) : (
                    <span>Bus Safe</span>
                  )}
                </label>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                <div className="font-semibold mb-1">Bus Safe (per-show arm)</div>
                <div className="text-muted-foreground">
                  {confirmationlessMode
                    ? 'Engage to allow confirmationless TAKE / CUT for the current live segment. Auto-disarms when you End Live so the next show starts safe.'
                    : 'Disabled — turn on Quick Switch first. Bus Safe is the per-segment "the program bus is hot, fire instantly" arm.'}
                </div>
              </TooltipContent>
            </Tooltip>
            <span className="h-3 w-px bg-border/60" />
            <Sheet>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      aria-label="What do Quick Switch and Bus Safe do?"
                      className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </SheetTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Open help — when does TAKE / CUT actually fire?
                </TooltipContent>
              </Tooltip>
              <SheetContent side="right" className="w-[420px] sm:max-w-[420px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Quick Switch &amp; Bus Safe</SheetTitle>
                  <SheetDescription>
                    Two independent gates that together decide whether TAKE / CUT fires
                    confirmationless while you are LIVE.
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-5 space-y-5 text-sm">
                  <section className="space-y-1.5">
                    <h3 className="font-semibold text-foreground">Quick Switch</h3>
                    <p className="text-muted-foreground">
                      A <strong>persistent workflow preference</strong>. ON = "I want one-touch transitions"; OFF = "Bus Safe by default — always confirm."
                      Saved to your operator profile and survives sessions.
                    </p>
                  </section>

                  <section className="space-y-1.5">
                    <h3 className="font-semibold text-foreground">Bus Safe (arm)</h3>
                    <p className="text-muted-foreground">
                      A <strong>per-show safety arm</strong>. Tells the system "the program bus is hot right now — let the next TAKE / CUT through without a dialog."
                      Auto-disarms on <span className="font-mono">End Live</span>, so each new show starts safe.
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-foreground">When does TAKE / CUT fire?</h3>
                    <div className="rounded-md border border-border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 text-muted-foreground font-mono uppercase tracking-wider">
                          <tr>
                            <th className="text-left px-2 py-1.5">Quick Switch</th>
                            <th className="text-left px-2 py-1.5">Bus Safe</th>
                            <th className="text-left px-2 py-1.5">Behavior</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono">
                          <tr className="border-t border-border">
                            <td className="px-2 py-1.5"><XIcon className="h-3 w-3 inline text-muted-foreground" /> OFF</td>
                            <td className="px-2 py-1.5 text-muted-foreground">— (locked)</td>
                            <td className="px-2 py-1.5">Confirm dialog every time</td>
                          </tr>
                          <tr className="border-t border-border">
                            <td className="px-2 py-1.5"><Check className="h-3 w-3 inline text-primary" /> ON</td>
                            <td className="px-2 py-1.5"><XIcon className="h-3 w-3 inline text-muted-foreground" /> OFF</td>
                            <td className="px-2 py-1.5">Blocked — toast: "Bus Safe not armed"</td>
                          </tr>
                          <tr className="border-t border-border bg-[hsl(var(--mako-live)/0.08)]">
                            <td className="px-2 py-1.5"><Check className="h-3 w-3 inline text-primary" /> ON</td>
                            <td className="px-2 py-1.5"><Check className="h-3 w-3 inline text-[hsl(var(--mako-live))]" /> ARMED</td>
                            <td className="px-2 py-1.5">Fires instantly, no confirm</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Bus Safe is only togglable when Quick Switch is ON. Outside of LIVE,
                      neither toggle affects anything — preview switches are always confirmationless.
                    </p>
                  </section>

                  <section className="space-y-1.5">
                    <h3 className="font-semibold text-foreground">Why two switches?</h3>
                    <p className="text-muted-foreground">
                      Mirrors a real video switcher. Quick Switch is your <em>workflow</em>
                      ("I prefer one-touch"). Bus Safe is your <em>moment-to-moment</em> safety
                      ("I'm consciously arming the bus right now"). Splitting them means a saved
                      preference can never silently fire a live cut — you must arm in the room.
                    </p>
                  </section>

                  <section className="space-y-1.5">
                    <h3 className="font-semibold text-foreground">Hotkeys</h3>
                    <p className="text-muted-foreground">
                      The same gating applies to keyboard <span className="font-mono">T</span> (TAKE) and <span className="font-mono">C</span> (CUT) bindings — remap them in Settings.
                    </p>
                  </section>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}
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

          {/* Scenes Output — lists scenes inside the folder/poll that
              aligns with the currently selected Block above. Selecting a
              scene stages it for air. */}
          <div className="mako-panel p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold font-mono uppercase text-foreground flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-muted-foreground" />
                Scenes Output
              </h2>
              <span className="text-[10px] font-mono text-muted-foreground">{scenes.length}</span>
            </div>
            <div className="space-y-1.5">
              {scenes.length === 0 ? (
                <p className="text-[11px] italic text-muted-foreground">
                  No scenes in this folder yet. Add one in Build Mode.
                </p>
              ) : (
                scenes.map((scene) => {
                  const isActive = scene.id === activeSceneId;
                  return (
                    <button
                      key={scene.id}
                      type="button"
                      onClick={() => onSelectScene?.(scene.id)}
                      className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                        isActive
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-border/60 bg-accent/10 hover:bg-accent/25'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`truncate text-xs font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>
                            {scene.name}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground capitalize">
                            {scene.preset.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}
                          </p>
                        </div>
                        <span className="mako-chip bg-muted text-[9px] text-muted-foreground uppercase">Scene</span>
                      </div>
                    </button>
                  );
                })
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
            <>
              {/* Broadcast switcher: stage a scene on Preview, then commit
               *  to Program with TAKE (animated) or CUT (instant). Scene
               *  changes never affect voting state — viewers keep voting
               *  through scene transitions. */}
              <div className="px-2 py-2 rounded-lg border border-border/50 bg-card/40">
                <SceneSelector
                  previewScene={previewScene}
                  programScene={programScene}
                  onSceneChange={onSceneChange}
                  onTake={onTake}
                  onCut={onCut}
                />
              </div>
              <MonitorContainer variant="operator">
                {(() => {
                  const live = previewScene === programScene;
                  // Ring = current state of this canvas. Red when what
                  // you see IS on air; blue when you're staging a change.
                  const ringClass = live
                    ? 'ring-2 ring-[hsl(var(--mako-live))]/70 shadow-[0_0_24px_-6px_hsl(var(--mako-live)/0.5)]'
                    : 'ring-2 ring-primary/60 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.5)]';
                  return (
                    <div className={`relative rounded-lg overflow-hidden ${ringClass}`}>
                      <PreviewWithOverlays showLabel label="1920×1080">
                        {previewNode}
                      </PreviewWithOverlays>
                    </div>
                  );
                })()}
              </MonitorContainer>
            </>
          ) : (
            <div className="flex justify-center">
              <ViewerSlatePreview
                mode={previewMode}
                bgImage={currentPoll.bgImage}
                bgColor={currentPoll.bgColor}
                /* Test Viewer View forces the slate render so the operator
                 * can preview slate copy/image without actually starting
                 * the slate on-air. When OFF, behaviour follows the real
                 * slate/voting state (answer types when voting is open). */
                slateActive={slateActive || testViewerView}
                slateText={slateText}
                slateImage={slateImage}
                textStyle={slateTextStyle}
                sublineText={slateSublineText}
                sublineStyle={slateSublineStyle}
                votingOpen={votingState === 'open' && !testViewerView}
                question={currentPoll.question}
                options={currentPoll.options}
                /* Output Mode doesn't carry the authored answer-type, so
                 * infer Yes/No from a 2-option poll whose labels read as
                 * Yes/No. Anything else falls through to multiple-choice
                 * (stacked layout). Mirrors Build's preview rules. */
                answerType={(() => {
                  const opts = currentPoll.options ?? [];
                  if (opts.length === 2) {
                    const a = (opts[0]?.text || '').trim().toLowerCase();
                    const b = (opts[1]?.text || '').trim().toLowerCase();
                    if ((a === 'yes' && b === 'no') || (a === 'y' && b === 'n')) {
                      return 'yes-no';
                    }
                  }
                  return 'multiple-choice';
                })()}
                enabledAssetIds={enabledAssetIds}
                subheadline={currentPoll.subheadline}
                slug={currentPoll.slug}
                assetColors={assetColorSet?.[previewMode] ?? assetColors}
                transforms={assetTransformSet?.[previewMode] ?? assetTransforms}
                mcLabelStyle={mcLabelStyle}
              />
            </div>
          )}

          {/* Output Mode is real-data only — Build's "Answer Bars · Live %"
              mock editor lives in Build Mode and was removed from Output. */}

          {/* Tally pacing — kept OUT of the Vote Runner collapsible because
              the operator may need to flip Live ↔ Stop Motion (and tweak
              the interval) while Go Live is engaged, without expanding the
              full Vote Runner. Always visible, compact. */}
          {(onTallyModeChange || onTallyIntervalChange) && (
            <div className="mako-panel p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground">
                  Tally Pacing
                </span>
                <span className="text-[10px] font-mono text-muted-foreground uppercase">
                  {tallyMode === 'stopMotion' ? `Stop · ${tallyIntervalSeconds}s` : 'Live'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Mode</p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={tallyMode === 'live' ? 'default' : 'outline'}
                    className="h-6 px-2 text-[10px]"
                    onClick={() => onTallyModeChange?.('live')}
                  >Live</Button>
                  <Button
                    size="sm"
                    variant={tallyMode === 'stopMotion' ? 'default' : 'outline'}
                    className="h-6 px-2 text-[10px]"
                    onClick={() => onTallyModeChange?.('stopMotion')}
                  >Stop Motion</Button>
                </div>
              </div>
              {tallyMode === 'stopMotion' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-muted-foreground">Check every</span>
                    <span className="text-[10px] font-mono text-foreground">{tallyIntervalSeconds}s</span>
                  </div>
                  <Slider
                    min={1}
                    max={30}
                    step={1}
                    value={[tallyIntervalSeconds]}
                    onValueChange={(v) => onTallyIntervalChange?.(v[0] ?? tallyIntervalSeconds)}
                  />
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                Stays accessible while Go Live is engaged.
              </p>
            </div>
          )}

          {/* Results playback — separate from Tally Pacing because it
              controls the *reveal* of the Results scene (animated bars
              vs static final), not how incoming votes are paced. Always
              visible so the operator can flip mode / change speed /
              re-trigger the reveal mid-show. */}
          {(onResultsModeChange || onResultsAnimationMsChange || onReplayResults) && (
            <div className="mako-panel p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground">
                  Results Playback
                </span>
                <span className="text-[10px] font-mono text-muted-foreground uppercase">
                  {resultsMode === 'animated' ? `Animated · ${(resultsAnimationMs / 1000).toFixed(1)}s` : 'Static'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Mode</p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={resultsMode === 'animated' ? 'default' : 'outline'}
                    className="h-6 px-2 text-[10px]"
                    onClick={() => onResultsModeChange?.('animated')}
                  >Animated</Button>
                  <Button
                    size="sm"
                    variant={resultsMode === 'static' ? 'default' : 'outline'}
                    className="h-6 px-2 text-[10px]"
                    onClick={() => onResultsModeChange?.('static')}
                  >Static</Button>
                </div>
              </div>
              {resultsMode === 'animated' && (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase text-muted-foreground">Reveal Speed</span>
                      <span className="text-[10px] font-mono text-foreground">{(resultsAnimationMs / 1000).toFixed(1)}s</span>
                    </div>
                    <Slider
                      min={200}
                      max={6000}
                      step={100}
                      value={[resultsAnimationMs]}
                      onValueChange={(v) => onResultsAnimationMsChange?.(v[0] ?? resultsAnimationMs)}
                    />
                    <div className="flex items-center justify-between text-[9px] font-mono uppercase text-muted-foreground/70">
                      <span>Fast</span>
                      <span>Dramatic</span>
                    </div>
                  </div>
                  {onReplayResults && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-full text-[10px]"
                      onClick={onReplayResults}
                    >
                      Replay Reveal
                    </Button>
                  )}
                </>
              )}
              <p className="text-[10px] text-muted-foreground">
                Animated bars on entry; Static skips the reveal.
              </p>
            </div>
          )}

          {/* Active Poll summary — REAL data only. The legacy Vote Runner
              (test-vote injector + per-bar Target % editor) was removed
              from Output Mode; mock/manual percentages now live exclusively
              in Build Mode. Output reads totals straight from
              poll_answers.live_votes via the parent's previewOptions. */}
          <div className="mako-panel p-3 space-y-2">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground truncate">{currentPoll.internalName}</p>
              <p className="text-xs font-semibold text-foreground line-clamp-2">
                {currentPoll.question || 'No on-air question yet'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-1.5">
              <div>
                <p className="text-[9px] font-mono uppercase text-muted-foreground">Real votes</p>
                <p className="text-sm font-bold text-foreground">
                  {liveVoteTotal.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-mono uppercase text-muted-foreground">Voting</p>
                <p className="text-sm font-bold text-foreground uppercase">{votingState.replace('_', ' ')}</p>
              </div>
            </div>
            {liveState !== 'live' && (
              <p className="text-[9px] font-mono uppercase text-muted-foreground/70">
                Output Mode shows real votes only. Go Live to begin tallying.
              </p>
            )}
          </div>
        </div>

        <div className="min-h-0 overflow-auto space-y-3">
          <div className="mako-panel p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold font-mono uppercase text-foreground">Quick Actions</h2>
              {(() => {
                const synced = outputOpen;
                const dropped = !outputOpen && outputEverOpened;
                const cls = synced
                  ? 'border-mako-success/50 bg-mako-success/15 text-mako-success'
                  : dropped
                    ? 'border-destructive/60 bg-destructive/15 text-destructive'
                    : 'border-border bg-muted/30 text-muted-foreground';
                const label = synced ? 'SYNCED' : dropped ? 'DROPPED' : 'IDLE';
                const tip = synced
                  ? 'Program Preview is mirroring to the Output window.'
                  : dropped
                    ? 'Output window closed — sync lost. Click Open Output to reconnect.'
                    : 'No Output window open yet. Click Open Output to start mirroring.';
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        role="status"
                        aria-label={`Program Preview to Output: ${label}`}
                        className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${cls}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${synced ? 'animate-live-pulse' : ''}`}
                          style={{
                            backgroundColor: synced
                              ? 'hsl(var(--mako-success))'
                              : dropped
                                ? 'hsl(var(--destructive))'
                                : 'hsl(var(--muted-foreground))',
                          }}
                        />
                        Preview → Output: {label}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left">{tip}</TooltipContent>
                  </Tooltip>
                );
              })()}
            </div>
            <div className="space-y-1.5">
              <Button
                variant="outline"
                size="sm"
                className={`w-full justify-start gap-2 text-xs ${outputActiveClass}`}
                onClick={handleOpenOutputClick}
              >
                <Monitor className="h-3.5 w-3.5" /> Full Screen Output
                {outputOpen && <span className="ml-auto text-[9px] font-mono">ACTIVE</span>}
              </Button>
              {liveState === 'not_live' ? (
                <Button size="sm" className="w-full justify-start gap-2 text-xs" onClick={() => setConfirmGoLive(true)}>
                  <Play className="h-3.5 w-3.5" /> Go Live
                </Button>
              ) : (
                <Button variant="destructive" size="sm" className="w-full justify-start gap-2 text-xs" onClick={onEndPoll}>
                  <Square className="h-3.5 w-3.5" /> End Live
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-xs"
                    onClick={handleRunTransitionTest}
                    disabled={transitionTesting}
                  >
                    <FlaskConical className={`h-3.5 w-3.5 ${transitionTesting ? 'animate-pulse' : ''}`} />
                    {transitionTesting ? 'Testing viewer…' : 'Run Viewer Transition Test'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  Opens voting on the active poll, polls the public viewer
                  state, and reports whether mobile/desktop voters would see
                  answer types appear after Go Live.
                </TooltipContent>
              </Tooltip>
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

            {/* Live Vote Tally — broadcast-style readout of the real-time
                vote counts on the current Program preview. Pulls directly
                from the poll's options (which carry live tallies once Go
                Live is engaged) so the operator can confirm at a glance
                that votes are landing without leaving the Output mode. */}
            {currentPoll?.options && currentPoll.options.length > 0 && (
              <div className="space-y-1.5 rounded-md border border-border/60 p-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono uppercase text-muted-foreground">Live Vote Tally</p>
                  <p className="text-[10px] font-mono text-foreground">
                    {liveVoteTotal.toLocaleString()} {liveVoteTotal === 1 ? 'vote' : 'votes'}
                  </p>
                </div>
                {currentPoll.options.map((o, i) => {
                  const pct = liveVoteTotal > 0
                    ? Math.round((o.votes / liveVoteTotal) * 100)
                    : 0;
                  return (
                    <div key={o.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-foreground">{o.text || `Answer ${i + 1}`}</span>
                      <span className="font-mono text-muted-foreground tabular-nums">
                        {o.votes.toLocaleString()} · {pct}%
                      </span>
                    </div>
                  );
                })}
                {liveState !== 'live' && (
                  <p className="text-[9px] font-mono uppercase text-muted-foreground/70">
                    Real votes only — Go Live and Open Voting to begin.
                  </p>
                )}
              </div>
            )}

            {/* Test viewer view — when ON, the Mobile / Desktop preview
                forces the slate render instead of the live answer-type
                voting UI, so the operator can QA the slate copy/image
                without actually starting the slate on-air. No effect in
                Program mode. */}
            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase text-muted-foreground">Test viewer view</p>
                <p className="text-[10px] text-muted-foreground/70 leading-snug">
                  {testViewerView
                    ? 'Mobile / Desktop preview shows the slate'
                    : 'Mobile / Desktop preview shows the live voting UI'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-[10px]"
                      onClick={handleQaFlip}
                      disabled={qaFlipping || previewMode === 'program'}
                    >
                      <RefreshCw className={`h-3 w-3 ${qaFlipping ? 'animate-spin' : ''}`} />
                      QA Flip
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Briefly cycles slate ↔ live answer-types on the current
                    Mobile / Desktop preview so you can confirm the transition
                    before Go Live.
                  </TooltipContent>
                </Tooltip>
                <Switch
                  checked={testViewerView}
                  onCheckedChange={(next) => {
                    setTestViewerView(next);
                    // Mirror the toggle to the public viewer so the audience
                    // leaves MakoVote branding and shows the slate during a
                    // test, and returns to branding when toggled off.
                    onTestViewerViewChange?.(next, {
                      text: slateText,
                      sublineText: slateSublineText,
                      image: slateImage ?? null,
                    });
                  }}
                />
              </div>
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
                  hard to read against a busy background. Collapsed by default
                  so the inspector stays compact during a live show. */}
              <Collapsible open={textStyleOpen} onOpenChange={setTextStyleOpen}>
                <div className="rounded-md border border-border/40 bg-background/40">
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground">
                    <span>Slate Text Style</span>
                    {textStyleOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 px-2 pb-2">
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
                  </CollapsibleContent>
                </div>
              </Collapsible>
              {/* Subline ("Stay tuned…") — fully editable so operators can
                  rewrite the copy and adjust typography to read against any
                  background. */}
              <Collapsible open={sublineOpen} onOpenChange={setSublineOpen}>
                <div className="rounded-md border border-border/40 bg-background/40">
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground">
                    <span>Subline</span>
                    {sublineOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 px-2 pb-2">
                <Textarea
                  value={slateSublineText}
                  onChange={(e) => setSlateSublineText(e.target.value)}
                  placeholder={DEFAULT_SLATE_SUBLINE_TEXT}
                  rows={2}
                  className="text-xs"
                />
                <div className="flex items-center gap-2">
                  <Label className="w-16 text-[10px] text-muted-foreground">Color</Label>
                  <input
                    type="color"
                    value={slateSublineStyle.color ?? DEFAULT_SLATE_SUBLINE_STYLE.color}
                    onChange={(e) => setSlateSublineStyle((s) => ({ ...s, color: e.target.value }))}
                    className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent p-0"
                  />
                  <Input
                    value={slateSublineStyle.color ?? DEFAULT_SLATE_SUBLINE_STYLE.color}
                    onChange={(e) => setSlateSublineStyle((s) => ({ ...s, color: e.target.value }))}
                    className="h-7 flex-1 px-2 text-[10px] font-mono"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-16 text-[10px] text-muted-foreground">Weight</Label>
                  <Slider
                    value={[slateSublineStyle.weight ?? DEFAULT_SLATE_SUBLINE_STYLE.weight]}
                    min={300}
                    max={900}
                    step={100}
                    onValueChange={([v]) => setSlateSublineStyle((s) => ({ ...s, weight: v }))}
                    className="flex-1"
                  />
                  <span className="w-10 text-right text-[10px] font-mono text-muted-foreground">{slateSublineStyle.weight ?? DEFAULT_SLATE_SUBLINE_STYLE.weight}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-16 text-[10px] text-muted-foreground">Size</Label>
                  <Slider
                    value={[slateSublineStyle.sizePx ?? DEFAULT_SLATE_SUBLINE_STYLE.sizePx]}
                    min={10}
                    max={48}
                    step={1}
                    onValueChange={([v]) => setSlateSublineStyle((s) => ({ ...s, sizePx: v }))}
                    className="flex-1"
                  />
                  <span className="w-10 text-right text-[10px] font-mono text-muted-foreground">{slateSublineStyle.sizePx ?? DEFAULT_SLATE_SUBLINE_STYLE.sizePx}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-16 text-[10px] text-muted-foreground">X</Label>
                  <Slider
                    value={[slateSublineStyle.offsetX ?? 0]}
                    min={-160}
                    max={160}
                    step={1}
                    onValueChange={([v]) => setSlateSublineStyle((s) => ({ ...s, offsetX: v }))}
                    className="flex-1"
                  />
                  <span className="w-10 text-right text-[10px] font-mono text-muted-foreground">{slateSublineStyle.offsetX ?? 0}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-16 text-[10px] text-muted-foreground">Y</Label>
                  <Slider
                    value={[slateSublineStyle.offsetY ?? 0]}
                    min={-200}
                    max={200}
                    step={1}
                    onValueChange={([v]) => setSlateSublineStyle((s) => ({ ...s, offsetY: v }))}
                    className="flex-1"
                  />
                  <span className="w-10 text-right text-[10px] font-mono text-muted-foreground">{slateSublineStyle.offsetY ?? 0}px</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-full text-[10px] text-muted-foreground"
                  onClick={() => {
                    setSlateSublineText(DEFAULT_SLATE_SUBLINE_TEXT);
                    setSlateSublineStyle(DEFAULT_SLATE_SUBLINE_STYLE);
                  }}
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Reset subline
                </Button>
                  </CollapsibleContent>
                </div>
              </Collapsible>
              {/* Slate image — pick from the operator's saved gallery OR
                  upload a fresh one. MediaPicker handles both flows and
                  persists uploads to the `images` storage bucket so the
                  same artwork can be reused across polls. */}
              <MediaPicker
                kind="image"
                label="Slate image"
                value={slateImage}
                onChange={(url) => setSlateImage(url)}
                onClear={() => setSlateImage(undefined)}
                emptyHint="No saved images yet — upload one to reuse."
              />
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
                  {voteSchedule === 'now' ? 'Open Voting Now or Scan' : voteSchedule === 'in' ? `Open in ${voteInMinutes}m` : voteAtTime ? `Open at ${voteAtTime}` : 'Pick a time'}
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground">
                Bars reset to 0% when voting opens. For folders without answer
                bars, viewers see the question + QR (Scan only).
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
                try {
                  // Going live releases the polling slate so voters see answer types.
                  setSlateActive(false);
                  // Reflect the current Program Preview onto the fullscreen
                  // Output surface — but ONLY open a new popup if none is
                  // already tracked. Calling onOpenOutput when a fullscreen
                  // popup exists would .focus() it (Chrome drops fullscreen)
                  // or, worse, trigger window.open with a URL on a remounted
                  // session where the ref is null but the window still
                  // exists, navigating it and exiting fullscreen.
                  if (!outputOpen) {
                    handleOpenOutputClick();
                  }
                  onGoLive();
                } finally {
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
            <AlertDialogTitle>Open voting now or scan?</AlertDialogTitle>
            <AlertDialogDescription>
              Voters will immediately be able to submit responses (or scan the
              QR-only mirror, for folders without answer bars). Scheduled opens
              (in N minutes / at a time) skip this confirmation.
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
