import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { LiveStatusIndicator } from '@/components/broadcast/LiveStatusIndicator';
import { VotingStatusChip } from '@/components/broadcast/VotingStatusChip';
import { PollQueue } from '@/components/broadcast/PollQueue';
import { AssetControls } from '@/components/broadcast/AssetControls';
import { MonitorContainer } from '@/components/broadcast/BroadcastPreviewFrame';
import { PreviewWithOverlays } from '@/components/broadcast/preview/PreviewWithOverlays';
import { SceneSelector } from '@/components/broadcast/SceneSelector';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { FullscreenScene } from '@/components/broadcast/scenes/FullscreenScene';
import { LowerThirdScene } from '@/components/broadcast/scenes/LowerThirdScene';
import { QRScene } from '@/components/broadcast/scenes/QRScene';
import { ResultsScene } from '@/components/broadcast/scenes/ResultsScene';
import { GraphicsWorkspace, DraftState } from '@/components/broadcast/GraphicsWorkspace';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { mockProject } from '@/lib/mock-data';
import { LiveState, VotingState, QRPosition, Poll } from '@/lib/types';
import { SceneType } from '@/lib/scenes';
import { themePresets } from '@/lib/themes';
import { DEFAULT_LAYERS, GraphicLayer, cloneLayers } from '@/lib/layers';
import { broadcastOutputState } from '@/lib/output-state';
import {
  PlusCircle, Copy, Play, Square, Monitor,
  ExternalLink, ChevronDown, Vote, XCircle, Eye,
  Maximize2, RotateCcw, Palette, Radio, Layers
} from 'lucide-react';

type WorkspaceMode = 'operator' | 'graphics';
type WorkspacePreset = 'operator' | 'graphics' | 'focus' | 'compact';

const LAYOUT_STORAGE_KEY = 'mako-workspace-layout';

interface WorkspaceLayout {
  leftSize: number;
  centerSize: number;
  rightSize: number;
  maximized: boolean;
}

const PRESET_LAYOUTS: Record<WorkspacePreset, WorkspaceLayout> = {
  operator: { leftSize: 22, centerSize: 56, rightSize: 22, maximized: false },
  graphics: { leftSize: 18, centerSize: 52, rightSize: 30, maximized: false },
  focus: { leftSize: 0, centerSize: 82, rightSize: 18, maximized: true },
  compact: { leftSize: 28, centerSize: 50, rightSize: 22, maximized: false },
};

const PRESET_META: { id: WorkspacePreset; label: string; desc: string }[] = [
  { id: 'operator', label: 'Operator', desc: 'Balanced panels for live show control' },
  { id: 'graphics', label: 'Graphics', desc: 'Wider inspector for layer editing' },
  { id: 'focus', label: 'Focus Preview', desc: 'Maximize program preview, collapse left' },
  { id: 'compact', label: 'Compact', desc: 'Wider poll panel for dense block lists' },
];

const DEFAULT_LAYOUT = PRESET_LAYOUTS.operator;

function loadLayout(): WorkspaceLayout {
  try {
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (saved) return { ...DEFAULT_LAYOUT, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_LAYOUT;
}

function saveLayout(layout: Partial<WorkspaceLayout>) {
  try {
    const current = loadLayout();
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({ ...current, ...layout }));
  } catch {}
}

/** Tooltip-wrapped button helper */
function TipButton({ tip, children, ...props }: { tip: string; children: React.ReactNode } & React.ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button {...props}>{children}</Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs max-w-[220px]">{tip}</TooltipContent>
    </Tooltip>
  );
}

export default function Dashboard() {
  const [project, setProject] = useState(mockProject);
  const [activeBlock, setActiveBlock] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('A');
  const allPolls = useMemo(() => project.polls, [project.polls]);
  const pollsByBlock = useMemo(() => ({
    A: allPolls.filter((poll) => poll.blockLetter === 'A'),
    B: allPolls.filter((poll) => poll.blockLetter === 'B'),
    C: allPolls.filter((poll) => poll.blockLetter === 'C'),
    D: allPolls.filter((poll) => poll.blockLetter === 'D'),
    E: allPolls.filter((poll) => poll.blockLetter === 'E'),
  }), [allPolls]);
  const [activePollId, setActivePollId] = useState(allPolls[0]?.id ?? '');
  const activePoll = allPolls.find(p => p.id === activePollId) || allPolls[0];

  const [liveState, setLiveState] = useState<LiveState>('not_live');
  const [previewScene, setPreviewScene] = useState<SceneType>('fullscreen');
  const [programScene, setProgramScene] = useState<SceneType>('fullscreen');
  const [qrSize, setQrSize] = useState(project.qrSize);
  const [qrPosition, setQrPosition] = useState<QRPosition>(project.qrPosition);
  const [showBranding, setShowBranding] = useState(project.showBranding);
  const [brandingPosition, setBrandingPosition] = useState<QRPosition>(project.brandingPosition);
  const [layout, setLayout] = useState<WorkspaceLayout>(loadLayout);
  const [layoutKey, setLayoutKey] = useState(0);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('operator');
  const [activePreset, setActivePreset] = useState<WorkspacePreset>('operator');
  const [programLayersByPollId, setProgramLayersByPollId] = useState<Record<string, GraphicLayer[]>>({});

  const applyPreset = (preset: WorkspacePreset) => {
    const newLayout = PRESET_LAYOUTS[preset];
    setActivePreset(preset);
    setLayout(newLayout);
    saveLayout(newLayout);
    setLayoutKey(k => k + 1);
    // Auto-switch workspace mode based on preset
    if (preset === 'graphics') setWorkspaceMode('graphics');
    else if (preset === 'operator' || preset === 'focus' || preset === 'compact') setWorkspaceMode('operator');
  };

  const activeTheme = themePresets.find((theme) => theme.id === activePoll.themeId) || themePresets[0];
  const activeProgramLayers = programLayersByPollId[activePollId] ?? DEFAULT_LAYERS;
  const previewColors = [activeTheme.chartColorA, activeTheme.chartColorB, activeTheme.chartColorC, activeTheme.chartColorD];

  const assetState = useMemo(() => ({
    qrSize, qrPosition, showBranding, brandingPosition,
  }), [qrSize, qrPosition, showBranding, brandingPosition]);

  const updatePollInProject = (pollId: string, updater: (p: Poll) => Poll) => {
    setProject(prev => ({
      ...prev,
      polls: prev.polls.map(p => p.id === pollId ? updater(p) : p),
    }));
  };

  const updatePollVotingState = (pollId: string, votingState: VotingState) => {
    updatePollInProject(pollId, p => ({ ...p, votingState }));
  };

  const broadcastScene = useCallback((scene: SceneType, transition: 'take' | 'cut') => {
    const value = `${scene}|${transition}`;
    localStorage.setItem('mako-scene', value);
    window.dispatchEvent(new StorageEvent('storage', { key: 'mako-scene', newValue: value }));
  }, []);

  const handleTake = useCallback(() => {
    broadcastOutputState({ poll: activePoll, scene: previewScene, layers: activeProgramLayers, assets: assetState });
    setProgramScene(previewScene);
    broadcastScene(previewScene, 'take');
  }, [activePoll, activeProgramLayers, previewScene, broadcastScene, assetState]);

  const handleCut = useCallback(() => {
    broadcastOutputState({ poll: activePoll, scene: previewScene, layers: activeProgramLayers, assets: assetState });
    setProgramScene(previewScene);
    broadcastScene(previewScene, 'cut');
  }, [activePoll, activeProgramLayers, previewScene, broadcastScene, assetState]);

  const handleGoLive = () => {
    broadcastOutputState({ poll: activePoll, scene: previewScene, layers: activeProgramLayers, assets: assetState });
    setLiveState('live');
    setProgramScene(previewScene);
    broadcastScene(previewScene, 'take');
  };

  const handleEndPoll = () => {
    setLiveState('not_live');
    updatePollVotingState(activePollId, 'closed');
  };

  const handleOpenVoting = () => updatePollVotingState(activePollId, 'open');
  const handleCloseVoting = () => updatePollVotingState(activePollId, 'closed');

  const handleOpenOutput = () => {
    broadcastOutputState({ poll: activePoll, scene: programScene, layers: activeProgramLayers, assets: assetState });
    window.open(`/output/${activePoll.id}`, 'mako-output', 'width=1920,height=1080');
  };

  const handleDuplicatePoll = () => {
    const newPoll: Poll = {
      ...activePoll,
      id: `poll-${Date.now()}`,
      internalName: `${activePoll.internalName} (Copy)`,
      slug: `${activePoll.slug}-copy`,
      state: 'draft',
      votingState: 'not_open',
      totalVotes: 0,
      votesPerSecond: 0,
      options: activePoll.options.map(o => ({ ...o, votes: 0 })),
      createdAt: new Date().toISOString(),
      openedAt: undefined,
      closedAt: undefined,
    };
    setProject(prev => ({
      ...prev,
      polls: [...prev.polls, { ...newPoll, projectId: prev.id, blockLetter: activeBlock }],
    }));
  };

  const handleResetLayout = () => {
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
    setLayout(DEFAULT_LAYOUT);
    setLayoutKey(k => k + 1);
  };

  const handleMaximizePreview = () => {
    const maximized = !layout.maximized;
    const newLayout = maximized
      ? { ...layout, maximized, leftSize: 0, centerSize: 82, rightSize: 18 }
      : { ...DEFAULT_LAYOUT, maximized: false };
    setLayout(newLayout);
    saveLayout(newLayout);
    setLayoutKey(k => k + 1);
  };

  const handleApplyDraft = (draft: DraftState) => {
    updatePollInProject(activePollId, p => ({
      ...p,
      question: draft.question,
      options: draft.options,
      template: draft.template,
      themeId: draft.themeId,
    }));

    if (draft.layers) {
      setProgramLayersByPollId((prev) => ({
        ...prev,
        [activePollId]: cloneLayers(draft.layers!),
      }));
    }
  };

  useEffect(() => {
    broadcastOutputState({ poll: activePoll, scene: programScene, layers: activeProgramLayers, assets: assetState });
  }, [activePoll, activeProgramLayers, programScene, assetState]);

  // Hotkeys
  useEffect(() => {
    const sceneMap: Record<string, SceneType> = {
      '1': 'fullscreen', '2': 'lowerThird', '3': 'qr', '4': 'results',
    };
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (sceneMap[e.key]) { e.preventDefault(); setPreviewScene(sceneMap[e.key]); }
      if (e.key === ' ') {
        e.preventDefault();
        setPreviewScene(prev => {
          setProgramScene(prev);
          broadcastScene(prev, 'take');
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [broadcastScene]);

  const renderPreviewScene = () => {
    const sharedAssets = {
      slug: activePoll.slug,
      qrSize, qrPosition, showBranding, brandingPosition,
    };
    const props = {
      question: activePoll.question, options: activePoll.options,
      totalVotes: activePoll.totalVotes, colors: previewColors, theme: activeTheme,
      template: activePoll.template,
      ...sharedAssets,
    };
    switch (previewScene) {
      case 'lowerThird': return <LowerThirdScene {...props} />;
      case 'qr': return <QRScene slug={activePoll.slug} theme={activeTheme} />;
      case 'results': return <ResultsScene {...props} />;
      default: return <FullscreenScene {...props} layers={activeProgramLayers} />;
    }
  };

  return (
    <OperatorLayout>
      {/* Top Bar */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card/50">
        <div className="flex items-center gap-3">
          {/* Workspace Mode Toggle + Preset Dropdown */}
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5 mr-2">
            <Tooltip><TooltipTrigger asChild>
              <button onClick={() => applyPreset('operator')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${workspaceMode === 'operator' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Radio className="w-3 h-3" /> Operator
              </button>
            </TooltipTrigger><TooltipContent side="bottom">Live broadcast control workspace</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <button onClick={() => applyPreset('graphics')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${workspaceMode === 'graphics' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Palette className="w-3 h-3" /> Graphics
              </button>
            </TooltipTrigger><TooltipContent side="bottom">Design and refine poll graphics</TooltipContent></Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center px-1.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {PRESET_META.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    className={`flex flex-col items-start gap-0.5 ${activePreset === p.id ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    <span className="text-xs font-medium">{p.label}</span>
                    <span className="text-[10px] text-muted-foreground">{p.desc}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="w-px h-6 bg-border" />
          <Link to="/projects" className="text-sm font-semibold text-foreground hover:text-primary transition-colors">{project.name}</Link>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{activePoll.internalName}</span>
          <LiveStatusIndicator state={liveState} />
          <VotingStatusChip state={activePoll.votingState} />
          <span className="mako-chip bg-muted text-muted-foreground">1920×1080</span>
        </div>
        <div className="flex items-center gap-2">
          {workspaceMode === 'operator' && (
            <>
              <TipButton tip="Reset workspace panels to default layout" variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={handleResetLayout}>
                <RotateCcw className="w-3.5 h-3.5" />
              </TipButton>
              <TipButton tip="Expand Program Preview to full width" variant="ghost" size="sm" className={`gap-1.5 text-xs ${layout.maximized ? 'text-primary' : 'text-muted-foreground'}`} onClick={handleMaximizePreview}>
                <Maximize2 className="w-3.5 h-3.5" />
              </TipButton>
              <div className="w-px h-6 bg-border mx-1" />
            </>
          )}
          <TipButton tip="Launch dedicated program output window for secondary display" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleOpenOutput}>
            <Monitor className="w-3.5 h-3.5" /> Full Screen Output
          </TipButton>
          {liveState === 'not_live' ? (
            <TipButton tip="Send current preview to the output window" size="sm" className="gap-1.5 text-xs" onClick={handleGoLive}>
              <Play className="w-3.5 h-3.5" /> Go Live
            </TipButton>
          ) : (
            <TipButton tip="End current poll on output and return to preview" variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={handleEndPoll}>
              <Square className="w-3.5 h-3.5" /> End Poll
            </TipButton>
          )}
        </div>
      </header>

      {/* Workspace Body */}
      {workspaceMode === 'graphics' ? (
        <GraphicsWorkspace
          key={activePoll.id}
          poll={activePoll}
          appliedLayers={activeProgramLayers}
          previewScene={previewScene}
          qrSize={qrSize}
          qrPosition={qrPosition}
          showBranding={showBranding}
          brandingPosition={brandingPosition}
          onQrSizeChange={setQrSize}
          onQrPositionChange={setQrPosition}
          onShowBrandingChange={setShowBranding}
          onBrandingPositionChange={setBrandingPosition}
          onApplyToProgram={handleApplyDraft}
        />
      ) : (
      <div className="h-[calc(100vh-3.5rem)] overflow-hidden">
        <ResizablePanelGroup
          key={layoutKey}
          direction="horizontal"
          className="h-full"
          onLayout={(sizes) => {
            if (sizes.length === 3) saveLayout({ leftSize: sizes[0], centerSize: sizes[1], rightSize: sizes[2] });
          }}
        >
          {/* Left Panel — Block Groups + Poll List + Active Poll */}
          {!layout.maximized && (
            <>
              <ResizablePanel defaultSize={layout.leftSize} minSize={16} maxSize={35} className="p-3">
                <div className="h-full overflow-auto space-y-3">
                  {/* Block Group Selector */}
                  <div className="mako-panel p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-semibold text-foreground font-mono uppercase">Blocks</h2>
                      <span className="text-[10px] text-muted-foreground font-mono">5 blocks</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {(['A', 'B', 'C', 'D', 'E'] as const).map((block) => (
                        <button
                          key={block}
                          onClick={() => {
                            setActiveBlock(block);
                            if (pollsByBlock[block].length > 0) setActivePollId(pollsByBlock[block][0].id);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors border ${
                            block === activeBlock
                              ? 'bg-primary/10 border-primary/30 text-primary'
                              : 'bg-transparent border-transparent text-muted-foreground hover:bg-accent/30'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><Layers className="w-3 h-3" />Block {block}</span>
                            <span className="font-mono text-[10px]">{pollsByBlock[block].length}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Polls in active block */}
                  <div className="mako-panel p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-semibold text-foreground font-mono uppercase">Block {activeBlock}</h2>
                      <span className="text-[10px] text-muted-foreground font-mono">{pollsByBlock[activeBlock].length} polls</span>
                    </div>
                    <PollQueue polls={pollsByBlock[activeBlock]} activePollId={activePollId} onSelectPoll={setActivePollId} />
                  </div>

                  {/* Active Poll Details */}
                  <div className="mako-panel p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-semibold text-foreground font-mono uppercase">Active Poll</h2>
                      <VotingStatusChip state={activePoll.votingState} />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-mono">{activePoll.internalName}</p>
                      <p className="text-sm font-semibold text-foreground mt-1">{activePoll.question}</p>
                    </div>
                    <HorizontalBarChart options={activePoll.options} totalVotes={activePoll.totalVotes} showPercent showVotes />
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                      <div>
                        <p className="text-[10px] text-muted-foreground font-mono uppercase">Total Votes</p>
                        <p className="font-mono text-lg font-bold text-foreground">{activePoll.totalVotes.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-mono uppercase">Votes/sec</p>
                        <p className="font-mono text-lg font-bold text-primary">{activePoll.votesPerSecond}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          {/* Center Panel — Preview + Scenes + Assets */}
          <ResizablePanel defaultSize={layout.centerSize} minSize={35}>
            <div className="h-full overflow-auto p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-foreground">Program Preview</h2>
                  {previewScene !== programScene && (
                    <span className="mako-chip bg-[hsl(var(--mako-warning)/0.2)] text-[hsl(var(--mako-warning))] text-[10px]">PREVIEW ≠ PROGRAM</span>
                  )}
                </div>
              </div>

              <MonitorContainer variant="operator">
                <PreviewWithOverlays showLabel label="1920×1080">
                  {renderPreviewScene()}
                </PreviewWithOverlays>
              </MonitorContainer>

              {/* Scene Selector */}
              <div className="mako-panel p-3">
                <SceneSelector
                  previewScene={previewScene}
                  programScene={programScene}
                  onSceneChange={setPreviewScene}
                  onTake={handleTake}
                  onCut={handleCut}
                />
              </div>

              {/* Asset Controls */}
              <div className="mako-panel p-3">
                <p className="text-[10px] text-muted-foreground font-mono uppercase mb-2">Output Assets</p>
                <AssetControls
                  qrSize={qrSize}
                  qrPosition={qrPosition}
                  showBranding={showBranding}
                  brandingPosition={brandingPosition}
                  onQrSizeChange={setQrSize}
                  onQrPositionChange={setQrPosition}
                  onShowBrandingChange={setShowBranding}
                  onBrandingPositionChange={setBrandingPosition}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel — Quick Actions */}
          <ResizablePanel defaultSize={layout.rightSize} minSize={14} maxSize={30} className="p-3">
            <div className="h-full overflow-auto space-y-3">
              {/* Quick Actions */}
              <div className="mako-panel p-4 space-y-3">
                <h2 className="text-xs font-semibold text-foreground font-mono uppercase">Quick Actions</h2>
                <div className="flex flex-col gap-1.5">
                  <Link to="/polls/new">
                    <TipButton tip="Create a new poll in the current project" variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                      <PlusCircle className="w-3.5 h-3.5" /> New Poll
                    </TipButton>
                  </Link>
                  {activePoll.votingState !== 'open' ? (
                    <TipButton tip="Allow mobile users to submit responses" variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9 text-[hsl(var(--mako-success))]" onClick={handleOpenVoting}>
                      <Vote className="w-3.5 h-3.5" /> Open Voting
                    </TipButton>
                  ) : (
                    <TipButton tip="Stop accepting new responses from mobile users" variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9 text-[hsl(var(--mako-warning))]" onClick={handleCloseVoting}>
                      <XCircle className="w-3.5 h-3.5" /> Close Voting
                    </TipButton>
                  )}
                  <div className="border-t border-border my-1" />
                  <TipButton tip="Preview the polling slate (countdown / 'voting opens soon')" variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                    <Eye className="w-3.5 h-3.5" /> Preview Polling Slate
                  </TipButton>
                  <Link to={`/graphics/${activePoll.id}`}>
                    <TipButton tip="Open the visual design editor for this poll" variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                      <ExternalLink className="w-3.5 h-3.5" /> Graphics Editor
                    </TipButton>
                  </Link>
                </div>
              </div>

              {/* All Project Polls */}
              <div className="mako-panel p-4">
                <h2 className="text-xs font-semibold text-foreground font-mono uppercase mb-3">All Polls</h2>
                <div className="flex flex-col gap-1">
                  {allPolls.map((poll) => (
                    <button
                      key={poll.id}
                      onClick={() => setActivePollId(poll.id)}
                      className={`w-full text-left p-2.5 rounded-lg transition-colors border ${
                        poll.id === activePollId
                          ? 'bg-primary/10 border-primary/30'
                          : 'bg-transparent border-transparent hover:bg-accent/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground truncate">{poll.internalName}</span>
                        <VotingStatusChip state={poll.votingState} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{poll.totalVotes.toLocaleString()} votes</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      )}
    </OperatorLayout>
  );
}
