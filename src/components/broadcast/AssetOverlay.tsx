import { QRCodeSVG } from 'qrcode.react';
import { QRPosition, ThemePreset } from '@/lib/types';
import { AssetTransformConfig } from '@/components/poll-create/polling-assets/types';
import { getAssetTransformStyle } from '@/lib/asset-transforms';

interface AssetOverlayProps {
  /** Show the scannable QR code overlay */
  showQR?: boolean;
  qrSlug: string;
  qrSize: number;
  qrPosition: QRPosition;
  debugVoteUrl?: string;
  /** Show the MakoVote bug/logo */
  showBranding: boolean;
  brandingPosition: QRPosition;
  theme: ThemePreset;
  qrTransform?: AssetTransformConfig;
  logoTransform?: AssetTransformConfig;
}

const PADDING = 48; // px on the 1920x1080 stage — true broadcast safe inset

function positionStyle(pos: QRPosition): React.CSSProperties {
  const v: React.CSSProperties = { position: 'absolute' };
  if (pos.startsWith('top')) v.top = PADDING; else v.bottom = PADDING;
  if (pos.endsWith('left')) v.left = PADDING; else v.right = PADDING;
  return v;
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
  debugVoteUrl,
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
        <div data-layer="qrCode" style={{ ...positionStyle(qrPosition), ...getAssetTransformStyle(qrTransform) }} className="z-30">
          <div
            className="inline-flex flex-col items-center gap-2 p-3 rounded-2xl"
            style={{ backgroundColor: theme.qrFrameColor }}
          >
            <QRCodeSVG
              value={debugVoteUrl ?? `https://makovote.app/vote/${qrSlug}`}
              size={canvasQrSize}
              level="M"
            />
            <span className="max-w-[280px] text-center font-mono text-[10px] leading-tight" style={{ color: theme.textSecondary }}>
              {debugVoteUrl ?? `https://makovote.app/vote/${qrSlug}`}
            </span>
          </div>
        </div>
      )}

      {showBranding && (
        <div
          data-layer="logo"
          style={{ ...positionStyle(brandingPosition), ...getAssetTransformStyle(logoTransform) }}
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
