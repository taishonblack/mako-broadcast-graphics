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
  OUTPUT_STATE_CHANNEL,
  OUTPUT_STATE_STORAGE_KEY,
  OUTPUT_LOCK_CHANNEL,
  OUTPUT_LOCK_STORAGE_KEY,
  OutputAssets,
  OutputLockMessage,
  OutputStatePayload,
  readOutputState,
  readOutputLock,
} from '@/lib/output-state';
import { Poll } from '@/lib/types';
import { DEFAULT_ASSET_STATE } from '@/components/poll-create/polling-assets/types';
import { Maximize, Minimize } from 'lucide-react';
import { useTallyDisplay } from '@/hooks/useTallyDisplay';

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
  const initialLock = useMemo(() => readOutputLock(), []);
  const initialEffective = initialLock?.locked && initialLock.snapshot ? initialLock.snapshot : initialOutputState;
  const [poll, setPoll] = useState<Poll>(initialEffective?.poll ?? fallbackPoll);
  const [layers, setLayers] = useState<GraphicLayer[]>(() => initialEffective?.layers ?? cloneLayers(DEFAULT_LAYERS));
  const [liveVotes, setLiveVotes] = useState((initialEffective?.poll ?? fallbackPoll).options.map(o => o.votes));
  const [total, setTotal] = useState((initialEffective?.poll ?? fallbackPoll).totalVotes);
  const [scene, setScene] = useState<SceneType>(initialEffective?.scene ?? 'fullscreen');
  const [transitionType, setTransitionType] = useState<'take' | 'cut'>('take');
  const [sceneKey, setSceneKey] = useState(0);
  const [assets, setAssets] = useState<OutputAssets>(initialEffective?.assets ?? DEFAULT_ASSETS);
  /** When locked, ignore all incoming OutputStatePayload pushes — the
   *  snapshot above is the canonical broadcast frame until End Live fires. */
  const [locked, setLocked] = useState<boolean>(Boolean(initialLock?.locked));
  const theme = themePresets.find((preset) => preset.id === poll.themeId) || themePresets[0];

  // Apply Stop Motion / Live tally pacing on the display votes that scenes
  // render. The "true" liveVotes / total still tick in the background; this
  // hook only affects what's shown.
  const { displayVotes, displayTotal } = useTallyDisplay(
    liveVotes,
    total,
    assets.tallyMode ?? 'live',
    assets.tallyIntervalSeconds ?? 5,
  );

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

  // Listen for scene/state changes from dashboard
  useEffect(() => {
    const applyPayload = (next: Partial<OutputStatePayload>) => {
      if (next.poll) setPoll(next.poll);
      if (next.scene) setScene(next.scene);
      setLayers(Array.isArray(next.layers) ? cloneLayers(next.layers) : cloneLayers(DEFAULT_LAYERS));
      if (next.assets) setAssets(next.assets);
    };

    const applyLock = (msg: OutputLockMessage | null) => {
      if (msg?.locked && msg.snapshot) {
        applyPayload(msg.snapshot);
        setLocked(true);
      } else {
        setLocked(false);
      }
    };

    const handler = (e: StorageEvent) => {
      if (e.key === OUTPUT_LOCK_STORAGE_KEY) {
        try {
          const msg = e.newValue ? JSON.parse(e.newValue) as OutputLockMessage : { locked: false };
          applyLock(msg);
        } catch { applyLock({ locked: false }); }
        return;
      }
      if (e.key === OUTPUT_STATE_STORAGE_KEY && e.newValue) {
        try {
          const next = JSON.parse(e.newValue) as Partial<{
            poll: Poll; scene: SceneType; layers: GraphicLayer[]; assets: OutputAssets;
          }>;
          // Discard payloads while locked — the snapshot is canonical.
          if (locked) return;
          applyPayload(next);
        } catch {}
      }

      if (e.key === 'mako-scene' && e.newValue) {
        const [newScene, transition] = e.newValue.split('|') as [SceneType, string];
        setTransitionType((transition as 'take' | 'cut') || 'take');
        if (locked) return;
        setScene(newScene);
        setSceneKey(k => k + 1);
      }
    };
    window.addEventListener('storage', handler);

    // Realtime mirror via BroadcastChannel for instant sync across windows.
    let channel: BroadcastChannel | null = null;
    let lockChannel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(OUTPUT_STATE_CHANNEL);
        channel.onmessage = (ev) => {
          const next = ev.data as OutputStatePayload | undefined;
          if (!next) return;
          if (locked) return;
          applyPayload(next);
        };
        lockChannel = new BroadcastChannel(OUTPUT_LOCK_CHANNEL);
        lockChannel.onmessage = (ev) => {
          applyLock((ev.data as OutputLockMessage | undefined) ?? { locked: false });
        };
      }
    } catch { /* ignore */ }

    return () => {
      window.removeEventListener('storage', handler);
      try { channel?.close(); } catch { /* ignore */ }
      try { lockChannel?.close(); } catch { /* ignore */ }
    };
  }, [locked]);

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

  const liveOptions = poll.options.map((o, i) => ({ ...o, votes: displayVotes[i] ?? 0 }));
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
      resultsMode: assets.resultsMode,
      resultsAnimationMs: assets.resultsAnimationMs,
    };
    const baseProps = {
      question: poll.question, options: liveOptions, totalVotes: displayTotal,
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
      <div style={{ width: 'min(100vw, calc(100vh * 16 / 9))', maxWidth: '1920px' }} className="w-full">
        <BroadcastCanvas className="bg-background">
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
