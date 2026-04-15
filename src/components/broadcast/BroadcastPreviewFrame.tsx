import { ReactNode } from 'react';
import { BroadcastCanvas } from '@/components/broadcast/BroadcastCanvas';

interface BroadcastPreviewFrameProps {
  children: ReactNode;
  showTitleSafe?: boolean;
  showActionSafe?: boolean;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

/**
 * Unified broadcast monitor frame.
 * Always renders at 16:9 using CSS aspect-ratio.
 * Wraps in a max-width container so it scales proportionally
 * regardless of parent size — keeping Draft and Dashboard previews
 * feeling like the same monitor family.
 */
export function BroadcastPreviewFrame({
  children,
  showTitleSafe = false,
  showActionSafe = false,
  showLabel = false,
  label = '1920×1080',
  className = '',
}: BroadcastPreviewFrameProps) {
  return (
    <BroadcastCanvas className={`broadcast-frame bg-mako-charcoal ${className}`}>
      {children}
      {showTitleSafe && <div className="safe-title-guide" />}
      {showActionSafe && <div className="safe-action-guide" />}
      {showLabel && (
        <div className="absolute top-2 right-2 z-50 mako-chip bg-background/80 text-muted-foreground text-[10px]">
          {label}
        </div>
      )}
    </BroadcastCanvas>
  );
}

/**
 * Constrained monitor wrapper that centers the preview and caps its max width.
 * Use `variant` to control how large the monitor appears:
 * - "operator"  — dashboard context, ~75-85% of draft size
 * - "draft"     — build workspace, larger but not unlimited
 * Both use the same BroadcastPreviewFrame inside.
 */
export function MonitorContainer({
  children,
  variant = 'draft',
  className = '',
}: {
  children: ReactNode;
  variant?: 'operator' | 'draft';
  className?: string;
}) {
  const maxW = variant === 'operator' ? 'max-w-[720px]' : 'max-w-[880px]';
  return (
    <div className={`w-full flex justify-center ${className}`}>
      <div className={`w-full ${maxW}`}>
        {children}
      </div>
    </div>
  );
}
