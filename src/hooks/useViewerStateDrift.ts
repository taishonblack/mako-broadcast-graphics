import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ViewerStateDriftInfo {
  drift: boolean;
  live_slug: string | null;
  audience_slug: string | null;
  voting_state: string | null;
  audience_state: string | null;
  active_poll_id: string | null;
  audience_poll_id: string | null;
}

/** Polls the viewer_state_drift DB function so the operator UI can warn
 *  when public_viewer_state and project_live_state disagree. The DB trigger
 *  should keep them in sync — drift means a write failed, RLS blocked the
 *  audience row, or an out-of-band update ran. */
export function useViewerStateDrift(projectId: string | null, enabled: boolean): ViewerStateDriftInfo | null {
  const [info, setInfo] = useState<ViewerStateDriftInfo | null>(null);

  useEffect(() => {
    if (!projectId || !enabled) {
      setInfo(null);
      return;
    }
    let cancelled = false;

    const check = async () => {
      const { data, error } = await supabase.rpc('viewer_state_drift' as never, {
        _project_id: projectId,
      } as never);
      if (cancelled || error || !data) return;
      setInfo(data as unknown as ViewerStateDriftInfo);
    };

    void check();
    const timer = window.setInterval(check, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [projectId, enabled]);

  return info;
}