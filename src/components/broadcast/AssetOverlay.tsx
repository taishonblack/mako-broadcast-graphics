import { CSSProperties } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QRPosition, ThemePreset } from '@/lib/types';
import { AssetTransformConfig } from '@/components/poll-create/polling-assets/types';

interface AssetOverlayProps {
  /** Show the scannable QR code overlay */
  showQR?: boolean;
  qrSlug: string;
  qrSize: number;
  qrPosition: QRPosition;
  /** Show the MakoVote bug/logo */
  showBranding: boolean;
  brandingPosition: QRPosition;
  theme: ThemePreset;
  qrTransform?: AssetTransformConfig;
  logoTransform?: AssetTransformConfig;
}

const PADDING = 48; // px on the 1920x1080 stage — true broadcast safe inset

function positionStyle(pos: QRPosition): CSSProperties {
  const v: CSSProperties = { position: 'absolute' };
  if (pos.startsWith('top')) v.top = PADDING; else v.bottom = PADDING;
  if (pos.endsWith('left')) v.left = PADDING; else v.right = PADDING;
  return v;
}

function buildTransformStyle(transform?: AssetTransformConfig): CSSProperties {
  if (!transform) return {};

  const scale = Math.max(0.25, transform.scale);
  const visibleScaleX = Math.max(0.05, 1 - (transform.cropLeft + transform.cropRight));
  const visibleScaleY = Math.max(0.05, 1 - (transform.cropTop + transform.cropBottom));

  return {
    opacity: transform.opacity,
    transform: `translate(${transform.x}px, ${transform.y}px) rotate(${transform.rotation}deg) scale(${scale * visibleScaleX}, ${scale * visibleScaleY})`,
    transformOrigin: 'center center',
  };
}

/**
 * Renders QR + bug at fixed broadcast positions, independent of scene content.
 * Sized in canvas pixels (the AssetOverlay sits inside BroadcastCanvas's 1920x1080 stage).
 */
export function AssetOverlay({
  showQR = false,
  qrSlug,
  qrSize,
  qrPosition,
  showBranding,
  brandingPosition,
  theme,
  qrTransform,
  logoTransform,
}: AssetOverlayProps) {
  // Scale the operator-panel pixel value (60-200) to broadcast-canvas px (≈3x).
  // Operator slider says "120px" meaning ~120px on a 1080p output.
  const canvasQrSize = qrSize;

  return (
    <>
      {showQR && (
        <div data-layer="qrCode" style={{ ...positionStyle(qrPosition), ...buildTransformStyle(qrTransform) }} className="z-30">
          <div
            className="inline-flex p-3 rounded-2xl"
            style={{ backgroundColor: theme.qrFrameColor }}
          >
            <QRCodeSVG
              value={`https://makovote.tv/vote/${qrSlug}`}
              size={canvasQrSize}
              level="M"
            />
          </div>
        </div>
      )}

      {showBranding && (
        <div
          data-layer="logo"
          style={{ ...positionStyle(brandingPosition), ...buildTransformStyle(logoTransform) }}
          className="z-30 flex items-center gap-2 opacity-70"
        >
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">M</span>
          </div>
          <span
            className="font-mono text-xs tracking-wide"
            style={{ color: theme.textSecondary }}
          >
            MakoVote
          </span>
        </div>
      )}
    </>
  );
}
