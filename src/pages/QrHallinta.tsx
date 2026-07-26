import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Loader2,
  MapPinned,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { generateWorkSiteQr, type GeneratedWorkSiteQr } from '@/lib/supabase/workforceHr';

export default function QrHallinta() {
  const { projects } = useAppDataContext();
  const [projectId, setProjectId] = useState('');
  const [label, setLabel] = useState('Työmaalle kirjautuminen');
  const [expiresAt, setExpiresAt] = useState('');
  const [requireGeofence, setRequireGeofence] = useState(true);
  const [result, setResult] = useState<GeneratedWorkSiteQr | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const generate = async () => {
    if (!projectId) {
      setError('Valitse työmaa ennen QR-koodin luontia.');
      return;
    }
    if (requireGeofence && !hasGeofence) {
      setError('Työmaalle ei ole määritetty sijaintipistettä ja sallittua säteittäistä aluetta. Määritä ne projektin tiedoissa tai poista sijaintirajauksen vaatimus.');
      return;
    }
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      setResult(await generateWorkSiteQr({
        projectId,
        label,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        requireGeofence,
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'QR-koodin luonti epäonnistui.');
    } finally {
      setLoading(false);
    }
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
    popup.document.write(`<!doctype html><html lang="fi"><head><meta charset="utf-8"><title>${result.projectName} – QR-kirjautuminen</title><style>body{font-family:Arial,sans-serif;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;background:#fff;color:#0f172a}.sheet{text-align:center;max-width:680px;padding:48px}h1{font-size:36px;margin:0 0 12px}p{font-size:20px;line-height:1.5;margin:0 0 28px}.qr{max-width:520px;margin:auto}.qr svg{width:100%;height:auto}.brand{margin-top:24px;font-weight:700;color:#ea580c}@media print{.sheet{padding:0}}</style></head><body><div class="sheet"><h1>${result.projectName}</h1><p>Skannaa koodi puhelimella ja kirjaudu työmaalle VaKantissa.</p><div class="qr">${result.svg}</div><div class="brand">VaKantti</div></div><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1400px] space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300"><QrCode size={16} /> Työmaiden kulunhallinta</div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">QR-kirjautumisen hallinta</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">Luo työmaalle tulostettava QR-koodi. Skannaus tunnistaa työmaan, tarkistaa käyttäjän organisaation ja vaatii sijainnin työmaan sallitulta alueelta.</p>
          </div>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-orange-500 shadow-lg shadow-orange-500/20"><QrCode size={38} /></div>
        </div>
      </div>

      {error && <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"><AlertTriangle size={19} className="mt-0.5 shrink-0" />{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
        <Card className="h-fit border-slate-200 shadow-sm">
          <CardContent className="space-y-6 p-5 sm:p-6">
            <div><h2 className="text-xl font-bold text-slate-950">QR-koodin asetukset</h2><p className="mt-1 text-sm text-slate-500">Uuden koodin luominen poistaa saman työmaan aiemman koodin käytöstä.</p></div>

            <div className="space-y-2"><Label>Työmaa</Label><Select value={projectId} onValueChange={(value) => { setProjectId(value); setResult(null); setError(null); }}><SelectTrigger><SelectValue placeholder="Valitse työmaa" /></SelectTrigger><SelectContent>{activeProjects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}{project.projectNumber ? ` · ${project.projectNumber}` : ''}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="qr-label">Koodin kuvaus</Label><Input id="qr-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Esim. pääsisäänkäynti" /></div>
            <div className="space-y-2"><Label htmlFor="qr-expires">Voimassaolon päättyminen</Label><Input id="qr-expires" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /><p className="text-xs leading-5 text-slate-500">Tyhjä arvo tekee koodista voimassa olevan, kunnes uusi koodi luodaan.</p></div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><Checkbox checked={requireGeofence} onCheckedChange={(checked) => setRequireGeofence(Boolean(checked))} className="mt-0.5" /><span><span className="flex items-center gap-2 font-semibold text-slate-950"><ShieldCheck size={17} className="text-orange-600" />Vaadi työmaan sijaintirajaus</span><span className="mt-1 block text-sm leading-6 text-slate-500">Kirjautuminen onnistuu vain työmaan koordinaattien ja sallitun säteen sisällä huomioiden laitteen paikannustarkkuuden.</span></span></label>

            {selectedProject && (
              <div className={`rounded-2xl border p-4 ${hasGeofence ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-start gap-3"><MapPinned size={20} className={`mt-0.5 shrink-0 ${hasGeofence ? 'text-emerald-700' : 'text-amber-700'}`} /><div><p className={`font-semibold ${hasGeofence ? 'text-emerald-900' : 'text-amber-900'}`}>{hasGeofence ? 'Työmaan sijaintirajaus on valmis' : 'Työmaan sijaintirajaus puuttuu'}</p><p className={`mt-1 text-sm leading-6 ${hasGeofence ? 'text-emerald-800' : 'text-amber-800'}`}>{hasGeofence ? `Sallittu säde ${Math.round(selectedProject.siteRadiusM ?? 0)} metriä.` : 'Määritä projektin sijainti ja sallittu säde ennen pakotetun sijaintitarkistuksen käyttöä.'}</p></div></div>
              </div>
            )}

            <Button onClick={() => void generate()} disabled={loading || !projectId} className="min-h-12 w-full gap-2 text-base">{loading ? <Loader2 size={18} className="animate-spin" /> : result ? <RefreshCw size={18} /> : <QrCode size={18} />}{result ? 'Luo uusi ja poista vanha käytöstä' : 'Luo QR-koodi'}</Button>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="p-0">
            {result ? (
              <div className="flex min-h-[620px] flex-col">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold text-slate-950">{result.projectName}</h2><p className="mt-1 text-sm text-slate-500">Valmis tulostettavaksi työmaalle</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" className="gap-2" onClick={() => void copy()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Kopioitu' : 'Kopioi linkki'}</Button><Button variant="outline" size="sm" className="gap-2" onClick={download}><Download size={15} />SVG</Button><Button size="sm" className="gap-2" onClick={print}><Printer size={15} />Tulosta</Button></div></div></div>
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center sm:p-10"><div className="w-full max-w-[480px] rounded-[2rem] border border-slate-200 bg-white p-5 shadow-lg sm:p-8"><div className="mx-auto aspect-square w-full" dangerouslySetInnerHTML={{ __html: result.svg }} /></div><h3 className="mt-6 text-2xl font-bold text-slate-950">Skannaa ja kirjaudu työmaalle</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Koodi avaa VaKantin kirjautumisnäkymän. Käyttäjän pitää kuulua samaan organisaatioon, ja sijainti tarkistetaan ennen työajan aloittamista.</p><div className="mt-5 flex flex-wrap justify-center gap-2 text-xs"><span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">{result.requireGeofence ? 'Sijaintirajaus pakollinen' : 'Sijainti tallennetaan'}</span><span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">{result.expiresAt ? `Voimassa ${new Date(result.expiresAt).toLocaleString('fi-FI')}` : 'Voimassa kunnes uusitaan'}</span></div></div>
              </div>
            ) : (
              <div className="flex min-h-[620px] flex-col items-center justify-center p-8 text-center"><div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-orange-50 text-orange-600"><QrCode size={48} /></div><h2 className="mt-6 text-2xl font-bold text-slate-950">QR-koodi ilmestyy tähän</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Valitse työmaa, tarkista sijaintirajaus ja luo uusi turvallinen QR-koodi.</p></div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
