import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { LiveStatusIndicator } from '@/components/broadcast/LiveStatusIndicator';
import { VotingStatusChip } from '@/components/broadcast/VotingStatusChip';
import { PollQueue } from '@/components/broadcast/PollQueue';
import { AssetControls } from '@/components/broadcast/AssetControls';
import { BroadcastPreviewFrame } from '@/components/broadcast/BroadcastPreviewFrame';
import { SceneSelector } from '@/components/broadcast/SceneSelector';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { FullscreenScene } from '@/components/broadcast/scenes/FullscreenScene';
import { LowerThirdScene } from '@/components/broadcast/scenes/LowerThirdScene';
import { QRScene } from '@/components/broadcast/scenes/QRScene';
import { ResultsScene } from '@/components/broadcast/scenes/ResultsScene';
import { Button } from '@/components/ui/button';
import { mockProject, templateLabels } from '@/lib/mock-data';
import { LiveState, VotingState, QRPosition, Poll } from '@/lib/types';
import { SceneType } from '@/lib/scenes';
import { themePresets } from '@/lib/themes';
import {
  PlusCircle, Copy, Play, Square, Monitor,
  ExternalLink, ChevronRight, Vote, XCircle, Eye
} from 'lucide-react';

export default function Dashboard() {
  const [project, setProject] = useState(mockProject);
  const [activePollId, setActivePollId] = useState(project.polls[0].id);
  const [liveState, setLiveState] = useState<LiveState>('not_live');
  const [previewScene, setPreviewScene] = useState<SceneType>('fullscreen');
  const [programScene, setProgramScene] = useState<SceneType>('fullscreen');
  const [showTitleSafe, setShowTitleSafe] = useState(false);
  const [showActionSafe, setShowActionSafe] = useState(false);
  const [qrSize, setQrSize] = useState(project.qrSize);
  const [qrPosition, setQrPosition] = useState<QRPosition>(project.qrPosition);
  const [showBranding, setShowBranding] = useState(project.showBranding);
  const [brandingPosition, setBrandingPosition] = useState<QRPosition>(project.brandingPosition);

  const activePoll = project.polls.find(p => p.id === activePollId) || project.polls[0];
  const previewTheme = themePresets[0];
  const previewColors = [previewTheme.chartColorA, previewTheme.chartColorB, previewTheme.chartColorC, previewTheme.chartColorD];

  const updatePollVotingState = (pollId: string, votingState: VotingState) => {
    setProject(prev => ({
      ...prev,
      polls: prev.polls.map(p => p.id === pollId ? { ...p, votingState } : p),
    }));
  };

  const broadcastScene = useCallback((scene: SceneType, transition: 'take' | 'cut') => {
    const value = `${scene}|${transition}`;
    localStorage.setItem('mako-scene', value);
    window.dispatchEvent(new StorageEvent('storage', { key: 'mako-scene', newValue: value }));
  }, []);

  const handleTake = useCallback(() => {
    setProgramScene(previewScene);
    broadcastScene(previewScene, 'take');
  }, [previewScene, broadcastScene]);

  const handleCut = useCallback(() => {
    setProgramScene(previewScene);
    broadcastScene(previewScene, 'cut');
  }, [previewScene, broadcastScene]);

  const handleGoLive = () => {
    setLiveState('live');
    setProgramScene(previewScene);
    broadcastScene(previewScene, 'take');
  };

  const handleEndPoll = () => {
    setLiveState('not_live');
    updatePollVotingState(activePollId, 'closed');
  };

  const handleOpenVoting = () => {
    updatePollVotingState(activePollId, 'open');
  };

  const handleCloseVoting = () => {
    updatePollVotingState(activePollId, 'closed');
  };

  const handleOpenOutput = () => {
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
      polls: [...prev.polls, newPoll],
    }));
  };

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

  return (
    <OperatorLayout>
      {/* Top Bar */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card/50">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground text-sm">{project.name}</span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{activePoll.internalName}</span>
          <LiveStatusIndicator state={liveState} />
          <VotingStatusChip state={activePoll.votingState} />
          <span className="mako-chip bg-muted text-muted-foreground">1920×1080</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleOpenOutput}>
            <Monitor className="w-3.5 h-3.5" /> Open Output
          </Button>
          {liveState === 'not_live' ? (
            <Button size="sm" className="gap-1.5 text-xs" onClick={handleGoLive}>
              <Play className="w-3.5 h-3.5" /> Go Live
            </Button>
          ) : (
            <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={handleEndPoll}>
              <Square className="w-3.5 h-3.5" /> End Poll
            </Button>
          )}
        </div>
      </header>

      <div className="p-4 space-y-3 overflow-auto h-[calc(100vh-3.5rem)]">
        {/* 3-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_240px] gap-4">
          {/* Left — Poll Queue + Active Poll */}
          <div className="space-y-3">
            {/* Poll Queue */}
            <div className="mako-panel p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-foreground font-mono uppercase">Poll Queue</h2>
                <span className="text-[10px] text-muted-foreground font-mono">{project.polls.length} polls</span>
              </div>
              <PollQueue
                polls={project.polls}
                activePollId={activePollId}
                onSelectPoll={setActivePollId}
              />
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

              <HorizontalBarChart
                options={activePoll.options}
                totalVotes={activePoll.totalVotes}
                showPercent
                showVotes
              />

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

          {/* Center — Preview + Scenes + Asset Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-foreground">Program Preview</h2>
                {previewScene !== programScene && (
                  <span className="mako-chip bg-mako-warning/20 text-[hsl(var(--mako-warning))] text-[10px]">
                    PREVIEW ≠ PROGRAM
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTitleSafe(!showTitleSafe)}
                  className={`mako-chip cursor-pointer transition-colors ${showTitleSafe ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}
                >
                  Title Safe
                </button>
                <button
                  onClick={() => setShowActionSafe(!showActionSafe)}
                  className={`mako-chip cursor-pointer transition-colors ${showActionSafe ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}
                >
                  Action Safe
                </button>
              </div>
            </div>

            <BroadcastPreviewFrame showTitleSafe={showTitleSafe} showActionSafe={showActionSafe} showLabel>
              {previewScene === 'lowerThird' && (
                <LowerThirdScene question={activePoll.question} options={activePoll.options} totalVotes={activePoll.totalVotes} colors={previewColors} theme={previewTheme} />
              )}
              {previewScene === 'qr' && (
                <QRScene slug={activePoll.slug} theme={previewTheme} />
              )}
              {previewScene === 'results' && (
                <ResultsScene question={activePoll.question} options={activePoll.options} totalVotes={activePoll.totalVotes} colors={previewColors} theme={previewTheme} />
              )}
              {(previewScene === 'fullscreen' || !previewScene) && (
                <FullscreenScene question={activePoll.question} options={activePoll.options} totalVotes={activePoll.totalVotes} colors={previewColors} theme={previewTheme} />
              )}
            </BroadcastPreviewFrame>

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

          {/* Right — Quick Actions */}
          <div className="mako-panel p-4 space-y-3">
            <h2 className="text-xs font-semibold text-foreground font-mono uppercase">Quick Actions</h2>
            <div className="flex flex-col gap-1.5">
              <Link to="/polls/new">
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                  <PlusCircle className="w-3.5 h-3.5" /> New Poll
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9" onClick={handleDuplicatePoll}>
                <Copy className="w-3.5 h-3.5" /> Duplicate Poll
              </Button>

              <div className="border-t border-border my-1" />

              {activePoll.votingState !== 'open' ? (
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9 text-mako-success" onClick={handleOpenVoting}>
                  <Vote className="w-3.5 h-3.5" /> Open Voting
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9 text-mako-warning" onClick={handleCloseVoting}>
                  <XCircle className="w-3.5 h-3.5" /> Close Voting
                </Button>
              )}

              <div className="border-t border-border my-1" />

              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                <Eye className="w-3.5 h-3.5" /> Preview Slate
              </Button>
              <Link to={`/graphics/${activePoll.id}`}>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                  <ExternalLink className="w-3.5 h-3.5" /> Graphics Editor
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom — Recent Polls */}
        <div className="mako-panel p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Project Polls</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-mono font-medium">Name</th>
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-mono font-medium">Question</th>
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-mono font-medium">Template</th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-mono font-medium">Votes</th>
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-mono font-medium">Voting</th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-mono font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {project.polls.map((poll) => (
                  <tr
                    key={poll.id}
                    className={`border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer ${poll.id === activePollId ? 'bg-primary/5' : ''}`}
                    onClick={() => setActivePollId(poll.id)}
                  >
                    <td className="py-2.5 px-3 font-medium text-foreground text-xs">{poll.internalName}</td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs truncate max-w-[200px]">{poll.question}</td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs">{templateLabels[poll.template]}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-foreground">{poll.totalVotes.toLocaleString()}</td>
                    <td className="py-2.5 px-3"><VotingStatusChip state={poll.votingState} /></td>
                    <td className="py-2.5 px-3 text-right">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </OperatorLayout>
  );
}
