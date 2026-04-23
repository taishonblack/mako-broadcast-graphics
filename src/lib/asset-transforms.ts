import { CSSProperties } from 'react';
import { AssetTransformConfig } from '@/components/poll-create/polling-assets/types';

export function getAssetTransformStyle(transform?: AssetTransformConfig): CSSProperties {
  if (!transform) return {};

  return {
    opacity: transform.opacity,
    transform: `translate(${transform.x}px, ${transform.y}px) rotate(${transform.rotation}deg) scale(${Math.max(0.25, transform.scale)})`,
    transformOrigin: 'center center',
    clipPath: `inset(${Math.max(0, transform.cropTop) * 100}% ${Math.max(0, transform.cropRight) * 100}% ${Math.max(0, transform.cropBottom) * 100}% ${Math.max(0, transform.cropLeft) * 100}%)`,
  };
}