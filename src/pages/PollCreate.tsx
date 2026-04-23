import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { AnswerType, MCLabelStyle, PreviewDataMode } from '@/components/poll-create/ContentPanel';
import { BuildControlsPanel } from '@/components/poll-create/BuildControlsPanel';
import { DraftPreviewMonitor } from '@/components/poll-create/DraftPreviewMonitor';
import { ProjectPickerDialog } from '@/components/poll-create/ProjectPickerDialog';
import { PollingAssetsPane, SEEDED_ASSETS } from '@/components/poll-create/polling-assets/PollingAssetsPane';
import { AssetInspector } from '@/components/poll-create/polling-assets/AssetInspector';
import { AssetId, AssetState, DEFAULT_ASSET_STATE } from '@/components/poll-create/polling-assets/types';
import { Button } from '@/components/ui/button';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { LoadPollDialog } from '@/components/poll-create/LoadPollDialog';
import { ImportErrorDialog } from '@/components/poll-create/ImportErrorDialog';
import { FullscreenScene } from '@/components/broadcast/scenes/FullscreenScene';
import { LowerThirdScene } from '@/components/broadcast/scenes/LowerThirdScene';
import { QRScene } from '@/components/broadcast/scenes/QRScene';
import { ResultsScene } from '@/components/broadcast/scenes/ResultsScene';
import { pollImportSchema, formatZodIssues, ImportIssue, ImportSection } from '@/lib/poll-import-schema';
import { themePresets } from '@/lib/themes';
import { TemplateName, Poll, PollOption, QRPosition, VotingState, LiveState } from '@/lib/types';
import { SceneType } from '@/lib/scenes';
import { broadcastOutputState } from '@/lib/output-state';
import { Save, FolderPlus, Loader2, RotateCcw, LayoutPanelLeft, FileIcon, FolderOpen, Upload, Copy, ChevronDown, Monitor, Radio } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { loadPoll, savePoll, listPolls, listProjects, DraftPollPayload, SavedPoll, BlockLetter } from '@/lib/poll-persistence';
import { OperatorOutputMode } from '@/components/operator/OperatorOutputMode';
import { toast } from 'sonner';
import {
  createDefaultFolderState,
  createFolderId,
  createFolderName,
  findAssetFolder,
  getAvailableAssets,
  getFolderById,
  loadProjectPollingAssetFolders,
  PollingAssetFolderState,
  saveProjectPollingAssetFolders,
} from '@/lib/polling-asset-folders';

type OperatorMode = 'build' | 'output';

/* ---------- Workspace layout persistence ---------- */

const WORKSPACE_LAYOUT_KEY = 'mako-draft-workspace-layout-v1';

interface WorkspaceLayout {
  hSizes: [number, number, number]; // left / center / right
  rightVSizes: [number, number];     // Template / Inspector
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
  const [saving, setSaving] = useState<'draft' | 'project' | null>(null);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [projectName, setProjectName] = useState<string | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [question, setQuestion] = useState('');
  const [internalName, setInternalName] = useState('');
  const [slug, setSlug] = useState('');
  const [subheadline, setSubheadline] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateName>('horizontal-bar');
  const [answerType, setAnswerType] = useState<AnswerType>('multiple-choice');
  const [mcLabelStyle, setMcLabelStyle] = useState<MCLabelStyle>('letters');
  const [previewDataMode, setPreviewDataMode] = useState<PreviewDataMode>('test');
  const [answers, setAnswers] = useState<{ id: string; text: string; shortLabel: string; testVotes?: number }[]>([
    { id: '1', text: '', shortLabel: '', testVotes: 720 },
    { id: '2', text: '', shortLabel: '', testVotes: 540 },
  ]);
  const [showLiveResults, setShowLiveResults] = useState(true);
  const [showThankYou, setShowThankYou] = useState(true);
  const [showFinalResults, setShowFinalResults] = useState(true);
  const [autoClose, setAutoClose] = useState('');
  const [bgColor, setBgColor] = useState('#1a1a2e');
  const [bgImage, setBgImage] = useState<string | undefined>(undefined);
  const [draftStatus, setDraftStatus] = useState<'unsaved' | 'draft-saved' | 'saved-to-project'>('unsaved');
  const [blockLetter, setBlockLetter] = useState<BlockLetter>('A');
  const [blockPosition, setBlockPosition] = useState<number>(1);
  const [mode, setMode] = useState<OperatorMode>(searchParams.get('mode') === 'output' ? 'output' : 'build');
  const [projectPolls, setProjectPolls] = useState<SavedPoll[]>([]);
  const [outputActiveBlock, setOutputActiveBlock] = useState<BlockLetter>('A');
  const [votingState, setVotingState] = useState<VotingState>('not_open');
  const [liveState, setLiveState] = useState<LiveState>('not_live');
  const [previewScene, setPreviewScene] = useState<SceneType>('fullscreen');
  const [programScene, setProgramScene] = useState<SceneType>('fullscreen');
  const [qrSize, setQrSize] = useState(120);
  const [qrPosition, setQrPosition] = useState<QRPosition>('bottom-right');
  const [showBranding, setShowBranding] = useState(true);
  const [brandingPosition, setBrandingPosition] = useState<QRPosition>('bottom-left');

  // Load existing poll if visiting /polls/:id
  useEffect(() => {
    if (!routeId) return;
    setLoadingExisting(true);
    loadPoll(routeId)
      .then((p) => {
        if (!p) {
          toast.error('Poll not found');
          navigate('/polls/new', { replace: true });
          return;
        }
        setPollId(p.id);
        setInternalName(p.internalName);
        setQuestion(p.question);
        setSubheadline(p.subheadline);
        setSlug(p.slug);
        setSelectedTemplate(p.template);
        setAnswerType(p.answerType);
        setMcLabelStyle(p.mcLabelStyle);
        setAnswers(p.answers.length ? p.answers : [
          { id: '1', text: '', shortLabel: '', testVotes: 0 },
          { id: '2', text: '', shortLabel: '', testVotes: 0 },
        ]);
        setShowLiveResults(p.showLiveResults);
        setShowThankYou(p.showThankYou);
        setShowFinalResults(p.showFinalResults);
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

  useEffect(() => {
    if (!user || !projectId) {
      setProjectPolls([]);
      return;
    }

    listPolls()
      .then((items) => setProjectPolls(items.filter((poll) => poll.projectId === projectId)))
      .catch(() => setProjectPolls([]));
  }, [user, projectId, pollId, draftStatus]);

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

  const buildPayload = (): DraftPollPayload => ({
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
    bgColor,
    bgImage,
    previewDataMode,
    blockLetter,
    blockPosition,
  });

  const handleSaveDraft = async () => {
    if (!user) { toast.error('Please sign in first'); return; }
    setSaving('draft');
    try {
      const saved = await savePoll({
        id: pollId,
        payload: buildPayload(),
        userId: user.id,
        status: projectId ? 'saved' : 'draft',
        projectId,
      });
      if (!pollId) {
        setPollId(saved.id);
        navigate(`/polls/${saved.id}`, { replace: true });
      }
      setDraftStatus(projectId ? 'saved-to-project' : 'draft-saved');
      toast.success('Draft saved');
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  };

  const handleSaveToProject = () => {
    if (!user) { toast.error('Please sign in first'); return; }
    setPickerOpen(true);
  };

  const handleProjectSelected = async (selectedProjectId: string, selectedProjectName: string) => {
    if (!user) return;
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
      setProjectName(selectedProjectName);
      setDraftStatus('saved-to-project');
      toast.success(`Saved to "${selectedProjectName}"`);
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  };

  const theme = themePresets[0];
  const previewColors = [theme.chartColorA, theme.chartColorB, theme.chartColorC, theme.chartColorD];

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
  const hasContent = question.length > 0 || answers.some(a => a.text.length > 0);

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
    createdAt: new Date().toISOString(),
  }), [pollId, projectId, internalName, question, subheadline, slugForUrl, votingState, previewOptions, previewTotal, selectedTemplate, theme.id, showLiveResults, autoClose, showThankYou, showFinalResults, blockLetter, blockPosition]);

  const outputPolls = useMemo(() => {
    const existing = projectPolls.filter((poll) => poll.id !== currentWorkspacePoll.id);
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
  }, [projectPolls, currentWorkspacePoll, projectId, answerType, mcLabelStyle, answers, previewDataMode, bgColor, bgImage]);

  const renderOutputScene = () => {
    const sharedAssets = { slug: slugForUrl, qrSize, qrPosition, showBranding, brandingPosition };
    const props = {
      question: currentWorkspacePoll.question || 'Your question here?',
      subheadline,
      options: currentWorkspacePoll.options,
      totalVotes: currentWorkspacePoll.totalVotes,
      colors: previewColors,
      theme,
      template: selectedTemplate,
      ...sharedAssets,
    };

    switch (previewScene) {
      case 'lowerThird': return <LowerThirdScene {...props} />;
      case 'qr': return <QRScene slug={slugForUrl} theme={theme} />;
      case 'results': return <ResultsScene {...props} />;
      default: return <FullscreenScene {...props} layers={[]} />;
    }
  };

  const setWorkspaceMode = (nextMode: OperatorMode) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('mode', nextMode);
    setSearchParams(nextParams, { replace: true });
    setMode(nextMode);
  };

  const handleTake = () => {
    setProgramScene(previewScene);
    broadcastOutputState({ poll: currentWorkspacePoll, scene: previewScene, layers: [], assets: { qrSize, qrPosition, showBranding, brandingPosition } });
  };

  const handleCut = () => {
    setProgramScene(previewScene);
    broadcastOutputState({ poll: currentWorkspacePoll, scene: previewScene, layers: [], assets: { qrSize, qrPosition, showBranding, brandingPosition } });
  };

  const handleGoLive = () => {
    setLiveState('live');
    handleTake();
  };

  const handleEndPoll = () => {
    setLiveState('not_live');
    setVotingState('closed');
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
    setSubheadline(p.subheadline);
    setSlug(p.slug);
    setSelectedTemplate(p.template);
    setAnswerType(p.answerType);
    setMcLabelStyle(p.mcLabelStyle);
    setAnswers(p.answers.length ? p.answers : [
      { id: '1', text: '', shortLabel: '', testVotes: 0 },
      { id: '2', text: '', shortLabel: '', testVotes: 0 },
    ]);
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
  const [assetState, setAssetState] = useState<AssetState>(DEFAULT_ASSET_STATE);
  const [highlightField, setHighlightField] = useState<string | null>(null);
  const [folderState, setFolderState] = useState<PollingAssetFolderState>(createDefaultFolderState);
  const [deleteFolderTargetId, setDeleteFolderTargetId] = useState<string | null>(null);
  const [foldersLoadedForProject, setFoldersLoadedForProject] = useState<string | null>(null);

  const activeFolder = getFolderById(folderState, folderState.activeFolderId);
  const enabledAssets = activeFolder?.assetIds ?? SEEDED_ASSETS;
  const availableAssets = getAvailableAssets(enabledAssets);

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
      setFolderState(createDefaultFolderState());
      return;
    }

    loadProjectPollingAssetFolders(projectId, user.id)
      .then((savedState) => {
        setFolderState(savedState ?? createDefaultFolderState());
        setFoldersLoadedForProject(projectId);
      })
      .catch(() => {
        setFolderState(createDefaultFolderState());
        setFoldersLoadedForProject(projectId);
      });
  }, [projectId, user]);

  useEffect(() => {
    if (!user || !projectId || foldersLoadedForProject !== projectId) return;
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

  const handleNewFolder = () => {
    updateFolderState((current) => {
      const nextIndex = current.folders.length + 1;
      const nextFolder = {
        id: createFolderId(),
        name: createFolderName(nextIndex),
        blockLetter: blockLetter,
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
    updateFolderState((current) => {
      const targetFolder = getFolderById(current, folderId);
      if (!targetFolder || current.folders.length === 1) return current;

      const remainingFolders = current.folders.filter((folder) => folder.id !== targetFolder.id);
      const fallbackFolder = remainingFolders[0];
      const mergedAssets = Array.from(new Set([...SEEDED_ASSETS, ...fallbackFolder.assetIds, ...targetFolder.assetIds.filter((assetId) => !SEEDED_ASSETS.includes(assetId))]));

      return {
        activeFolderId: fallbackFolder.id,
        folders: remainingFolders.map((folder) => folder.id === fallbackFolder.id ? { ...folder, assetIds: mergedAssets } : folder),
      };
    });
    setDeleteFolderTargetId(null);
    setSelectedAssetId(null);
    toast.success('Folder deleted');
  };

  const handleSetEnabledAssets = (nextAssets: AssetId[]) => {
    updateFolderState((current) => ({
      ...current,
      folders: current.folders.map((folder) => folder.id === current.activeFolderId ? { ...folder, assetIds: nextAssets } : folder),
    }));
  };

  const handleSelectFolder = (folderId: string) => {
    updateFolderState((current) => ({ ...current, activeFolderId: folderId }));
    const nextFolder = getFolderById(folderState, folderId);
    setSelectedAssetId(nextFolder?.assetIds[0] ?? null);
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
              <DropdownMenuItem onClick={handleSaveDraft} disabled={saving !== null} className="text-xs gap-2">
                {saving === 'draft'
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Save className="w-3 h-3" />}
                Save Draft
              </DropdownMenuItem>
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
              <DropdownMenuItem onClick={() => setDeleteFolderTargetId(folderState.activeFolderId)} disabled={folderState.folders.length <= 1} className="text-xs gap-2">
                <FolderOpen className="w-3 h-3" />
                Delete Folder
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
            <AlertDialogAction onClick={() => { if (deleteFolderTargetId) handleDeleteFolder(deleteFolderTargetId); }}>Delete folder</AlertDialogAction>
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
            activeBlock={outputActiveBlock}
            liveState={liveState}
            votingState={votingState}
            previewScene={previewScene}
            programScene={programScene}
            qrSize={qrSize}
            qrPosition={qrPosition}
            showBranding={showBranding}
            brandingPosition={brandingPosition}
            previewNode={renderOutputScene()}
            onSelectBlock={setOutputActiveBlock}
            onSelectPoll={(selectedId) => {
              if (selectedId === currentWorkspacePoll.id) return;
              navigate(`/polls/${selectedId}?mode=output`);
            }}
            onSceneChange={setPreviewScene}
            onTake={handleTake}
            onCut={handleCut}
            onOpenOutput={() => window.open(`/output/${currentWorkspacePoll.id}`, 'mako-output', 'width=1920,height=1080')}
            onGoLive={handleGoLive}
            onEndPoll={handleEndPoll}
            onOpenVoting={() => setVotingState('open')}
            onCloseVoting={() => setVotingState('closed')}
            onDuplicatePoll={handleDuplicate}
            onQrSizeChange={setQrSize}
            onQrPositionChange={setQrPosition}
            onShowBrandingChange={setShowBranding}
            onBrandingPositionChange={setBrandingPosition}
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
                <PollingAssetsPane
                  folders={folderState.folders}
                  activeFolderId={folderState.activeFolderId}
                  availableAssets={availableAssets}
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
                  blockLetter={blockLetter}
                  onBlockLetterChange={handleBlockLetterChange}
                  question={question} setQuestion={setQuestion}
                  subheadline={subheadline} setSubheadline={setSubheadline}
                  internalName={internalName} setInternalName={setInternalName}
                  slug={slug} setSlug={setSlug}
                  answerType={answerType} setAnswerType={setAnswerType}
                  mcLabelStyle={mcLabelStyle} setMcLabelStyle={setMcLabelStyle}
                  answers={answers} setAnswers={setAnswers}
                />
              </Pane>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={layout.hSizes[1]} minSize={35}>
              <Pane title="Program Preview" hint="Operator workspace monitor">
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
                  fullUrl={fullUrl}
                  shortUrl={shortUrl}
                />
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
                      bgColor={bgColor} setBgColor={setBgColor}
                      bgImage={bgImage} setBgImage={setBgImage}
                    />
                  </Pane>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={layout.rightVSizes[1]} minSize={20}>
                  <Pane title="Inspector" hint={mode === 'build' ? 'Poll basics and content' : 'Transforms and per-asset properties'}>
                    <AssetInspector
                      selectedAssetId={selectedAssetId}
                      question={question} setQuestion={setQuestion}
                      subheadline={subheadline} setSubheadline={setSubheadline}
                      internalName={internalName} setInternalName={setInternalName}
                      slug={slug} setSlug={setSlug}
                      answerType={answerType} setAnswerType={setAnswerType}
                      mcLabelStyle={mcLabelStyle} setMcLabelStyle={setMcLabelStyle}
                      answers={answers} setAnswers={setAnswers}
                      bgColor={bgColor} setBgColor={setBgColor}
                      bgImage={bgImage}
                      setBgImage={setBgImage}
                      assetState={assetState}
                      setAssetState={setAssetState}
                      highlightField={highlightField}
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
