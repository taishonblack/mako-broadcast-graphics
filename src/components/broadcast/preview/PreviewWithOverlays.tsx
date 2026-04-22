import { ReactNode } from 'react';
import { BroadcastPreviewFrame } from '@/components/broadcast/BroadcastPreviewFrame';
import { PreviewOverlayToolbar } from '@/components/broadcast/preview/PreviewOverlayToolbar';
import { PreviewOverlays, SmartGuide } from '@/components/broadcast/preview/PreviewOverlays';
import { usePreviewOverlays } from '@/lib/preview-overlays';

interface PreviewWithOverlaysProps {
  children: ReactNode;
  /** Slot for the LayerPreviewOverlay (Graphics mode only). Receives the
   *  overlay state so it can use snap targets / report smart guides. */
  layerOverlaySlot?: (api: ReturnType<typeof usePreviewOverlays>) => ReactNode;
  /** Smart-alignment guides to draw above the asset overlay during drag. */
  smartGuides?: SmartGuide[];
  /** Show the chip toolbar at the top-right of the frame. */
  showToolbar?: boolean;
  /** Position the toolbar absolutely inside the frame (default) or below it. */
  toolbarPlacement?: 'inside-top-right' | 'above';
  /** Optional text label rendered in the frame corner. */
  showLabel?: boolean;
  label?: string;
  /** Pass through resolved api so parents can read state if needed. */
  onApiReady?: (api: ReturnType<typeof usePreviewOverlays>) => void;
}

/**
 * Standardized broadcast preview surface for operator-facing screens.
 * Mounts the overlay toolbar, the workspace overlays (rulers/guides/grid/safe)
 * and an optional layer manipulation overlay slot. Output (`/output/:id`) MUST
 * NOT use this component — it stays clean.
 */
export function PreviewWithOverlays({
  children,
  layerOverlaySlot,
  smartGuides,
  showToolbar = true,
  toolbarPlacement = 'inside-top-right',
  showLabel = false,
  label,
  onApiReady,
}: PreviewWithOverlaysProps) {
  const api = usePreviewOverlays();
  onApiReady?.(api);

  return (
    <div className="relative w-full">
      {showToolbar && toolbarPlacement === 'above' && (
        <div className="flex justify-end mb-2">
          <PreviewOverlayToolbar
            state={api.state}
            onToggle={api.toggle}
            onUpdate={api.update}
            onResetGuides={api.resetGuides}
          />
        </div>
      )}
      <div className="relative">
        <BroadcastPreviewFrame showLabel={showLabel} label={label}>
          {children}
        </BroadcastPreviewFrame>
        {layerOverlaySlot?.(api)}
        <PreviewOverlays
          state={api.state}
          onAddGuide={api.addGuide}
          onMoveGuide={api.moveGuide}
          onRemoveGuide={api.removeGuide}
          smartGuides={smartGuides}
        />
        {showToolbar && toolbarPlacement === 'inside-top-right' && (
          <div className="absolute top-2 right-2 z-[60]">
            <PreviewOverlayToolbar
              state={api.state}
              onToggle={api.toggle}
              onUpdate={api.update}
              onResetGuides={api.resetGuides}
            />
          </div>
        )}
      </div>
    </div>
  );
}