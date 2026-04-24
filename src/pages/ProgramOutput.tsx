import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { mockPolls } from '@/lib/mock-data';
import { themePresets } from '@/lib/themes';
import { SceneType } from '@/lib/scenes';
import { FullscreenScene } from '@/components/broadcast/scenes/FullscreenScene';
import { LowerThirdScene } from '@/components/broadcast/scenes/LowerThirdScene';
import { QRScene } from '@/components/broadcast/scenes/QRScene';
import { ResultsScene } from '@/components/broadcast/scenes/ResultsScene';
import { BroadcastCanvas } from '@/components/broadcast/BroadcastCanvas';
import { DEFAULT_LAYERS, GraphicLayer, cloneLayers } from '@/lib/layers';
import { OUTPUT_STATE_STORAGE_KEY, OutputAssets, readOutputState } from '@/lib/output-state';
import { Poll } from '@/lib/types';
import { DEFAULT_ASSET_STATE } from '@/components/poll-create/polling-assets/types';

const DEFAULT_ASSETS: OutputAssets = {
  qrSize: 120,
  qrPosition: 'bottom-right',
  qrVisible: DEFAULT_ASSET_STATE.qrVisible,
  qrUrlVisible: DEFAULT_ASSET_STATE.qrUrlVisible,
  showBranding: true,
  brandingPosition: 'bottom-left',
  wordmarkWeight: DEFAULT_ASSET_STATE.wordmarkWeight,
  wordmarkTracking: DEFAULT_ASSET_STATE.wordmarkTracking,
  wordmarkScale: DEFAULT_ASSET_STATE.wordmarkScale,
  wordmarkShowGuides: DEFAULT_ASSET_STATE.wordmarkShowGuides,
};

export default function ProgramOutput() {
  const { id } = useParams();
  const fallbackPoll = useMemo(() => mockPolls.find((poll) => poll.id === id) || mockPolls[0], [id]);
  const initialOutputState = useMemo(() => readOutputState(), []);
  const [poll, setPoll] = useState<Poll>(initialOutputState?.poll ?? fallbackPoll);
  const [layers, setLayers] = useState<GraphicLayer[]>(() => initialOutputState?.layers ?? cloneLayers(DEFAULT_LAYERS));
  const [liveVotes, setLiveVotes] = useState((initialOutputState?.poll ?? fallbackPoll).options.map(o => o.votes));
  const [total, setTotal] = useState((initialOutputState?.poll ?? fallbackPoll).totalVotes);
  const [scene, setScene] = useState<SceneType>(initialOutputState?.scene ?? 'fullscreen');
  const [transitionType, setTransitionType] = useState<'take' | 'cut'>('take');
  const [sceneKey, setSceneKey] = useState(0);
  const [assets, setAssets] = useState<OutputAssets>(initialOutputState?.assets ?? DEFAULT_ASSETS);
  const theme = themePresets.find((preset) => preset.id === poll.themeId) || themePresets[0];

  // Listen for scene/state changes from dashboard
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === OUTPUT_STATE_STORAGE_KEY && e.newValue) {
        try {
          const next = JSON.parse(e.newValue) as Partial<{
            poll: Poll; scene: SceneType; layers: GraphicLayer[]; assets: OutputAssets;
          }>;
          if (next.poll) setPoll(next.poll);
          if (next.scene) setScene(next.scene);
          setLayers(Array.isArray(next.layers) ? cloneLayers(next.layers) : cloneLayers(DEFAULT_LAYERS));
          if (next.assets) setAssets(next.assets);
        } catch {}
      }

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

  useEffect(() => {
    setLiveVotes(poll.options.map((option) => option.votes));
    setTotal(poll.totalVotes);
  }, [poll]);

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
    const sharedAssets = {
      slug: poll.slug,
      qrSize: assets.qrSize,
      qrPosition: assets.qrPosition,
      qrVisible: assets.qrVisible,
      qrUrlVisible: assets.qrUrlVisible,
      showBranding: assets.showBranding,
      brandingPosition: assets.brandingPosition,
      enabledAssetIds: assets.enabledAssetIds,
      transforms: assets.transforms,
      wordmarkWeight: assets.wordmarkWeight,
      wordmarkTracking: assets.wordmarkTracking,
      wordmarkScale: assets.wordmarkScale,
    };
    const baseProps = {
      question: poll.question, options: liveOptions, totalVotes: total,
      colors, theme, template: poll.template, ...sharedAssets,
    };

    const bgStyle: React.CSSProperties = poll.bgImage
      ? { backgroundImage: `url(${poll.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : poll.bgColor
        ? { background: `linear-gradient(135deg, ${poll.bgColor}, hsla(220, 20%, 8%, 0.95))` }
        : {};

    let inner: React.ReactNode;
    switch (scene) {
      case 'lowerThird': inner = <LowerThirdScene {...baseProps} />; break;
      case 'qr':
        inner = <QRScene slug={poll.slug} theme={theme} enabledAssetIds={assets.enabledAssetIds} transforms={assets.transforms} qrVisible={assets.qrVisible} qrUrlVisible={assets.qrUrlVisible} debugVoteUrl={`https://makovote.app/vote/${poll.slug}`} />;
        break;
      case 'results': inner = <ResultsScene {...baseProps} />; break;
      case 'fullscreen':
      default: inner = <FullscreenScene {...baseProps} layers={layers} />;
    }
    return <div className="absolute inset-0" style={bgStyle}>{inner}</div>;
  };

  const animClass = transitionType === 'cut' ? '' : 'animate-fade-in';

  return (
    <div
      className="w-screen h-screen overflow-hidden relative bg-background flex items-center justify-center"
      style={{ cursor: 'none' }}
    >
      <div style={{ width: 'min(100vw, calc(100vh * 16 / 9))', maxWidth: '1920px' }} className="w-full">
        <BroadcastCanvas className="bg-background">
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-live-pulse" style={{ backgroundColor: 'hsl(var(--mako-live))' }} />
            <span className="font-mono text-[10px] font-bold tracking-widest animate-live-pulse" style={{ color: 'hsl(var(--mako-live))' }}>
              ON AIR
            </span>
          </div>

          <div
            key={sceneKey}
            className={`absolute inset-0 ${animClass}`}
            style={{ animationDuration: '300ms' }}
          >
            {renderScene()}
          </div>
        </BroadcastCanvas>
      </div>
    </div>
  );
}
