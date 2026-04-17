import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { GraphicLayer, LayerType } from '@/lib/layers';

interface LayerPreviewOverlayProps {
  layers: GraphicLayer[];
  selectedLayerId: LayerType | null;
  onSelectLayer: (id: LayerType) => void;
  onUpdateLayer: (id: LayerType, changes: Partial<GraphicLayer>) => void;
}

interface MeasuredRect {
  x: number; // % of overlay container
  y: number;
  w: number;
  h: number;
}

/**
 * LayerPreviewOverlay — true layer-to-rendered-asset binding.
 *
 * Instead of computing fictional zones, we look up the actual DOM node
 * inside the preview that carries `data-layer="<id>"`, measure its
 * bounding rect, and draw the selection box around its real position
 * and size. This keeps the bounding box tight on the rendered asset
 * regardless of layout, scale, or scene.
 */
export function LayerPreviewOverlay({
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
}: LayerPreviewOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverRect, setHoverRect] = useState<MeasuredRect | null>(null);
  const [selectedRect, setSelectedRect] = useState<MeasuredRect | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; layerX: number; layerY: number } | null>(null);

  /** Measure a `[data-layer="<id>"]` node inside the preview. */
  const measureLayer = useCallback((id: LayerType): MeasuredRect | null => {
    const container = containerRef.current;
    if (!container) return null;
    // Walk up to the relative parent that holds both the overlay and the preview frame.
    const parent = container.parentElement;
    if (!parent) return null;
    const node = parent.querySelector<HTMLElement>(`[data-layer="${id}"]`);
    if (!node) return null;
    const containerRect = container.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return null;
    return {
      x: ((nodeRect.left - containerRect.left) / containerRect.width) * 100,
      y: ((nodeRect.top - containerRect.top) / containerRect.height) * 100,
      w: (nodeRect.width / containerRect.width) * 100,
      h: (nodeRect.height / containerRect.height) * 100,
    };
  }, []);

  // Re-measure the selected layer whenever layers, selection, or size changes.
  useLayoutEffect(() => {
    if (!selectedLayerId) {
      setSelectedRect(null);
      return;
    }
    const measure = () => {
      const rect = measureLayer(selectedLayerId);
      setSelectedRect(rect);
    };
    measure();
    // Watch the preview parent for resize so the selection stays tight.
    const parent = containerRef.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    parent.querySelectorAll('[data-layer]').forEach((n) => ro.observe(n));
    return () => ro.disconnect();
  }, [selectedLayerId, layers, measureLayer]);

  const handleClick = (e: React.MouseEvent) => {
    if (dragging) return;
    const container = containerRef.current?.parentElement;
    if (!container) return;
    const containerRect = containerRef.current!.getBoundingClientRect();
    const clickX = e.clientX;
    const clickY = e.clientY;

    // Find topmost visible, unlocked rendered layer whose bounding rect contains the click.
    const visible = layers
      .filter((l) => l.visible && l.id !== 'background')
      .slice()
      .reverse();
    for (const layer of visible) {
      const node = container.querySelector<HTMLElement>(`[data-layer="${layer.id}"]`);
      if (!node) continue;
      const r = node.getBoundingClientRect();
      if (clickX >= r.left && clickX <= r.right && clickY >= r.top && clickY <= r.bottom) {
        onSelectLayer(layer.id);
        return;
      }
    }
    onSelectLayer('background');
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!selectedLayerId || selectedLayerId === 'background') return;
    const selectedLayer = layers.find((l) => l.id === selectedLayerId);
    if (!selectedLayer || selectedLayer.locked) return;

    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      layerX: selectedLayer.transform.x,
      layerY: selectedLayer.transform.y,
    };
  };

  // Hover hint while moving over the preview (helps users see what's selectable).
  const handleMouseMoveOverlay = (e: React.MouseEvent) => {
    if (dragStart.current) return; // dragging — skip hover tracking
    const container = containerRef.current?.parentElement;
    if (!container) return;
    const visible = layers
      .filter((l) => l.visible && l.id !== 'background')
      .slice()
      .reverse();
    for (const layer of visible) {
      const node = container.querySelector<HTMLElement>(`[data-layer="${layer.id}"]`);
      if (!node) continue;
      const r = node.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        setHoverRect(measureLayer(layer.id));
        return;
      }
    }
    setHoverRect(null);
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

      const layer = layers.find((l) => l.id === selectedLayerId);
      if (layer) {
        onUpdateLayer(selectedLayerId, {
          transform: { ...layer.transform, x: newX, y: newY },
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

  const selectedLayer = selectedLayerId ? layers.find((l) => l.id === selectedLayerId) ?? null : null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-40 cursor-crosshair"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMoveOverlay}
      onMouseLeave={() => setHoverRect(null)}
    >
      {/* Hover hint */}
      {hoverRect && (!selectedRect || hoverRect.x !== selectedRect.x || hoverRect.y !== selectedRect.y) && (
        <div
          className="absolute border border-primary/40 rounded-sm pointer-events-none"
          style={{
            left: `${hoverRect.x}%`,
            top: `${hoverRect.y}%`,
            width: `${hoverRect.w}%`,
            height: `${hoverRect.h}%`,
          }}
        />
      )}

      {/* Selection bounding box — tight around actual rendered asset */}
      {selectedLayerId && selectedLayerId !== 'background' && selectedRect && (
        <div
          className="absolute border-2 border-primary rounded-sm pointer-events-none transition-[left,top,width,height] duration-100"
          style={{
            left: `${selectedRect.x}%`,
            top: `${selectedRect.y}%`,
            width: `${selectedRect.w}%`,
            height: `${selectedRect.h}%`,
            boxShadow: '0 0 0 1px hsl(var(--primary) / 0.25), inset 0 0 0 1px hsl(var(--primary) / 0.15)',
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
          <div className="absolute -top-5 left-0 text-[9px] font-mono text-primary bg-background/90 px-1.5 py-0.5 rounded">
            {selectedLayer?.label}
          </div>
        </div>
      )}
    </div>
  );
}
