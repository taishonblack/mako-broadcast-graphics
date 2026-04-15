import { renderChart } from '@/lib/render-chart';
import { ThemePreset, PollOption, TemplateName } from '@/lib/types';
import { QRCodeSVG } from 'qrcode.react';
import { GraphicLayer, LayerType, LAYER_FRAME_ZONES } from '@/lib/layers';

interface FullscreenSceneProps {
  question: string;
  options: PollOption[];
  totalVotes: number;
  colors: string[];
  theme: ThemePreset;
  template?: TemplateName;
  layers?: GraphicLayer[];
}

function getLayer(layers: GraphicLayer[] | undefined, id: LayerType): GraphicLayer | undefined {
  return layers?.find(l => l.id === id);
}

function layerStyle(layer: GraphicLayer | undefined): React.CSSProperties {
  if (!layer) return {};
  return {
    opacity: layer.transform.opacity,
    transform: `scale(${layer.transform.scale})`,
    transformOrigin: 'top left',
    display: layer.visible ? undefined : 'none',
    transition: 'left 0.2s, top 0.2s, opacity 0.2s, transform 0.2s',
  };
}

/** Returns absolute positioning style driven by layer x/y */
function layerPosition(layer: GraphicLayer | undefined, id: LayerType): React.CSSProperties {
  const zone = LAYER_FRAME_ZONES[id];
  return {
    ...layerStyle(layer),
    position: 'absolute' as const,
    left: `${layer?.transform.x ?? zone.x}%`,
    top: `${layer?.transform.y ?? zone.y}%`,
  };
}

export function FullscreenScene({ question, options, totalVotes, colors, theme, template = 'horizontal-bar', layers }: FullscreenSceneProps) {
  const bgLayer = getLayer(layers, 'background');
  const questionLayer = getLayer(layers, 'question');
  const barsLayer = getLayer(layers, 'answerBars');
  const votesLayer = getLayer(layers, 'votesText');
  const qrLayer = getLayer(layers, 'qrCode');
  const logoLayer = getLayer(layers, 'logo');
  const questionZone = LAYER_FRAME_ZONES.question;
  const barsZone = LAYER_FRAME_ZONES.answerBars;
  const votesZone = LAYER_FRAME_ZONES.votesText;

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
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
          className="text-center"
          style={{
            ...layerPosition(questionLayer, 'question'),
            width: `${questionLayer?.textProps?.maxWidth ?? questionZone.w}%`,
          }}
        >
          <h1
            className="font-bold leading-tight whitespace-pre-wrap break-words"
            style={{
              color: theme.textPrimary,
              fontSize: questionLayer?.textProps?.fontSize ? `${questionLayer.textProps.fontSize * 2}px` : undefined,
              fontWeight: questionLayer?.textProps?.fontWeight ?? 'bold',
              textAlign: questionLayer?.textProps?.textAlign ?? 'center',
              lineHeight: questionLayer?.textProps?.lineHeight ?? 1.1,
            }}
          >
            {question}
          </h1>
        </div>

        {/* Answer Bars */}
        <div
          style={{
            ...layerPosition(barsLayer, 'answerBars'),
            width: `${barsZone.w}%`,
            maxWidth: '42rem',
          }}
        >
          {renderChart({ template, options, totalVotes, colors })}
        </div>

        {/* Votes Text */}
        <div style={{ ...layerPosition(votesLayer, 'votesText'), width: `${votesZone.w}%` }}>
          <span
            className="font-mono block"
            style={{
              color: theme.textSecondary,
              fontSize: votesLayer?.textProps?.fontSize ? `${votesLayer.textProps.fontSize}px` : '14px',
              textAlign: votesLayer?.textProps?.textAlign ?? 'center',
            }}
          >
            {totalVotes.toLocaleString()} total votes
          </span>
        </div>

        {/* QR */}
        <div style={layerPosition(qrLayer, 'qrCode')}>
          <div className="inline-flex p-2 rounded-xl" style={{ backgroundColor: theme.qrFrameColor }}>
            <QRCodeSVG
              value="https://makovote.tv/vote/penalty-call"
              size={qrLayer?.qrProps?.size ?? 120}
              level="M"
            />
          </div>
        </div>

        {/* Logo */}
        <div
          className="flex items-center gap-2"
          style={layerPosition(logoLayer, 'logo')}
        >
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-[10px]">M</span>
          </div>
          <span className="font-mono text-[10px]" style={{ color: theme.textSecondary }}>MakoVote</span>
        </div>
      </div>
    </div>
  );
}
