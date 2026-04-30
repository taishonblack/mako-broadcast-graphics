import { QRCodeSVG } from 'qrcode.react';
import { QRPosition, ThemePreset } from '@/lib/types';
import { AssetTransformConfig } from '@/components/poll-create/polling-assets/types';
import { SceneAssetTransformFrame } from '@/components/broadcast/scenes/SceneAssetTransformFrame';

interface AssetOverlayProps {
  /** Show the scannable QR code overlay */
  showQR?: boolean;
  qrSlug: string;
  qrSize: number;
  qrPosition: QRPosition;
  debugVoteUrl?: string;
  showQrUrl?: boolean;
  /** Show the MakoVote bug/logo */
  showBranding: boolean;
  brandingPosition: QRPosition;
  theme: ThemePreset;
  qrTransform?: AssetTransformConfig;
  logoTransform?: AssetTransformConfig;
}

// QR + Logo render through SceneAssetTransformFrame so X=0/Y=0 means dead
// center of the canvas — same coordinate origin as every other asset.
// Quick-placement buttons in the inspector write the offsets needed to
// land the asset at a corner; this overlay just respects the transform.

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
  showQrUrl = true,
  showBranding,
  brandingPosition,
  theme,
  qrTransform,
  logoTransform,
}: AssetOverlayProps) {
  // Suppress unused-var warning for the legacy corner props — they are kept
  // in the prop signature so older call sites compile, but corner anchoring
  // is now expressed through the transform offset.
  void qrPosition;
  void brandingPosition;
  const canvasQrSize = qrSize;

  return (
    <>
      {showQR && (
        <div data-layer="qrCode" className="absolute inset-0 z-30">
          <SceneAssetTransformFrame transform={qrTransform}>
            <div
              className="inline-flex flex-col items-center gap-2 p-3 rounded-2xl"
              style={{ backgroundColor: theme.qrFrameColor }}
            >
              <QRCodeSVG
                value={debugVoteUrl ?? `https://makovote.app/vote/${qrSlug}`}
                size={canvasQrSize}
                level="M"
              />
              {showQrUrl && (
                <span className="max-w-[280px] text-center font-mono text-[10px] leading-tight" style={{ color: theme.textSecondary }}>
                  {debugVoteUrl ?? `https://makovote.app/vote/${qrSlug}`}
                </span>
              )}
            </div>
          </SceneAssetTransformFrame>
        </div>
      )}

      {showBranding && (
        <div data-layer="logo" className="absolute inset-0 z-30">
          <SceneAssetTransformFrame transform={logoTransform}>
            <div className="flex items-center gap-2 opacity-70">
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
          </SceneAssetTransformFrame>
        </div>
      )}
    </>
  );
}
