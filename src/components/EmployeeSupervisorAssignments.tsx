import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Save, UserRoundCheck, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrganizationAdmin } from '@/hooks/useOrganizationAdmin';
import {
  listEmployeeSupervisorAssignments,
  setEmployeeSupervisor,
  type EmployeeSupervisorAssignment,
} from '@/lib/supabase/employeeSupervisors';

const NONE = 'none';

export default function EmployeeSupervisorAssignments() {
  const { currentOrg, actualRole } = useOrganization();
  const { employees } = useAppDataContext();
  const { members, loading: membersLoading } = useOrganizationAdmin();
  const [assignments, setAssignments] = useState<EmployeeSupervisorAssignment[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [supervisorUserId, setSupervisorUserId] = useState(NONE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManage = actualRole === 'admin' || actualRole === 'supervisor';
  const activeEmployees = useMemo(
    () => employees
      .filter((employee) => employee.status !== 'Eroonnut' && !employee.archivedAt)
      .sort((a, b) => a.name.localeCompare(b.name, 'fi')),
    [employees],
  );
  const supervisors = useMemo(
    () => members
      .filter((member) => member.role === 'supervisor')
      .map((member) => ({
        userId: member.userId,
        name: member.profile?.full_name || member.profile?.email || 'Nimetön työnjohtaja',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fi')),
    [members],
  );
  const supervisorName = useMemo(
    () => new Map(supervisors.map((supervisor) => [supervisor.userId, supervisor.name])),
    [supervisors],
  );
  const assignmentByEmployee = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.employeeId, assignment.supervisorUserId])),
    [assignments],
  );

  const refresh = useCallback(async () => {
    if (!currentOrg || !canManage) return;
    setLoading(true);
    try {
      setAssignments(await listEmployeeSupervisorAssignments(currentOrg.id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Esihenkilösuhteiden haku epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [canManage, currentOrg]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!employeeId) {
      setSupervisorUserId(NONE);
      return;
    }
    setSupervisorUserId(assignmentByEmployee.get(employeeId) ?? NONE);
  }, [assignmentByEmployee, employeeId]);

  const save = async () => {
    if (!currentOrg || !employeeId || !canManage) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await setEmployeeSupervisor({
        organizationId: currentOrg.id,
        employeeId,
        supervisorUserId: supervisorUserId === NONE ? null : supervisorUserId,
      });
      await refresh();
      const employee = activeEmployees.find((item) => item.id === employeeId);
      setSuccess(
        supervisorUserId === NONE
          ? `${employee?.name ?? 'Työntekijä'} jätettiin ilman nimettyä esihenkilöä.`
          : `${supervisorName.get(supervisorUserId) ?? 'Työnjohtaja'} asetettiin esihenkilöksi.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Esihenkilön tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) return null;

  return (
    <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-white shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserRoundCheck className="text-indigo-600" size={22} />
              Esihenkilösuhteet
            </CardTitle>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Valitse asentajalle tai muulle työntekijälle vastuullinen työnjohtaja. Projektikoordinaattoria ei voi valita esihenkilöksi, joten hänelle ei muodostu alaisia.
            </p>
          </div>
          <Badge className="w-fit border-0 bg-indigo-100 text-indigo-700">
            <UsersRound size={14} className="mr-1" /> {assignments.length} nimettyä suhdetta
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div className="space-y-2">
            <Label>Asentaja / työntekijä</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Valitse työntekijä" /></SelectTrigger>
              <SelectContent>
                {activeEmployees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name} · {employee.role || 'Työntekijä'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Esihenkilö</Label>
            <Select value={supervisorUserId} onValueChange={setSupervisorUserId} disabled={!employeeId || membersLoading}>
              <SelectTrigger><SelectValue placeholder="Valitse esihenkilö" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Ei nimettyä esihenkilöä</SelectItem>
                {supervisors.map((supervisor) => (
                  <SelectItem key={supervisor.userId} value={supervisor.userId}>{supervisor.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => void save()} disabled={!employeeId || saving || loading} className="gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Tallenna esihenkilö
          </Button>
        </div>

        {employeeId && (
          <p className="text-xs text-slate-500">
            Nykyinen esihenkilö: {assignmentByEmployee.get(employeeId)
              ? supervisorName.get(assignmentByEmployee.get(employeeId)!) ?? 'Työnjohtaja'
              : 'ei nimetty'}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
