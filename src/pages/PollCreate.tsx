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
import { Save, FolderPlus, Loader2, RotateCcw, LayoutPanelLeft, FileIcon, FolderOpen, Upload, Copy, ChevronDown, Grid3x3, Monitor, Radio, Palette } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { loadPoll, savePoll, listPolls, DraftPollPayload, SavedPoll, BlockLetter, BLOCK_LETTERS, DEFAULT_BLOCK_LABELS } from '@/lib/poll-persistence';
import { OperatorOutputMode } from '@/components/operator/OperatorOutputMode';
import { toast } from 'sonner';

type OperatorMode = 'build' | 'edit' | 'output';

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

function PaneHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="h-7 px-3 flex items-center justify-between border-b border-border/60 bg-muted/30 shrink-0">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{title}</span>
      {hint && <span className="text-[9px] text-muted-foreground/60">{hint}</span>}
    </div>
  );
}

function Pane({
  title, hint, children, contentClassName,
}: { title: string; hint?: string; children: React.ReactNode; contentClassName?: string }) {
  return (
    <div className="h-full flex flex-col bg-background">
      <PaneHeader title={title} hint={hint} />
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
  const [mode, setMode] = useState<OperatorMode>((searchParams.get('mode') as OperatorMode) || 'build');
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
    const nextMode = (searchParams.get('mode') as OperatorMode) || 'build';
    if (nextMode === 'build' || nextMode === 'edit' || nextMode === 'output') {
      setMode(nextMode);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user || !projectId) {
      setProjectPolls([]);
      return;
    }

    listPolls()
      .then((items) => setProjectPolls(items.filter((poll) => poll.projectId === projectId)))
      .catch(() => setProjectPolls([]));
  }, [user, projectId, pollId, draftStatus]);

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

  const statusLabel = {
    'unsaved': { text: 'Unsaved', cls: 'bg-mako-warning/15 text-mako-warning border-mako-warning/30' },
    'draft-saved': { text: 'Draft Saved', cls: 'bg-primary/15 text-primary border-primary/30' },
    'saved-to-project': {
      text: projectName ? `Saved to ${projectName}` : 'Saved to Project',
      cls: 'bg-mako-success/15 text-mako-success border-mako-success/30'
    },
  }[draftStatus];

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
  const [enabledAssets, setEnabledAssets] = useState<AssetId[]>(SEEDED_ASSETS);
  const [selectedAssetId, setSelectedAssetId] = useState<AssetId | null>(null);
  const [assetState, setAssetState] = useState<AssetState>(DEFAULT_ASSET_STATE);
  const [highlightField, setHighlightField] = useState<string | null>(null);

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
      setEnabledAssets((curr) => (curr.includes(target) ? curr : [...curr, target]));
      setSelectedAssetId(target);
    }
    setHighlightField(field);
    // Clear highlight after the pulse animation
    window.setTimeout(() => setHighlightField((f) => (f === field ? null : f)), 2400);
    toast.message(`Jumped to ${field}`);
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

          {/* Block dropdown — assign poll to A–E */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-[10px] h-7 px-2">
                <Grid3x3 className="w-3 h-3" />
                Block
                <span className="font-mono text-primary font-semibold">{blockLetter}/{String(blockPosition).padStart(2, '0')}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Assign to Block
              </DropdownMenuLabel>
              {BLOCK_LETTERS.map((letter) => (
                <DropdownMenuItem
                  key={letter}
                  onClick={() => setBlockLetter(letter)}
                  className="text-xs gap-2 justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span className={`font-mono font-bold w-4 ${blockLetter === letter ? 'text-primary' : 'text-muted-foreground'}`}>{letter}</span>
                    <span className="text-muted-foreground">{DEFAULT_BLOCK_LABELS[letter]}</span>
                  </span>
                  {blockLetter === letter && <span className="text-[9px] text-primary">●</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Position (1–99)
              </DropdownMenuLabel>
              <div className="px-2 py-1.5">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={blockPosition}
                  onChange={(e) => {
                    const n = Math.min(99, Math.max(1, Number(e.target.value) || 1));
                    setBlockPosition(n);
                  }}
                  className="w-full h-7 rounded-md border border-border bg-background/50 px-2 text-xs font-mono"
                />
                <p className="text-[9px] text-muted-foreground mt-1">
                  Position within block {blockLetter} (default: 1)
                </p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="text-muted-foreground/40">/</span>
          <span className="text-[10px] text-muted-foreground">Polls</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-xs font-semibold text-foreground">Draft Workspace</span>
          <PollStatusChip state="draft" />
          <span className={`mako-chip text-[9px] border ${statusLabel.cls}`}>{statusLabel.text}</span>
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

      {/* Dockable, resizable workspace — 3 columns, vertically split sides */}
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
          {/* LEFT COLUMN — Polling Assets (single pane; background lives in Inspector) */}
          <ResizablePanel defaultSize={layout.hSizes[0]} minSize={18} maxSize={36}>
            <Pane title="Polling Assets" hint="Question · Answers · Logic">
              <PollingAssetsPane
                enabledAssets={enabledAssets}
                onEnabledAssetsChange={setEnabledAssets}
                selectedAssetId={selectedAssetId}
                onSelectAsset={setSelectedAssetId}
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

          {/* CENTER — Preview */}
          <ResizablePanel defaultSize={layout.hSizes[1]} minSize={35}>
            <Pane title="Preview" hint="Live draft monitor">
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

          {/* RIGHT COLUMN — Template (top) + Inspector (bottom) */}
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
                <Pane title="Template">
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
                <Pane title="Inspector" hint="Per-asset properties">
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
    </OperatorLayout>
  );
}
