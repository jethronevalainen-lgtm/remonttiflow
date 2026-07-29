import {
  BellRing,
  BriefcaseBusiness,
  CalendarClock,
  Clock3,
  Home,
  KeyRound,
  Link2,
  Loader2,
  MapPin,
  UsersRound,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ROLE_LABELS } from '@/contexts/AuthContext';
import type { OrganizationPerson, ProjectMembership } from '@/lib/supabase/workManagement';
import type { Project, WorkAssignmentScope, WorkOrderPriority, WorkOrderStatus } from '@/types';
import type { OccupancyStatus, WorkOrderFormValues } from './workOrderForm';

const NO_PROJECT = '__standalone__';
const STATUSES: WorkOrderStatus[] = ['Avoin', 'Käynnissä', 'Odottaa', 'Valmis', 'Peruttu'];
const PRIORITIES: WorkOrderPriority[] = ['Korkea', 'Normaali', 'Matala'];
const WEEKDAYS = [
  { value: 1, label: 'Ma' },
  { value: 2, label: 'Ti' },
  { value: 3, label: 'Ke' },
  { value: 4, label: 'To' },
  { value: 5, label: 'Pe' },
  { value: 6, label: 'La' },
  { value: 7, label: 'Su' },
];

const OCCUPANCY_OPTIONS: Array<{ value: OccupancyStatus; label: string }> = [
  { value: 'unknown', label: 'Ei tiedossa' },
  { value: 'occupied', label: 'Asuttu työn aikana' },
  { value: 'vacant', label: 'Tyhjä / asumaton' },
  { value: 'partly_occupied', label: 'Osittain käytössä' },
];

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

  const toggleWeekday = (weekday: number, checked: boolean) => {
    const next = checked
      ? [...new Set([...form.plannedWeekdays, weekday])].sort((a, b) => a - b)
      : form.plannedWeekdays.filter((item) => item !== weekday);
    onChange({ ...form, plannedWeekdays: next });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Muokkaa työmääräystä' : 'Uusi työmääräys'}</DialogTitle>
        </DialogHeader>

        {errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errors.map((item) => <p key={item}>{item}</p>)}
          </div>
        )}

        <div className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="work-title">Tehtävä *</Label>
              <Input
                id="work-title"
                value={form.title}
                onChange={(event) => onChange({ ...form, title: event.target.value })}
                placeholder="Esim. huoneistoremontti tai rikkoutuneen ovenpainikkeen vaihto"
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
                Projekti on valinnainen. Myös itsenäinen työ voidaan aikatauluttaa resurssikalenteriin.
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
          </section>

          <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <CalendarClock size={20} className="mt-0.5 shrink-0 text-blue-700" />
              <div>
                <h3 className="font-semibold text-blue-950">Työn aikataulu ja resurssikalenteri</h3>
                <p className="mt-1 text-xs leading-5 text-blue-800">
                  Työmääräys muodostaa vastuuhenkilöille kalenterivaraukset valituille työpäiville. Määräaika säilyy erillisenä sitovana takarajana.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="work-planned-start">Työn saa aloittaa</Label>
                <Input
                  id="work-planned-start"
                  type="date"
                  value={form.plannedStartDate}
                  onChange={(event) => onChange({
                    ...form,
                    plannedStartDate: event.target.value,
                    plannedEndDate: form.plannedEndDate || event.target.value,
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="work-planned-end">Suunniteltu valmistuminen</Label>
                <Input
                  id="work-planned-end"
                  type="date"
                  min={form.plannedStartDate || undefined}
                  value={form.plannedEndDate}
                  onChange={(event) => onChange({ ...form, plannedEndDate: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="work-due">Viimeistään valmis</Label>
                <Input
                  id="work-due"
                  type="date"
                  min={form.plannedEndDate || form.plannedStartDate || undefined}
                  value={form.dueDate}
                  onChange={(event) => onChange({ ...form, dueDate: event.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="work-start-time">Päivittäinen aloitusaika</Label>
                <div className="relative">
                  <Clock3 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="work-start-time"
                    type="time"
                    value={form.plannedStartTime}
                    onChange={(event) => onChange({ ...form, plannedStartTime: event.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="work-end-time">Päivittäinen päättymisaika</Label>
                <div className="relative">
                  <Clock3 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="work-end-time"
                    type="time"
                    value={form.plannedEndTime}
                    onChange={(event) => onChange({ ...form, plannedEndTime: event.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Työpäivät</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((weekday) => {
                  const checked = form.plannedWeekdays.includes(weekday.value);
                  return (
                    <label
                      key={weekday.value}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${checked ? 'border-blue-300 bg-white text-blue-800' : 'border-slate-200 bg-white/60 text-slate-500'}`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleWeekday(weekday.value, value === true)}
                      />
                      {weekday.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-white p-3">
              <Checkbox
                checked={form.calendarSyncEnabled}
                onCheckedChange={(checked) => onChange({ ...form, calendarSyncEnabled: checked === true })}
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">Näytä työ resurssikalenterissa</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Vastuuhenkilön tai työjakson muutokset päivittävät kalenterin automaattisesti. Peruttu työ poistuu kalenterista.
                </span>
              </span>
            </label>
          </section>

          <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <Home size={20} className="mt-0.5 shrink-0 text-amber-700" />
              <div>
                <h3 className="font-semibold text-amber-950">Kohteen käyttö, aloitusehdot ja viitteet</h3>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Nämä tiedot näkyvät työmääräyksellä, jotta asentaja tietää milloin ja millä ehdoilla kohteessa voidaan työskennellä.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Onko huoneisto tai tila käytössä?</Label>
                <Select
                  value={form.occupancyStatus}
                  onValueChange={(occupancyStatus: OccupancyStatus) => onChange({ ...form, occupancyStatus })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OCCUPANCY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="work-reference">Työn viite</Label>
                <div className="relative">
                  <Link2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="work-reference"
                    value={form.workReference}
                    onChange={(event) => onChange({ ...form, workReference: event.target.value })}
                    placeholder="Tilausnumero, vikailmoitus tai muu viite"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white p-3">
              <Checkbox
                checked={form.residentNotificationRequired}
                onCheckedChange={(checked) => onChange({ ...form, residentNotificationRequired: checked === true })}
              />
              <BellRing size={17} className="mt-0.5 shrink-0 text-amber-700" />
              <span>
                <span className="block text-sm font-semibold text-slate-900">Asukkaalle tai tilan käyttäjälle on ilmoitettava ennen aloitusta</span>
                <span className="mt-1 block text-xs text-slate-500">Merkintä näkyy työmääräyksen kohdetiedoissa.</span>
              </span>
            </label>

            <div className="space-y-2">
              <Label htmlFor="work-start-constraints">Milloin ja millä ehdoilla työn saa aloittaa?</Label>
              <Textarea
                id="work-start-constraints"
                value={form.startConstraints}
                onChange={(event) => onChange({ ...form, startConstraints: event.target.value })}
                rows={3}
                placeholder="Esim. aloitus vasta asukasilmoituksen jälkeen, materiaalien saavuttua tai purkuluvan varmistuttua"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="work-access-notes">Pääsy, avaimet ja muut kohdeohjeet</Label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-3 text-slate-400" />
                <Textarea
                  id="work-access-notes"
                  value={form.accessNotes}
                  onChange={(event) => onChange({ ...form, accessNotes: event.target.value })}
                  rows={3}
                  placeholder="Avainten nouto, ovikoodi, yhteydenotto ennen saapumista, suojaukset tai muut käytännön ohjeet"
                  className="pl-9"
                />
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
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

            {editing && (
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
            )}

            <div className={`space-y-2 ${editing ? '' : 'sm:col-span-2'}`}>
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
          </section>

          {form.assignmentScope === 'people' && (
            <section className="space-y-2">
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
                      <span className="block truncate text-xs text-slate-500">{ROLE_LABELS[person.role]}</span>
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
            </section>
          )}

          {form.assignmentScope === 'project_team' && (
            <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              <UsersRound size={18} className="mt-0.5 shrink-0" />
              <p>
                Tehtävä ja sen kalenterivaraukset näkyvät koko valitulle projektitiimille. Tiimissä on nyt <strong>{projectMemberIds.size}</strong> jäsentä.
              </p>
            </div>
          )}

          {!form.projectId && (
            <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <BriefcaseBusiness size={18} className="mt-0.5 shrink-0" />
              <p>
                Tämä tallennetaan itsenäisenä työmääräyksenä. Se ei muuta projektin vaiheita, mutta valittu työjakso siirtyy vastuuhenkilöiden resurssikalenteriin.
              </p>
            </div>
          )}

          <section className="space-y-2">
            <Label htmlFor="work-description">Työohje</Label>
            <Textarea
              id="work-description"
              value={form.description}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
              rows={5}
              placeholder="Kerro tehtävän rajaus, laatuvaatimukset, tarvikkeet ja tarvittavat tarkistukset."
            />
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Peruuta</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
            {editing ? 'Tallenna muutokset' : 'Luo työmääräys'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
