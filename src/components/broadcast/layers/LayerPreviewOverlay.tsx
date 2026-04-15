import { useState, useCallback, useRef, useEffect } from 'react';
import { GraphicLayer, LayerType, LAYER_FRAME_ZONES } from '@/lib/layers';

interface LayerPreviewOverlayProps {
  layers: GraphicLayer[];
  selectedLayerId: LayerType | null;
  onSelectLayer: (id: LayerType) => void;
  onUpdateLayer: (id: LayerType, changes: Partial<GraphicLayer>) => void;
}

function getLayerZone(layer: GraphicLayer) {
  const baseZone = LAYER_FRAME_ZONES[layer.id];
  return {
    x: layer.id === 'background' ? 0 : layer.transform.x,
    y: layer.id === 'background' ? 0 : layer.transform.y,
    w: Math.min(baseZone.w * layer.transform.scale, 100),
    h: Math.min(baseZone.h * layer.transform.scale, 100),
  };
}

export function LayerPreviewOverlay({
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
}: LayerPreviewOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; layerX: number; layerY: number } | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    if (dragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    // Find topmost visible, unlocked layer that contains the click
    const visibleLayers = layers.filter(l => l.visible && l.id !== 'background').slice().reverse();
    for (const layer of visibleLayers) {
      const zone = getLayerZone(layer);
      if (
        clickX >= zone.x && clickX <= zone.x + zone.w &&
        clickY >= zone.y && clickY <= zone.y + zone.h
      ) {
        onSelectLayer(layer.id);
        return;
      }
    }
    // Click on empty area = select background
    onSelectLayer('background');
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!selectedLayerId || selectedLayerId === 'background') return;
    const selectedLayer = layers.find(l => l.id === selectedLayerId);
    if (!selectedLayer || selectedLayer.locked) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      layerX: selectedLayer.transform.x,
      layerY: selectedLayer.transform.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStart.current || !selectedLayerId || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((e.clientX - dragStart.current.x) / rect.width) * 100;
      const dy = ((e.clientY - dragStart.current.y) / rect.height) * 100;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        setDragging(true);
      }

      const newX = Math.max(0, Math.min(100, dragStart.current.layerX + dx));
      const newY = Math.max(0, Math.min(100, dragStart.current.layerY + dy));

      const layer = layers.find(l => l.id === selectedLayerId);
      if (layer) {
        onUpdateLayer(selectedLayerId, {
          transform: { ...layer.transform, x: newX, y: newY }
        });
      }
    };

    const handleMouseUp = () => {
      dragStart.current = null;
      setTimeout(() => setDragging(false), 50);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectedLayerId, layers, onUpdateLayer]);

  const selectedLayer = selectedLayerId ? layers.find((layer) => layer.id === selectedLayerId) ?? null : null;
  const selectedZone = selectedLayer ? getLayerZone(selectedLayer) : null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-40 cursor-crosshair"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {/* Selection bounding box */}
      {selectedLayerId && selectedLayerId !== 'background' && selectedZone && (
        <div
          className="absolute border-2 border-primary/60 rounded-sm pointer-events-none transition-all duration-150"
          style={{
            left: `${selectedZone.x}%`,
            top: `${selectedZone.y}%`,
            width: `${selectedZone.w}%`,
            height: `${selectedZone.h}%`,
            boxShadow: '0 0 0 1px hsl(var(--primary) / 0.2), inset 0 0 0 1px hsl(var(--primary) / 0.1)',
          }}
        >
          {/* Corner handles */}
          {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => {
            const [vPos, hPos] = corner.split('-');
            return (
              <div
                key={corner}
                className="absolute w-2 h-2 bg-primary border border-primary-foreground rounded-sm pointer-events-auto cursor-nwse-resize"
                style={{
                  [vPos]: -4,
                  [hPos]: -4,
                }}
              />
            );
          })}
          {/* Label */}
          <div className="absolute -top-5 left-0 text-[9px] font-mono text-primary bg-background/80 px-1 rounded">
            {layers.find(l => l.id === selectedLayerId)?.label}
          </div>
        </div>
      )}
    </div>
  );
}
