import ClockEntryQuickCreate from './timeEntries/ClockEntryQuickCreate';
import Tuntikirjaukset from './Tuntikirjaukset';

export default function TuntikirjauksetV2() {
  return (
    <div className="space-y-6">
      <ClockEntryQuickCreate />
      <Tuntikirjaukset />
    </div>
  );
}
