import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
  Plus,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  TimeCorrectionRequest,
  TimeWorkspaceDashboard,
  TimeWorkspaceEntry,
  TimeWorkspaceSession,
} from '@/lib/supabase/timeWorkspace';
import { formatWorkDuration, type TimeDaySummary } from '@/lib/timeWorkspaceModel';

export function localDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function dateLabel(value: string): string {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('fi-FI', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
}

export function dateTimeLabel(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatHours(value: number): string {
  return `${value.toLocaleString('fi-FI', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} h`;
}

export function StatusBadge({ status }: { status: TimeWorkspaceEntry['status'] }) {
  const tone = status === 'Hyväksytty'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'Hylätty'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';
  return (
    <Badge variant="outline" className={tone}>
      {status === 'Hylätty' ? 'Korjattava' : status}
    </Badge>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <Clock3 size={34} className="mx-auto text-slate-300" />
      <p className="mt-3 font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  note,
}: {
  label: string;
  value: string;
  icon: typeof Clock3;
  note?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
            {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
          </div>
          <div className="rounded-xl bg-blue-50 p-2 text-blue-700"><Icon size={18} /></div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DayDetails({ day }: { day: TimeDaySummary }) {
  return (
    <div className="mt-4 space-y-2 border-t pt-4">
      {day.entries.map((entry) => (
        <div
          key={entry.id}
          className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-[110px_1fr_100px_100px] sm:items-center"
        >
          <span className="font-mono text-slate-700">
            {entry.startTime && entry.endTime
              ? `${entry.startTime.slice(0, 5)}–${entry.endTime.slice(0, 5)}`
              : 'Ei kellonaikaa'}
          </span>
          <div>
            <p className="font-medium text-slate-950">{entry.workOrderTitle || entry.projectName}</p>
            <p className="text-xs text-slate-500">{entry.description || entry.projectName}</p>
          </div>
          <span className="font-semibold">{formatHours(entry.hours)}</span>
          <StatusBadge status={entry.status} />
        </div>
      ))}
    </div>
  );
}

export function DayCard({
  day,
  expanded,
  onToggle,
  actions,
}: {
  day: TimeDaySummary;
  expanded: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={onToggle}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-950">{day.employeeName}</h3>
              <StatusBadge status={day.status} />
              {day.locked && <Lock size={14} className="text-slate-500" />}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {dateLabel(day.date)}
              {day.startTime && day.endTime ? ` · ${day.startTime.slice(0, 5)}–${day.endTime.slice(0, 5)}` : ''}
              {day.projectNames.length > 0 ? ` · ${day.projectNames.join(' · ')}` : ''}
            </p>
            <p className="mt-2 font-semibold">
              {formatHours(day.totalHours)} · tauko {day.breakMinutes} min · ylityö {formatHours(day.overtimeHours)}
            </p>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <Button variant="ghost" size="sm" onClick={onToggle}>
              Tiedot
              <ChevronRight size={16} className={expanded ? 'ml-1 rotate-90 transition' : 'ml-1 transition'} />
            </Button>
          </div>
        </div>
        {expanded && <DayDetails day={day} />}
      </CardContent>
    </Card>
  );
}

function mapUrl(session: TimeWorkspaceSession): string {
  return `https://www.google.com/maps?q=${session.latitude},${session.longitude}`;
}

export function ActiveSessionRow({
  session,
  now,
  expanded = false,
}: {
  session: TimeWorkspaceSession;
  now: number;
  expanded?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-950">{session.employeeName}</p>
          <Badge className="border-0 bg-emerald-50 text-emerald-700">Aktiivinen</Badge>
          {session.withinGeofence === false && (
            <Badge className="border-0 bg-amber-50 text-amber-700">Sijaintipoikkeama</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {session.workOrderTitle} · {session.projectName}
        </p>
        {expanded && (
          <p className="mt-1 text-xs text-slate-500">
            Aloitettu {dateTimeLabel(session.startedAt)}{session.note ? ` · ${session.note}` : ''}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <strong className="font-mono text-xl">{formatWorkDuration(session.startedAt, now)}</strong>
        {session.latitude !== null && session.longitude !== null && (
          <a
            href={mapUrl(session)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
          >
            <MapPin size={15} /> Kartta <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

export function CorrectionList({
  requests,
  management,
  saving,
  onResolve,
}: {
  requests: TimeCorrectionRequest[];
  management: boolean;
  saving: boolean;
  onResolve: (request: TimeCorrectionRequest, decision: 'accept' | 'reject') => void;
}) {
  const openCount = requests.filter((request) => request.status === 'Avoin').length;
  return (
    <Card>
      <CardHeader><CardTitle>Korjauspyynnöt</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{request.targetName}</p>
                <Badge variant="outline">{request.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-700">{request.reason}</p>
              <p className="mt-1 text-xs text-slate-500">
                {dateLabel(request.entryDate)} · {request.projectName} · pyydetty {dateTimeLabel(request.createdAt)}
              </p>
              {request.resolutionNote && (
                <p className="mt-2 text-xs text-slate-600">Ratkaisu: {request.resolutionNote}</p>
              )}
            </div>
            {management && request.status === 'Avoin' && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={saving} onClick={() => onResolve(request, 'reject')}>
                  <XCircle size={15} className="mr-1" /> Sulje
                </Button>
                <Button size="sm" disabled={saving} onClick={() => onResolve(request, 'accept')}>
                  <CheckCircle2 size={15} className="mr-1" /> Hyväksy korjattavaksi
                </Button>
              </div>
            )}
          </div>
        ))}
        {requests.length === 0 && <EmptyState title="Korjauspyyntöjä ei ole" />}
        {management && openCount > 0 && (
          <p className="text-xs text-slate-500">
            Hyväksyminen palauttaa kirjauksen odottavaksi korjausta ja uutta käsittelyä varten.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export interface ManualForm {
  targetUserId: string;
  projectId: string;
  workOrderId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakSource: 'automatic' | 'manual' | 'none';
  breakMinutes: string;
  description: string;
}

export function emptyManualForm(userId = ''): ManualForm {
  return {
    targetUserId: userId,
    projectId: '',
    workOrderId: '',
    date: localDate(),
    startTime: '07:00',
    endTime: '15:30',
    breakSource: 'automatic',
    breakMinutes: '30',
    description: '',
  };
}

export function ManualTimeDialog({
  open,
  saving,
  management,
  dashboard,
  form,
  onFormChange,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  management: boolean;
  dashboard: TimeWorkspaceDashboard;
  form: ManualForm;
  onFormChange: (form: ManualForm) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}) {
  const selectedOrders = dashboard.workOrders.filter((order) => !form.projectId || order.projectId === form.projectId);
  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{management ? 'Lisää työaika' : 'Lisää puuttuva työaika'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {dashboard.capabilities.createForOthers && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Työntekijä</Label>
              <Select value={form.targetUserId} onValueChange={(targetUserId) => onFormChange({ ...form, targetUserId })}>
                <SelectTrigger><SelectValue placeholder="Valitse työntekijä" /></SelectTrigger>
                <SelectContent>
                  {dashboard.people.map((person) => (
                    <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Päivä</Label>
            <Input type="date" value={form.date} onChange={(event) => onFormChange({ ...form, date: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Projekti</Label>
            <Select
              value={form.projectId || 'none'}
              onValueChange={(value) => onFormChange({ ...form, projectId: value === 'none' ? '' : value, workOrderId: '' })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Valitse projekti</SelectItem>
                {dashboard.projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Työmääräys</Label>
            <Select
              value={form.workOrderId || 'none'}
              onValueChange={(value) => {
                const order = dashboard.workOrders.find((item) => item.id === value);
                onFormChange({
                  ...form,
                  workOrderId: value === 'none' ? '' : value,
                  projectId: order?.projectId ?? form.projectId,
                });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ei työmääräystä</SelectItem>
                {selectedOrders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>{order.title} · {order.projectName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Alkamisaika</Label>
            <Input type="time" value={form.startTime} onChange={(event) => onFormChange({ ...form, startTime: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Päättymisaika</Label>
            <Input type="time" value={form.endTime} onChange={(event) => onFormChange({ ...form, endTime: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Taukotapa</Label>
            <Select
              value={form.breakSource}
              onValueChange={(value: ManualForm['breakSource']) => onFormChange({ ...form, breakSource: value })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="automatic">Automaattinen sääntö</SelectItem>
                <SelectItem value="manual">Anna minuutit</SelectItem>
                <SelectItem value="none">Ei taukoa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.breakSource === 'manual' && (
            <div className="space-y-2">
              <Label>Tauko minuutteina</Label>
              <Input
                type="number"
                min={0}
                value={form.breakMinutes}
                onChange={(event) => onFormChange({ ...form, breakMinutes: event.target.value })}
              />
            </div>
          )}
          <div className="space-y-2 sm:col-span-2">
            <Label>Työn kuvaus</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(event) => onFormChange({ ...form, description: event.target.value })}
              placeholder="Mitä tehtiin ja miksi kirjaus lisätään jälkikäteen?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Peruuta</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Plus size={16} className="mr-2" />}
            Tallenna tarkistettavaksi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <AlertTriangle size={17} className="mt-0.5 shrink-0" />{message}
    </div>
  );
}
