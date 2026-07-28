import { Building2, FolderKanban, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type {
  CustomerAccessAssignment,
  CustomerAccessCatalogItem,
  CustomerAccessScope,
} from '@/lib/customerPortalAccess';

interface CustomerAccessPickerProps {
  catalog: CustomerAccessCatalogItem[];
  value: CustomerAccessAssignment[];
  onChange: (value: CustomerAccessAssignment[]) => void;
  disabled?: boolean;
}

function assignmentFor(
  value: CustomerAccessAssignment[],
  customerId: string,
): CustomerAccessAssignment | undefined {
  return value.find((item) => item.customerId === customerId);
}

export default function CustomerAccessPicker({
  catalog,
  value,
  onChange,
  disabled = false,
}: CustomerAccessPickerProps) {
  const toggleCustomer = (customer: CustomerAccessCatalogItem, enabled: boolean) => {
    if (!enabled) {
      onChange(value.filter((item) => item.customerId !== customer.customerId));
      return;
    }
    onChange([
      ...value,
      {
        customerId: customer.customerId,
        customerName: customer.customerName,
        accessScope: 'all_projects',
        projectIds: [],
      },
    ]);
  };

  const updateScope = (customerId: string, accessScope: CustomerAccessScope) => {
    onChange(value.map((item) => item.customerId === customerId
      ? {
        ...item,
        accessScope,
        projectIds: accessScope === 'all_projects' ? [] : item.projectIds,
      }
      : item));
  };

  const toggleProject = (customerId: string, projectId: string, enabled: boolean) => {
    onChange(value.map((item) => {
      if (item.customerId !== customerId) return item;
      const projectIds = new Set(item.projectIds);
      if (enabled) projectIds.add(projectId);
      else projectIds.delete(projectId);
      return { ...item, projectIds: [...projectIds] };
    }));
  };

  if (catalog.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Asiakkaita ei ole vielä luotu. Luo tilaaja ensin Asiakkaat-näkymässä.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Tilaaja-asiakkuudet *</Label>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Käyttäjä voi kuulua useaan asiakkuuteen. Valitse jokaiselle asiakkuudelle pysyvä tai projektikohtainen tilaajaoikeus.
        </p>
      </div>
      <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
        {catalog.map((customer) => {
          const assignment = assignmentFor(value, customer.customerId);
          const selected = Boolean(assignment);
          return (
            <div key={customer.customerId} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selected}
                  disabled={disabled}
                  onCheckedChange={(checked) => toggleCustomer(customer, checked === true)}
                  aria-label={`Valitse ${customer.customerName}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{customer.customerName}</p>
                    <Badge variant="outline" className="gap-1"><Building2 size={12} /> {customer.projects.length} projektia</Badge>
                  </div>
                  {selected && assignment && (
                    <div className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label>Tilaajatyypin laajuus</Label>
                        <Select
                          value={assignment.accessScope}
                          disabled={disabled}
                          onValueChange={(scope: CustomerAccessScope) => updateScope(customer.customerId, scope)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all_projects">Pysyvä tilaaja — kaikki nykyiset ja tulevat projektit</SelectItem>
                            <SelectItem value="selected_projects">Projektikohtainen tilaaja — vain valitut projektit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {assignment.accessScope === 'all_projects' && (
                        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
                          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-700" />
                          Käyttäjä näkee tämän asiakkuuden nykyiset ja myöhemmin luotavat projektit sekä voi tehdä uusia projektipyyntöjä.
                        </div>
                      )}

                      {assignment.accessScope === 'selected_projects' && (
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2"><FolderKanban size={15} /> Sallitut projektit</Label>
                          {customer.projects.length === 0 ? (
                            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Asiakkuudella ei ole vielä projekteja.</p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {customer.projects.map((project) => (
                                <label key={project.id} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                                  <Checkbox
                                    checked={assignment.projectIds.includes(project.id)}
                                    disabled={disabled}
                                    onCheckedChange={(checked) => toggleProject(customer.customerId, project.id, checked === true)}
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium text-slate-900">{project.name}</span>
                                    <span className="block truncate text-xs text-slate-500">{project.location || project.status || 'Ei sijaintia'}</span>
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
