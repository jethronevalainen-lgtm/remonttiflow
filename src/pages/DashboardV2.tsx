import AnnouncementSection from '@/components/announcements/AnnouncementCards';
import ManagementLiveOperations from '@/components/dashboard/ManagementLiveOperations';
import { useViewAs } from '@/contexts/ViewAsContext';

import Dashboard from './Dashboard';

export default function DashboardV2() {
  const { effectiveRole } = useViewAs();

  return (
    <div className="space-y-6">
      <AnnouncementSection
        placement="dashboard"
        title="Ajankohtaiset tiedotteet"
        description="Sinulle kohdistetut voimassa olevat tiedotteet. Kaikki tiedotteet löytyvät Viestintä-osiosta."
        compact
        limit={4}
      />
      {effectiveRole !== 'worker' && <ManagementLiveOperations />}
      <Dashboard />
    </div>
  );
}
