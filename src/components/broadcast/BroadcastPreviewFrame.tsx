import { ReactNode, useState } from 'react';

interface BroadcastPreviewFrameProps {
  children: ReactNode;
  showTitleSafe?: boolean;
  showActionSafe?: boolean;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function BroadcastPreviewFrame({
  children,
  showTitleSafe = false,
  showActionSafe = false,
  showLabel = false,
  label = '1920×1080',
  className = '',
}: BroadcastPreviewFrameProps) {
  return (
    <div className={`broadcast-frame bg-mako-charcoal ${className}`}>
      {children}
      {showTitleSafe && <div className="safe-title-guide" />}
      {showActionSafe && <div className="safe-action-guide" />}
      {showLabel && (
        <div className="absolute top-2 right-2 z-50 mako-chip bg-background/80 text-muted-foreground text-[10px]">
          {label}
        </div>
      )}
    </div>
  );
}
