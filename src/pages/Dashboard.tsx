import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { PollStatusChip } from '@/components/broadcast/PollStatusChip';
import { OutputStatusChip } from '@/components/broadcast/OutputStatusChip';
import { BroadcastPreviewFrame } from '@/components/broadcast/BroadcastPreviewFrame';
import { SceneSelector } from '@/components/broadcast/SceneSelector';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { FullscreenScene } from '@/components/broadcast/scenes/FullscreenScene';
import { LowerThirdScene } from '@/components/broadcast/scenes/LowerThirdScene';
import { QRScene } from '@/components/broadcast/scenes/QRScene';
import { ResultsScene } from '@/components/broadcast/scenes/ResultsScene';
import { Button } from '@/components/ui/button';
import { mockPolls, recentPolls, templateLabels } from '@/lib/mock-data';
import { OutputState } from '@/lib/types';
import { SceneType } from '@/lib/scenes';
import { themePresets } from '@/lib/themes';
import {
  PlusCircle, Copy, Play, Square, RotateCcw, QrCode, Monitor,
  ExternalLink, Eye, EyeOff, ChevronRight
} from 'lucide-react';

export default function Dashboard() {
  const activePoll = mockPolls[0];
  const [outputState] = useState<OutputState>('live_output');
  const [showTitleSafe, setShowTitleSafe] = useState(false);
  const [showActionSafe, setShowActionSafe] = useState(false);
  const [previewScene, setPreviewScene] = useState<SceneType>('fullscreen');
  const [programScene, setProgramScene] = useState<SceneType>('fullscreen');

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

  // Hotkeys
  useEffect(() => {
    const sceneMap: Record<string, SceneType> = {
      '1': 'fullscreen',
      '2': 'lowerThird',
      '3': 'qr',
      '4': 'results',
    };

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (sceneMap[e.key]) {
        e.preventDefault();
        setPreviewScene(sceneMap[e.key]);
      }
      if (e.key === ' ') {
        e.preventDefault();
        // Use functional update to get latest previewScene
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
          <span className="font-semibold text-foreground text-sm">MakoVote</span>
          <PollStatusChip state={activePoll.state} />
          <OutputStatusChip state={outputState} />
          <span className="mako-chip bg-muted text-muted-foreground">1920×1080</span>
          <span className="mako-chip bg-muted text-muted-foreground">{templateLabels[activePoll.template]}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Monitor className="w-3.5 h-3.5" />
            Open Output
          </Button>
          <Button size="sm" className="gap-1.5 text-xs">
            <Play className="w-3.5 h-3.5" />
            Go Live
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Square className="w-3.5 h-3.5" />
            Close Poll
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* 3-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_260px] gap-4">
          {/* Left — Active Poll */}
          <div className="mako-panel p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Active Poll</h2>
              <PollStatusChip state={activePoll.state} />
            </div>

            <div>
              <p className="text-xs text-muted-foreground font-mono">{activePoll.internalName}</p>
              <p className="text-base font-semibold text-foreground mt-1">{activePoll.question}</p>
            </div>

            {/* Live shimmer effect on active poll */}
            <div className="relative">
              <HorizontalBarChart
                options={activePoll.options}
                totalVotes={activePoll.totalVotes}
                showPercent
                showVotes
              />
            </div>

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

          {/* Center — Preview + Scenes */}
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
          </div>

          {/* Right — Quick Actions */}
          <div className="mako-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Quick Actions</h2>
            <div className="flex flex-col gap-1.5">
              <Link to="/polls/new">
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                  <PlusCircle className="w-3.5 h-3.5" /> New Poll
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                <Copy className="w-3.5 h-3.5" /> Duplicate Poll
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                <Play className="w-3.5 h-3.5" /> Open Voting
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                <Square className="w-3.5 h-3.5" /> Close Voting
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                <RotateCcw className="w-3.5 h-3.5" /> Reset Poll
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                <QrCode className="w-3.5 h-3.5" /> Show/Hide QR
              </Button>
              <Link to={`/graphics/${activePoll.id}`}>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                  <ExternalLink className="w-3.5 h-3.5" /> Graphics Editor
                </Button>
              </Link>
            </div>

            <div className="pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground font-mono uppercase mb-2">Display</p>
              <div className="flex flex-col gap-1.5">
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                  <Eye className="w-3.5 h-3.5" /> Show Percent
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                  <EyeOff className="w-3.5 h-3.5" /> Show Votes
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom — Recent Polls */}
        <div className="mako-panel p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Recent Polls</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-mono font-medium">Name</th>
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-mono font-medium">Date</th>
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-mono font-medium">Template</th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-mono font-medium">Votes</th>
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-mono font-medium">State</th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-mono font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {recentPolls.map((poll) => (
                  <tr key={poll.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-foreground">{poll.name}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-mono text-xs">{poll.date}</td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs">{templateLabels[poll.template]}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-foreground">{poll.totalVotes.toLocaleString()}</td>
                    <td className="py-2.5 px-3"><PollStatusChip state={poll.state} /></td>
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
