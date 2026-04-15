import { ReactNode, useEffect, useRef, useState } from 'react';

export const BROADCAST_CANVAS_WIDTH = 1920;
export const BROADCAST_CANVAS_HEIGHT = 1080;

interface BroadcastCanvasProps {
  children: ReactNode;
  className?: string;
}

export function BroadcastCanvas({ children, className = '' }: BroadcastCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateScale = () => {
      const nextScale = node.clientWidth / BROADCAST_CANVAS_WIDTH;
      setScale(nextScale || 1);
    };

    updateScale();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(updateScale);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={`relative w-full overflow-hidden aspect-video ${className}`}>
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: `${BROADCAST_CANVAS_WIDTH}px`,
          height: `${BROADCAST_CANVAS_HEIGHT}px`,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}