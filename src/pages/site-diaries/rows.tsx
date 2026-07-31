import { useState } from 'react';
import { CloudSun, Save, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  updateWorkItem,
  updateWorkforceRow,
  upsertWeatherObservation,
  type SiteDiaryWeatherObservation,
  type SiteDiaryWorkItem,
  type SiteDiaryWorkforceRow,
  type WorkItemState,
} from '@/lib/supabase/siteDiaries';
import { WORKFORCE_LABELS, WORK_ITEM_LABELS, numberOrUndefined } from './labels';

export function WeatherEditor({ item, userId, disabled, onSaved }: {
  item: SiteDiaryWeatherObservation;
  userId: string;
  disabled: boolean;
  onSaved: () => Promise<void>;
}) {
  const [temperature, setTemperature] = useState(item.temperatureC?.toString() ?? '');
  const [condition, setCondition] = useState(item.weatherCondition ?? '');
  const [wind, setWind] = useState(item.windSpeedMs?.toString() ?? '');
  const [gust, setGust] = useState(item.windGustMs?.toString() ?? '');
  const [impact, setImpact] = useState(item.workImpact ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await upsertWeatherObservation({
        id: item.id,
        diaryId: item.diaryId,
        userId,
        observationTime: item.observationTime,
        temperatureC: numberOrUndefined(temperature),
        weatherCondition: condition,
        windSpeedMs: numberOrUndefined(wind),
        windGustMs: numberOrUndefined(gust),
        workImpact: impact,
        source: item.source === 'automatic' ? 'corrected' : item.source,
      });
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold"><CloudSun className="size-4 text-primary" /> Klo {item.observationTime.slice(0, 5)}</div>
        <Badge variant="outline">{item.source === 'automatic' ? 'Automaattinen' : item.source === 'corrected' ? 'Korjattu' : 'Havainto'}</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1"><Label>Lämpötila °C</Label><Input type="number" step="0.1" value={temperature} onChange={(event) => setTemperature(event.target.value)} disabled={disabled} /></div>
        <div className="space-y-1 lg:col-span-2"><Label>Säätila</Label><Input value={condition} onChange={(event) => setCondition(event.target.value)} placeholder="Pouta, sade…" disabled={disabled} /></div>
        <div className="space-y-1"><Label>Tuuli m/s</Label><Input type="number" step="0.1" min="0" value={wind} onChange={(event) => setWind(event.target.value)} disabled={disabled} /></div>
        <div className="space-y-1"><Label>Puuska m/s</Label><Input type="number" step="0.1" min="0" value={gust} onChange={(event) => setGust(event.target.value)} disabled={disabled} /></div>
        <div className="space-y-1 sm:col-span-2 lg:col-span-5"><Label>Vaikutus työntekoon</Label><Input value={impact} onChange={(event) => setImpact(event.target.value)} placeholder="Ei vaikutusta / nostotyö keskeytetty…" disabled={disabled} /></div>
      </div>
      {!disabled && <div className="mt-3 flex justify-end"><Button size="sm" variant="outline" onClick={() => void save()} disabled={saving}><Save className="mr-2 size-4" />{saving ? 'Tallennetaan…' : 'Tallenna havainto'}</Button></div>}
    </div>
  );
}

export function WorkforceRow({ row, disabled, onSaved, onDelete }: {
  row: SiteDiaryWorkforceRow;
  disabled: boolean;
  onSaved: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [headcount, setHeadcount] = useState(String(row.headcount));
  const [notes, setNotes] = useState(row.notes ?? '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await updateWorkforceRow(row.id, { headcount: Math.max(0, Number(headcount) || 0), notes });
      await onSaved();
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1.5fr)_100px_minmax(0,2fr)_auto] sm:items-end">
      <div><p className="font-semibold">{WORKFORCE_LABELS[row.category]}</p><p className="text-sm text-text-secondary">{[row.companyName, row.trade].filter(Boolean).join(' · ') || 'Ei tarkennusta'}</p></div>
      <div className="space-y-1"><Label>Henkilöä</Label><Input type="number" min="0" step="1" value={headcount} onChange={(event) => setHeadcount(event.target.value)} disabled={disabled} /></div>
      <div className="space-y-1"><Label>Lisätieto</Label><Input value={notes} onChange={(event) => setNotes(event.target.value)} disabled={disabled} /></div>
      {!disabled && <div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => void save()} disabled={saving} aria-label="Tallenna"><Save className="size-4" /></Button><Button size="icon" variant="ghost" className="text-red-600" onClick={() => void onDelete()} aria-label="Poista"><Trash2 className="size-4" /></Button></div>}
    </div>
  );
}

export function WorkItemRow({ item, disabled, onSaved, onDelete }: {
  item: SiteDiaryWorkItem;
  disabled: boolean;
  onSaved: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [state, setState] = useState<WorkItemState>(item.phaseState);
  const [progress, setProgress] = useState(item.progressPercent?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await updateWorkItem(item.id, {
        phaseState: state,
        progressPercent: numberOrUndefined(progress),
        completedAt: state === 'completed' ? item.completedAt ?? new Date().toISOString() : undefined,
      });
      await onSaved();
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rounded-xl border border-slate-200 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><p className="font-semibold">{item.title}</p><p className="text-sm text-text-secondary">{[item.location, item.responsibleParty].filter(Boolean).join(' · ') || 'Ei sijainti- tai tekijätietoa'}</p>{item.notes && <p className="mt-2 text-sm">{item.notes}</p>}</div>
        <Badge variant="outline">{WORK_ITEM_LABELS[item.phaseState]}</Badge>
      </div>
      {!disabled && <div className="mt-3 grid gap-3 sm:grid-cols-[180px_130px_auto] sm:items-end"><div className="space-y-1"><Label>Tila</Label><Select value={state} onValueChange={(value: WorkItemState) => setState(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(WORK_ITEM_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Valmius %</Label><Input type="number" min="0" max="100" value={progress} onChange={(event) => setProgress(event.target.value)} /></div><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => void save()} disabled={saving}><Save className="mr-2 size-4" />Tallenna</Button><Button size="icon" variant="ghost" className="text-red-600" onClick={() => void onDelete()} aria-label="Poista"><Trash2 className="size-4" /></Button></div></div>}
    </div>
  );
}
