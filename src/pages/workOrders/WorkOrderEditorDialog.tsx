import { useEffect, useState } from 'react';
import {
  BellRing,
  BriefcaseBusiness,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
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
import { useProjectLocations } from '@/hooks/useProjectLocations';
import type { OrganizationPerson, ProjectMembership } from '@/lib/supabase/workManagement';
import type { Project, WorkAssignmentScope, WorkOrderPriority, WorkOrderStatus } from '@/types';
import type { OccupancyStatus, WorkOrderFormValues } from './workOrderForm';

const NO_VALUE = '__none__';
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
const STEPS = [
  { id: 1, label: 'Työ ja kohde' },
  { id: 2, label: 'Tekijät ja aika' },
  { id: 3, label: 'Ohjeet' },
] as const;

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

export default function WorkOrderEditorDialog({
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
  const [step, setStep] = useState(1);
  const { buildings, stairwells, units, error: locationError } = useProjectLocations();

  useEffect(() => {
    if (open) setStep(1);
  }, [open, editing]);

  const projectMemberIds = new Set(
    projectMemberships
      .filter((membership) => membership.projectId === form.projectId)
      .map((membership) => membership.userId),
  );
  const availablePeople = form.projectId
    ? people.filter((person) => projectMemberIds.has(person.userId))
    : people;
  const availableBuildings = buildings.filter((building) => building.projectId === form.projectId);
  const availableStairwells = stairwells.filter((stairwell) => (
    stairwell.projectId === form.projectId
    && (!form.buildingId || stairwell.buildingId === form.buildingId)
  ));
  const availableUnits = units.filter((unit) => (
    unit.projectId === form.projectId
    && (!form.buildingId || !unit.buildingId || unit.buildingId === form.buildingId)
    && (!form.stairwellId || unit.stairwellId === form.stairwellId)
  ));

  const changeProject = (value: string) => {
    const projectId = value === NO_VALUE ? '' : value;
    const memberIds = new Set(
      projectMemberships
        .filter((membership) => membership.projectId === projectId)
        .map((membership) => membership.userId),
    );
    onChange({
      ...form,
      projectId,
      buildingId: '',
      stairwellId: '',
      unitId: '',
      assignmentScope: projectId ? form.assignmentScope : 'people',
      assigneeUserIds: form.assigneeUserIds.filter((userId) => (
        projectId ? memberIds.has(userId) : people.some((person) => person.userId === userId)
      )),
    });
  };

  const changeBuilding = (value: string) => {
    onChange({
      ...form,
      buildingId: value === NO_VALUE ? '' : value,
      stairwellId: '',
      unitId: '',
    });
  };

  const changeStairwell = (value: string) => {
    const stairwellId = value === NO_VALUE ? '' : value;
    const stairwell = stairwells.find((item) => item.id === stairwellId);
    onChange({
      ...form,
      buildingId: stairwell?.buildingId || form.buildingId,
      stairwellId,
      unitId: '',
    });
  };

  const changeUnit = (value: string) => {
    const unitId = value === NO_VALUE ? '' : value;
    const unit = units.find((item) => item.id === unitId);
    const stairwell = unit?.stairwellId
      ? stairwells.find((item) => item.id === unit.stairwellId)
      : undefined;
    onChange({
      ...form,
      buildingId: unit?.buildingId || stairwell?.buildingId || form.buildingId,
      stairwellId: unit?.stairwellId || form.stairwellId,
      unitId,
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

  const canContinue = step !== 1 || Boolean(form.title.trim());

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Muokkaa työmääräystä' : 'Uusi työmääräys'}</DialogTitle>
        </DialogHeader>

        <ol className="grid grid-cols-3 gap-2" aria-label="Työmääräyksen vaiheet">
          {STEPS.map((item) => (
            <li
              key={item.id}
              className={`rounded-xl border px-2 py-3 text-center text-xs font-semibold sm:text-sm ${
                item.id === step
                  ? 'border-orange-300 bg-orange-50 text-orange-800'
                  : item.id < step
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-500'
              }`}
              aria-current={item.id === step ? 'step' : undefined}
            >
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide">
                {item.id} / 3
              </span>
              {item.label}
            </li>
          ))}
        </ol>

        {errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {errors.map((item) => <p key={item}>{item}</p>)}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="work-title">Tehtävä *</Label>
                <Input
                  id="work-title"
                  autoFocus
                  value={form.title}
                  onChange={(event) => onChange({ ...form, title: event.target.value })}
                  placeholder="Esim. kylpyhuoneen kalusteasennus"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Projekti</Label>
                <Select value={form.projectId || NO_VALUE} onValueChange={changeProject}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VALUE}>Ei projektia – yksittäinen työ</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.projectId && availableBuildings.length > 0 && (
                <div className="space-y-2">
                  <Label>Rakennus</Label>
                  <Select value={form.buildingId || NO_VALUE} onValueChange={changeBuilding}>
                    <SelectTrigger><SelectValue placeholder="Valitse rakennus" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_VALUE}>Ei valintaa</SelectItem>
                      {availableBuildings.map((building) => (
                        <SelectItem key={building.id} value={building.id}>
                          {building.name}{building.address ? ` – ${building.address}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.projectId && availableStairwells.length > 0 && (
                <div className="space-y-2">
                  <Label>Rappu</Label>
                  <Select value={form.stairwellId || NO_VALUE} onValueChange={changeStairwell}>
                    <SelectTrigger><SelectValue placeholder="Valitse rappu" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_VALUE}>Ei valintaa</SelectItem>
                      {availableStairwells.map((stairwell) => (
                        <SelectItem key={stairwell.id} value={stairwell.id}>{stairwell.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.projectId && availableUnits.length > 0 && (
                <div className="space-y-2">
                  <Label>Asunto tai tila</Label>
                  <Select value={form.unitId || NO_VALUE} onValueChange={changeUnit}>
                    <SelectTrigger><SelectValue placeholder="Valitse asunto tai tila" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_VALUE}>Ei valintaa</SelectItem>
                      {availableUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.unitCode}{unit.floor ? ` · kerros ${unit.floor}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className={`space-y-2 ${form.projectId && availableUnits.length > 0 ? '' : 'sm:col-span-2'}`}>
                <Label htmlFor="work-location-detail">
                  {form.projectId ? 'Huone tai työkohde' : 'Kohde tai sijainti'}
                </Label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="work-location-detail"
                    value={form.locationDetail}
                    onChange={(event) => onChange({
                      ...form,
                      locationDetail: event.target.value,
                      location: event.target.value,
                    })}
                    placeholder={form.projectId ? 'Esim. kylpyhuone' : 'Osoite, tila tai muu tarkenne'}
                    className="pl-9"
                  />
                </div>
              </div>
              {locationError && (
                <p className="text-sm text-amber-700 sm:col-span-2">
                  Sijaintirekisteriä ei voitu ladata. Voit silti käyttää vapaata kohdetarkennetta.
                </p>
              )}
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
                <div className="space-y-2 sm:col-span-2">
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
            </section>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <section className="space-y-4">
              <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label>{form.projectId ? 'Vastuuhenkilöt projektitiimistä *' : 'Vastuuhenkilöt organisaatiosta *'}</Label>
                  <div className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                    {availablePeople.map((person) => (
                      <label key={person.userId} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-50">
                        <Checkbox
                          checked={form.assigneeUserIds.includes(person.userId)}
                          onCheckedChange={(checked) => toggleAssignee(person.userId, checked === true)}
                        />
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                          {initials(person.name)}
                        </span>
                        <span className="min-w-0 break-words">
                          <span className="block text-sm font-medium">{person.name}</span>
                          <span className="block text-xs text-slate-500">{ROLE_LABELS[person.role]}</span>
                        </span>
                      </label>
                    ))}
                    {availablePeople.length === 0 && (
                      <p className="text-sm text-slate-500 sm:col-span-2">
                        {form.projectId
                          ? 'Projektilla ei ole vielä tiimin jäseniä. Lisää tiimi ennen työn kohdistamista.'
                          : 'Organisaatiossa ei ole työmääräykseen valittavia käyttäjiä.'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {form.assignmentScope === 'project_team' && (
                <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  <UsersRound size={18} className="mt-0.5 shrink-0" />
                  <p>Tehtävä näkyy koko projektitiimille. Tiimissä on nyt <strong>{projectMemberIds.size}</strong> jäsentä.</p>
                </div>
              )}
            </section>

            <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <CalendarClock size={20} className="mt-0.5 shrink-0 text-blue-700" />
                <div>
                  <h3 className="font-semibold text-blue-950">Työn aikataulu</h3>
                  <p className="mt-1 text-xs leading-5 text-blue-800">
                    Valittu työjakso muodostaa vastuuhenkilöille resurssivarauksen.
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
                  <Label htmlFor="work-planned-end">Suunniteltu valmis</Label>
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

              <details className="rounded-xl border border-blue-200 bg-white p-4">
                <summary className="cursor-pointer font-semibold text-blue-950">Aikataulun lisäasetukset</summary>
                <div className="mt-4 space-y-4">
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
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                              checked ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-500'
                            }`}
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
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 p-3">
                    <Checkbox
                      checked={form.calendarSyncEnabled}
                      onCheckedChange={(checked) => onChange({ ...form, calendarSyncEnabled: checked === true })}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">Näytä resurssikalenterissa</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        Vastuu- ja aikamuutokset päivittävät kalenterin automaattisesti.
                      </span>
                    </span>
                  </label>
                </div>
              </details>
            </section>

            {!form.projectId && (
              <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <BriefcaseBusiness size={18} className="mt-0.5 shrink-0" />
                <p>Tämä tallennetaan itsenäisenä työnä ja näkyy valittujen henkilöiden resurssikalenterissa.</p>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Home size={20} className="mt-0.5 shrink-0 text-amber-700" />
                <div>
                  <h3 className="font-semibold text-amber-950">Kohteen käyttö ja aloitus</h3>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    Nämä tiedot näkyvät työn tekijälle ennen työn aloittamista.
                  </p>
                </div>
              </div>
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
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white p-3">
                <Checkbox
                  checked={form.residentNotificationRequired}
                  onCheckedChange={(checked) => onChange({ ...form, residentNotificationRequired: checked === true })}
                />
                <BellRing size={17} className="mt-0.5 shrink-0 text-amber-700" />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Asukkaalle tai käyttäjälle ilmoitettava ennen aloitusta</span>
                  <span className="mt-1 block text-xs text-slate-500">Merkintä nostetaan tekijälle näkyvästi esiin.</span>
                </span>
              </label>
              <div className="space-y-2">
                <Label htmlFor="work-start-constraints">Milloin ja millä ehdoilla työn saa aloittaa?</Label>
                <Textarea
                  id="work-start-constraints"
                  value={form.startConstraints}
                  onChange={(event) => onChange({ ...form, startConstraints: event.target.value })}
                  rows={3}
                  placeholder="Esim. materiaalien saavuttua tai purkuluvan varmistuttua"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="work-access-notes">Pääsy, avaimet ja kohdeohjeet</Label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-3 text-slate-400" />
                  <Textarea
                    id="work-access-notes"
                    value={form.accessNotes}
                    onChange={(event) => onChange({ ...form, accessNotes: event.target.value })}
                    rows={3}
                    placeholder="Avainten nouto, ovikoodi tai yhteydenotto ennen saapumista"
                    className="pl-9"
                  />
                </div>
              </div>
            </section>

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

            <details className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer font-semibold text-slate-800">Muut tiedot</summary>
              <div className="mt-4 space-y-2">
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
            </details>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((current) => current - 1)} disabled={saving}>
                <ChevronLeft size={16} className="mr-1" /> Edellinen
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Peruuta</Button>
            {step < 3 ? (
              <Button onClick={() => setStep((current) => current + 1)} disabled={!canContinue || saving}>
                Seuraava <ChevronRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button onClick={onSave} disabled={saving}>
                {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
                {editing ? 'Tallenna muutokset' : 'Luo työmääräys'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
