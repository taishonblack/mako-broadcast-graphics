import { renderChart } from '@/lib/render-chart';
import { ThemePreset, PollOption, TemplateName } from '@/lib/types';
import { QRCodeSVG } from 'qrcode.react';
import { GraphicLayer, LayerType } from '@/lib/layers';

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
    display: layer.visible ? undefined : 'none',
    transition: 'opacity 0.2s, transform 0.2s',
  };
}

export function FullscreenScene({ question, options, totalVotes, colors, theme, template = 'horizontal-bar', layers }: FullscreenSceneProps) {
  const bgLayer = getLayer(layers, 'background');
  const questionLayer = getLayer(layers, 'question');
  const barsLayer = getLayer(layers, 'answerBars');
  const votesLayer = getLayer(layers, 'votesText');
  const qrLayer = getLayer(layers, 'qrCode');
  const logoLayer = getLayer(layers, 'logo');

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

      <div className="relative z-20 flex flex-col items-center w-full">
        <div
          className="text-center mb-8 px-16"
          style={{
            ...layerStyle(questionLayer),
            maxWidth: questionLayer?.textProps ? `${questionLayer.textProps.maxWidth}%` : undefined,
          }}
        >
          <h1
            className="font-bold leading-tight"
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

        <div className="w-full max-w-2xl px-16" style={layerStyle(barsLayer)}>
          {renderChart({ template, options, totalVotes, colors })}
        </div>

        <div className="mt-8" style={layerStyle(votesLayer)}>
          <span
            className="font-mono"
            style={{
              color: theme.textSecondary,
              fontSize: votesLayer?.textProps?.fontSize ? `${votesLayer.textProps.fontSize}px` : '14px',
            }}
          >
            {totalVotes.toLocaleString()} total votes
          </span>
        </div>
      </div>

      {/* QR */}
      <div
        className="absolute bottom-8 right-8 z-20"
        style={layerStyle(qrLayer)}
      >
        <div className="p-2 rounded-xl" style={{ backgroundColor: 'hsla(0, 0%, 100%, 0.95)' }}>
          <QRCodeSVG
            value="https://makovote.tv/vote/penalty-call"
            size={qrLayer?.qrProps?.size ? qrLayer.qrProps.size * 0.6 : 80}
            level="M"
          />
        </div>
      </div>

      {/* Bug */}
      <div
        className="absolute bottom-8 left-8 flex items-center gap-2 z-20"
        style={layerStyle(logoLayer)}
      >
        <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-[10px]">M</span>
        </div>
        <span className="font-mono text-[10px]" style={{ color: theme.textSecondary }}>MakoVote</span>
      </div>
    </div>
  );
}
