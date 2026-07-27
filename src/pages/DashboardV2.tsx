import ManagementLiveOperations from '@/components/dashboard/ManagementLiveOperations';
import { useViewAs } from '@/contexts/ViewAsContext';

import Dashboard from './Dashboard';

export default function DashboardV2() {
  const { effectiveRole } = useViewAs();
  if (effectiveRole === 'worker') return <Dashboard />;

  return (
    <div className="space-y-6">
      <ManagementLiveOperations />
      <Dashboard />
    </div>
  );
}
