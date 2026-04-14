import { useState, useEffect } from 'react';
import { mockPolls } from '@/lib/mock-data';
import { themePresets } from '@/lib/themes';
import { SceneType } from '@/lib/scenes';
import { FullscreenScene } from '@/components/broadcast/scenes/FullscreenScene';
import { LowerThirdScene } from '@/components/broadcast/scenes/LowerThirdScene';
import { QRScene } from '@/components/broadcast/scenes/QRScene';
import { ResultsScene } from '@/components/broadcast/scenes/ResultsScene';

export default function ProgramOutput() {
  const poll = mockPolls[0];
  const theme = themePresets[0];
  const [liveVotes, setLiveVotes] = useState(poll.options.map(o => o.votes));
  const [total, setTotal] = useState(poll.totalVotes);
  const [scene, setScene] = useState<SceneType>('fullscreen');
  const [transitionType, setTransitionType] = useState<'take' | 'cut'>('take');
  const [sceneKey, setSceneKey] = useState(0);

  // Listen for scene changes from dashboard
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'mako-scene' && e.newValue) {
        const [newScene, transition] = e.newValue.split('|') as [SceneType, string];
        setTransitionType((transition as 'take' | 'cut') || 'take');
        setScene(newScene);
        setSceneKey(k => k + 1);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Simulate live vote updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveVotes(prev => {
        const next = prev.map(v => v + Math.floor(Math.random() * 5));
        setTotal(next.reduce((a, b) => a + b, 0));
        return next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const liveOptions = poll.options.map((o, i) => ({ ...o, votes: liveVotes[i] }));
  const colors = [theme.chartColorA, theme.chartColorB, theme.chartColorC, theme.chartColorD];

  const renderScene = () => {
    const baseProps = { question: poll.question, options: liveOptions, totalVotes: total, colors, theme };

    switch (scene) {
      case 'lowerThird':
        return <LowerThirdScene {...baseProps} />;
      case 'qr':
        return <QRScene slug={poll.slug} theme={theme} />;
      case 'results':
        return <ResultsScene {...baseProps} />;
      case 'fullscreen':
      default:
        return <FullscreenScene {...baseProps} />;
    }
  };

  const animClass = transitionType === 'cut' ? '' : 'animate-fade-in';

  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{ cursor: 'none' }}
    >
      {/* ON AIR indicator */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[hsl(var(--mako-live))] animate-live-pulse" />
        <span className="font-mono text-[10px] font-bold tracking-widest text-[hsl(var(--mako-live))] animate-live-pulse">
          ON AIR
        </span>
      </div>

      {/* Scene with transition */}
      <div
        key={sceneKey}
        className={`absolute inset-0 ${animClass}`}
        style={{ animationDuration: '300ms' }}
      >
        {renderScene()}
      </div>
    </div>
  );
}
