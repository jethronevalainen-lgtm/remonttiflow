import { BriefcaseBusiness, Loader2, MapPin, UsersRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { OrganizationPerson, ProjectMembership } from '@/lib/supabase/workManagement';
import type { Project, WorkAssignmentScope, WorkOrderPriority, WorkOrderStatus } from '@/types';
import type { WorkOrderFormValues } from './workOrderForm';

const NO_PROJECT = '__standalone__';
const STATUSES: WorkOrderStatus[] = ['Avoin', 'Käynnissä', 'Odottaa', 'Valmis', 'Peruttu'];
const PRIORITIES: WorkOrderPriority[] = ['Korkea', 'Normaali', 'Matala'];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

interface Props {
  open: boolean;
  editing: boolean;
  saving: boolean;
  errors: string[];
  form: WorkOrderFormValues;
  projects: Project[];
  people: OrganizationPerson[];
  projectMemberships: ProjectMembership[];
  onChange: (form: WorkOrderFormValues) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function WorkOrderDialog({
  open,
  editing,
  saving,
  errors,
  form,
  projects,
  people,
  projectMemberships,
  onChange,
  onClose,
  onSave,
}: Props) {
  const projectMemberIds = new Set(
    projectMemberships
      .filter((membership) => membership.projectId === form.projectId)
      .map((membership) => membership.userId),
  );
  const availablePeople = form.projectId
    ? people.filter((person) => projectMemberIds.has(person.userId))
    : people;

  const changeProject = (value: string) => {
    if (value === NO_PROJECT) {
      onChange({
        ...form,
        projectId: '',
        assignmentScope: 'people',
        assigneeUserIds: form.assigneeUserIds.filter((userId) => people.some((person) => person.userId === userId)),
      });
      return;
    }

    const memberIds = new Set(
      projectMemberships
        .filter((membership) => membership.projectId === value)
        .map((membership) => membership.userId),
    );
    onChange({
      ...form,
      projectId: value,
      assigneeUserIds: form.assigneeUserIds.filter((userId) => memberIds.has(userId)),
    });
  };

  const toggleAssignee = (userId: string, checked: boolean) => {
    onChange({
      ...form,
      assigneeUserIds: checked
        ? [...new Set([...form.assigneeUserIds, userId])]
        : form.assigneeUserIds.filter((id) => id !== userId),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Muokkaa työmääräystä' : 'Uusi työmääräys'}</DialogTitle>
        </DialogHeader>

        {errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errors.map((item) => <p key={item}>{item}</p>)}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="work-title">Tehtävä *</Label>
            <Input
              id="work-title"
              value={form.title}
              onChange={(event) => onChange({ ...form, title: event.target.value })}
              placeholder="Esim. vaihda rikkoutunut ovenpainike"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Projekti</Label>
            <Select value={form.projectId || NO_PROJECT} onValueChange={changeProject}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>Ei projektia – yksittäinen työ</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              Projekti on valinnainen. Yksittäinen työmääräys voi olla huolto, tarkistus, materiaalihaku, asiakaskäynti tai muu erillinen tehtävä.
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="work-location">Kohde tai sijainti</Label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                id="work-location"
                value={form.location}
                onChange={(event) => onChange({ ...form, location: event.target.value })}
                placeholder="Osoite, huoneisto, tila tai muu tarkenne"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="work-due">Määräaika</Label>
            <Input
              id="work-due"
              type="date"
              value={form.dueDate}
              onChange={(event) => onChange({ ...form, dueDate: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="work-type">Työlaji</Label>
            <Input
              id="work-type"
              value={form.type}
              onChange={(event) => onChange({ ...form, type: event.target.value })}
              placeholder="Esim. huolto, kirvesmiestyö"
            />
          </div>

          <div className="space-y-2">
            <Label>Prioriteetti</Label>
            <Select
              value={form.priority}
              onValueChange={(priority: WorkOrderPriority) => onChange({ ...form, priority })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tila</Label>
            <Select
              value={form.status}
              onValueChange={(status: WorkOrderStatus) => onChange({ ...form, status })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Kohdistus</Label>
            <Select
              value={form.assignmentScope}
              onValueChange={(assignmentScope: WorkAssignmentScope) => onChange({
                ...form,
                assignmentScope: form.projectId ? assignmentScope : 'people',
                assigneeUserIds: assignmentScope === 'project_team' ? [] : form.assigneeUserIds,
              })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="people">Nimetyt henkilöt</SelectItem>
                {form.projectId && <SelectItem value="project_team">Koko projektitiimi</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {form.assignmentScope === 'people' && (
            <div className="space-y-2 sm:col-span-2">
              <Label>{form.projectId ? 'Vastuuhenkilöt projektitiimistä *' : 'Vastuuhenkilöt organisaatiosta *'}</Label>
              <div className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                {availablePeople.map((person) => (
                  <label key={person.userId} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-50">
                    <Checkbox
                      checked={form.assigneeUserIds.includes(person.userId)}
                      onCheckedChange={(checked) => toggleAssignee(person.userId, checked === true)}
                    />
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                      {initials(person.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{person.name}</span>
                      <span className="block truncate text-xs text-slate-500">{person.email || person.role}</span>
                    </span>
                  </label>
                ))}
                {availablePeople.length === 0 && (
                  <p className="text-sm text-slate-500 sm:col-span-2">
                    {form.projectId
                      ? 'Projektilla ei ole vielä tiimin jäseniä. Lisää heidät ensin Projektit ja tiimit -näkymässä.'
                      : 'Organisaatiossa ei ole työmääräykseen valittavia käyttäjiä.'}
                  </p>
                )}
              </div>
            </div>
          )}

          {form.assignmentScope === 'project_team' && (
            <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 sm:col-span-2">
              <UsersRound size={18} className="mt-0.5 shrink-0" />
              <p>Tehtävä näkyy koko valitulle projektitiimille. Tiimissä on nyt <strong>{projectMemberIds.size}</strong> jäsentä.</p>
            </div>
          )}

          {!form.projectId && (
            <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 sm:col-span-2">
              <BriefcaseBusiness size={18} className="mt-0.5 shrink-0" />
              <p>Tämä tallennetaan itsenäisenä työmääräyksenä eikä se vaikuta projektien aikatauluihin, tiimeihin tai raportointiin.</p>
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="work-description">Työohje</Label>
            <Textarea
              id="work-description"
              value={form.description}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
              rows={5}
              placeholder="Kerro tehtävän rajaus, laatuvaatimukset, tarvikkeet ja tarvittavat tarkistukset."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Peruuta</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
            Tallenna työmääräys
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
