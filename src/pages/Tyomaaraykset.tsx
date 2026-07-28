import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import TyomaarayksetLegacy from './TyomaarayksetLegacy';
import TyomaarayksetV2 from './TyomaarayksetV2';

export default function Tyomaaraykset() {
  const { canManage } = useRoleWorkspace();
  return canManage ? <TyomaarayksetV2 /> : <TyomaarayksetLegacy />;
}
