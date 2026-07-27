import { useState } from 'react';

import TravelAllowanceQuickCreate from '@/components/travel/TravelAllowanceQuickCreate';
import Matkakulut from './Matkakulut';

export default function MatkakulutV2() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="space-y-6">
      <TravelAllowanceQuickCreate onSaved={() => setRefreshKey((value) => value + 1)} />
      <Matkakulut key={refreshKey} />
    </div>
  );
}
