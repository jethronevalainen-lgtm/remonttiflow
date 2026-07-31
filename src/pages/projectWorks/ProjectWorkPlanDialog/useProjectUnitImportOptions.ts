import { useCallback, useEffect, useState } from 'react';

import type { ProjectUnitImportSource } from '@/lib/projectWorkPlanBuilder';
import { loadProjectWorkTargetImportOptions } from '@/lib/supabase/projectWorkTargetImport';

export interface ProjectUnitImportOptionsState {
  options: ProjectUnitImportSource[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
}

/**
 * Huoneistorekisteri ladataan kerran dialogin auetessa, jotta vaiheiden välillä
 * liikkuminen ei tee uutta hakua eikä nollaa käyttäjän valintoja.
 */
export function useProjectUnitImportOptions(input: {
  organizationId: string;
  projectId: string;
  enabled: boolean;
}): ProjectUnitImportOptionsState {
  const { organizationId, projectId, enabled } = input;
  const [options, setOptions] = useState<ProjectUnitImportSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOptions(await loadProjectWorkTargetImportOptions({ organizationId, projectId }));
    } catch (caught) {
      setOptions([]);
      setError(caught instanceof Error ? caught.message : 'Huoneistorekisterin haku epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [organizationId, projectId]);

  useEffect(() => {
    if (!enabled) {
      setOptions([]);
      setError('');
      return;
    }
    void load();
  }, [enabled, load]);

  return { options, loading, error, reload: load };
}
