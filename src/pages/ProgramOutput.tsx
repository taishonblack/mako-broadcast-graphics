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
import {
  OUTPUT_HEARTBEAT_CHANNEL,
  OUTPUT_HEARTBEAT_STORAGE_KEY,
  OUTPUT_STATE_CHANNEL,
  OUTPUT_STATE_STORAGE_KEY,
  OutputAssets,
  OutputStatePayload,
  readOutputState,
} from '@/lib/output-state';
import { Poll } from '@/lib/types';
import { DEFAULT_ASSET_STATE } from '@/components/poll-create/polling-assets/types';
import { Maximize, Minimize } from 'lucide-react';

const DEFAULT_ASSETS: OutputAssets = {
  qrSize: 120,
  qrPosition: 'bottom-right',
  qrVisible: DEFAULT_ASSET_STATE.qrVisible,
  qrUrlVisible: DEFAULT_ASSET_STATE.qrUrlVisible,
  showBranding: false,
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

  // Fullscreen controls — browsers won't strip the URL bar without an
  // explicit user gesture calling the Fullscreen API. We expose a small
  // control that briefly reveals on mouse-move and hides automatically
  // so the Output stays clean once engaged.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  useEffect(() => {
    if (!controlsVisible) return;
    const t = window.setTimeout(() => setControlsVisible(false), 2500);
    return () => window.clearTimeout(t);
  }, [controlsVisible]);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch { /* user denied or unsupported */ }
  };

  // Mirror status indicator — tracks the most recent heartbeat or state
  // message from the operator. If nothing arrives for >2s we flip to
  // STALLED (red); >5s degrades to LOST. Any incoming message restores LIVE.
  const [lastBeat, setLastBeat] = useState<number>(() => {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem(OUTPUT_HEARTBEAT_STORAGE_KEY)
      : null;
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const markBeat = () => setLastBeat(Date.now());
    const onStorage = (e: StorageEvent) => {
      if (e.key === OUTPUT_HEARTBEAT_STORAGE_KEY || e.key === OUTPUT_STATE_STORAGE_KEY) {
        markBeat();
      }
    };
    window.addEventListener('storage', onStorage);
    let beatChannel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        beatChannel = new BroadcastChannel(OUTPUT_HEARTBEAT_CHANNEL);
        beatChannel.onmessage = () => markBeat();
      }
    } catch { /* ignore */ }
    return () => {
      window.removeEventListener('storage', onStorage);
      try { beatChannel?.close(); } catch { /* ignore */ }
    };
  }, []);
  const sinceBeat = lastBeat ? now - lastBeat : Infinity;
  const mirrorStatus: 'live' | 'stalled' | 'lost' =
    sinceBeat <= 2000 ? 'live' : sinceBeat <= 5000 ? 'stalled' : 'lost';

  // Listen for scene/state changes from dashboard
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === OUTPUT_STATE_STORAGE_KEY && e.newValue) {
        setLastBeat(Date.now());
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

    // Realtime mirror via BroadcastChannel for instant sync across windows.
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(OUTPUT_STATE_CHANNEL);
        channel.onmessage = (ev) => {
          setLastBeat(Date.now());
          const next = ev.data as OutputStatePayload | undefined;
          if (!next) return;
          if (next.poll) setPoll(next.poll);
          if (next.scene) setScene(next.scene);
          setLayers(Array.isArray(next.layers) ? cloneLayers(next.layers) : cloneLayers(DEFAULT_LAYERS));
          if (next.assets) setAssets(next.assets);
        };
      }
    } catch { /* ignore */ }

    return () => {
      window.removeEventListener('storage', handler);
      try { channel?.close(); } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => {
    setLiveVotes(poll.options.map((option) => option.votes));
    setTotal(poll.totalVotes);
  }, [poll]);

  // Simulate live vote updates
  useEffect(() => {
    // Don't simulate votes for an empty/placeholder poll — keeps the
    // MakoVote wordmark visible on fullscreen until the operator adds a
    // real question.
    if (!poll.question.trim()) return;
    const interval = setInterval(() => {
      setLiveVotes(prev => {
        const next = prev.map(v => v + Math.floor(Math.random() * 5));
        setTotal(next.reduce((a, b) => a + b, 0));
        return next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [poll.question]);

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
      style={{ cursor: controlsVisible ? 'default' : 'none' }}
      onMouseMove={() => setControlsVisible(true)}
    >
      {/* Fullscreen toggle — reveals on mouse-move, auto-hides after 2.5s */}
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        className={`fixed top-3 left-3 z-[100] inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-black/60 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white backdrop-blur-sm transition-opacity duration-300 hover:bg-black/80 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {isFullscreen ? <Minimize className="h-3 w-3" /> : <Maximize className="h-3 w-3" />}
        {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      </button>
      {/* Output mirroring status — auto-hides when LIVE, but stays visible
       *  whenever the mirror stalls or drops so the operator sees red. */}
      {(() => {
        const isLive = mirrorStatus === 'live';
        const label =
          mirrorStatus === 'live'
            ? 'Mirroring: Live'
            : mirrorStatus === 'stalled'
              ? 'Mirroring: Stalled'
              : 'Mirroring: Lost';
        const dotColor =
          mirrorStatus === 'live'
            ? 'hsl(var(--mako-success))'
            : 'hsl(var(--destructive))';
        const showChip = !isLive || controlsVisible;
        return (
          <div
            role="status"
            aria-live="polite"
            title={
              isLive
                ? 'Receiving live updates from Program Preview'
                : 'No updates received from Program Preview — check the operator window'
            }
            className={`fixed top-3 left-[calc(0.75rem+10rem)] z-[100] inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white backdrop-blur-sm transition-opacity duration-300 ${
              isLive
                ? 'border-white/15 bg-black/60'
                : 'border-destructive/60 bg-destructive/30'
            } ${showChip ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${isLive ? 'animate-live-pulse' : ''}`}
              style={{ backgroundColor: dotColor }}
            />
            {label}
          </div>
        );
      })()}
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
