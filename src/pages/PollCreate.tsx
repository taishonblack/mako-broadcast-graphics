import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { AnswerType, MCLabelStyle, PreviewDataMode } from '@/components/poll-create/ContentPanel';
import { BuildControlsPanel } from '@/components/poll-create/BuildControlsPanel';
import { DraftPreviewMonitor } from '@/components/poll-create/DraftPreviewMonitor';
import { ProjectPickerDialog } from '@/components/poll-create/ProjectPickerDialog';
import { PollingAssetsPane, SEEDED_ASSETS } from '@/components/poll-create/polling-assets/PollingAssetsPane';
import { AssetInspector } from '@/components/poll-create/polling-assets/AssetInspector';
import { AssetTransformControls } from '@/components/poll-create/AssetTransformControls';
import { ASSET_REGISTRY } from '@/components/poll-create/polling-assets/PollingAssetsPane';
import { AssetColorMap, AssetColorSet, AssetId, AssetState, AssetTransformMap, AssetTransformSet, DEFAULT_ASSET_COLORS, DEFAULT_ASSET_STATE, DEFAULT_ASSET_TRANSFORMS, TransformField, TransformViewport, createDefaultColorSet, createDefaultTransformSet } from '@/components/poll-create/polling-assets/types';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { LoadPollDialog } from '@/components/poll-create/LoadPollDialog';
import { ImportErrorDialog } from '@/components/poll-create/ImportErrorDialog';
import { usePollScenes } from '@/hooks/usePollScenes';
import { hydrateSceneTransformMap } from '@/lib/poll-scenes';
import { FullscreenScene } from '@/components/broadcast/scenes/FullscreenScene';
import { LowerThirdScene } from '@/components/broadcast/scenes/LowerThirdScene';
import { QRScene } from '@/components/broadcast/scenes/QRScene';
import { ResultsScene } from '@/components/broadcast/scenes/ResultsScene';
import { pollImportSchema, formatZodIssues, ImportIssue, ImportSection } from '@/lib/poll-import-schema';
import { themePresets } from '@/lib/themes';
import { TemplateName, Poll, PollOption, QRPosition, VotingState, LiveState } from '@/lib/types';
import { SceneType } from '@/lib/scenes';
import { broadcastSceneFromSceneType, filterAssetsForScene } from '@/lib/scene-presets';
import { broadcastOutputHeartbeat, broadcastOutputLock, broadcastOutputState, OUTPUT_REQUEST_CHANNEL } from '@/lib/output-state';
import { supabase } from '@/integrations/supabase/client';
import { writePublicViewerState, type PublicViewerPollSnapshot } from '@/lib/public-viewer-state';
import { EQUAL_BASE, equalShareAnswers } from '@/lib/answer-percents';
import { FolderPlus, Loader2, RotateCcw, LayoutPanelLeft, FileIcon, FolderOpen, Upload, Copy, ChevronDown, Monitor, Radio, Undo2, Redo2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { loadPoll, savePoll, listPolls, listProjects, DraftPollPayload, SavedPoll, BlockLetter } from '@/lib/poll-persistence';
import { OperatorOutputMode } from '@/components/operator/OperatorOutputMode';
import { takeToProgram, cutToProgram, setPreviewScene as dbSetPreviewScene, type SceneName } from '@/lib/broadcast-state';
import { toast } from 'sonner';
import {
  createDefaultFolderState,
  createFolderId,
  createFolderName,
  DEFAULT_TALLY_INTERVAL_SECONDS,
  DEFAULT_TALLY_MODE,
  TallyMode,
  DEFAULT_RESULTS_MODE,
  DEFAULT_RESULTS_ANIMATION_MS,
  ResultsMode,
  duplicateFolder,
  linkFolders,
  unlinkFolder,
  setAssetInactive,
  convertAnswerTypeToBars,
  convertAnswerBarsToAnswerType,
  findAssetFolder,
  getFolderById,
  loadProjectPollingAssetFolders,
  PollingAssetFolderState,
  saveProjectPollingAssetFolders,
  normalizeFolderState,
} from '@/lib/polling-asset-folders';
import { DEFAULT_AUTOSAVE_MINUTES, loadAutosaveMinutes } from '@/lib/operator-settings';

type OperatorMode = 'build' | 'output';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value?: string) {
  return Boolean(value && UUID_RE.test(value));
}

function savedPollOptions(poll?: SavedPoll): PollOption[] {
  return (poll?.answers ?? [])
    .filter((answer) => answer.text.trim().length > 0)
    .map((answer, index) => ({
      id: answer.id,
      text: answer.text,
      shortLabel: answer.shortLabel || undefined,
      votes: answer.testVotes ?? 0,
      order: index,
    }));
}

/* ---------- Workspace layout persistence ---------- */

const WORKSPACE_LAYOUT_KEY = 'mako-draft-workspace-layout-v1';
const ASSET_STATE_STORAGE_KEY = 'mako-asset-state-v1';
const OUTPUT_BLOCK_PIN_KEY = 'mako-output-block-pin-v1';
const OUTPUT_BLOCK_LAST_KEY = 'mako-output-block-last-v1';

export type OutputBlockSource = 'pinned' | 'manual' | 'auto-first-populated' | 'auto-promoted' | 'default';

interface PersistedOutputBlock {
  block: BlockLetter;
  pinned: boolean;
}

function loadPersistedOutputBlock(): PersistedOutputBlock {
  try {
    const raw = localStorage.getItem(OUTPUT_BLOCK_LAST_KEY);
    const pinned = localStorage.getItem(OUTPUT_BLOCK_PIN_KEY) === '1';
    if (!raw) return { block: 'A', pinned };
    const parsed = JSON.parse(raw) as { block?: BlockLetter };
    const block = (['A', 'B', 'C', 'D', 'E'] as BlockLetter[]).includes(parsed.block as BlockLetter)
      ? (parsed.block as BlockLetter)
      : 'A';
    return { block, pinned };
  } catch {
    return { block: 'A', pinned: false };
  }
}

function loadPersistedAssetState(): AssetState {
  try {
    const raw = localStorage.getItem(ASSET_STATE_STORAGE_KEY);
    if (!raw) return DEFAULT_ASSET_STATE;
    const parsed = JSON.parse(raw) as Partial<AssetState>;
    return { ...DEFAULT_ASSET_STATE, ...parsed };
  } catch {
    return DEFAULT_ASSET_STATE;
  }
}

const buildActiveFolderStorageKey = (projectId?: string) => `mako-active-folder:${projectId ?? 'draft'}`;

/**
 * Draft folder state persistence — used when the operator is editing in
 * the workspace WITHOUT having opened a project. Without this, navigating
 * away (e.g. to /projects) and back to /workspace remounts PollCreate and
 * wipes the in-memory folder list, losing all assets/folders the operator
 * had built up. With this, the draft round-trips through localStorage so
 * the workspace acts as a persistent scratchpad until a project is opened.
 */
const DRAFT_FOLDER_STATE_KEY = 'mako-draft-folder-state-v1';

function loadDraftFolderState(): PollingAssetFolderState | null {
  try {
    const raw = localStorage.getItem(DRAFT_FOLDER_STATE_KEY);
    if (!raw) return null;
    return normalizeFolderState(JSON.parse(raw));
  } catch {
    return null;
  }
}

interface WorkspaceLayout {
  hSizes: [number, number, number]; // left / center / right
  rightVSizes: [number, number];     // Template / Inspector
}

interface EditorSnapshot {
  question: string;
  internalName: string;
  slug: string;
  subheadline: string;
  selectedTemplate: TemplateName;
  answerType: AnswerType;
  mcLabelStyle: MCLabelStyle;
  previewDataMode: PreviewDataMode;
  answers: { id: string; text: string; shortLabel: string; testVotes?: number }[];
  showLiveResults: boolean;
  showThankYou: boolean;
  showFinalResults: boolean;
  postVoteDelayMs: number;
  autoClose: string;
  bgColor: string;
  bgImage?: string;
  blockLetter: BlockLetter;
  blockPosition: number;
  selectedAssetId: AssetId | null;
  assetState: AssetState;
  assetTransforms: typeof DEFAULT_ASSET_TRANSFORMS;
  assetColors: AssetColorMap;
  folderState: PollingAssetFolderState;
}

interface SelectionHistory {
  undo: EditorSnapshot[];
  redo: EditorSnapshot[];
}

function cloneSnapshotValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Broadcast canvas geometry — kept here so centering math reflects the
 * fixed 1920×1080 stage and the 48px broadcast-safe inset used by the
 * AssetOverlay to anchor QR + branding.
 */
const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const STAGE_INSET = 48;
const QR_FRAME_PADDING = 24; // p-3 on each side ≈ 12px → 24px box padding

/**
 * Compute the (x, y) translation in canvas pixels that moves an asset from
 * its anchored corner to dead center on the 1920×1080 stage.
 */
function computeCenterOffset(
  assetId: AssetId,
  ctx: { qrPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; qrSize: number; brandingPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }
): { x: number; y: number } {
  if (assetId === 'qr') {
    const frameW = ctx.qrSize + QR_FRAME_PADDING;
    const frameH = ctx.qrSize + QR_FRAME_PADDING;
    const anchorLeft = ctx.qrPosition.endsWith('left') ? STAGE_INSET : STAGE_WIDTH - STAGE_INSET - frameW;
    const anchorTop = ctx.qrPosition.startsWith('top') ? STAGE_INSET : STAGE_HEIGHT - STAGE_INSET - frameH;
    const targetLeft = (STAGE_WIDTH - frameW) / 2;
    const targetTop = (STAGE_HEIGHT - frameH) / 2;
    return { x: Math.round(targetLeft - anchorLeft), y: Math.round(targetTop - anchorTop) };
  }
  if (assetId === 'logo') {
    // Branding bug uses an estimated 160x32 footprint at the corner anchor.
    const frameW = 160;
    const frameH = 32;
    const anchorLeft = ctx.brandingPosition.endsWith('left') ? STAGE_INSET : STAGE_WIDTH - STAGE_INSET - frameW;
    const anchorTop = ctx.brandingPosition.startsWith('top') ? STAGE_INSET : STAGE_HEIGHT - STAGE_INSET - frameH;
    return { x: Math.round((STAGE_WIDTH - frameW) / 2 - anchorLeft), y: Math.round((STAGE_HEIGHT - frameH) / 2 - anchorTop) };
  }
  // Other assets are scene-positioned (often already near center) → 0/0 is the natural anchor.
  return { x: 0, y: 0 };
}

const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayout = {
  hSizes: [22, 56, 22],
  rightVSizes: [55, 45],
};

function loadWorkspaceLayout(): WorkspaceLayout {
  try {
    const raw = localStorage.getItem(WORKSPACE_LAYOUT_KEY);
    if (!raw) return DEFAULT_WORKSPACE_LAYOUT;
    return { ...DEFAULT_WORKSPACE_LAYOUT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_WORKSPACE_LAYOUT;
  }
}

function saveWorkspaceLayout(partial: Partial<WorkspaceLayout>) {
  try {
    const next = { ...loadWorkspaceLayout(), ...partial };
    localStorage.setItem(WORKSPACE_LAYOUT_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

/* ---------- Pane chrome ---------- */

function PaneHeader({ title, hint, icon: Icon }: { title: string; hint?: string; icon?: typeof FolderOpen }) {
  return (
    <div className="h-7 px-3 flex items-center justify-between border-b border-border/60 bg-muted/30 shrink-0">
      <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="w-3 h-3" />}
        {title}
      </span>
      {hint && <span className="text-[9px] text-muted-foreground/60">{hint}</span>}
    </div>
  );
}

function Pane({
  title, hint, icon, children, contentClassName,
}: { title: string; hint?: string; icon?: typeof FolderOpen; children: React.ReactNode; contentClassName?: string }) {
  return (
    <div className="h-full flex flex-col bg-background">
      <PaneHeader title={title} hint={hint} icon={icon} />
      <div className={`flex-1 min-h-0 overflow-auto ${contentClassName ?? ''}`}>
        {children}
      </div>
    </div>
  );
}

export default function PollCreate() {
  const { id: routeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [pollId, setPollId] = useState<string | undefined>(routeId);
  const [loadingExisting, setLoadingExisting] = useState(!!routeId);
  // Scene management — Project > Block > Folder/Poll > Scene > Assets.
  // When a poll has zero scenes, the assets pane is greyed out until the
  // operator creates one.
  const sceneController = usePollScenes(pollId);
  const [saving, setSaving] = useState<'draft' | 'project' | null>(null);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [projectName, setProjectName] = useState<string | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [autosaveMinutes, setAutosaveMinutes] = useState<number>(DEFAULT_AUTOSAVE_MINUTES);

  const [question, setQuestion] = useState('');
  const [internalName, setInternalName] = useState('');
  const [slug, setSlug] = useState('');
  const [subheadline, setSubheadline] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateName>('horizontal-bar');
  const [answerType, setAnswerType] = useState<AnswerType>('multiple-choice');
  const [mcLabelStyle, setMcLabelStyle] = useState<MCLabelStyle>('letters');
  const [previewDataMode, setPreviewDataMode] = useState<PreviewDataMode>('test');
  const [answers, setAnswers] = useState<{ id: string; text: string; shortLabel: string; testVotes?: number }[]>([
    { id: '1', text: '', shortLabel: '', testVotes: EQUAL_BASE },
    { id: '2', text: '', shortLabel: '', testVotes: EQUAL_BASE },
  ]);
  const [showLiveResults, setShowLiveResults] = useState(true);
  const [showThankYou, setShowThankYou] = useState(true);
  const [showFinalResults, setShowFinalResults] = useState(true);
  const [postVoteDelayMs, setPostVoteDelayMs] = useState<number>(1500);
  const [autoClose, setAutoClose] = useState('');
  const [bgColor, setBgColor] = useState('#1a1a2e');
  const [bgImage, setBgImage] = useState<string | undefined>(undefined);
  const [draftStatus, setDraftStatus] = useState<'unsaved' | 'draft-saved' | 'saved-to-project'>('unsaved');
  const [blockLetter, setBlockLetter] = useState<BlockLetter>('A');
  const [blockPosition, setBlockPosition] = useState<number>(1);
  const [mode, setMode] = useState<OperatorMode>(searchParams.get('mode') === 'output' ? 'output' : 'build');
  const [projectPolls, setProjectPolls] = useState<SavedPoll[]>([]);
  const [outputActiveBlock, setOutputActiveBlock] = useState<BlockLetter>(() => loadPersistedOutputBlock().block);
  // Snapshot of the active folder list, kept current via an effect after
  // `folderState` is declared further down. Used by save handlers (which
  // are defined before `folderState`) to validate Answer Type choices
  // without forming a forward dependency.
  const foldersRef = useRef<PollingAssetFolderState['folders']>([]);
  const [outputBlockPinned, setOutputBlockPinned] = useState<boolean>(() => loadPersistedOutputBlock().pinned);
  const [outputBlockSource, setOutputBlockSource] = useState<OutputBlockSource>(() => (
    loadPersistedOutputBlock().pinned ? 'pinned' : 'default'
  ));
  const [votingState, setVotingState] = useState<VotingState>('not_open');
  const [liveState, setLiveState] = useState<LiveState>('not_live');
  const [previewScene, setPreviewScene] = useState<SceneType>('fullscreen');
  const [programScene, setProgramScene] = useState<SceneType>('fullscreen');
  const [qrSize, setQrSize] = useState(120);
  const [showBranding, setShowBranding] = useState(true);
  const [brandingPosition, setBrandingPosition] = useState<QRPosition>('bottom-left');
  /** Bumped by the operator's "Replay Reveal" button to re-trigger the
   *  Results scene's animated bar reveal without changing vote data. */
  const [resultsReplayKey, setResultsReplayKey] = useState(0);
  const theme = themePresets[0];

  // Load existing poll if visiting /polls/:id
  useEffect(() => {
    if (!routeId) return;
    setLoadingExisting(true);
    loadPoll(routeId)
      .then((p) => {
        if (!p) {
          toast.error('Poll not found');
          navigate('/workspace', { replace: true });
          return;
        }
        setPollId(p.id);
        setInternalName(p.internalName);
        setQuestion(p.question);
        setFolderState((current) => ({
          ...current,
          folders: current.folders.map((folder) => (
            folder.id === current.activeFolderId
              ? { ...folder, questionText: p.question, bgColor: p.bgColor, bgImage: p.bgImage }
              : folder
          )),
        }));
        setSubheadline(p.subheadline);
        setSlug(p.slug);
        setSelectedTemplate(p.template);
        setAnswerType(p.answerType);
        setMcLabelStyle(p.mcLabelStyle);
        setAnswers(p.answers.length
          ? p.answers.map((a) => ({ ...a, testVotes: a.testVotes ?? EQUAL_BASE }))
          : equalShareAnswers(2));
        setShowLiveResults(p.showLiveResults);
        setShowThankYou(p.showThankYou);
        setShowFinalResults(p.showFinalResults);
        setPostVoteDelayMs(p.postVoteDelayMs ?? 1500);
        setAutoClose(p.autoCloseSeconds ? String(p.autoCloseSeconds) : '');
        setBgColor(p.bgColor);
        setBgImage(p.bgImage);
        setPreviewDataMode(p.previewDataMode);
        setProjectId(p.projectId);
        setBlockLetter((p.blockLetter as BlockLetter) || 'A');
        setBlockPosition(p.blockPosition ?? 1);
        setDraftStatus(p.status === 'draft' ? 'draft-saved' : 'saved-to-project');
      })
      .catch((e) => toast.error(`Could not load poll: ${e.message}`))
      .finally(() => setLoadingExisting(false));
  }, [routeId, navigate]);

  // Mark dirty when fields change after a save
  useEffect(() => {
    if (draftStatus !== 'unsaved') setDraftStatus('unsaved');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, internalName, slug, subheadline, selectedTemplate, answerType, mcLabelStyle, answers, showLiveResults, showThankYou, showFinalResults, autoClose, bgColor, bgImage, previewDataMode]);

  useEffect(() => {
    const rawMode = searchParams.get('mode');
    const nextMode: OperatorMode = rawMode === 'output' ? 'output' : 'build';
    if (mode !== nextMode) {
      setMode(nextMode);
    }
    if (rawMode === 'edit') {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('mode', 'build');
      setSearchParams(nextParams, { replace: true });
    }
  }, [mode, searchParams, setSearchParams]);

  const rescanProjectPolls = useCallback(async () => {
    if (!user || !projectId) {
      setProjectPolls([]);
      return;
    }
    try {
      const items = await listPolls();
      setProjectPolls(items.filter((poll) => poll.projectId === projectId));
    } catch {
      setProjectPolls([]);
    }
  }, [user, projectId]);

  useEffect(() => {
    void rescanProjectPolls();
  }, [rescanProjectPolls, pollId, draftStatus]);

  useEffect(() => {
    if (projectId) {
      listProjects()
        .then((items) => {
          const match = items.find((project) => project.id === projectId);
          if (match) {
            setProjectName(match.name);
            localStorage.setItem('mako-active-project', match.id);
          }
        })
        .catch(() => undefined);
      return;
    }

    const activeProjectId = localStorage.getItem('mako-active-project');
    if (!activeProjectId) {
      setProjectName(undefined);
      return;
    }

    listProjects()
      .then((items) => {
        const match = items.find((project) => project.id === activeProjectId);
        if (!match) return;
        setProjectId(match.id);
        setProjectName(match.name);
      })
      .catch(() => undefined);
  }, [projectId]);

  useEffect(() => {
    setAutosaveMinutes(loadAutosaveMinutes());

    const handleStorage = (event: StorageEvent) => {
      if (event.key) {
        setAutosaveMinutes(loadAutosaveMinutes());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const buildPayload = useCallback((): DraftPollPayload => ({
    internalName,
    question,
    subheadline,
    slug,
    template: selectedTemplate,
    answerType,
    mcLabelStyle,
    answers,
    showLiveResults,
    showThankYou,
    showFinalResults,
    autoCloseSeconds: autoClose ? Number(autoClose) : undefined,
    postVoteDelayMs,
    bgColor,
    bgImage,
    previewDataMode,
    blockLetter,
    blockPosition,
  }), [internalName, question, subheadline, slug, selectedTemplate, answerType, mcLabelStyle, answers, showLiveResults, showThankYou, showFinalResults, postVoteDelayMs, autoClose, bgColor, bgImage, previewDataMode, blockLetter, blockPosition]);

  const persistProjectSave = useCallback(async (selectedProjectId: string, selectedProjectName?: string, source: 'manual' | 'autosave' = 'manual') => {
    if (!user) { toast.error('Please sign in first'); return false; }

    // Block saves (manual + autosave) when any folder uses the Answer Type
    // asset and its choices are empty or duplicated. Voter buttons must be
    // unambiguous before the poll can be persisted. Read folders via the
    // ref so this callback doesn't need to depend on folderState (which is
    // declared further down in the component).
    const folders = foldersRef.current;
    const anyFolderUsesAnswerType = folders.some((f) =>
      f.assetIds.includes('answerType') && !(f.inactiveAssetIds ?? []).includes('answerType')
    );
    if (anyFolderUsesAnswerType) {
      const seen = new Map<string, number>();
      for (let i = 0; i < answers.length; i += 1) {
        const norm = answers[i].text.trim().toLowerCase();
        if (!norm) {
          toast.error(`Answer Type · Choice ${i + 1} is empty.`);
          return false;
        }
        if (seen.has(norm)) {
          toast.error(`Answer Type · Choice ${i + 1} duplicates Choice ${(seen.get(norm) ?? 0) + 1}.`);
          return false;
        }
        seen.set(norm, i);
      }
    }

    setSaving('project');
    try {
      const saved = await savePoll({
        id: pollId,
        payload: buildPayload(),
        userId: user.id,
        status: 'saved',
        projectId: selectedProjectId,
      });
      if (!pollId) {
        setPollId(saved.id);
        navigate(`/polls/${saved.id}`, { replace: true });
      }
      setProjectId(selectedProjectId);
      if (selectedProjectName) {
        setProjectName(selectedProjectName);
      }
      setDraftStatus('saved-to-project');
      if (source === 'manual') {
        toast.success(`Saved to "${selectedProjectName ?? projectName ?? 'project'}"`);
      }
      return true;
    } catch (e) {
      toast.error(`${source === 'autosave' ? 'Autosave' : 'Save'} failed: ${(e as Error).message}`);
      return false;
    } finally {
      setSaving(null);
    }
  }, [answers, buildPayload, navigate, pollId, projectName, user]);

  const handleSaveToProject = () => {
    if (!user) { toast.error('Please sign in first'); return; }
    setPickerOpen(true);
  };

  useEffect(() => {
    // Autosave should keep running for as long as the operator has a project
    // selected — it stops only when there is no user or no project.
    if (!user || !projectId) return;

    const intervalMs = Math.max(1, autosaveMinutes) * 60 * 1000;
    const timer = window.setInterval(() => {
      if (saving !== null) return;
      void persistProjectSave(projectId, projectName, 'autosave');
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [autosaveMinutes, persistProjectSave, projectId, projectName, saving, user]);

  // Save-on-leave: timer-based autosave can lag behind the operator. If the
  // tab is hidden (visibilitychange → 'hidden') or the page is about to be
  // closed/navigated, flush a save immediately so scenes/assets created in
  // the last minute aren't lost when the user comes back to a different tab.
  useEffect(() => {
    if (!user || !projectId) return;
    const flush = () => {
      if (saving !== null) return;
      void persistProjectSave(projectId, projectName, 'autosave');
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [persistProjectSave, projectId, projectName, saving, user]);

  const handleProjectSelected = async (selectedProjectId: string, selectedProjectName: string) => {
    await persistProjectSave(selectedProjectId, selectedProjectName, 'manual');
  };

  const previewOptions: PollOption[] = useMemo(() =>
    answers.map((a, i) => ({
      id: a.id,
      text: a.text || `Answer ${i + 1}`,
      shortLabel: a.shortLabel || undefined,
      votes: previewDataMode === 'test' ? (a.testVotes ?? 0) : 0,
      order: i,
    })), [answers, previewDataMode]
  );
  const previewTotal = previewOptions.reduce((sum, o) => sum + o.votes, 0);
  const previewQuestion = question || 'Your question here?';

  const slugForUrl = slug || 'your-poll-slug';
  const fullUrl = `https://makovote.app/vote/${slugForUrl}`;
  const shortUrl = `mvote.app/${slugForUrl}`;

  const currentWorkspacePoll = useMemo<Poll>(() => ({
    id: pollId ?? 'draft-poll',
    projectId,
    internalName: internalName || 'Untitled Poll',
    question,
    subheadline,
    slug: slugForUrl,
    state: 'draft',
    votingState,
    options: previewOptions,
    totalVotes: previewTotal,
    votesPerSecond: 0,
    template: selectedTemplate,
    themeId: theme.id,
    showLiveResults,
    hideUntilClose: false,
    minVoteThreshold: 0,
    allowVoteChange: true,
    autoCloseDuration: autoClose ? Number(autoClose) : undefined,
    showThankYou,
    showFinalResults,
    blockLetter,
    blockPosition,
    bgColor,
    bgImage,
    createdAt: new Date().toISOString(),
  }), [pollId, projectId, internalName, question, subheadline, slugForUrl, votingState, previewOptions, previewTotal, selectedTemplate, theme.id, showLiveResults, autoClose, showThankYou, showFinalResults, blockLetter, blockPosition, bgColor, bgImage]);

  const outputPolls = useMemo(() => {
    const existing = projectPolls.filter((poll) => poll.id !== currentWorkspacePoll.id);
    // Stricter rule: only surface the in-progress workspace poll in the operator
    // output list when BOTH conditions are true — it has a real saved poll id AND
    // a non-empty on-air question. This prevents phantom "Untitled Poll" entries
    // from leaking into block lists while the operator is editing a draft.
    const hasRealId = Boolean(pollId);
    const hasQuestion = Boolean(question && question.trim());
    if (!hasRealId || !hasQuestion) {
      return existing;
    }
    return [
      {
        ...currentWorkspacePoll,
        status: projectId ? 'saved' : 'draft',
        updatedAt: new Date().toISOString(),
        answerType,
        mcLabelStyle,
        answers,
        previewDataMode,
        bgColor,
        bgImage,
      } as SavedPoll,
      ...existing,
    ];
  }, [projectPolls, currentWorkspacePoll, projectId, pollId, question, answerType, mcLabelStyle, answers, previewDataMode, bgColor, bgImage]);

  // Persist last selected block + pin toggle so they survive reloads.
  useEffect(() => {
    try {
      localStorage.setItem(OUTPUT_BLOCK_LAST_KEY, JSON.stringify({ block: outputActiveBlock }));
    } catch { /* ignore */ }
  }, [outputActiveBlock]);
  useEffect(() => {
    try {
      localStorage.setItem(OUTPUT_BLOCK_PIN_KEY, outputBlockPinned ? '1' : '0');
    } catch { /* ignore */ }
  }, [outputBlockPinned]);

  const renderOutputScene = () => {
    // Always render the PROGRAM viewport's transforms/colors here. This is the
    // node passed to OperatorOutputMode as the on-air program preview, so it
    // must NOT drift to the operator's currently-selected mobile/desktop tab
    // in Build. (Previously it read `assetTransforms`/`assetColors` which
    // followed `transformViewport`, causing the QR/asset placement to
    // momentarily snap to mobile/desktop defaults when the operator switched
    // from Build → Output until they revisited Build's Program tab.)
    const programTransforms = assetTransformSet.program;
    const programAssetColors = assetColorSet.program;
    const programColors = programAssetColors.answers.barColors?.length
      ? programAssetColors.answers.barColors
      : [theme.chartColorA, theme.chartColorB, theme.chartColorC, theme.chartColorD];
    // Scene-driven visibility: the operator picks a scene, the scene
    // narrows the poll's enabled assets down to what should appear on
    // air (e.g. Question+QR hides answer bars; Lower Third hides QR).
    const sceneEnabled = filterAssetsForScene(
      sceneFilteredEnabled,
      broadcastSceneFromSceneType(previewScene),
    );
    const activeFolderForResults = getFolderById(folderState, folderState.activeFolderId);
    const sharedAssets = {
      slug: slugForUrl,
      qrSize,
      qrPosition: assetState.qrPosition,
      qrVisible: assetState.qrVisible,
      qrUrlVisible: assetState.qrUrlVisible,
      showBranding,
      brandingPosition,
      enabledAssetIds: sceneEnabled,
      transforms: programTransforms,
      assetColors: programAssetColors,
      wordmarkWeight: assetState.wordmarkWeight,
      wordmarkTracking: assetState.wordmarkTracking,
      wordmarkScale: assetState.wordmarkScale,
      resultsMode: activeFolderForResults?.resultsMode ?? DEFAULT_RESULTS_MODE,
      resultsAnimationMs: activeFolderForResults?.resultsAnimationMs ?? DEFAULT_RESULTS_ANIMATION_MS,
      resultsReplayKey,
    };
    const props = {
      question: currentWorkspacePoll.question || 'Your question here?',
      subheadline,
      options: currentWorkspacePoll.options,
      totalVotes: currentWorkspacePoll.totalVotes,
      colors: programColors,
      theme,
      template: selectedTemplate,
      ...sharedAssets,
    };

    const bgStyle: React.CSSProperties = bgImage
      ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : bgColor
        ? { background: `linear-gradient(135deg, ${bgColor}, hsla(220, 20%, 8%, 0.95))` }
        : {};

    let scene: React.ReactNode;
    switch (previewScene) {
      case 'lowerThird': scene = <LowerThirdScene {...props} />; break;
      case 'qr': scene = <QRScene slug={slugForUrl} theme={theme} {...sharedAssets} />; break;
      case 'results': scene = <ResultsScene {...props} />; break;
      default: scene = <FullscreenScene {...props} layers={[]} />;
    }
    return <div className="absolute inset-0" style={bgStyle}>{scene}</div>;
  };

  function getProgramOutputPayload(poll: Poll = currentWorkspacePoll) {
    const programTransforms = assetTransformSet.program;
    const programAssetColors = assetColorSet.program;
    const folder = getFolderById(folderState, folderState.activeFolderId);
    const sceneEnabled = filterAssetsForScene(sceneFilteredEnabled, broadcastSceneFromSceneType(previewScene));

    return {
      poll: {
        ...poll,
        question: poll.question || previewQuestion,
        options: poll.options?.length ? poll.options : previewOptions,
        totalVotes: poll.options?.length ? poll.totalVotes : previewTotal,
      },
      scene: previewScene,
      layers: [],
      assets: {
        qrSize,
        qrPosition: assetState.qrPosition,
        qrVisible: assetState.qrVisible,
        qrUrlVisible: assetState.qrUrlVisible,
        showBranding,
        brandingPosition,
        enabledAssetIds: sceneEnabled,
        transforms: programTransforms,
        assetColors: programAssetColors,
        wordmarkWeight: assetState.wordmarkWeight,
        wordmarkTracking: assetState.wordmarkTracking,
        wordmarkScale: assetState.wordmarkScale,
        wordmarkShowGuides: assetState.wordmarkShowGuides,
        tallyMode: folder?.tallyMode ?? DEFAULT_TALLY_MODE,
        tallyIntervalSeconds: folder?.tallyIntervalSeconds ?? DEFAULT_TALLY_INTERVAL_SECONDS,
        resultsMode: folder?.resultsMode ?? DEFAULT_RESULTS_MODE,
        resultsAnimationMs: folder?.resultsAnimationMs ?? DEFAULT_RESULTS_ANIMATION_MS,
        resultsReplayKey,
      },
    };
  }

  const setWorkspaceMode = (nextMode: OperatorMode) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('mode', nextMode);
    setSearchParams(nextParams, { replace: true });
    setMode(nextMode);
  };

  const handleTake = () => {
    setProgramScene(previewScene);
    if (projectId) void takeToProgram(projectId, previewScene as unknown as SceneName);
    broadcastOutputState(getProgramOutputPayload());
  };

  const handleCut = () => {
    setProgramScene(previewScene);
    if (projectId) void cutToProgram(projectId, previewScene as unknown as SceneName);
    broadcastOutputState(getProgramOutputPayload());
  };

  const handleGoLive = async () => {
    let livePoll = currentWorkspacePoll;
    if (!isUuid(livePoll.id) && projectId) {
      const match = projectPolls.find((poll) => poll.projectId === projectId && poll.slug === slugForUrl);
      if (match) {
        livePoll = {
          ...livePoll,
          id: match.id,
          projectId: match.projectId,
          options: savedPollOptions(match),
          question: livePoll.question || match.question,
          subheadline: livePoll.subheadline || match.subheadline,
          bgColor: livePoll.bgColor || match.bgColor,
          bgImage: livePoll.bgImage || match.bgImage,
        };
      }
    }

    setLiveState('live');
    // Build the canonical Program payload for the lock snapshot. We push it
    // through handleTake() (so existing listeners + DB sync stay in sync) AND
    // emit a lock message that freezes Output until End Live.
    handleTake();
    const folder = getFolderById(folderState, folderState.activeFolderId);
    const snapshotPoll = {
      ...livePoll,
      viewer_slug: livePoll.slug,
      options: livePoll.options?.length ? livePoll.options : previewOptions,
      answers: livePoll.options?.length ? livePoll.options : previewOptions,
    };
    const snapshot = { ...getProgramOutputPayload(snapshotPoll), slateActive: false };
    broadcastOutputLock({ locked: true, snapshot, lockedAt: Date.now() });
    // Persist the snapshot to project_live_state so cross-network viewers
    // (mobile/desktop on /vote/:slug) can read the operator's color
    // assignments and enabled-asset list and render in parity with Program.
    if (projectId) {
      const { error } = await supabase.from('project_live_state').upsert({
        project_id: projectId,
        active_poll_id: isUuid(livePoll.id) ? livePoll.id : null,
        active_folder_id: folderState.activeFolderId ?? null,
        live_folder_id: folderState.activeFolderId ?? null,
        live_poll_snapshot: snapshot as never,
        voting_state: 'open',
        output_state: 'program_live',
      } as never);
      if (error) {
        toast.error(`Go Live viewer sync failed: ${error.message}`);
      }
      // Write to public_viewer_state — the audience-only source of truth.
      const audienceSnapshot: PublicViewerPollSnapshot = {
        id: isUuid(livePoll.id) ? livePoll.id : undefined,
        question: snapshotPoll.question,
        subheadline: snapshotPoll.subheadline,
        bgColor: snapshotPoll.bgColor,
        bgImage: snapshotPoll.bgImage,
        answers: (snapshotPoll.options ?? []).map((o, i) => ({
          id: o.id,
          label: o.text || `Answer ${i + 1}`,
          shortLabel: o.shortLabel,
          sortOrder: i,
        })),
        showLiveResults: snapshotPoll.showLiveResults,
        showThankYou: snapshotPoll.showThankYou,
        assetColors,
      };
      const audience = await writePublicViewerState({
        projectId,
        viewerSlug: livePoll.slug,
        state: 'voting',
        pollSnapshot: audienceSnapshot,
      });
      if (audience.error) toast.error(`Viewer Go Live sync failed: ${audience.error}`);
    }
    // Open Output fullscreen window if not already open, and open voting so
    // the slate/voting flow begins simultaneously with the on-air push.
    try {
      window.open(`/output/${currentWorkspacePoll.id}`, 'mako-output', 'width=1920,height=1080');
    } catch {}
    setVotingState('open');
  };

  const handleEndPoll = () => {
    setLiveState('not_live');
    setVotingState('closed');
    // Release the Program lock so the workspace once again drives Output.
    broadcastOutputLock({ locked: false });
    if (projectId) {
      void supabase.from('project_live_state').upsert({
        project_id: projectId,
        live_poll_snapshot: null,
        live_folder_id: null,
        voting_state: 'closed',
        output_state: 'preview',
      } as never);
      // Audience returns to MakoVote branding.
      void writePublicViewerState({
        projectId,
        viewerSlug: currentWorkspacePoll.slug,
        state: 'branding',
        pollSnapshot: null,
      });
    }
  };

  const [layout, setLayout] = useState<WorkspaceLayout>(loadWorkspaceLayout);
  const [layoutKey, setLayoutKey] = useState(0);
  const resetLayout = () => {
    localStorage.removeItem(WORKSPACE_LAYOUT_KEY);
    setLayout(DEFAULT_WORKSPACE_LAYOUT);
    setLayoutKey((k) => k + 1);
  };

  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [importError, setImportError] = useState<{
    open: boolean;
    fileName?: string;
    parseError?: string;
    issues: ImportIssue[];
  }>({ open: false, issues: [] });

  const applyLoadedPoll = (p: SavedPoll) => {
    setPollId(p.id);
    navigate(`/polls/${p.id}`, { replace: true });
    setInternalName(p.internalName);
    setQuestion(p.question);
    setFolderState((current) => ({
      ...current,
      folders: current.folders.map((folder) => (
        folder.id === current.activeFolderId
          ? { ...folder, questionText: p.question, bgColor: p.bgColor, bgImage: p.bgImage }
          : folder
      )),
    }));
    setSubheadline(p.subheadline);
    setSlug(p.slug);
    setSelectedTemplate(p.template);
    setAnswerType(p.answerType);
    setMcLabelStyle(p.mcLabelStyle);
    setAnswers(p.answers.length
      ? p.answers.map((a) => ({ ...a, testVotes: a.testVotes ?? EQUAL_BASE }))
      : equalShareAnswers(2));
    setShowLiveResults(p.showLiveResults);
    setShowThankYou(p.showThankYou);
    setShowFinalResults(p.showFinalResults);
    setAutoClose(p.autoCloseSeconds ? String(p.autoCloseSeconds) : '');
    setBgColor(p.bgColor);
    setBgImage(p.bgImage);
    setPreviewDataMode(p.previewDataMode);
    setProjectId(p.projectId);
    setDraftStatus(p.status === 'draft' ? 'draft-saved' : 'saved-to-project');
    toast.success(`Loaded "${p.internalName || p.question || 'poll'}"`);
  };

  const handleDuplicate = async () => {
    if (!user) { toast.error('Please sign in first'); return; }
    setSaving('draft');
    try {
      const payload = buildPayload();
      payload.internalName = `${payload.internalName || 'Poll'} (Copy)`;
      payload.slug = payload.slug ? `${payload.slug}-copy` : '';
      const saved = await savePoll({
        payload,
        userId: user.id,
        status: 'draft',
      });
      setPollId(saved.id);
      navigate(`/polls/${saved.id}`, { replace: true });
      setInternalName(saved.internalName);
      setSlug(saved.slug);
      setProjectId(undefined);
      setDraftStatus('draft-saved');
      toast.success('Duplicated as new draft');
    } catch (e) {
      toast.error(`Duplicate failed: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      let parsed: unknown;
      try {
        const text = await file.text();
        parsed = JSON.parse(text);
      } catch (e) {
        setImportError({
          open: true,
          fileName: file.name,
          parseError: (e as Error).message,
          issues: [],
        });
        return;
      }

      const result = pollImportSchema.safeParse(parsed);
      if (!result.success) {
        const issues = formatZodIssues(result.error);
        setImportError({ open: true, fileName: file.name, issues });
        toast.error(`Import failed — ${issues.length} validation ${issues.length === 1 ? 'issue' : 'issues'}`);
        return;
      }

      const data = result.data;
      setInternalName(data.internalName);
      setQuestion(data.question);
      setFolderState((current) => ({
        ...current,
        folders: current.folders.map((folder) => (
          folder.id === current.activeFolderId
            ? { ...folder, questionText: data.question, bgColor: data.bgColor, bgImage: data.bgImage }
            : folder
        )),
      }));
      setSubheadline(data.subheadline);
      setSlug(data.slug);
      setSelectedTemplate(data.template);
      setAnswerType(data.answerType);
      setMcLabelStyle(data.mcLabelStyle);
      setAnswers(data.answers as { id: string; text: string; shortLabel: string; testVotes?: number }[]);
      setShowLiveResults(data.showLiveResults);
      setShowThankYou(data.showThankYou);
      setShowFinalResults(data.showFinalResults);
      setAutoClose(data.autoCloseSeconds ? String(data.autoCloseSeconds) : '');
      setBgColor(data.bgColor);
      setBgImage(data.bgImage);
      setPreviewDataMode(data.previewDataMode);
      setBlockLetter((data.blockLetter as BlockLetter | undefined) ?? 'A');
      setBlockPosition(data.blockPosition ?? 1);
      toast.success(`Imported ${file.name}`);
    };
    input.click();
  };

  // Modular polling-assets state
  const [selectedAssetId, setSelectedAssetId] = useState<AssetId | null>(null);
  const [assetState, setAssetState] = useState<AssetState>(() => loadPersistedAssetState());
  // Per-viewport transform sets. The inspector edits the slice for whichever
  // viewport is currently active so Program / Mobile / Desktop tweaks stay
  // independent. `assetTransforms` continues to be the live map every scene
  // and the inspector reads from, while writes flow through `setAssetTransforms`
  // and only mutate the active viewport's slice.
  // Per-scene transform sets. Each scene gets its own AssetTransformSet so
  // moving / scaling the QR (or any asset) in Scene 1 does NOT bleed into
  // Scene 2. We key by sceneId; when no scene is active we fall back to a
  // shared bucket so the inspector still works on poll-level edits.
  const NO_SCENE_KEY = '__no_scene__';
  const [transformViewport, setTransformViewport] = useState<TransformViewport>('program');
  const [sceneTransformSets, setSceneTransformSets] = useState<Record<string, AssetTransformSet>>(
    () => ({ [NO_SCENE_KEY]: createDefaultTransformSet() }),
  );
  const activeTransformKey = sceneController.activeSceneId ?? NO_SCENE_KEY;
  // Lazily seed a transform set for a newly-active scene by copying from
  // the previously-active scene (or the no-scene bucket). This keeps "new
  // scene inherits current scene transforms" behavior without needing to
  // hook the create flow directly.
  const lastActiveKeyRef = useRef<string>(activeTransformKey);
  useEffect(() => {
    setSceneTransformSets((current) => {
      if (current[activeTransformKey]) {
        lastActiveKeyRef.current = activeTransformKey;
        return current;
      }
      const seedFrom = current[lastActiveKeyRef.current] ?? current[NO_SCENE_KEY] ?? createDefaultTransformSet();
      // Deep clone so subsequent edits in the new scene don't mutate the source.
      const cloned: AssetTransformSet = JSON.parse(JSON.stringify(seedFrom));
      lastActiveKeyRef.current = activeTransformKey;
      return { ...current, [activeTransformKey]: cloned };
    });
  }, [activeTransformKey]);
  const assetTransformSet: AssetTransformSet =
    sceneTransformSets[activeTransformKey] ?? sceneTransformSets[NO_SCENE_KEY];
  const assetTransforms: AssetTransformMap = assetTransformSet[transformViewport];
  const setAssetTransformSet = useCallback(
    (updater: AssetTransformSet | ((current: AssetTransformSet) => AssetTransformSet)) => {
      setSceneTransformSets((all) => {
        const key = lastActiveKeyRef.current;
        const slice = all[key] ?? createDefaultTransformSet();
        const next = typeof updater === 'function'
          ? (updater as (c: AssetTransformSet) => AssetTransformSet)(slice)
          : updater;
        if (next === slice) return all;
        return { ...all, [key]: next };
      });
    },
    [],
  );
  const setAssetTransforms = useCallback(
    (updater: AssetTransformMap | ((current: AssetTransformMap) => AssetTransformMap)) => {
      setSceneTransformSets((all) => {
        const key = lastActiveKeyRef.current;
        const set = all[key] ?? createDefaultTransformSet();
        const slice = set[transformViewport];
        const next = typeof updater === 'function'
          ? (updater as (c: AssetTransformMap) => AssetTransformMap)(slice)
          : updater;
        if (next === slice) return all;
        return { ...all, [key]: { ...set, [transformViewport]: next } };
      });
    },
    [transformViewport],
  );
  // Seed sceneTransformSets from the DB whenever scenes load. We only
  // overwrite buckets we haven't created yet locally, so an in-progress
  // edit isn't clobbered if the operator is mid-drag when a refetch lands.
  useEffect(() => {
    if (sceneController.scenes.length === 0) return;
    setSceneTransformSets((current) => {
      let changed = false;
      const next = { ...current };
      for (const scene of sceneController.scenes) {
        if (next[scene.id]) continue;
        const programMap = hydrateSceneTransformMap(scene.assetTransforms ?? {});
        next[scene.id] = {
          program: programMap,
          // Mobile/Desktop overrides aren't persisted yet — seed them
          // from the program map so the operator's tweaks start from the
          // same place they see on broadcast.
          mobile: JSON.parse(JSON.stringify(programMap)),
          desktop: JSON.parse(JSON.stringify(programMap)),
        };
        changed = true;
      }
      return changed ? next : current;
    });
  }, [sceneController.scenes]);
  // Debounced persistence: whenever the program slice for the active scene
  // changes, push it to the DB. Mobile/Desktop edits stay client-side.
  const persistTransformsRef = useRef(sceneController.saveSceneAssetTransforms);
  useEffect(() => { persistTransformsRef.current = sceneController.saveSceneAssetTransforms; });
  const lastSavedTransformsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const sceneId = sceneController.activeSceneId;
    if (!sceneId) return;
    const set = sceneTransformSets[sceneId];
    if (!set) return;
    const programMap = set.program;
    const serialized = JSON.stringify(programMap);
    if (lastSavedTransformsRef.current[sceneId] === serialized) return;
    const handle = window.setTimeout(() => {
      lastSavedTransformsRef.current[sceneId] = serialized;
      void persistTransformsRef.current(sceneId, programMap);
    }, 600);
    return () => window.clearTimeout(handle);
  }, [sceneTransformSets, sceneController.activeSceneId]);
  // Per-viewport answer / text colors. The active slice is exposed as
  // `assetColors`; `setAssetColors` writes only into the active viewport's
  // slice, so changing colors on the Mobile tab does not affect Program or
  // Desktop. Full Screen Output always mirrors the `program` slice.
  const [assetColorSet, setAssetColorSet] = useState<AssetColorSet>(() => createDefaultColorSet());
  const assetColors: AssetColorMap = assetColorSet[transformViewport];
  const setAssetColors = useCallback(
    (updater: AssetColorMap | ((current: AssetColorMap) => AssetColorMap)) => {
      setAssetColorSet((current) => {
        const slice = current[transformViewport];
        const next = typeof updater === 'function'
          ? (updater as (c: AssetColorMap) => AssetColorMap)(slice)
          : updater;
        if (next === slice) return current;
        return { ...current, [transformViewport]: next };
      });
    },
    [transformViewport],
  );
  const [highlightField, setHighlightField] = useState<string | null>(null);
  const [folderState, setFolderState] = useState<PollingAssetFolderState>(() => createDefaultFolderState(question));
  // Keep foldersRef in sync so callbacks defined earlier can read the
  // latest folder list without a stale-closure bug.
  useEffect(() => {
    foldersRef.current = folderState.folders;
  }, [folderState.folders]);
  const [deleteFolderTargetId, setDeleteFolderTargetId] = useState<string | null>(null);
  const [foldersLoadedForProject, setFoldersLoadedForProject] = useState<string | null>(null);
  const [selectionHistory, setSelectionHistory] = useState<Record<string, SelectionHistory>>({});
  const [backgroundImageMissing, setBackgroundImageMissing] = useState(false);
  const [_lastDeletedFolderState, setLastDeletedFolderState] = useState<PollingAssetFolderState | null>(null);

  const outputFolders = useMemo(
    () => folderState.folders
      .filter((folder) => folder.assetIds.length > 0)
      .map((folder) => ({ id: folder.id, name: folder.name, blockLetter: folder.blockLetter })),
    [folderState.folders],
  );

  // In output mode, auto-select the first block that actually has content
  // (polls and/or folders) in A → E priority, unless the operator pinned a block.
  useEffect(() => {
    if (mode !== 'output') return;
    const order: BlockLetter[] = ['A', 'B', 'C', 'D', 'E'];
    const counts = order.reduce<Record<BlockLetter, number>>((acc, letter) => {
      const pollCount = outputPolls.filter((p) => (p.blockLetter ?? 'A') === letter).length;
      const folderCount = outputFolders.filter((folder) => folder.blockLetter === letter).length;
      acc[letter] = pollCount + folderCount;
      return acc;
    }, { A: 0, B: 0, C: 0, D: 0, E: 0 });

    if (outputBlockPinned && counts[outputActiveBlock] > 0) {
      setOutputBlockSource('pinned');
      return;
    }

    const firstNonEmpty = order.find((letter) => counts[letter] > 0);
    if (!firstNonEmpty) return;

    if (counts[outputActiveBlock] === 0) {
      setOutputActiveBlock(firstNonEmpty);
      setOutputBlockSource('auto-first-populated');
    }
    // Note: we intentionally do NOT auto-promote to an earlier populated
    // block. Doing so would override the operator's manual selection
    // (e.g. clicking Block C would snap back to Block B if B has a folder).
    // Auto-selection only kicks in when the current block is empty.
  }, [mode, outputFolders, outputPolls, outputActiveBlock, outputBlockPinned]);

  // Signature of folders relevant to Output mode (id, name, blockLetter).
  // When this changes (rename / delete / new / re-block), trigger a rescan
  // so the operator's Output block lists reflect the change immediately.
  const folderSignature = useMemo(
    () => folderState.folders.map((f) => `${f.id}:${f.name}:${f.blockLetter}`).join('|'),
    [folderState.folders],
  );
  useEffect(() => {
    void rescanProjectPolls();
  }, [folderSignature, rescanProjectPolls]);

  // Test-vote runner: bumps answers[i].testVotes incrementally so the
  // preview chart and counters animate as if real votes were arriving.
  const [testVoteRunning, setTestVoteRunning] = useState(false);
  const testVoteTimerRef = (window as unknown as { __mvTimer?: number }).__mvTimer;
  void testVoteTimerRef;
  const handleStartTestVotes = useCallback((total: number, durationSeconds: number, targetPercents?: number[]) => {
    if (testVoteRunning) return;
    if (!answers.length || total <= 0 || durationSeconds <= 0) return;
    // Run = reset + start. Zero out any prior tallies before ramping up so
    // each Run produces a clean 0% → final-target animation. This replaces
    // the previous separate "Reset votes to 0%" button.
    setAnswers((current) => current.map((a) => ({ ...a, testVotes: 0 })));
    setPreviewDataMode('test');
    setTestVoteRunning(true);
    const tickMs = 200;
    const ticks = Math.max(1, Math.round((durationSeconds * 1000) / tickMs));
    // Resolve final per-answer vote targets. If percentages are provided,
    // honor them exactly (rounded; remainder padded to the largest share).
    // Otherwise fall back to even distribution.
    const n = answers.length;
    const pcts = targetPercents && targetPercents.length === n
      ? targetPercents.map((p) => Math.max(0, Number.isFinite(p) ? p : 0))
      : Array.from({ length: n }, () => 100 / n);
    const sumPct = pcts.reduce((s, p) => s + p, 0) || 1;
    const normalized = pcts.map((p) => p / sumPct);
    const finalTargets = normalized.map((p) => Math.round(p * total));
    // Adjust rounding drift so totals match exactly.
    let drift = total - finalTargets.reduce((s, v) => s + v, 0);
    while (drift !== 0) {
      const i = drift > 0
        ? normalized.indexOf(Math.max(...normalized))
        : finalTargets.indexOf(Math.max(...finalTargets));
      finalTargets[i] += drift > 0 ? 1 : -1;
      drift += drift > 0 ? -1 : 1;
    }
    let tick = 0;
    const distributed = new Array<number>(n).fill(0);
    const interval = window.setInterval(() => {
      tick += 1;
      // Per-answer ramp toward each finalTarget, so percentages converge
      // to the operator's chosen split as the run completes.
      const deltas = finalTargets.map((tgt, i) => {
        const want = Math.round((tick / ticks) * tgt);
        const d = want - distributed[i];
        distributed[i] = want;
        return d;
      });
      if (deltas.some((d) => d !== 0)) {
        setAnswers((current) => {
          if (!current.length) return current;
          return current.map((a, i) => ({
            ...a,
            testVotes: Math.max(0, (a.testVotes ?? 0) + (deltas[i] ?? 0)),
          }));
        });
      }
      if (tick >= ticks) {
        window.clearInterval(interval);
        setTestVoteRunning(false);
      }
    }, tickMs);
    (window as unknown as { __mvTimer?: number }).__mvTimer = interval;
  }, [answers.length, testVoteRunning]);
  const handleStopTestVotes = useCallback(() => {
    const w = window as unknown as { __mvTimer?: number };
    if (w.__mvTimer) {
      window.clearInterval(w.__mvTimer);
      w.__mvTimer = undefined;
    }
    setTestVoteRunning(false);
  }, []);

  // Reset every answer's testVotes back to 0. This affects the build too —
  // the operator can re-enter values manually in Build if they want to seed
  // the chart with non-zero starting percentages.
  const handleResetTestVotes = useCallback(() => {
    const w = window as unknown as { __mvTimer?: number };
    if (w.__mvTimer) {
      window.clearInterval(w.__mvTimer);
      w.__mvTimer = undefined;
    }
    setTestVoteRunning(false);
    setAnswers((current) => current.map((a) => ({ ...a, testVotes: 0 })));
    toast.success('Vote tallies reset to 0');
  }, [setAnswers]);

  const activeFolder = getFolderById(folderState, folderState.activeFolderId);

  // Persist asset state (QR position, visibility, etc.) so it survives reloads
  useEffect(() => {
    try {
      localStorage.setItem(ASSET_STATE_STORAGE_KEY, JSON.stringify(assetState));
    } catch { /* ignore */ }
  }, [assetState]);
  // Filter out inactive assets so downstream surfaces (scenes, voter
  // previews, output snapshot) treat them as absent. Inactive assets
  // remain in the folder list as a dimmed card so the operator can
  // re-activate them without losing position/inspector state.
  const inactiveAssetIds = activeFolder?.inactiveAssetIds ?? [];
  const enabledAssets = (activeFolder?.assetIds ?? SEEDED_ASSETS).filter(
    (id) => !inactiveAssetIds.includes(id),
  );
  // When a scene is active, narrow the visible assets in BOTH Build and
  // Output previews to the scene's `visibleAssetIds`. This is what makes
  // "select scene → see scene contents on preview" work end-to-end.
  // Falls back to the full folder asset list when no scene exists yet.
  const activeSceneVisible = sceneController.activeScene?.visibleAssetIds;
  const sceneFilteredEnabled = activeSceneVisible
    ? enabledAssets.filter((id) => activeSceneVisible.has(id as AssetId))
    : enabledAssets;

  const syncViewerVotingOpen = useCallback(async () => {
    if (!projectId) return;
    const savedMatch = !isUuid(currentWorkspacePoll.id)
      ? projectPolls.find((poll) => poll.projectId === projectId && poll.slug === slugForUrl)
      : undefined;
    const livePoll: Poll = savedMatch
      ? {
          ...currentWorkspacePoll,
          id: savedMatch.id,
          projectId: savedMatch.projectId,
          options: savedPollOptions(savedMatch),
          question: currentWorkspacePoll.question || savedMatch.question,
          subheadline: currentWorkspacePoll.subheadline || savedMatch.subheadline,
          bgColor: currentWorkspacePoll.bgColor || savedMatch.bgColor,
          bgImage: currentWorkspacePoll.bgImage || savedMatch.bgImage,
        }
      : currentWorkspacePoll;
    const snapshotPoll = {
      ...livePoll,
      viewer_slug: livePoll.slug,
      options: livePoll.options?.length ? livePoll.options : previewOptions,
      answers: livePoll.options?.length ? livePoll.options : previewOptions,
    };
    const snapshot = {
      poll: snapshotPoll,
      scene: previewScene,
      layers: [],
      slateActive: false,
      assets: {
        qrSize,
        qrPosition: assetState.qrPosition,
        qrVisible: assetState.qrVisible,
        qrUrlVisible: assetState.qrUrlVisible,
        showBranding,
        brandingPosition,
        enabledAssetIds: enabledAssets,
        transforms: assetTransforms,
        assetColors,
        wordmarkWeight: assetState.wordmarkWeight,
        wordmarkTracking: assetState.wordmarkTracking,
        wordmarkScale: assetState.wordmarkScale,
        wordmarkShowGuides: assetState.wordmarkShowGuides,
        tallyMode: activeFolder?.tallyMode ?? DEFAULT_TALLY_MODE,
        tallyIntervalSeconds: activeFolder?.tallyIntervalSeconds ?? DEFAULT_TALLY_INTERVAL_SECONDS,
        resultsMode: activeFolder?.resultsMode ?? DEFAULT_RESULTS_MODE,
        resultsAnimationMs: activeFolder?.resultsAnimationMs ?? DEFAULT_RESULTS_ANIMATION_MS,
      },
    };
    const { error } = await supabase.from('project_live_state').upsert({
      project_id: projectId,
      active_poll_id: isUuid(livePoll.id) ? livePoll.id : null,
      active_folder_id: folderState.activeFolderId ?? null,
      live_folder_id: folderState.activeFolderId ?? null,
      live_poll_snapshot: snapshot as never,
      voting_state: 'open',
      output_state: liveState === 'live' ? 'program_live' : 'preview',
    } as never);
    if (error) toast.error(`Viewer sync failed: ${error.message}`);
    // Audience-facing write: switch /vote/:slug to the voting state so
    // mobile + desktop voters actually see answer buttons. Without this
    // the public_viewer_state row stays on its previous state and the
    // audience UI never transitions out of branding/slate.
    const audienceSnapshot: PublicViewerPollSnapshot = {
      id: isUuid(livePoll.id) ? livePoll.id : undefined,
      question: snapshotPoll.question,
      subheadline: snapshotPoll.subheadline,
      bgColor: snapshotPoll.bgColor,
      bgImage: snapshotPoll.bgImage,
      answers: (snapshotPoll.options ?? []).map((o, i) => ({
        id: o.id,
        label: o.text || `Answer ${i + 1}`,
        shortLabel: o.shortLabel,
        sortOrder: i,
      })),
      showLiveResults: livePoll.showLiveResults,
      showThankYou: livePoll.showThankYou,
      assetColors,
    };
    const audience = await writePublicViewerState({
      projectId,
      viewerSlug: livePoll.slug,
      state: 'voting',
      pollSnapshot: audienceSnapshot,
    });
    if (audience.error) toast.error(`Viewer voting sync failed: ${audience.error}`);
  }, [activeFolder, assetColors, assetState, assetTransforms, brandingPosition, currentWorkspacePoll, enabledAssets, folderState.activeFolderId, liveState, previewOptions, previewScene, projectId, projectPolls, qrSize, showBranding, slugForUrl]);

  const syncViewerVotingClosed = useCallback(async () => {
    if (!projectId) return;
    const { error } = await supabase.from('project_live_state').upsert({
      project_id: projectId,
      voting_state: 'closed',
      live_poll_snapshot: null,
      output_state: liveState === 'live' ? 'program_live' : 'preview',
    } as never);
    if (error) toast.error(`Viewer close sync failed: ${error.message}`);
    // Audience returns to MakoVote branding when voting closes from
    // the operator side (mirrors handleEndPoll behavior).
    void writePublicViewerState({
      projectId,
      viewerSlug: currentWorkspacePoll.slug,
      state: 'branding',
      pollSnapshot: null,
    });
  }, [liveState, projectId, currentWorkspacePoll.slug]);

  // Broadcast the Polling Slate state to public viewers. When `active` is
  // true we publish a `voting_state='closed'` row WITH the live snapshot and
  // a `slateActive: true` flag so /vote/:slug renders the operator-authored
  // slate text/image instead of the MakoVote branding. When `active` is
  // false we clear the snapshot so viewers fall back to the MakoVote slate.
  const syncViewerSlate = useCallback(async (active: boolean, slate?: { text: string; sublineText: string; image?: string | null }) => {
    if (!projectId) return;
    if (!active) {
      // Stop slate → revert mobile/desktop voters to MakoVote branding by
      // clearing the live snapshot. We keep voting_state at 'closed' so the
      // public RLS row stays readable; the missing snapshot triggers the
      // fallback "not_found" branch which renders MakoVote.
      const { error } = await supabase.from('project_live_state').upsert({
        project_id: projectId,
        voting_state: 'closed',
        live_poll_snapshot: null,
        output_state: liveState === 'live' ? 'program_live' : 'preview',
      } as never);
      if (error) toast.error(`Slate stop sync failed: ${error.message}`);
      void writePublicViewerState({
        projectId,
        viewerSlug: currentWorkspacePoll.slug,
        state: 'branding',
        pollSnapshot: null,
      });
      return;
    }
    const savedMatch = !isUuid(currentWorkspacePoll.id)
      ? projectPolls.find((poll) => poll.projectId === projectId && poll.slug === slugForUrl)
      : undefined;
    const livePoll: Poll = savedMatch
      ? {
          ...currentWorkspacePoll,
          id: savedMatch.id,
          projectId: savedMatch.projectId,
          options: savedPollOptions(savedMatch),
          question: currentWorkspacePoll.question || savedMatch.question,
          subheadline: currentWorkspacePoll.subheadline || savedMatch.subheadline,
          bgColor: currentWorkspacePoll.bgColor || savedMatch.bgColor,
          bgImage: currentWorkspacePoll.bgImage || savedMatch.bgImage,
        }
      : currentWorkspacePoll;
    const slateTextValue = slate?.text || 'Polling will open soon';
    const slateSublineValue = slate?.sublineText || '';
    const slateImageValue = slate?.image ?? null;
    const snapshotPoll = {
      ...livePoll,
      viewer_slug: livePoll.slug,
      options: livePoll.options?.length ? livePoll.options : previewOptions,
      answers: livePoll.options?.length ? livePoll.options : previewOptions,
      slateText: slateTextValue,
      slate_text: slateTextValue,
      slateSublineText: slateSublineValue,
      slate_subline_text: slateSublineValue,
      slateImage: slateImageValue,
      slate_image: slateImageValue,
    };
    const snapshot = {
      poll: snapshotPoll,
      scene: previewScene,
      layers: [],
      slateActive: true,
      slateText: slateTextValue,
      slate_text: slateTextValue,
      slateSublineText: slateSublineValue,
      slate_subline_text: slateSublineValue,
      slateImage: slateImageValue,
      slate_image: slateImageValue,
      assets: {
        qrSize,
        qrPosition: assetState.qrPosition,
        qrVisible: assetState.qrVisible,
        qrUrlVisible: assetState.qrUrlVisible,
        showBranding,
        brandingPosition,
        enabledAssetIds: enabledAssets,
        transforms: assetTransforms,
        assetColors,
      },
    };
    const { error } = await supabase.from('project_live_state').upsert({
      project_id: projectId,
      active_poll_id: isUuid(livePoll.id) ? livePoll.id : null,
      active_folder_id: folderState.activeFolderId ?? null,
      live_folder_id: folderState.activeFolderId ?? null,
      live_poll_snapshot: snapshot as never,
      voting_state: 'closed',
      output_state: liveState === 'live' ? 'program_live' : 'preview',
    } as never);
    if (error) toast.error(`Slate sync failed: ${error.message}`);
    // Audience-facing slate write.
    const audienceSnapshot: PublicViewerPollSnapshot = {
      id: isUuid(livePoll.id) ? livePoll.id : undefined,
      question: snapshotPoll.question,
      subheadline: snapshotPoll.subheadline,
      bgColor: snapshotPoll.bgColor,
      bgImage: snapshotPoll.bgImage,
      answers: (snapshotPoll.options ?? []).map((o, i) => ({
        id: o.id,
        label: o.text || `Answer ${i + 1}`,
        shortLabel: o.shortLabel,
        sortOrder: i,
      })),
      assetColors,
    };
    const audience = await writePublicViewerState({
      projectId,
      viewerSlug: livePoll.slug,
      state: 'slate',
      pollSnapshot: audienceSnapshot,
      slateText: slateTextValue,
    });
    if (audience.error) toast.error(`Viewer slate sync failed: ${audience.error}`);
  }, [assetColors, assetState, assetTransforms, brandingPosition, currentWorkspacePoll, enabledAssets, folderState.activeFolderId, liveState, previewOptions, previewScene, projectId, projectPolls, qrSize, showBranding, slugForUrl]);

  // Snapshot-request handshake — declared above the mirror effect so its
  // nonce can be a dep. When an Output window mounts (or refreshes) it
  // posts on OUTPUT_REQUEST_CHANNEL asking us to re-broadcast the current
  // Program Preview. Without this the popup can hang on stale state.
  const [snapshotRequestNonce, setSnapshotRequestNonce] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof BroadcastChannel === 'undefined') return;
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(OUTPUT_REQUEST_CHANNEL);
      ch.onmessage = () => {
        if (liveState !== 'live') broadcastOutputLock({ locked: false });
        else broadcastOutputLock({ locked: true, snapshot: getProgramOutputPayload(), lockedAt: Date.now() });
        broadcastOutputState(getProgramOutputPayload());
        setSnapshotRequestNonce((n) => n + 1);
      };
    } catch { /* ignore */ }
    return () => { try { ch?.close(); } catch { /* ignore */ } };
  }, [liveState, currentWorkspacePoll, previewScene, qrSize, assetState, showBranding, brandingPosition, sceneFilteredEnabled, assetTransformSet, assetColorSet, activeFolder?.tallyMode, activeFolder?.tallyIntervalSeconds, activeFolder?.resultsMode, activeFolder?.resultsAnimationMs, previewOptions, resultsReplayKey]);

  // Mirror the Program Preview to any open Output window in real time.
  // Whenever the operator's program-preview state (poll content, scene,
  // assets, transforms, colors, wordmark) changes, push it to the Output
  // fullscreen surface so it stays in lockstep without requiring a manual
  // Take/Cut for purely cosmetic edits.
  useEffect(() => {
    broadcastOutputState(getProgramOutputPayload());
  }, [
    currentWorkspacePoll,
    previewScene,
    qrSize,
    assetState,
    showBranding,
    brandingPosition,
    enabledAssets,
    assetTransformSet,
    assetColorSet,
    activeFolder?.tallyMode,
    activeFolder?.tallyIntervalSeconds,
    activeFolder?.resultsMode,
    activeFolder?.resultsAnimationMs,
    previewOptions,
    resultsReplayKey,
    snapshotRequestNonce,
  ]);
  // Presence heartbeat — pings open Output windows once per second so the
  // Output page can show "Mirroring: Live" and detect stalls even when
  // there are no state changes to broadcast.
  useEffect(() => {
    broadcastOutputHeartbeat();
    const id = window.setInterval(broadcastOutputHeartbeat, 1000);
    return () => window.clearInterval(id);
  }, []);
  // Show MakoVote branding when the folder has no assets, or when no question
  // text or answer bars have been authored yet.
  const hasContent =
    enabledAssets.length > 0 &&
    (question.length > 0 || answers.some((a) => a.text.length > 0));
  const activeInspectorAssetIds = selectedAssetId ? [selectedAssetId] : enabledAssets;
  const activeHistoryKey = selectedAssetId ?? `folder:${folderState.activeFolderId ?? 'none'}`;
  const currentHistory = selectionHistory[activeHistoryKey] ?? { undo: [], redo: [] };
  const backgroundStatus = {
    hasColor: Boolean(activeFolder?.bgColor ?? bgColor),
    hasImage: Boolean(activeFolder?.bgImage),
    imageMissing: backgroundImageMissing,
  };
  const previewColors = assetColors.answers.barColors?.length
    ? assetColors.answers.barColors
    : [theme.chartColorA, theme.chartColorB, theme.chartColorC, theme.chartColorD];

  const createSnapshot = useCallback((): EditorSnapshot => ({
    question,
    internalName,
    slug,
    subheadline,
    selectedTemplate,
    answerType,
    mcLabelStyle,
    previewDataMode,
    answers: cloneSnapshotValue(answers),
    showLiveResults,
    showThankYou,
    showFinalResults,
    postVoteDelayMs,
    autoClose,
    bgColor,
    bgImage,
    blockLetter,
    blockPosition,
    selectedAssetId,
    assetState: cloneSnapshotValue(assetState),
    assetTransforms: cloneSnapshotValue(assetTransforms),
    assetColors: cloneSnapshotValue(assetColors),
    folderState: cloneSnapshotValue(folderState),
  }), [answerType, answers, assetColors, assetState, assetTransforms, autoClose, bgColor, bgImage, blockLetter, blockPosition, folderState, internalName, mcLabelStyle, postVoteDelayMs, previewDataMode, question, selectedAssetId, selectedTemplate, showFinalResults, showLiveResults, showThankYou, slug, subheadline]);

  const restoreSnapshot = useCallback((snapshot: EditorSnapshot) => {
    setQuestion(snapshot.question);
    setInternalName(snapshot.internalName);
    setSlug(snapshot.slug);
    setSubheadline(snapshot.subheadline);
    setSelectedTemplate(snapshot.selectedTemplate);
    setAnswerType(snapshot.answerType);
    setMcLabelStyle(snapshot.mcLabelStyle);
    setPreviewDataMode(snapshot.previewDataMode);
    setAnswers(cloneSnapshotValue(snapshot.answers));
    setShowLiveResults(snapshot.showLiveResults);
    setShowThankYou(snapshot.showThankYou);
    setShowFinalResults(snapshot.showFinalResults);
    setPostVoteDelayMs(snapshot.postVoteDelayMs);
    setAutoClose(snapshot.autoClose);
    setBgColor(snapshot.bgColor);
    setBgImage(snapshot.bgImage);
    setBlockLetter(snapshot.blockLetter);
    setBlockPosition(snapshot.blockPosition);
    setSelectedAssetId(snapshot.selectedAssetId);
    setAssetState(cloneSnapshotValue(snapshot.assetState));
    setAssetTransforms(cloneSnapshotValue(snapshot.assetTransforms));
    setAssetColors(cloneSnapshotValue(snapshot.assetColors));
    setFolderState(cloneSnapshotValue(snapshot.folderState));
  }, []);

  const pushUndoSnapshot = useCallback(() => {
    const snapshot = createSnapshot();
    setSelectionHistory((current) => {
      const existing = current[activeHistoryKey] ?? { undo: [], redo: [] };
      return {
        ...current,
        [activeHistoryKey]: {
          undo: [...existing.undo.slice(-24), snapshot],
          redo: [],
        },
      };
    });
  }, [activeHistoryKey, createSnapshot]);

  const handleUndoChanges = useCallback(() => {
    setSelectionHistory((current) => {
      const existing = current[activeHistoryKey] ?? { undo: [], redo: [] };
      const previous = existing.undo[existing.undo.length - 1];
      if (!previous) return current;
      restoreSnapshot(previous);
      toast.success('Undid latest change');
      return {
        ...current,
        [activeHistoryKey]: {
          undo: existing.undo.slice(0, -1),
          redo: [...existing.redo.slice(-24), createSnapshot()],
        },
      };
    });
  }, [activeHistoryKey, createSnapshot, restoreSnapshot]);

  const handleRedoChanges = useCallback(() => {
    setSelectionHistory((current) => {
      const existing = current[activeHistoryKey] ?? { undo: [], redo: [] };
      const next = existing.redo[existing.redo.length - 1];
      if (!next) return current;
      restoreSnapshot(next);
      toast.success('Redid latest change');
      return {
        ...current,
        [activeHistoryKey]: {
          undo: [...existing.undo.slice(-24), createSnapshot()],
          redo: existing.redo.slice(0, -1),
        },
      };
    });
  }, [activeHistoryKey, createSnapshot, restoreSnapshot]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable = Boolean(target?.isContentEditable) || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
      if (isEditable || !(event.metaKey || event.ctrlKey)) return;

      const key = event.key.toLowerCase();
      const wantsUndo = key === 'z' && !event.shiftKey;
      const wantsRedo = (key === 'z' && event.shiftKey) || (!event.metaKey && event.ctrlKey && key === 'y');
      if (!wantsUndo && !wantsRedo) return;

      event.preventDefault();
      if (wantsUndo) {
        handleUndoChanges();
        return;
      }
      handleRedoChanges();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRedoChanges, handleUndoChanges]);

  useEffect(() => {
    if (!activeFolder) return;
    if (blockLetter !== activeFolder.blockLetter) {
      setBlockLetter(activeFolder.blockLetter);
    }
    if (selectedAssetId && !activeFolder.assetIds.includes(selectedAssetId)) {
      setSelectedAssetId(activeFolder.assetIds[0] ?? null);
    }
  }, [activeFolder, blockLetter, selectedAssetId]);

  useEffect(() => {
    if (!user || !projectId) {
      setFoldersLoadedForProject(null);
      // Without a project, hydrate from the local draft so navigating away
      // from /workspace and back doesn't wipe folders/assets the operator
      // has built up.
      const draft = loadDraftFolderState();
      const nextState = draft ?? createDefaultFolderState(question, bgColor);
      const savedActiveFolderId = localStorage.getItem(buildActiveFolderStorageKey(projectId));
      if (savedActiveFolderId && nextState.folders.some((folder) => folder.id === savedActiveFolderId)) {
        nextState.activeFolderId = savedActiveFolderId;
      }
      setFolderState(nextState);
      setSceneTransformSets({ [NO_SCENE_KEY]: createDefaultTransformSet() });
      setAssetColorSet(createDefaultColorSet());
      return;
    }

    loadProjectPollingAssetFolders(projectId, user.id)
      .then((savedState) => {
        const nextState = savedState ?? createDefaultFolderState(question, bgColor);
        const savedActiveFolderId = localStorage.getItem(buildActiveFolderStorageKey(projectId));
        if (savedActiveFolderId && nextState.folders.some((folder) => folder.id === savedActiveFolderId)) {
          nextState.activeFolderId = savedActiveFolderId;
        }
        setFolderState(nextState);
        setSceneTransformSets({ [NO_SCENE_KEY]: createDefaultTransformSet() });
        setAssetColorSet(createDefaultColorSet());
        setFoldersLoadedForProject(projectId);
      })
      .catch(() => {
        const nextState = createDefaultFolderState(question, bgColor);
        const savedActiveFolderId = localStorage.getItem(buildActiveFolderStorageKey(projectId));
        if (savedActiveFolderId && nextState.folders.some((folder) => folder.id === savedActiveFolderId)) {
          nextState.activeFolderId = savedActiveFolderId;
        }
        setFolderState(nextState);
        setSceneTransformSets({ [NO_SCENE_KEY]: createDefaultTransformSet() });
        setAssetColorSet(createDefaultColorSet());
        setFoldersLoadedForProject(projectId);
      });
    // Intentionally only depend on projectId/user. Reloading on bgColor/question
    // changes caused deleted folders to reappear because the active-folder sync
    // effect mutates bgColor/question, retriggering this load before the save
    // had committed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user]);

  useEffect(() => {
    if (!folderState.activeFolderId) return;
    localStorage.setItem(buildActiveFolderStorageKey(projectId), folderState.activeFolderId);
  }, [folderState.activeFolderId, projectId]);

  useEffect(() => {
    if (!activeFolder) return;
    const nextQuestion = activeFolder.questionText ?? '';
    if (question !== nextQuestion) {
      setQuestion(nextQuestion);
    }
    setBackgroundImageMissing(false);
    const nextBgColor = activeFolder.bgColor ?? '#1a1a2e';
    if (bgColor !== nextBgColor) {
      setBgColor(nextBgColor);
    }
    if (bgImage !== activeFolder.bgImage) {
      setBgImage(activeFolder.bgImage);
    }
    // Slug is per-folder. When switching folders, the URL/QR destination
    // updates to that folder's slug so each folder has its own /vote/* URL.
    const nextSlug = activeFolder.slug ?? '';
    if (slug !== nextSlug) {
      setSlug(nextSlug);
    }
  }, [activeFolder, bgColor, bgImage, question, slug]);

  useEffect(() => {
    setAssetColors((current) => {
      const desiredCount = Math.max(answers.length, 1);
      const currentBars = current.answers.barColors ?? [];
      const nextBars = Array.from({ length: desiredCount }, (_, index) => currentBars[index] ?? DEFAULT_ASSET_COLORS.answers.barColors?.[index % (DEFAULT_ASSET_COLORS.answers.barColors?.length ?? 1)] ?? 'hsl(0 0% 100%)');

      if (currentBars.length === nextBars.length && currentBars.every((color, index) => color === nextBars[index])) {
        return current;
      }

      return {
        ...current,
        answers: {
          ...current.answers,
          barColors: nextBars,
        },
      };
    });
  }, [answers.length, selectedTemplate]);

  useEffect(() => {
    if (!user || !projectId) {
      // Persist as a local draft so the workspace survives remounts when no
      // project is open.
      try {
        localStorage.setItem(DRAFT_FOLDER_STATE_KEY, JSON.stringify(folderState));
      } catch {
        // ignore quota errors
      }
      return;
    }
    if (foldersLoadedForProject !== projectId) return;
    saveProjectPollingAssetFolders(projectId, user.id, folderState).catch(() => undefined);
  }, [folderState, foldersLoadedForProject, projectId, user]);

  // Map a JSON import field name to the matching asset id in the workspace
  const fieldToAssetId = (field: string): AssetId | null => {
    if (['question', 'internalName', 'slug', 'blockLetter', 'blockPosition'].includes(field)) return 'question';
    if (field === 'subheadline') return 'subheadline';
    if (['answers', 'answerType', 'mcLabelStyle'].includes(field)) return 'answers';
    if (['bgColor', 'bgImage'].includes(field)) return 'background';
    return null;
  };

  const handleJumpToField = (field: string, _section: ImportSection) => {
    const target = fieldToAssetId(field);
    if (target) {
      // Ensure the asset is mounted, then select it so the Inspector shows its controls
      const sourceFolder = findAssetFolder(folderState, target);
      if (sourceFolder && sourceFolder.id !== folderState.activeFolderId) {
        setFolderState((current) => ({ ...current, activeFolderId: sourceFolder.id }));
      }
      setSelectedAssetId(target);
    }
    setHighlightField(field);
    // Clear highlight after the pulse animation
    window.setTimeout(() => setHighlightField((f) => (f === field ? null : f)), 2400);
    toast.message(`Jumped to ${field}`);
  };

  const updateFolderState = (updater: (current: PollingAssetFolderState) => PollingAssetFolderState) => {
    setFolderState((current) => updater(current));
  };

  const syncActiveFolderQuestion = (nextQuestion: string) => {
    updateFolderState((current) => ({
      ...current,
      folders: current.folders.map((folder) => (
        folder.id === current.activeFolderId
          ? { ...folder, questionText: nextQuestion }
          : folder
      )),
    }));
  };

  const handleSlugChange = (nextSlug: string) => {
    setSlug(nextSlug);
    updateFolderState((current) => ({
      ...current,
      folders: current.folders.map((folder) => (
        folder.id === current.activeFolderId
          ? { ...folder, slug: nextSlug }
          : folder
      )),
    }));
  };

  const syncActiveFolderBackground = (nextBackground: { bgColor?: string; bgImage?: string }) => {
    updateFolderState((current) => ({
      ...current,
      folders: current.folders.map((folder) => (
        folder.id === current.activeFolderId
          ? {
              ...folder,
              ...(nextBackground.bgColor !== undefined ? { bgColor: nextBackground.bgColor } : {}),
              ...(Object.prototype.hasOwnProperty.call(nextBackground, 'bgImage') ? { bgImage: nextBackground.bgImage } : {}),
            }
          : folder
      )),
    }));
  };

  const handleBackgroundColorChange = (nextColor: string) => {
    setBgColor(nextColor);
    setBackgroundImageMissing(false);
    syncActiveFolderBackground({ bgColor: nextColor });
  };

  const handleBackgroundImageChange = (nextImage: string | undefined) => {
    setBgImage(nextImage);
    setBackgroundImageMissing(false);
    syncActiveFolderBackground({ bgImage: nextImage });
  };

  const handleMissingBackgroundImage = useCallback(() => {
    if (!activeFolder?.bgImage) return;
    setBackgroundImageMissing(true);
    setBgImage(undefined);
    syncActiveFolderBackground({ bgImage: undefined });
    toast.error('Background image missing — reverted to folder color');
  }, [activeFolder?.bgImage]);

  const handleNewFolder = () => {
    updateFolderState((current) => {
      const usedNumbers = new Set(
        current.folders
          .map((f) => /^Folder\s+(\d+)$/i.exec(f.name.trim())?.[1])
          .filter((n): n is string => Boolean(n))
          .map((n) => parseInt(n, 10)),
      );
      let nextIndex = 1;
      while (usedNumbers.has(nextIndex)) nextIndex += 1;
      const nextFolder = {
        id: createFolderId(),
        name: createFolderName(nextIndex),
        blockLetter: blockLetter,
        questionText: '',
        bgColor,
        bgImage,
        assetIds: [...SEEDED_ASSETS],
      };

      return {
        activeFolderId: nextFolder.id,
        folders: [...current.folders, nextFolder],
      };
    });
    setSelectedAssetId(null);
    toast.success('Created new folder');
  };

  const handleDeleteFolder = (folderId: string) => {
    const snapshot = cloneSnapshotValue(folderState);
    const previousActiveId = folderState.activeFolderId;
    const previousActiveName = folderState.folders.find((f) => f.id === previousActiveId)?.name ?? 'previous folder';
    updateFolderState((current) => {
      const targetFolder = current.folders.find((folder) => folder.id === folderId);
      if (!targetFolder) return current;

      // If deleting the last folder, replace it with a fresh empty default
      // folder so the workspace is never folder-less.
      if (current.folders.length === 1) {
        const replacement = createDefaultFolderState('', '#1a1a2e');
        return replacement;
      }

      const remainingFolders = current.folders.filter((folder) => folder.id !== targetFolder.id);
      const fallbackFolder = remainingFolders[0];
      return {
        activeFolderId: fallbackFolder.id,
        folders: remainingFolders,
      };
    });
    setDeleteFolderTargetId(null);
    setSelectedAssetId(null);
    setLastDeletedFolderState(snapshot);
    toast.success('Folder deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          setFolderState(cloneSnapshotValue(snapshot));
          setLastDeletedFolderState(null);
          toast.info(`Restored — switching back to "${previousActiveName}"`);
        },
      },
    });
  };

  const confirmDeleteFolder = () => {
    if (!deleteFolderTargetId) return;
    handleDeleteFolder(deleteFolderTargetId);
  };

  const handleSetEnabledAssets = (nextAssets: AssetId[]) => {
    const previousFolder = folderState.folders.find((folder) => folder.id === folderState.activeFolderId);
    const previousAssets = previousFolder?.assetIds ?? [];
    const sameLength = previousAssets.length === nextAssets.length;
    const sameSet = sameLength && previousAssets.every((id) => nextAssets.includes(id));
    const isReorder = sameLength && sameSet && previousAssets.some((id, i) => nextAssets[i] !== id);
    const isRemoval = nextAssets.length < previousAssets.length;
    const previousActiveName = previousFolder?.name ?? 'previous folder';

    if (isRemoval || isReorder) {
      const snapshot = cloneSnapshotValue(folderState);
      setLastDeletedFolderState(snapshot);
      toast.success(isReorder ? 'Asset reordered' : 'Asset removed', {
        action: {
          label: 'Undo',
          onClick: () => {
            setFolderState(cloneSnapshotValue(snapshot));
            setLastDeletedFolderState(null);
            toast.info(`Restored — switching back to "${previousActiveName}"`);
          },
        },
      });
    }
    updateFolderState((current) => ({
      ...current,
      folders: current.folders.map((folder) => folder.id === current.activeFolderId ? { ...folder, assetIds: nextAssets } : folder),
    }));
  };

  const handleSelectFolder = (folderId: string) => {
    updateFolderState((current) => ({ ...current, activeFolderId: folderId }));
    setSelectedAssetId(null);
  };

  const handleBlockLetterChange = (next: BlockLetter) => {
    setBlockLetter(next);
    updateFolderState((current) => ({
      ...current,
      folders: current.folders.map((folder) => folder.id === current.activeFolderId ? { ...folder, blockLetter: next } : folder),
    }));
  };

  const handleSetFolderBlock = (folderId: string, next: BlockLetter) => {
    if (folderId === folderState.activeFolderId) {
      setBlockLetter(next);
    }
    updateFolderState((current) => ({
      ...current,
      folders: current.folders.map((folder) => folder.id === folderId ? { ...folder, blockLetter: next } : folder),
    }));
  };

  const handleRenameFolder = (folderId: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) return;
    updateFolderState((current) => ({
      ...current,
      folders: current.folders.map((folder) => folder.id === folderId ? { ...folder, name: trimmed } : folder),
    }));
  };

  const handleAddAssetToFolder = (folderId: string, assetId: AssetId) => {
    updateFolderState((current) => ({
      ...current,
      activeFolderId: folderId,
      folders: current.folders.map((folder) => (
        folder.id === folderId && !folder.assetIds.includes(assetId)
          ? { ...folder, assetIds: [...folder.assetIds, assetId] }
          : folder
      )),
    }));
    setSelectedAssetId(assetId);
    // Ensure the newly added asset is also visible in the currently active
    // scene — scenes are visibility filters, so without this the new asset
    // would be on the poll but invisible until the operator manually
    // toggled it on per scene.
    if (sceneController.activeSceneId) {
      void sceneController.setSceneAssetVisible(sceneController.activeSceneId, assetId, true);
    }
  };

  const handleToggleFolderCollapse = (folderId: string) => {
    updateFolderState((current) => ({
      ...current,
      folders: current.folders.map((folder) => (
        folder.id === folderId ? { ...folder, collapsed: !folder.collapsed } : folder
      )),
    }));
  };

  /**
   * Duplicate a folder (3-dots → Duplicate Folder). The clone is inserted
   * directly below the source so operators can quickly stage the
   * "voting → bars reveal" pair without scrolling. Active folder swaps to
   * the new clone so they immediately see and can edit it.
   */
  const handleDuplicateFolder = (folderId: string) => {
    updateFolderState((current) => duplicateFolder(current, folderId));
    setSelectedAssetId(null);
    toast.success('Folder duplicated');
  };

  /** Mutually couple two folders so they share slate / background / slug. */
  const handleLinkFolders = (folderAId: string, folderBId: string) => {
    updateFolderState((current) => linkFolders(current, folderAId, folderBId));
    toast.success('Folders linked');
  };

  /** Break the link on a folder (and its partner). */
  const handleUnlinkFolder = (folderId: string) => {
    updateFolderState((current) => unlinkFolder(current, folderId));
    toast.success('Folder unlinked');
  };

  /** Toggle an asset's inactive flag (used by the dimmed asset card). */
  const handleToggleAssetInactive = (folderId: string, assetId: AssetId, inactive: boolean) => {
    updateFolderState((current) => setAssetInactive(current, folderId, assetId, inactive));
    toast.success(inactive ? 'Asset muted' : 'Asset reactivated');
  };

  /** Fired by the Answer Type inspector — swaps answerType→answers and
   *  marks any QR in the folder as inactive. One-way (operator can re-add
   *  Answer Type from the + menu if they want to swap back). */
  const handleConvertAnswerTypeToBars = (folderId: string) => {
    updateFolderState((current) => convertAnswerTypeToBars(current, folderId));
    setSelectedAssetId('answers');
    toast.success('Converted to Answer Bars — QR muted');
  };

  /** Reverse: swap an `answers` asset back to `answerType` and re-activate
   *  any muted QR so the folder collects votes again. */
  const handleConvertAnswerBarsToAnswerType = (folderId: string) => {
    updateFolderState((current) => convertAnswerBarsToAnswerType(current, folderId));
    setSelectedAssetId('answerType');
    toast.success('Converted to Answer Type — QR re-activated');
  };

  const handleAddAnswer = () => {
    if (answerType === 'yes-no' || answers.length >= 4) return;
    // Add the new bar and re-equalize so all bars share 100% evenly.
    const next = [
      ...answers,
      { id: String(Date.now()), text: '', shortLabel: '', testVotes: EQUAL_BASE },
    ].map((a) => ({ ...a, testVotes: EQUAL_BASE }));
    setAnswers(next);
  };

  const handleTransformChange = (assetId: AssetId, field: TransformField, value: number) => {
    pushUndoSnapshot();
    setAssetTransforms((current) => {
      const currentTransform = current[assetId];
      if (currentTransform.locks[field]) return current;
      // Snap-to-center: when the operator drags X or Y within a small
      // tolerance of zero (the asset's own anchor center), snap exactly
      // to 0 so centering is precise without pixel-hunting.
      let snapped = value;
      if ((field === 'x' || field === 'y') && Math.abs(value) <= 8) {
        snapped = 0;
      }
      return {
        ...current,
        [assetId]: {
          ...currentTransform,
          [field]: snapped,
        },
      };
    });
  };

  /**
   * Center an asset dead-center on the 1920×1080 broadcast stage.
   * The QR is anchored at one of four corners with a 48px broadcast-safe inset;
   * we compute the translation needed from that anchor to true frame center.
   */
  const handleCenterAsset = (assetId: AssetId) => {
    pushUndoSnapshot();
    setAssetTransforms((current) => {
      const currentTransform = current[assetId];
      if (!currentTransform) return current;
      const { x: dx, y: dy } = computeCenterOffset(assetId, {
        qrPosition: assetState.qrPosition,
        qrSize,
        brandingPosition,
      });
      return {
        ...current,
        [assetId]: {
          ...currentTransform,
          x: currentTransform.locks.x ? currentTransform.x : dx,
          y: currentTransform.locks.y ? currentTransform.y : dy,
        },
      };
    });
    toast.success('Asset centered in 1920×1080 frame');
  };

  const handleToggleTransformLock = (assetId: AssetId, field: TransformField) => {
    pushUndoSnapshot();
    setAssetTransforms((current) => ({
      ...current,
      [assetId]: {
        ...current[assetId],
        locks: {
          ...current[assetId].locks,
          [field]: !current[assetId].locks[field],
        },
      },
    }));
  };

  const handleAssetColorsChange = (assetId: AssetId, nextColors: AssetColorMap[AssetId]) => {
    pushUndoSnapshot();
    setAssetColors((current) => ({
      ...current,
      [assetId]: {
        ...current[assetId],
        ...nextColors,
      },
    }));
  };

  const handleFolderQuestionChange = (nextQuestion: string) => {
    setQuestion(nextQuestion);
    syncActiveFolderQuestion(nextQuestion);
  };

  if (loadingExisting) {
    return (
      <OperatorLayout>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading poll…
        </div>
      </OperatorLayout>
    );
  }

  return (
    <OperatorLayout>
      <ProjectPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleProjectSelected}
      />
      {/* Header */}
      <header className="h-11 border-b border-border flex items-center justify-between px-4 bg-card/50 shrink-0">
        <div className="flex items-center gap-2">
          {projectName && (
            <div className="mr-2 flex items-center gap-2 pr-3 border-r border-border/60 min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Project</span>
              <span className="text-xs font-medium text-foreground truncate max-w-[220px]">{projectName}</span>
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-[10px] h-7 px-2">
                <FileIcon className="w-3 h-3" />
                File
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Poll
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={handleSaveToProject} disabled={saving !== null} className="text-xs gap-2">
                {saving === 'project'
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <FolderPlus className="w-3 h-3" />}
                Save to Project…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleNewFolder} className="text-xs gap-2">
                <FolderOpen className="w-3 h-3" />
                New Folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLoadDialogOpen(true)} className="text-xs gap-2">
                <FolderOpen className="w-3 h-3" />
                Load…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImport} className="text-xs gap-2">
                <Upload className="w-3 h-3" />
                Import JSON…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate} disabled={saving !== null} className="text-xs gap-2">
                <Copy className="w-3 h-3" />
                Duplicate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-[10px] h-7 px-2">
                <Undo2 className="w-3 h-3" />
                Edit
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                History
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={handleUndoChanges} disabled={currentHistory.undo.length === 0} className="text-xs gap-2">
                <Undo2 className="w-3 h-3" />
                Undo Change
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRedoChanges} disabled={currentHistory.redo.length === 0} className="text-xs gap-2">
                <Redo2 className="w-3 h-3" />
                Redo Change
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-1 flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWorkspaceMode('build')}
              className={`h-7 gap-1 px-2 text-[10px] ${mode === 'build' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              <Radio className="h-3 w-3" /> Build
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWorkspaceMode('output')}
              className={`h-7 gap-1 px-2 text-[10px] ${mode === 'output' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              <Monitor className="h-3 w-3" /> Output
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveToProject}
            disabled={saving !== null}
            className="gap-1.5 h-7 px-2 text-[10px]"
          >
            {saving === 'project' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderPlus className="w-3 h-3" />}
            Save to Project
          </Button>
          <span className="text-[10px] text-muted-foreground">
            Autosaves every {autosaveMinutes} min
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" size="sm"
                onClick={resetLayout}
                className="gap-1 text-[10px] h-7 text-muted-foreground"
              >
                <LayoutPanelLeft className="w-3 h-3" />
                <RotateCcw className="w-2.5 h-2.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset workspace pane layout</TooltipContent>
          </Tooltip>
        </div>
      </header>
      <AlertDialog open={Boolean(deleteFolderTargetId)} onOpenChange={(open) => { if (!open) setDeleteFolderTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the active folder and moves its assets into the next available folder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="button" onClick={confirmDeleteFolder}>Delete folder</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <LoadPollDialog
        open={loadDialogOpen}
        onOpenChange={setLoadDialogOpen}
        onSelect={applyLoadedPoll}
      />
      <ImportErrorDialog
        open={importError.open}
        onOpenChange={(o) => setImportError((s) => ({ ...s, open: o }))}
        fileName={importError.fileName}
        parseError={importError.parseError}
        issues={importError.issues}
        onJumpToField={handleJumpToField}
      />

      {mode === 'output' ? (
        <div className="flex-1 min-h-0">
          <OperatorOutputMode
            projectName={projectName}
            currentPoll={currentWorkspacePoll}
            projectPolls={outputPolls}
            folders={outputFolders}
            activeFolderId={folderState.activeFolderId}
            onSelectFolder={handleSelectFolder}
            activeBlock={outputActiveBlock}
            blockSource={outputBlockSource}
            blockPinned={outputBlockPinned}
            onTogglePinBlock={() => {
              setOutputBlockPinned((prev) => {
                const next = !prev;
                setOutputBlockSource(next ? 'pinned' : 'manual');
                return next;
              });
            }}
            onRescanPolls={async () => {
              await rescanProjectPolls();
              toast.success('Polls re-scanned');
            }}
            liveState={liveState}
            votingState={votingState}
            previewScene={previewScene}
            programScene={programScene}
            qrSize={qrSize}
            qrPosition={assetState.qrPosition}
            showBranding={showBranding}
            brandingPosition={brandingPosition}
            previewNode={renderOutputScene()}
            hasAnswerBars={sceneFilteredEnabled.includes('answers')}
            enabledAssetIds={sceneFilteredEnabled}
            assetColors={assetColors}
            assetTransforms={assetTransforms}
            assetColorSet={assetColorSet}
            assetTransformSet={assetTransformSet}
            onSelectBlock={(letter) => {
              setOutputActiveBlock(letter);
              setOutputBlockSource(outputBlockPinned ? 'pinned' : 'manual');
            }}
            onSelectPoll={(selectedId) => {
              if (selectedId === currentWorkspacePoll.id) return;
              navigate(`/polls/${selectedId}?mode=output`);
            }}
            scenes={sceneController.scenes}
            activeSceneId={sceneController.activeSceneId}
            onSelectScene={(sceneId) => sceneController.setActiveSceneId(sceneId)}
            onSceneChange={(scene) => {
              setPreviewScene(scene);
              if (projectId) void dbSetPreviewScene(projectId, scene as unknown as SceneName);
            }}
            onTake={handleTake}
            onCut={handleCut}
            onOpenOutput={() => window.open(`/output/${currentWorkspacePoll.id}`, 'mako-output', 'width=1920,height=1080') ?? null}
            onGoLive={handleGoLive}
            onEndPoll={handleEndPoll}
            onOpenVoting={() => {
              setVotingState('open');
              void syncViewerVotingOpen();
            }}
            onCloseVoting={() => {
              setVotingState('closed');
              void syncViewerVotingClosed();
            }}
            onSlateActiveChange={(active, slate) => { void syncViewerSlate(active, slate); }}
            testVoteRunning={testVoteRunning}
            onStartTestVotes={handleStartTestVotes}
            onStopTestVotes={handleStopTestVotes}
            onResetTestVotes={handleResetTestVotes}
            answers={answers}
            onSetAnswers={setAnswers}
            onQrSizeChange={setQrSize}
            onQrPositionChange={(next) => setAssetState((current) => ({ ...current, qrPosition: next }))}
            onShowBrandingChange={setShowBranding}
            onBrandingPositionChange={setBrandingPosition}
            tallyMode={getFolderById(folderState, folderState.activeFolderId)?.tallyMode ?? DEFAULT_TALLY_MODE}
            tallyIntervalSeconds={getFolderById(folderState, folderState.activeFolderId)?.tallyIntervalSeconds ?? DEFAULT_TALLY_INTERVAL_SECONDS}
            onTallyModeChange={(mode: TallyMode) => {
              setFolderState((current) => ({
                ...current,
                folders: current.folders.map((f) =>
                  f.id === current.activeFolderId ? { ...f, tallyMode: mode } : f
                ),
              }));
            }}
            onTallyIntervalChange={(seconds: number) => {
              setFolderState((current) => ({
                ...current,
                folders: current.folders.map((f) =>
                  f.id === current.activeFolderId ? { ...f, tallyIntervalSeconds: seconds } : f
                ),
              }));
            }}
            resultsMode={getFolderById(folderState, folderState.activeFolderId)?.resultsMode ?? DEFAULT_RESULTS_MODE}
            resultsAnimationMs={getFolderById(folderState, folderState.activeFolderId)?.resultsAnimationMs ?? DEFAULT_RESULTS_ANIMATION_MS}
            onResultsModeChange={(mode: ResultsMode) => {
              setFolderState((current) => ({
                ...current,
                folders: current.folders.map((f) =>
                  f.id === current.activeFolderId ? { ...f, resultsMode: mode } : f
                ),
              }));
              // Bump the replay key so the change takes effect immediately
              // when flipping back to Animated mid-show.
              setResultsReplayKey((k) => k + 1);
            }}
            onResultsAnimationMsChange={(ms: number) => {
              setFolderState((current) => ({
                ...current,
                folders: current.folders.map((f) =>
                  f.id === current.activeFolderId ? { ...f, resultsAnimationMs: ms } : f
                ),
              }));
            }}
            onReplayResults={() => setResultsReplayKey((k) => k + 1)}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResizablePanelGroup
            key={layoutKey}
            direction="horizontal"
            className="h-full"
            onLayout={(sizes) => {
              if (sizes.length === 3) {
                const next = [sizes[0], sizes[1], sizes[2]] as [number, number, number];
                setLayout((l) => ({ ...l, hSizes: next }));
                saveWorkspaceLayout({ hSizes: next });
              }
            }}
          >
            <ResizablePanel defaultSize={layout.hSizes[0]} minSize={18} maxSize={36}>
              <Pane title="Polling Assets" hint="Question · Answers · Logic" icon={FolderOpen}>
                <div className="h-full flex flex-col min-h-0">
                <div className="flex-1 min-h-0">
                <PollingAssetsPane
                  noScenes={sceneController.requiresScene}
                  scenes={sceneController.scenes}
                  activeSceneId={sceneController.activeSceneId}
                  onSelectScene={sceneController.setActiveSceneId}
                  onAddScene={sceneController.addScene}
                  onRenameScene={sceneController.renameScene}
                  onDuplicateScene={sceneController.duplicateScene}
                  onRemoveScene={sceneController.removeScene}
                  onSetSceneAssetVisible={sceneController.setSceneAssetVisible}
                  folders={folderState.folders}
                  activeFolderId={folderState.activeFolderId}
                  enabledAssets={enabledAssets}
                  onEnabledAssetsChange={handleSetEnabledAssets}
                  selectedAssetId={selectedAssetId}
                  onSelectAsset={setSelectedAssetId}
                  onSelectFolder={handleSelectFolder}
                  onCreateFolder={handleNewFolder}
                  onAddAssetToFolder={handleAddAssetToFolder}
                  onRenameFolder={handleRenameFolder}
                  onSetFolderBlock={handleSetFolderBlock}
                  onDeleteFolder={(folderId) => setDeleteFolderTargetId(folderId)}
                  onToggleFolderCollapse={handleToggleFolderCollapse}
                  onDuplicateFolder={handleDuplicateFolder}
                  onLinkFolders={handleLinkFolders}
                  onUnlinkFolder={handleUnlinkFolder}
                  onToggleAssetInactive={handleToggleAssetInactive}
                  blockLetter={blockLetter}
                  onBlockLetterChange={handleBlockLetterChange}
                question={question} setQuestion={handleFolderQuestionChange}
                  subheadline={subheadline} setSubheadline={setSubheadline}
                  internalName={internalName} setInternalName={setInternalName}
                  slug={slug} setSlug={handleSlugChange}
                  answerType={answerType} setAnswerType={setAnswerType}
                  mcLabelStyle={mcLabelStyle} setMcLabelStyle={setMcLabelStyle}
                  answers={answers} setAnswers={setAnswers}
                  onAddAnswer={handleAddAnswer}
                />
                </div>
                </div>
              </Pane>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={layout.hSizes[1]} minSize={35}>
              <Pane title="Program Preview" hint="Operator workspace monitor">
                <div className="h-full flex flex-col min-h-0">
                  <DraftPreviewMonitor
                    question={previewQuestion}
                    subheadline={subheadline}
                    options={previewOptions}
                    totalVotes={previewTotal}
                    colors={previewColors}
                    template={selectedTemplate}
                    theme={theme}
                    hasContent={hasContent}
                    answerType={answerType}
                    mcLabelStyle={mcLabelStyle}
                    previewDataMode={previewDataMode}
                    answers={answers}
                    bgColor={bgColor}
                    bgImage={bgImage}
                  slug={slugForUrl}
                    fullUrl={fullUrl}
                    shortUrl={shortUrl}
                    wordmark={assetState}
                  qrSize={qrSize}
                  qrPosition={assetState.qrPosition}
                  qrVisible={assetState.qrVisible}
                  qrUrlVisible={assetState.qrUrlVisible}
                  showBranding={showBranding}
                  brandingPosition={brandingPosition}
                  enabledAssetIds={sceneFilteredEnabled}
                  transforms={assetTransforms}
                    assetColors={assetColors}
                    previewMode={transformViewport}
                    onPreviewModeChange={setTransformViewport}
                    folderLabel={activeFolder?.name}
                  />
                  <AssetTransformControls
                    assetId={selectedAssetId}
                    assetLabel={selectedAssetId ? ASSET_REGISTRY[selectedAssetId]?.label : undefined}
                    folderLabel={selectedAssetId ? undefined : activeFolder?.name}
                    folderAssetIds={selectedAssetId ? undefined : activeInspectorAssetIds}
                    transforms={assetTransforms}
                    colors={assetColors}
                    answerCount={answers.length}
                    onChange={handleTransformChange}
                    onToggleLock={handleToggleTransformLock}
                    onColorsChange={handleAssetColorsChange}
                    onCenterAsset={handleCenterAsset}
                    viewport={transformViewport}
                    onViewportChange={setTransformViewport}
                  />
                </div>
              </Pane>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={layout.hSizes[2]} minSize={16} maxSize={32}>
              <ResizablePanelGroup
                direction="vertical"
                className="h-full"
                onLayout={(sizes) => {
                  if (sizes.length === 2) {
                    const next = [sizes[0], sizes[1]] as [number, number];
                    setLayout((l) => ({ ...l, rightVSizes: next }));
                    saveWorkspaceLayout({ rightVSizes: next });
                  }
                }}
              >
                <ResizablePanel defaultSize={layout.rightVSizes[0]} minSize={25}>
                  <Pane title={mode === 'build' ? 'Template' : 'Style'}>
                    <BuildControlsPanel
                      section="template"
                      selectedTemplate={selectedTemplate}
                      setSelectedTemplate={setSelectedTemplate}
                      bgColor={bgColor} setBgColor={handleBackgroundColorChange}
                      bgImage={bgImage} setBgImage={handleBackgroundImageChange}
                      backgroundStatus={backgroundStatus}
                      wordmark={assetState}
                      setWordmark={(next) => setAssetState((current) => ({ ...current, ...next }))}
                    />
                  </Pane>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={layout.rightVSizes[1]} minSize={20}>
                  <Pane title="Inspector" hint={mode === 'build' ? 'Poll basics and content' : 'Transforms and per-asset properties'}>
                    <AssetInspector
                      selectedAssetId={selectedAssetId}
                question={question} setQuestion={handleFolderQuestionChange}
                      subheadline={subheadline} setSubheadline={setSubheadline}
                      internalName={internalName} setInternalName={setInternalName}
                      slug={slug} setSlug={handleSlugChange}
                      answerType={answerType} setAnswerType={setAnswerType}
                      mcLabelStyle={mcLabelStyle} setMcLabelStyle={setMcLabelStyle}
                      answers={answers} setAnswers={setAnswers}
                      bgColor={bgColor} setBgColor={handleBackgroundColorChange}
                      bgImage={bgImage}
                      setBgImage={handleBackgroundImageChange}
                      imageMissing={backgroundImageMissing}
                      onImageMissing={handleMissingBackgroundImage}
                      assetState={assetState}
                      setAssetState={setAssetState}
                      highlightField={highlightField}
                      onResetAssetPosition={(assetId) => {
                        pushUndoSnapshot();
                        setAssetTransforms((current) => {
                          const t = current[assetId];
                          if (!t) return current;
                          // Reset translate (and any clamped lock) so the new
                          // anchor corner is honored. Other transforms are kept.
                          return {
                            ...current,
                            [assetId]: { ...t, x: 0, y: 0 },
                          };
                        });
                      }}
                      onConvertAnswerTypeToBars={() => {
                        if (folderState.activeFolderId) handleConvertAnswerTypeToBars(folderState.activeFolderId);
                      }}
                      onConvertAnswerBarsToAnswerType={() => {
                        if (folderState.activeFolderId) handleConvertAnswerBarsToAnswerType(folderState.activeFolderId);
                      }}
                    />
                  </Pane>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}
    </OperatorLayout>
  );
}
