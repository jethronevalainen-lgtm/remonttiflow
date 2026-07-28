import { hasPermission } from '@/auth/permissions';
import { useViewAs } from '@/contexts/ViewAsContext';
import SafetyWorkspace from '@/pages/SafetyWorkspace';

export default function SafetyPortal() {
  const { effectiveRole } = useViewAs();
  const canReadSafety = hasPermission(effectiveRole, 'safety.read.all')
    || hasPermission(effectiveRole, 'safety.read.project')
    || hasPermission(effectiveRole, 'safety.read.own')
    || hasPermission(effectiveRole, 'safety.create');

  return canReadSafety ? <SafetyWorkspace /> : null;
}
