import { renderChart } from '@/lib/render-chart';
import { ThemePreset, PollOption, TemplateName, QRPosition } from '@/lib/types';
import { GraphicLayer, LayerType, LAYER_FRAME_ZONES } from '@/lib/layers';
import { AssetOverlay } from '@/components/broadcast/AssetOverlay';

interface FullscreenSceneProps {
  question: string;
  options: PollOption[];
  totalVotes: number;
  colors: string[];
  theme: ThemePreset;
  template?: TemplateName;
  layers?: GraphicLayer[];
  // Optional asset overlays
  slug?: string;
  qrSize?: number;
  qrPosition?: QRPosition;
  showBranding?: boolean;
  brandingPosition?: QRPosition;
}

function getLayer(layers: GraphicLayer[] | undefined, id: LayerType): GraphicLayer | undefined {
  return layers?.find((l) => l.id === id);
}

function layerPosition(layer: GraphicLayer | undefined, id: LayerType): React.CSSProperties {
  const zone = LAYER_FRAME_ZONES[id];
  return {
    position: 'absolute' as const,
    left: `${layer?.transform.x ?? zone.x}%`,
    top: `${layer?.transform.y ?? zone.y}%`,
    opacity: layer?.transform.opacity ?? 1,
    transform: `scale(${layer?.transform.scale ?? 1})`,
    transformOrigin: 'top left',
    display: layer?.visible === false ? 'none' : undefined,
    transition: 'left 0.2s, top 0.2s, opacity 0.2s, transform 0.2s',
  };
}

export function FullscreenScene({
  question,
  options,
  totalVotes,
  colors,
  theme,
  template = 'horizontal-bar',
  layers,
  slug,
  qrSize,
  qrPosition,
  showBranding = false,
  brandingPosition = 'bottom-left',
}: FullscreenSceneProps) {
  const bgLayer = getLayer(layers, 'background');
  const questionLayer = getLayer(layers, 'question');
  const barsLayer = getLayer(layers, 'answerBars');
  const votesLayer = getLayer(layers, 'votesText');
  const questionZone = LAYER_FRAME_ZONES.question;
  const barsZone = LAYER_FRAME_ZONES.answerBars;
  const votesZone = LAYER_FRAME_ZONES.votesText;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${theme.tintColor}, hsl(220, 25%, 6%))`,
        opacity: bgLayer?.transform.opacity ?? 1,
      }}
    >
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      <div className="relative z-20 w-full h-full">
        {/* Question */}
        <div
          style={{
            ...layerPosition(questionLayer, 'question'),
            width: `${questionLayer?.textProps?.maxWidth ?? questionZone.w}%`,
          }}
        >
          <h1
            className="font-bold leading-tight whitespace-pre-wrap break-words"
            style={{
              color: theme.textPrimary,
              fontSize: `${questionLayer?.textProps?.fontSize ?? 72}px`,
              fontWeight: questionLayer?.textProps?.fontWeight ?? 'bold',
              textAlign: questionLayer?.textProps?.textAlign ?? 'center',
              lineHeight: questionLayer?.textProps?.lineHeight ?? 1.1,
            }}
          >
            {question}
          </h1>
        </div>

        {/* Answer Bars — fills frame */}
        <div
          style={{
            ...layerPosition(barsLayer, 'answerBars'),
            width: `${barsZone.w}%`,
          }}
        >
          {renderChart({ template, options, totalVotes, colors })}
        </div>

        {/* Votes Text */}
        <div
          style={{
            ...layerPosition(votesLayer, 'votesText'),
            width: `${votesZone.w}%`,
          }}
        >
          <span
            className="font-mono block"
            style={{
              color: theme.textSecondary,
              fontSize: `${votesLayer?.textProps?.fontSize ?? 28}px`,
              textAlign: votesLayer?.textProps?.textAlign ?? 'center',
            }}
          >
            {totalVotes.toLocaleString()} total votes
          </span>
        </div>
      </div>

      {/* Asset overlay (QR + bug) — wired to operator controls */}
      {(qrSize !== undefined || showBranding) && (
        <AssetOverlay
          showQR={qrSize !== undefined && qrSize > 0}
          qrSlug={slug ?? ''}
          qrSize={qrSize ?? 0}
          qrPosition={qrPosition ?? 'bottom-right'}
          showBranding={showBranding}
          brandingPosition={brandingPosition}
          theme={theme}
        />
      )}
    </div>
  );
}
