import { useCallback, useRef, useState } from 'react';
import { ACTION_SAFE_INSET, PreviewGuide, PreviewOverlayState, TITLE_SAFE_INSET } from '@/lib/preview-overlays';

/**
 * Smart-alignment lines emitted by an active drag operation.
 * `x`/`y` are in % of the canvas; rendering is purely visual.
 */
export interface SmartGuide {
  axis: 'x' | 'y';
  position: number;
}

interface PreviewOverlaysProps {
  state: PreviewOverlayState;
  onAddGuide: (axis: 'x' | 'y', position: number) => void;
  onMoveGuide: (id: string, position: number) => void;
  onRemoveGuide: (id: string) => void;
  /** Smart alignment lines from active drag (rendered briefly, no input). */
  smartGuides?: SmartGuide[];
}

const RULER_THICKNESS = 16; // px

/**
 * Workspace-only overlay layer. Renders rulers, safe areas, grid,
 * crosshair, draggable custom guides and smart-alignment lines on top
 * of a 16:9 broadcast preview. Pointer events are constrained to the
 * ruler strips and existing guide hit-targets so the LayerPreviewOverlay
 * underneath continues to handle asset drag/select.
 */
export function PreviewOverlays({
  state,
  onAddGuide,
  onMoveGuide,
  onRemoveGuide,
  smartGuides = [],
}: PreviewOverlaysProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingFromRuler, setDraggingFromRuler] = useState<null | { axis: 'x' | 'y' }>(null);
  const [draftGuide, setDraftGuide] = useState<{ axis: 'x' | 'y'; position: number } | null>(null);
  const [draggingGuideId, setDraggingGuideId] = useState<string | null>(null);

  const opacity = state.overlayOpacity / 100;
  const lineColor = `hsla(199, 89%, 60%, ${0.55 * opacity})`; // muted cyan
  const subtle = `hsla(210, 25%, 75%, ${0.18 * opacity})`;
  const titleColor = `hsla(199, 89%, 65%, ${0.45 * opacity})`;
  const actionColor = `hsla(210, 25%, 80%, ${0.3 * opacity})`;
  const guideColor = `hsla(170, 80%, 55%, ${0.85 * opacity})`;
  const smartColor = `hsla(24, 95%, 60%, ${0.9 * opacity})`;

  const computeFromEvent = useCallback((e: React.PointerEvent | PointerEvent, axis: 'x' | 'y') => {
    const node = containerRef.current;
    if (!node) return 0;
    const rect = node.getBoundingClientRect();
    const ratio = axis === 'x'
      ? (e.clientX - rect.left) / rect.width
      : (e.clientY - rect.top) / rect.height;
    return Math.max(0, Math.min(100, ratio * 100));
  }, []);

  const handleRulerPointerDown = (axis: 'x' | 'y') => (e: React.PointerEvent) => {
    if (!state.guides) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDraggingFromRuler({ axis });
    setDraftGuide({ axis, position: computeFromEvent(e, axis) });

    const handleMove = (ev: PointerEvent) => {
      setDraftGuide({ axis, position: computeFromEvent(ev, axis) });
    };
    const handleUp = (ev: PointerEvent) => {
      const pos = computeFromEvent(ev, axis);
      // Only commit if released over the canvas (not back over the ruler edge)
      if (pos > 1 && pos < 99) onAddGuide(axis, pos);
      setDraggingFromRuler(null);
      setDraftGuide(null);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const handleGuidePointerDown = (guide: PreviewGuide) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingGuideId(guide.id);

    const handleMove = (ev: PointerEvent) => {
      const pos = computeFromEvent(ev, guide.axis);
      onMoveGuide(guide.id, pos);
    };
    const handleUp = (ev: PointerEvent) => {
      const pos = computeFromEvent(ev, guide.axis);
      // Drag a guide off the canvas to remove it
      if (pos < 1 || pos > 99) onRemoveGuide(guide.id);
      setDraggingGuideId(null);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  // ---- Grid lines ----
  const gridLines: { axis: 'x' | 'y'; pos: number; major: boolean }[] = [];
  if (state.grid) {
    const cols = Math.max(2, state.gridDensity);
    const rows = Math.max(2, Math.round((cols * 9) / 16));
    for (let i = 1; i < cols; i++) gridLines.push({ axis: 'x', pos: (100 / cols) * i, major: i === cols / 2 });
    for (let i = 1; i < rows; i++) gridLines.push({ axis: 'y', pos: (100 / rows) * i, major: i === Math.round(rows / 2) });
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-[45] pointer-events-none"
    >
      {/* Title Safe */}
      {state.titleSafe && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              inset: `${TITLE_SAFE_INSET}%`,
              border: `1px solid ${titleColor}`,
            }}
          />
          <span
            className="absolute font-mono uppercase pointer-events-none"
            style={{
              top: `calc(${TITLE_SAFE_INSET}% - 14px)`,
              left: `${TITLE_SAFE_INSET}%`,
              fontSize: '9px',
              letterSpacing: '0.1em',
              color: titleColor,
            }}
          >
            Title Safe
          </span>
        </>
      )}

      {/* Action Safe */}
      {state.actionSafe && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              inset: `${ACTION_SAFE_INSET}%`,
              border: `1px dashed ${actionColor}`,
            }}
          />
          <span
            className="absolute font-mono uppercase pointer-events-none"
            style={{
              top: `calc(${ACTION_SAFE_INSET}% - 14px)`,
              right: `${ACTION_SAFE_INSET}%`,
              fontSize: '9px',
              letterSpacing: '0.1em',
              color: actionColor,
            }}
          >
            Action Safe
          </span>
        </>
      )}

      {/* Grid */}
      {gridLines.map((g, i) => (
        <div
          key={`grid-${i}`}
          className="absolute pointer-events-none"
          style={
            g.axis === 'x'
              ? { left: `${g.pos}%`, top: 0, bottom: 0, width: 1, background: g.major ? lineColor : subtle }
              : { top: `${g.pos}%`, left: 0, right: 0, height: 1, background: g.major ? lineColor : subtle }
          }
        />
      ))}

      {/* Center crosshair */}
      {state.centerCrosshair && (
        <>
          <div className="absolute pointer-events-none" style={{ left: '50%', top: 0, bottom: 0, width: 1, background: lineColor }} />
          <div className="absolute pointer-events-none" style={{ top: '50%', left: 0, right: 0, height: 1, background: lineColor }} />
        </>
      )}

      {/* Custom guides */}
      {state.guides && state.customGuides.map((g) => (
        <div
          key={g.id}
          onPointerDown={handleGuidePointerDown(g)}
          className="absolute pointer-events-auto group"
          style={
            g.axis === 'x'
              ? { left: `calc(${g.position}% - 4px)`, top: 0, bottom: 0, width: 8, cursor: 'ew-resize' }
              : { top: `calc(${g.position}% - 4px)`, left: 0, right: 0, height: 8, cursor: 'ns-resize' }
          }
          title={`Drag to move · drag off canvas to remove (${g.position.toFixed(1)}%)`}
        >
          <div
            className="absolute"
            style={
              g.axis === 'x'
                ? { left: 3, top: 0, bottom: 0, width: 1, background: draggingGuideId === g.id ? smartColor : guideColor }
                : { top: 3, left: 0, right: 0, height: 1, background: draggingGuideId === g.id ? smartColor : guideColor }
            }
          />
        </div>
      ))}

      {/* Draft guide while dragging from a ruler */}
      {draftGuide && (
        <div
          className="absolute pointer-events-none"
          style={
            draftGuide.axis === 'x'
              ? { left: `${draftGuide.position}%`, top: 0, bottom: 0, width: 1, background: smartColor }
              : { top: `${draftGuide.position}%`, left: 0, right: 0, height: 1, background: smartColor }
          }
        />
      )}

      {/* Smart alignment lines (during asset drag) */}
      {smartGuides.map((s, i) => (
        <div
          key={`smart-${i}`}
          className="absolute pointer-events-none"
          style={
            s.axis === 'x'
              ? { left: `${s.position}%`, top: 0, bottom: 0, width: 1, background: smartColor, boxShadow: `0 0 6px ${smartColor}` }
              : { top: `${s.position}%`, left: 0, right: 0, height: 1, background: smartColor, boxShadow: `0 0 6px ${smartColor}` }
          }
        />
      ))}

      {/* Rulers — drawn last so they sit on top, with pointer-events to allow drag-out */}
      {state.rulers && (
        <>
          {/* Top ruler */}
          <div
            onPointerDown={handleRulerPointerDown('x')}
            className="absolute pointer-events-auto"
            style={{
              top: 0, left: 0, right: 0, height: RULER_THICKNESS,
              background: `hsla(220, 18%, 13%, ${0.85})`,
              borderBottom: `1px solid hsla(220, 14%, 22%, 1)`,
              cursor: state.guides ? 'ns-resize' : 'default',
            }}
          >
            <RulerTicks axis="x" />
          </div>
          {/* Left ruler */}
          <div
            onPointerDown={handleRulerPointerDown('y')}
            className="absolute pointer-events-auto"
            style={{
              top: 0, bottom: 0, left: 0, width: RULER_THICKNESS,
              background: `hsla(220, 18%, 13%, ${0.85})`,
              borderRight: `1px solid hsla(220, 14%, 22%, 1)`,
              cursor: state.guides ? 'ew-resize' : 'default',
            }}
          >
            <RulerTicks axis="y" />
          </div>
        </>
      )}

      {/* Cursor hint while dragging from a ruler */}
      {draggingFromRuler && (
        <div className="absolute inset-0 pointer-events-none" />
      )}
    </div>
  );
}

function RulerTicks({ axis }: { axis: 'x' | 'y' }) {
  const ticks: number[] = [];
  for (let i = 0; i <= 20; i++) ticks.push(i * 5);
  const tickColor = 'hsla(215, 15%, 55%, 0.7)';
  const labelColor = 'hsla(215, 15%, 65%, 0.85)';
  return (
    <div className="relative w-full h-full">
      {ticks.map((t) => {
        const major = t % 25 === 0;
        if (axis === 'x') {
          return (
            <div key={t} className="absolute top-0 bottom-0" style={{ left: `${t}%`, width: 1 }}>
              <div style={{ position: 'absolute', top: major ? 0 : 8, bottom: 0, width: 1, background: tickColor }} />
              {major && (
                <span style={{ position: 'absolute', top: 1, left: 3, fontSize: 8, color: labelColor, fontFamily: 'JetBrains Mono, monospace' }}>
                  {t}
                </span>
              )}
            </div>
          );
        }
        return (
          <div key={t} className="absolute left-0 right-0" style={{ top: `${t}%`, height: 1 }}>
            <div style={{ position: 'absolute', left: major ? 0 : 8, right: 0, height: 1, background: tickColor }} />
            {major && (
              <span style={{ position: 'absolute', left: 1, top: 1, fontSize: 8, color: labelColor, fontFamily: 'JetBrains Mono, monospace' }}>
                {t}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}