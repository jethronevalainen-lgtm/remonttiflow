import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Loader2,
  MapPinned,
  Navigation,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  deactivateWorkSiteQrToken,
  generateWorkSiteQr,
  listWorkSiteQrTokens,
  type GeneratedWorkSiteQr,
  type WorkSiteQrTokenSummary,
} from '@/lib/supabase/workforceHr';
import { cn } from '@/lib/utils';

function formatDateTime(value?: string): string {
  if (!value) return 'Ei päättymistä';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fi-FI');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export default function QrHallinta() {
  const { projects, updateProject, refresh } = useAppDataContext();
  const { currentOrg } = useOrganization();
  const organizationId = currentOrg?.id;

  const [projectId, setProjectId] = useState('');
  const [label, setLabel] = useState('Pääsisäänkäynti');
  const [expiresAt, setExpiresAt] = useState('');
  const [requireGeofence, setRequireGeofence] = useState(true);
  const [result, setResult] = useState<GeneratedWorkSiteQr | null>(null);
  const [tokens, setTokens] = useState<WorkSiteQrTokenSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [savingGeofence, setSavingGeofence] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [radiusDraft, setRadiusDraft] = useState('150');
  const [latDraft, setLatDraft] = useState('');
  const [lonDraft, setLonDraft] = useState('');

  const activeProjects = useMemo(
    () => projects.filter((project) => !project.archivedAt && project.status !== 'Valmis'),
    [projects],
  );
  const selectedProject = activeProjects.find((project) => project.id === projectId);
  const hasGeofence = Boolean(
    selectedProject?.siteLatitude != null
    && selectedProject.siteLongitude != null
    && selectedProject.siteRadiusM != null
    && selectedProject.siteRadiusM > 0,
  );
  const existingTokenForProject = tokens.find((token) => token.projectId === projectId);

  const loadTokens = useCallback(async () => {
    if (!organizationId) return;
    setTokensLoading(true);
    try {
      setTokens(await listWorkSiteQrTokens(organizationId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Aktiivisten QR-koodien haku epäonnistui.');
    } finally {
      setTokensLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  useEffect(() => {
    if (!selectedProject) {
      setLatDraft('');
      setLonDraft('');
      setRadiusDraft('150');
      return;
    }
    setLatDraft(selectedProject.siteLatitude != null ? String(selectedProject.siteLatitude) : '');
    setLonDraft(selectedProject.siteLongitude != null ? String(selectedProject.siteLongitude) : '');
    setRadiusDraft(selectedProject.siteRadiusM != null ? String(selectedProject.siteRadiusM) : '150');
  }, [selectedProject]);

  const runGenerate = async () => {
    if (!projectId) {
      setError('Valitse työmaa ennen QR-koodin luontia.');
      return;
    }
    if (requireGeofence && !hasGeofence) {
      setError('Sijaintirajaus on päällä, mutta työmaalla ei ole koordinaatteja ja sädettä. Tallenna rajaus tai poista vaatimus.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    setCopied(false);
    try {
      const generated = await generateWorkSiteQr({
        projectId,
        label,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        requireGeofence,
      });
      setResult(generated);
      setInfo(existingTokenForProject
        ? 'Uusi koodi luotiin. Vanha koodi poistettiin käytöstä.'
        : 'QR-koodi on valmis. Tulosta tai kopioi linkki työmaalle.');
      await loadTokens();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'QR-koodin luonti epäonnistui.');
    } finally {
      setLoading(false);
      setConfirmRotate(false);
    }
  };

  const requestGenerate = () => {
    if (existingTokenForProject || result?.projectId === projectId) {
      setConfirmRotate(true);
      return;
    }
    void runGenerate();
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([result.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vakantti-qr-${result.projectName.toLocaleLowerCase('fi').replace(/[^a-z0-9åäö]+/gi, '-')}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.checkInUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Linkin kopiointi leikepöydälle epäonnistui.');
    }
  };

  const print = () => {
    if (!result) return;
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) {
      setError('Tulostusikkunaa ei voitu avata. Salli ponnahdusikkunat ja yritä uudelleen.');
      return;
    }
    const subtitle = result.label
      ? escapeHtml(result.label)
      : 'Skannaa koodi puhelimella ja kirjaudu työmaalle VaKantissa.';
    popup.document.write(`<!doctype html><html lang="fi"><head><meta charset="utf-8"><title>${escapeHtml(result.projectName)} – QR-kirjautuminen</title><style>body{font-family:Arial,sans-serif;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;background:#fff;color:#0f172a}.sheet{text-align:center;max-width:680px;padding:48px}h1{font-size:36px;margin:0 0 8px;word-break:break-word}p{font-size:18px;line-height:1.5;margin:0 0 28px;word-break:break-word}.qr{max-width:480px;margin:auto}.qr svg{width:100%;height:auto}.brand{margin-top:24px;font-weight:700;color:#ea580c}@media print{.sheet{padding:0}}</style></head><body><div class="sheet"><h1>${escapeHtml(result.projectName)}</h1><p>${subtitle}</p><div class="qr">${result.svg}</div><div class="brand">VaKantti</div></div><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  };

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setError('Selain ei tue paikannusta.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatDraft(position.coords.latitude.toFixed(6));
        setLonDraft(position.coords.longitude.toFixed(6));
        setLocating(false);
        setInfo('Nykyinen sijainti täytettiin. Tarkista säde ja tallenna.');
      },
      () => {
        setLocating(false);
        setError('Sijainnin haku epäonnistui. Anna koordinaatit käsin tai salli paikannus.');
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const saveGeofence = async () => {
    if (!selectedProject) return;
    const latitude = Number(latDraft);
    const longitude = Number(lonDraft);
    const radius = Number(radiusDraft);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setError('Anna kelvollinen leveysaste (−90…90).');
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError('Anna kelvollinen pituusaste (−180…180).');
      return;
    }
    if (!Number.isFinite(radius) || radius < 10 || radius > 10_000) {
      setError('Säteeksi kelpaa 10–10 000 metriä.');
      return;
    }
    setSavingGeofence(true);
    setError(null);
    try {
      const ok = await updateProject(selectedProject.id, {
        siteLatitude: latitude,
        siteLongitude: longitude,
        siteRadiusM: radius,
      });
      if (!ok) {
        setError('Sijaintirajauksen tallennus epäonnistui.');
        return;
      }
      await refresh();
      setInfo(`Sijaintirajaus tallennettiin: ${Math.round(radius)} m.`);
    } finally {
      setSavingGeofence(false);
    }
  };

  const deactivate = async () => {
    if (!deactivateId) return;
    setLoading(true);
    setError(null);
    try {
      await deactivateWorkSiteQrToken(deactivateId);
      if (result && tokens.find((token) => token.id === deactivateId)?.projectId === result.projectId) {
        setResult(null);
      }
      setInfo('QR-koodi poistettiin käytöstä.');
      await loadTokens();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'QR-koodin poistaminen epäonnistui.');
    } finally {
      setLoading(false);
      setDeactivateId(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-sm">
            <QrCode size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              QR-kirjautumisen hallinta
            </h1>
            <p className="mt-1 break-words text-sm text-slate-600">
              Luo työmaalle tulostettava koodi. Skannaus kirjaa työntekijän sisään VaKanttiin.
            </p>
          </div>
        </div>

        <ol className="grid gap-2 sm:grid-cols-3">
          {[
            { step: '1', title: 'Valitse työmaa', detail: 'Ja tarkista sijaintirajaus' },
            { step: '2', title: 'Luo koodi', detail: 'Vanha koodi poistuu automaattisesti' },
            { step: '3', title: 'Tulosta tai jaa', detail: 'SVG, linkki tai paperituloste' },
          ].map((item) => (
            <li
              key={item.step}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                {item.step}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-slate-950">{item.title}</span>
                <span className="mt-0.5 block break-words text-xs text-slate-500">{item.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p className="break-words">{error}</p>
        </div>
      )}
      {info && !error && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
          <Check size={18} className="mt-0.5 shrink-0" />
          <p className="break-words">{info}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Luo QR-koodi</CardTitle>
            <p className="text-sm text-slate-500">Yhdellä työmaalla on kerrallaan yksi aktiivinen koodi.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Työmaa</Label>
              <Select
                value={projectId}
                onValueChange={(value) => {
                  setProjectId(value);
                  setResult(null);
                  setError(null);
                  setInfo(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Valitse työmaa" />
                </SelectTrigger>
                <SelectContent>
                  {activeProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}{project.projectNumber ? ` · ${project.projectNumber}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeProjects.length === 0 && (
                <p className="text-sm text-amber-800">Aktiivisia työmaita ei ole valittavissa.</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="qr-label">Koodin kuvaus</Label>
                <Input
                  id="qr-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Esim. pääsisäänkäynti"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="qr-expires">Voimassaolon päättyminen</Label>
                <Input
                  id="qr-expires"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
                <p className="text-xs leading-5 text-slate-500">
                  Tyhjä = voimassa, kunnes uusi koodi luodaan tai vanha poistetaan.
                </p>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <Checkbox
                checked={requireGeofence}
                onCheckedChange={(checked) => setRequireGeofence(Boolean(checked))}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-semibold text-slate-950">
                  <ShieldCheck size={17} className="shrink-0 text-orange-600" />
                  Vaadi sijaintirajaus kirjautuessa
                </span>
                <span className="mt-1 block break-words text-sm leading-6 text-slate-500">
                  Kirjautuminen onnistuu vain työmaan koordinaattien ja sallitun säteen sisällä.
                </span>
              </span>
            </label>

            {selectedProject && (
              <div
                className={cn(
                  'space-y-3 rounded-2xl border p-4',
                  hasGeofence ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70',
                )}
              >
                <div className="flex items-start gap-3">
                  <MapPinned size={18} className={cn('mt-0.5 shrink-0', hasGeofence ? 'text-emerald-700' : 'text-amber-700')} />
                  <div className="min-w-0">
                    <p className={cn('font-semibold', hasGeofence ? 'text-emerald-950' : 'text-amber-950')}>
                      {hasGeofence ? 'Sijaintirajaus kunnossa' : 'Sijaintirajaus puuttuu'}
                    </p>
                    <p className={cn('mt-1 break-words text-sm leading-6', hasGeofence ? 'text-emerald-900' : 'text-amber-900')}>
                      {hasGeofence
                        ? `Säde ${Math.round(selectedProject.siteRadiusM ?? 0)} m · ${selectedProject.siteLatitude}, ${selectedProject.siteLongitude}`
                        : 'Tallenna piste ja säde tähän, jos haluat pakottaa kirjautumisen työmaalla.'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Leveysaste</Label>
                    <Input value={latDraft} onChange={(event) => setLatDraft(event.target.value)} inputMode="decimal" placeholder="60.1699" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pituusaste</Label>
                    <Input value={lonDraft} onChange={(event) => setLonDraft(event.target.value)} inputMode="decimal" placeholder="24.9384" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Säde (m)</Label>
                    <Input value={radiusDraft} onChange={(event) => setRadiusDraft(event.target.value)} type="number" min={10} max={10000} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-2" disabled={locating} onClick={captureLocation}>
                    {locating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                    Käytä nykyistä sijaintia
                  </Button>
                  <Button type="button" size="sm" className="gap-2" disabled={savingGeofence} onClick={() => void saveGeofence()}>
                    {savingGeofence ? <Loader2 size={14} className="animate-spin" /> : <MapPinned size={14} />}
                    Tallenna rajaus
                  </Button>
                </div>
              </div>
            )}

            <Button
              onClick={requestGenerate}
              disabled={loading || !projectId}
              className="min-h-12 w-full gap-2 text-base"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : existingTokenForProject ? <RefreshCw size={18} /> : <QrCode size={18} />}
              {existingTokenForProject ? 'Luo uusi koodi (poistaa vanhan)' : 'Luo QR-koodi'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="break-words text-lg">
                  {result ? result.projectName : 'Esikatselu'}
                </CardTitle>
                <p className="mt-1 break-words text-sm text-slate-500">
                  {result
                    ? (result.label || 'Valmis tulostettavaksi tai jaettavaksi')
                    : 'Koodi näkyy tässä heti luonnin jälkeen'}
                </p>
              </div>
              {result && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => void copy()}>
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? 'Kopioitu' : 'Kopioi linkki'}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={download}>
                    <Download size={15} />
                    SVG
                  </Button>
                  <Button size="sm" className="gap-2" onClick={print}>
                    <Printer size={15} />
                    Tulosta
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                <div className="mx-auto max-w-[360px] rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mx-auto aspect-square w-full" dangerouslySetInnerHTML={{ __html: result.svg }} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="break-words">
                    {result.requireGeofence ? 'Sijaintirajaus pakollinen' : 'Sijainti vain tallennetaan'}
                  </Badge>
                  <Badge variant="outline" className="break-words">
                    {result.expiresAt ? `Voimassa ${formatDateTime(result.expiresAt)}` : 'Voimassa kunnes uusitaan'}
                  </Badge>
                </div>
                <p className="break-words text-sm leading-6 text-slate-500">
                  Raaka tunniste näytetään vain tässä istunnossa. Jos sivu päivitetään, luo uusi koodi tarvittaessa.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                  <QrCode size={32} />
                </div>
                <p className="mt-4 font-semibold text-slate-950">Ei vielä esikatselua</p>
                <p className="mt-1 max-w-sm break-words text-sm leading-6 text-slate-500">
                  Valitse työmaa vasemmalta ja luo koodi. Aktiiviset koodit näkyvät alla ilman skannattavaa kuvaa.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Aktiiviset koodit</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Metadata ilman skannattavaa tunnusta. Poista käytöstä, jos koodi vuotaa tai työmaa vaihtuu.
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" disabled={tokensLoading} onClick={() => void loadTokens()}>
              {tokensLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Päivitä
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tokensLoading && tokens.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin" />
              Ladataan…
            </p>
          ) : tokens.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <p className="font-semibold text-slate-950">Ei aktiivisia QR-koodeja</p>
              <p className="mt-1 text-sm text-slate-500">Luo ensimmäinen koodi yllä olevasta lomakkeesta.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="break-words font-semibold text-slate-950">{token.projectName}</p>
                    <p className="break-words text-sm text-slate-600">
                      {token.label || 'Ei kuvausta'}
                      {' · '}
                      {token.requireGeofence ? 'Sijaintirajaus' : 'Ilman rajausta'}
                      {' · '}
                      {token.expiresAt ? `Voimassa ${formatDateTime(token.expiresAt)}` : 'Ei päättymistä'}
                    </p>
                    <p className="break-words text-xs text-slate-500">
                      Luotu {formatDateTime(token.createdAt)}
                      {' · '}
                      Käyttöjä {token.useCount}
                      {token.lastUsedAt ? ` · Viimeksi ${formatDateTime(token.lastUsedAt)}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setProjectId(token.projectId);
                        setLabel(token.label || 'Pääsisäänkäynti');
                        setRequireGeofence(token.requireGeofence);
                        setResult(null);
                        setInfo('Työmaa valittiin listasta. Luo uusi koodi, jos tarvitset tulostettavan kuvan uudelleen.');
                      }}
                    >
                      Valitse työmaa
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 text-red-700 hover:bg-red-50 hover:text-red-800"
                      onClick={() => setDeactivateId(token.id)}
                    >
                      <Trash2 size={14} />
                      Poista käytöstä
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Korvataanko nykyinen QR-koodi?</AlertDialogTitle>
            <AlertDialogDescription>
              Uuden koodin luonti poistaa tämän työmaan aiemman aktiivisen koodin käytöstä. Vanha tuloste lakkaa toimimasta heti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Peruuta</AlertDialogCancel>
            <AlertDialogAction disabled={loading} onClick={() => void runGenerate()}>
              Luo uusi koodi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deactivateId)} onOpenChange={(open) => !open && setDeactivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poistetaanko QR-koodi käytöstä?</AlertDialogTitle>
            <AlertDialogDescription>
              Skannaukset tällä koodilla eivät enää onnistu. Voit luoda uuden koodin milloin tahansa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Peruuta</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={loading} onClick={() => void deactivate()}>
              Poista käytöstä
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
