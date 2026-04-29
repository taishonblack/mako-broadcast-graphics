import { CSSProperties, ReactNode } from 'react';
import { AssetTransformConfig } from '@/components/poll-create/polling-assets/types';

/**
 * SHARED ASSET TRANSFORM COORDINATE SYSTEM.
 *
 * Every scene asset (Question, Answer Bars, Answer Type, QR, Logo, …) MUST
 * render through this frame so that X / Y / Scale / Rotation mean the SAME
 * thing for every asset across every surface (Program, Mobile, Desktop).
 *
 * Rules guaranteed by this component:
 *   1. Outer wrapper fills the parent canvas (`absolute inset-0`).
 *   2. `transform-origin: center center` — anchor is canvas center.
 *   3. The transform (translate / rotate / scale) is applied to THIS wrapper
 *      only. Internal layout (padding, max-width, flex centering) happens
 *      INSIDE and never affects what X=0/Y=0/scale=1 means.
 *   4. Opacity + clip-path are forwarded so the inspector can crop/fade.
 *
 * Result: copying X/Y/Scale between Answer Type and Answer Bars (or any
 * other asset) lands them at the same visual position on every surface.
 */

export interface SceneAssetTransformFrameProps {
  transform?: AssetTransformConfig;
  /** Optional pointer-events override. Defaults to `none` so transformed
   *  asset frames don't swallow clicks meant for the canvas behind them. */
  pointerEvents?: CSSProperties['pointerEvents'];
  /** Additional inline styles for the inner content wrapper (NOT the
   *  transformed wrapper). Use this for asset-specific layout — never for
   *  transform values. */
  contentStyle?: CSSProperties;
  /** ClassName applied to the inner content wrapper. */
  contentClassName?: string;
  children: ReactNode;
}

export function SceneAssetTransformFrame({
  transform,
  pointerEvents = 'none',
  contentStyle,
  contentClassName,
  children,
}: SceneAssetTransformFrameProps) {
  const x = transform?.x ?? 0;
  const y = transform?.y ?? 0;
  const rot = transform?.rotation ?? 0;
  const scale = Math.max(0.25, transform?.scale ?? 1);
  const opacity = transform?.opacity ?? 1;
  const cropTop = Math.max(0, transform?.cropTop ?? 0) * 100;
  const cropRight = Math.max(0, transform?.cropRight ?? 0) * 100;
  const cropBottom = Math.max(0, transform?.cropBottom ?? 0) * 100;
  const cropLeft = Math.max(0, transform?.cropLeft ?? 0) * 100;

  return (
    <div
      className="absolute left-0 top-0 w-full h-full"
      style={{
        opacity,
        transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`,
        transformOrigin: 'center center',
        clipPath: `inset(${cropTop}% ${cropRight}% ${cropBottom}% ${cropLeft}%)`,
        pointerEvents,
      }}
    >
      <div
        className={contentClassName ?? 'absolute inset-0 flex items-center justify-center'}
        style={contentStyle}
      >
        {children}
      </div>
    </div>
  );
}