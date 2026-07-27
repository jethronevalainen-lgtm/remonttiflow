import EmployeeSupervisorAssignments from '@/components/EmployeeSupervisorAssignments';
import Henkilosto from '@/pages/Henkilosto';

export default function HenkilostoWithSupervisors() {
  return (
    <div className="space-y-6">
      <EmployeeSupervisorAssignments />
      <Henkilosto />
    </div>
  );
}
