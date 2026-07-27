import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import NotificationSettingsCard from '@/components/admin/NotificationSettingsCard';
import { useOrganization } from '@/contexts/OrganizationContext';
import HallintaV2 from '@/pages/HallintaV2';

export default function HallintaV3() {
  const { currentOrg } = useOrganization();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const showError = (message: string) => {
    setSuccess(null);
    setError(message);
  };

  const showSuccess = (message: string) => {
    setError(null);
    setSuccess(message);
  };

  return (
    <div className="space-y-6">
      <HallintaV2 />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {currentOrg && (
        <NotificationSettingsCard
          organizationId={currentOrg.id}
          onError={showError}
          onSuccess={showSuccess}
        />
      )}
    </div>
  );
}
