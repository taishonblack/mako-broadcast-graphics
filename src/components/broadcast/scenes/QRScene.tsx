import { ThemePreset } from '@/lib/types';
import { QRCodeSVG } from 'qrcode.react';
import { AssetColorMap, AssetTransformMap } from '@/components/poll-create/polling-assets/types';
import { getAssetTransformStyle } from '@/lib/asset-transforms';

interface QRSceneProps {
  slug: string;
  theme: ThemePreset;
  enabledAssetIds?: AssetId[];
  transforms?: AssetTransformMap;
  assetColors?: AssetColorMap;
  qrVisible?: boolean;
  qrUrlVisible?: boolean;
  debugVoteUrl?: string;
}

export function QRScene({ slug, theme, enabledAssetIds, transforms, assetColors, qrVisible = true, qrUrlVisible = true, debugVoteUrl }: QRSceneProps) {
  const url = debugVoteUrl ?? `https://makovote.app/vote/${slug}`;
  const visibleAssets = new Set(enabledAssetIds ?? ['question', 'answers', 'logo']);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${theme.tintColor}, hsl(220, 25%, 6%))`,
        ...getAssetTransformStyle(transforms?.background),
      }}
    >
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 animate-scale-in-scene">
        {visibleAssets.has('question') && (
        <h1
          className="text-5xl font-bold tracking-tight"
          style={{ color: assetColors?.question?.textPrimary ?? theme.textPrimary, ...getAssetTransformStyle(transforms?.question) }}
        >
          Vote Now
        </h1>
        )}

        {visibleAssets.has('qr') && qrVisible && (
        <div
          className="p-6 rounded-3xl shadow-[0_0_60px_-10px_hsla(0,0%,100%,0.15)]"
          style={{ backgroundColor: 'hsla(0, 0%, 100%, 0.95)', ...getAssetTransformStyle(transforms?.qr) }}
        >
          <QRCodeSVG value={url} size={240} level="H" />
        </div>
        )}

        {visibleAssets.has('subheadline') && qrVisible && qrUrlVisible && (
        <p
          className="font-mono text-lg tracking-wide"
          style={{ color: assetColors?.qr?.textSecondary ?? theme.textSecondary }}
        >
          {url}
        </p>
        )}
      </div>

      {visibleAssets.has('logo') && (
      <div className="absolute bottom-8 left-8 flex items-center gap-2 opacity-50 z-20" style={getAssetTransformStyle(transforms?.logo)}>
        <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-[10px]">M</span>
        </div>
        <span className="font-mono text-[10px]" style={{ color: assetColors?.logo?.textSecondary ?? theme.textSecondary }}>MakoVote</span>
      </div>
      )}
    </div>
  );
}
