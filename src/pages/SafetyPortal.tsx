import { useViewAs } from '@/contexts/ViewAsContext';
import SafetyObservationPortal from '@/pages/SafetyObservationPortal';
import Tyoturvallisuus from '@/pages/Tyoturvallisuus';

export default function SafetyPortal() {
  const { effectiveRole } = useViewAs();
  return effectiveRole === 'admin' || effectiveRole === 'supervisor'
    ? <Tyoturvallisuus />
    : <SafetyObservationPortal />;
}
