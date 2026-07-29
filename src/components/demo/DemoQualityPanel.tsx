import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Loader2,
  MessageSquareWarning,
  Monitor,
  RotateCcw,
  Save,
  Smartphone,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ROLE_LABELS } from '@/contexts/AuthContext';
import {
  DEMO_ROLE_GUIDES,
  DEMO_ROLES,
  demoReviewExpectedCount,
  type DemoFindingSeverity,
  type DemoReviewDevice,
  type DemoReviewStatus,
  type DemoRole,
  type DemoScenario,
} from '@/lib/demoQuality';
import {
  createDemoReviewFinding,
  deleteDemoReviewFinding,
  listDemoReviewFindings,
  listDemoReviewItems,
  saveDemoReviewItem,
  setDemoReviewFindingStatus,
  type DemoReviewFinding,
  type DemoReviewItem,
} from '@/lib/supabase/demoReview';

interface Props {
  organizationId: string;
  scenario: DemoScenario;
  datasetVersion: number;
}

const DEVICES: Array<{ id: DemoReviewDevice; label: string; icon: typeof Monitor }> = [
  { id: 'desktop', label: 'Tietokone', icon: Monitor },
  { id: 'mobile', label: 'Mobiili', icon: Smartphone },
];

const STATUS_OPTIONS: Array<{
  id: DemoReviewStatus;
  label: string;
  icon: typeof Circle;
  className: string;
}> = [
  { id: 'not_tested', label: 'Ei testattu', icon: Circle, className: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50' },
  { id: 'passed', label: 'Hyväksytty', icon: CheckCircle2, className: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' },
  { id: 'failed', label: 'Virhe', icon: AlertCircle, className: 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100' },
];

function itemKey(role: DemoRole, device: DemoReviewDevice, checkKey: string): string {
  return `${role}:${device}:${checkKey}`;
}

function formatDateTime(value: string): string {
  if (!value) return 'Ei vielä';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function severityBadge(severity: DemoFindingSeverity) {
  if (severity === 'critical') return 'border-red-300 bg-red-50 text-red-800';
  if (severity === 'warning') return 'border-amber-300 bg-amber-50 text-amber-800';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

function severityLabel(severity: DemoFindingSeverity) {
  if (severity === 'critical') return 'Kriittinen';
  if (severity === 'warning') return 'Huomio';
  return 'Info';
}

export default function DemoQualityPanel({ organizationId, scenario, datasetVersion }: Props) {
  const [selectedRole, setSelectedRole] = useState<DemoRole>('supervisor');
  const [selectedDevice, setSelectedDevice] = useState<DemoReviewDevice>('desktop');
  const [items, setItems] = useState<DemoReviewItem[]>([]);
  const [findings, setFindings] = useState<DemoReviewFinding[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [findingTitle, setFindingTitle] = useState('');
  const [findingDescription, setFindingDescription] = useState('');
  const [findingPath, setFindingPath] = useState('');
  const [findingSeverity, setFindingSeverity] = useState<DemoFindingSeverity>('warning');
  const [savingFinding, setSavingFinding] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextItems, nextFindings] = await Promise.all([
        listDemoReviewItems({ organizationId, scenario, datasetVersion }),
        listDemoReviewFindings({ organizationId, scenario, datasetVersion }),
      ]);
      setItems(nextItems);
      setFindings(nextFindings);
      setNotes(Object.fromEntries(nextItems.map((item) => [itemKey(item.role, item.device, item.checkKey), item.note])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Demotarkistusten lataaminen epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [datasetVersion, organizationId, scenario]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const itemMap = useMemo(
    () => new Map(items.map((item) => [itemKey(item.role, item.device, item.checkKey), item])),
    [items],
  );
  const selectedGuide = DEMO_ROLE_GUIDES[selectedRole];
  const visibleFindings = findings.filter((finding) => finding.role === selectedRole);
  const passed = items.filter((item) => item.status === 'passed').length;
  const failed = items.filter((item) => item.status === 'failed').length;
  const tested = passed + failed;
  const expected = demoReviewExpectedCount();
  const completion = expected > 0 ? Math.round(tested / expected * 100) : 0;

  const replaceItem = (next: DemoReviewItem) => {
    setItems((previous) => [
      ...previous.filter((item) => item.id !== next.id && itemKey(item.role, item.device, item.checkKey) !== itemKey(next.role, next.device, next.checkKey)),
      next,
    ]);
  };

  const persistItem = async (checkKey: string, status: DemoReviewStatus, note: string) => {
    const key = itemKey(selectedRole, selectedDevice, checkKey);
    setSavingKey(key);
    setError(null);
    setSuccess(null);
    try {
      const next = await saveDemoReviewItem({
        organizationId,
        scenario,
        datasetVersion,
        role: selectedRole,
        device: selectedDevice,
        checkKey,
        status,
        note,
      });
      replaceItem(next);
      setSuccess('Tarkistustulos tallennettiin.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tarkistustuloksen tallennus epäonnistui.');
    } finally {
      setSavingKey(null);
    }
  };

  const addFinding = async () => {
    if (!findingTitle.trim()) {
      setError('Havainnon otsikko on pakollinen.');
      return;
    }
    setSavingFinding(true);
    setError(null);
    setSuccess(null);
    try {
      const finding = await createDemoReviewFinding({
        organizationId,
        scenario,
        datasetVersion,
        role: selectedRole,
        device: selectedDevice,
        severity: findingSeverity,
        title: findingTitle,
        description: findingDescription,
        pagePath: findingPath,
      });
      setFindings((previous) => [finding, ...previous]);
      setFindingTitle('');
      setFindingDescription('');
      setFindingPath('');
      setSuccess('Havainto kirjattiin.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Havainnon tallennus epäonnistui.');
    } finally {
      setSavingFinding(false);
    }
  };

  const toggleFinding = async (finding: DemoReviewFinding) => {
    setSavingKey(`finding:${finding.id}`);
    setError(null);
    try {
      const next = await setDemoReviewFindingStatus(finding.id, finding.status === 'open' ? 'resolved' : 'open');
      setFindings((previous) => previous.map((item) => item.id === next.id ? next : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Havainnon tilan päivitys epäonnistui.');
    } finally {
      setSavingKey(null);
    }
  };

  const removeFinding = async (findingId: string) => {
    setSavingKey(`finding:${findingId}`);
    setError(null);
    try {
      await deleteDemoReviewFinding(findingId);
      setFindings((previous) => previous.filter((finding) => finding.id !== findingId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Havainnon poistaminen epäonnistui.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="space-y-4" aria-labelledby="demo-quality-heading">
      <div>
        <h2 id="demo-quality-heading" className="text-xl font-bold text-slate-950">Roolien laadunvarmistus</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Merkitse jokainen tarkistus erikseen tietokoneella ja mobiilissa. Tulokset säilyvät skenaario- ja demodataversiokohtaisesti.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Tarkistettu', value: `${tested}/${expected}`, detail: `${completion} %`, tone: 'text-slate-950' },
          { label: 'Hyväksytty', value: passed, detail: 'toimii odotetusti', tone: 'text-emerald-700' },
          { label: 'Virheitä', value: failed, detail: 'vaatii korjauksen', tone: 'text-red-700' },
          { label: 'Avoimia havaintoja', value: findings.filter((item) => item.status === 'open').length, detail: 'tässä skenaariossa', tone: 'text-amber-700' },
        ].map((metric) => (
          <Card key={metric.label} className="border-slate-200 shadow-sm">
            <CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p><p className={`mt-2 text-2xl font-bold ${metric.tone}`}>{metric.value}</p><p className="mt-1 text-xs text-slate-500">{metric.detail}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="gap-4 border-b">
          <CardTitle className="flex items-center gap-2"><ClipboardCheck size={20} /> Tarkistuslista</CardTitle>
          <div className="flex flex-wrap gap-2">
            {DEMO_ROLES.map((role) => (
              <Button key={role} size="sm" variant={selectedRole === role ? 'default' : 'outline'} onClick={() => setSelectedRole(role)}>{ROLE_LABELS[role]}</Button>
            ))}
          </div>
          <div className="flex gap-2">
            {DEVICES.map((device) => (
              <Button key={device.id} size="sm" variant={selectedDevice === device.id ? 'secondary' : 'outline'} className="gap-2" onClick={() => setSelectedDevice(device.id)}><device.icon size={15} />{device.label}</Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          {loading && <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={17} className="animate-spin" /> Ladataan tarkistuksia…</div>}
          {!loading && selectedGuide.checks.map((check) => {
            const key = itemKey(selectedRole, selectedDevice, check.key);
            const existing = itemMap.get(key);
            const status = existing?.status ?? 'not_tested';
            const note = notes[key] ?? existing?.note ?? '';
            return (
              <div key={check.key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0"><p className="font-semibold text-slate-950">{check.label}</p><p className="mt-1 font-mono text-xs text-slate-500">{check.path}</p></div>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={savingKey === key}
                        onClick={() => void persistItem(check.key, option.id, note)}
                        className={`flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${status === option.id ? option.className : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'}`}
                      >
                        <option.icon size={14} /> {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1"><Label htmlFor={`note-${key}`} className="text-xs">Huomio</Label><Input id={`note-${key}`} value={note} onChange={(event) => setNotes((previous) => ({ ...previous, [key]: event.target.value }))} placeholder="Kirjaa poikkeama, epäselvyys tai testauksen rajaus" /></div>
                  <Button size="sm" variant="outline" className="gap-2" disabled={savingKey === key} onClick={() => void persistItem(check.key, status, note)}>{savingKey === key ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Tallenna huomio</Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b"><CardTitle className="flex items-center gap-2"><MessageSquareWarning size={20} /> Havaintoloki · {ROLE_LABELS[selectedRole]}</CardTitle></CardHeader>
        <CardContent className="space-y-5 p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="finding-title">Otsikko *</Label><Input id="finding-title" value={findingTitle} onChange={(event) => setFindingTitle(event.target.value)} placeholder="Esim. mobiilivalikko peittää toimintopainikkeen" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="finding-severity">Vakavuus</Label><select id="finding-severity" value={findingSeverity} onChange={(event) => setFindingSeverity(event.target.value as DemoFindingSeverity)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="info">Info</option><option value="warning">Huomio</option><option value="critical">Kriittinen</option></select></div>
              <div className="space-y-2"><Label htmlFor="finding-path">Näkymä tai reitti</Label><Input id="finding-path" value={findingPath} onChange={(event) => setFindingPath(event.target.value)} placeholder="/tyomaaraykset" /></div>
            </div>
            <div className="space-y-2 lg:col-span-2"><Label htmlFor="finding-description">Kuvaus</Label><Textarea id="finding-description" value={findingDescription} onChange={(event) => setFindingDescription(event.target.value)} rows={3} placeholder="Mitä tapahtui, mitä odotit ja miten virhe voidaan toistaa?" /></div>
          </div>
          <Button onClick={() => void addFinding()} disabled={savingFinding} className="gap-2">{savingFinding ? <Loader2 size={16} className="animate-spin" /> : <MessageSquareWarning size={16} />} Kirjaa havainto</Button>

          <div className="space-y-3">
            {visibleFindings.map((finding) => (
              <div key={finding.id} className={`rounded-xl border p-4 ${finding.status === 'resolved' ? 'border-slate-200 bg-slate-50 opacity-75' : 'border-amber-200 bg-amber-50/50'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{finding.title}</h3><Badge variant="outline" className={severityBadge(finding.severity)}>{severityLabel(finding.severity)}</Badge><Badge variant="outline">{finding.device === 'mobile' ? 'Mobiili' : 'Tietokone'}</Badge>{finding.status === 'resolved' && <Badge className="border-0 bg-emerald-600 text-white">Ratkaistu</Badge>}</div><p className="mt-1 text-xs text-slate-500">{finding.pagePath || 'Reittiä ei määritetty'} · {formatDateTime(finding.createdAt)}</p>{finding.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{finding.description}</p>}</div>
                  <div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" className="gap-2" disabled={savingKey === `finding:${finding.id}`} onClick={() => void toggleFinding(finding)}><RotateCcw size={14} />{finding.status === 'open' ? 'Merkitse ratkaistuksi' : 'Avaa uudelleen'}</Button><Button size="sm" variant="ghost" className="text-red-600" disabled={savingKey === `finding:${finding.id}`} onClick={() => void removeFinding(finding.id)}><Trash2 size={14} /></Button></div>
                </div>
              </div>
            ))}
            {visibleFindings.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Tälle roolille ei ole vielä kirjattu havaintoja.</div>}
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}
    </section>
  );
}
