import { GraphicLayer, LayerType } from '@/lib/layers';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Eye, EyeOff, Lock, Unlock, Image, Type, BarChart3,
  QrCode, Hash, Heading, Sparkles
} from 'lucide-react';

interface LayerPanelProps {
  layers: GraphicLayer[];
  selectedLayerId: LayerType | null;
  onSelectLayer: (id: LayerType) => void;
  onToggleVisibility: (id: LayerType) => void;
  onToggleLock: (id: LayerType) => void;
}

const layerIcons: Record<LayerType, React.ElementType> = {
  background: Image,
  question: Type,
  subheadline: Heading,
  answerBars: BarChart3,
  votesText: Hash,
  qrCode: QrCode,
  logo: Sparkles,
};

export function LayerPanel({
  layers,
  selectedLayerId,
  onSelectLayer,
  onToggleVisibility,
  onToggleLock,
}: LayerPanelProps) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground font-mono uppercase mb-2 px-1">Layers</p>
      {layers.map((layer) => {
        const Icon = layerIcons[layer.id];
        const isSelected = selectedLayerId === layer.id;

        return (
          <div
            key={layer.id}
            onClick={() => onSelectLayer(layer.id)}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all group ${
              isSelected
                ? 'bg-primary/15 border border-primary/30 shadow-[0_0_8px_hsl(var(--primary)/0.15)]'
                : 'border border-transparent hover:bg-accent/30'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={`text-[11px] flex-1 truncate ${isSelected ? 'text-primary font-medium' : 'text-foreground'}`}>
              {layer.label}
            </span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ opacity: isSelected ? 1 : undefined }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                    className="p-0.5 rounded hover:bg-accent transition-colors"
                  >
                    {layer.visible
                      ? <Eye className="w-3 h-3 text-muted-foreground" />
                      : <EyeOff className="w-3 h-3 text-muted-foreground/40" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Toggle visibility</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleLock(layer.id); }}
                    className="p-0.5 rounded hover:bg-accent transition-colors"
                  >
                    {layer.locked
                      ? <Lock className="w-3 h-3 text-muted-foreground/40" />
                      : <Unlock className="w-3 h-3 text-muted-foreground" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Toggle lock</TooltipContent>
              </Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
}
