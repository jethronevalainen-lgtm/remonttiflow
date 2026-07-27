import { useMemo, useState } from 'react';
import { AlertTriangle, Calculator, Car, CheckCircle2, Loader2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  calculateDomesticTravelAllowance,
  createCalculatedTravelExpense,
  type DomesticTravelAllowanceCalculation,
} from '@/lib/supabase/travelAllowanceCalculator';

function localDateTime(hours: number, minutes: number) {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function money(cents: number) {
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function durationLabel(minutes: number) {
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function allowanceLabel(value: DomesticTravelAllowanceCalculation['allowanceType']) {
  if (value === 'partial') return 'Osapäiväraha';
  if (value === 'full') return 'Kokopäiväraha';
  if (value === 'multi_day') return 'Usean matkavuorokauden päiväraha';
  return 'Ei päivärahaa';
}

export default function TravelAllowanceQuickCreate({ onSaved }: { onSaved: () => void }) {
  const { currentOrg } = useOrganization();
  const { projects } = useAppDataContext();
  const [open, setOpen] = useState(false);
  const [startedAt, setStartedAt] = useState(localDateTime(7, 0));
  const [endedAt, setEndedAt] = useState(localDateTime(15, 30));
  const [distanceKm, setDistanceKm] = useState('0');
  const [projectId, setProjectId] = useState('none');
  const [description, setDescription] = useState('');
  const [useOwnCar, setUseOwnCar] = useState(true);
  const [freeMealCount, setFreeMealCount] = useState('0');
  const [eligibilityConfirmed, setEligibilityConfirmed] = useState(false);
  const [calculation, setCalculation] = useState<DomesticTravelAllowanceCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const parsedDistance = useMemo(() => Number(distanceKm.replace(',', '.')), [distanceKm]);
  const parsedMeals = useMemo(() => Number(freeMealCount || 0), [freeMealCount]);

  const reset = () => {
    setStartedAt(localDateTime(7, 0));
    setEndedAt(localDateTime(15, 30));
    setDistanceKm('0');
    setProjectId('none');
    setDescription('');
    setUseOwnCar(true);
    setFreeMealCount('0');
    setEligibilityConfirmed(false);
    setCalculation(null);
    setError(null);
  };

  const calculate = async () => {
    if (!currentOrg) return;
    if (!startedAt || !endedAt) { setError('Anna matkan alku- ja päättymisaika.'); return; }
    if (!Number.isFinite(parsedDistance) || parsedDistance < 0) { setError('Kilometrimäärä ei ole kelvollinen.'); return; }
    if (!Number.isInteger(parsedMeals) || parsedMeals < 0) { setError('Ilmaisten aterioiden määrän pitää olla kokonaisluku.'); return; }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      setCalculation(await calculateDomesticTravelAllowance({
        organizationId: currentOrg.id,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        distanceKm: parsedDistance,
        useOwnCar,
        freeMealCount: parsedMeals,
        eligibilityConfirmed,
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Laskenta epäonnistui.');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!currentOrg || !calculation) return;
    if (!eligibilityConfirmed) { setError('Vahvista työmatkan korvausedellytykset ennen tallennusta.'); return; }
    setLoading(true);
    setError(null);
    try {
      await createCalculatedTravelExpense({
        organizationId: currentOrg.id,
        projectId: projectId === 'none' ? undefined : projectId,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        distanceKm: parsedDistance,
        useOwnCar,
        freeMealCount: parsedMeals,
        eligibilityConfirmed,
        description,
      });
      setSuccess(`Matkalasku ${money(calculation.totalCents)} tallennettiin odottamaan hyväksyntää.`);
      onSaved();
      setOpen(false);
      reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-white">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-950"><Calculator size={19} className="text-orange-600" />Automaattinen matkalasku</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Laske oman auton kilometrikorvaus ja kotimaan päivärahataso organisaation voimassa olevilla säännöillä. Tallenna laskelma hyväksyttäväksi matkakuluksi.</p>
            {success && <p className="mt-2 text-sm font-medium text-emerald-700">{success}</p>}
          </div>
          <Button className="shrink-0 gap-2" onClick={() => { reset(); setOpen(true); }}><Plus size={16} />Laske matkalasku</Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Automaattinen kotimaan matkalasku</DialogTitle></DialogHeader>
          {error && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="travel-start">Matka alkoi *</Label><Input id="travel-start" type="datetime-local" value={startedAt} onChange={(event) => { setStartedAt(event.target.value); setCalculation(null); }} /></div>
            <div className="space-y-2"><Label htmlFor="travel-end">Matka päättyi *</Label><Input id="travel-end" type="datetime-local" value={endedAt} onChange={(event) => { setEndedAt(event.target.value); setCalculation(null); }} /></div>
            <div className="space-y-2"><Label htmlFor="travel-distance">Ajettu matka km</Label><Input id="travel-distance" inputMode="decimal" value={distanceKm} onChange={(event) => { setDistanceKm(event.target.value); setCalculation(null); }} /></div>
            <div className="space-y-2"><Label htmlFor="travel-meals">Ilmaiset ateriat matkalla</Label><Input id="travel-meals" type="number" min="0" step="1" value={freeMealCount} onChange={(event) => { setFreeMealCount(event.target.value); setCalculation(null); }} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Projekti</Label><Select value={projectId} onValueChange={setProjectId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="travel-description">Matkan tarkoitus ja lisätiedot</Label><Textarea id="travel-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Esim. työmaakäynti ja materiaalin nouto" /></div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2"><Checkbox checked={useOwnCar} onCheckedChange={(checked) => { setUseOwnCar(Boolean(checked)); setCalculation(null); }} className="mt-0.5" /><span><span className="flex items-center gap-2 font-semibold text-slate-950"><Car size={16} className="text-orange-600" />Oma tai hallinnassa oleva auto</span><span className="mt-1 block text-xs leading-5 text-slate-500">Kilometrikorvaus lasketaan vain, kun tämä valinta on käytössä.</span></span></label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:col-span-2"><Checkbox checked={eligibilityConfirmed} onCheckedChange={(checked) => { setEligibilityConfirmed(Boolean(checked)); setCalculation(null); }} className="mt-0.5" /><span><span className="font-semibold text-blue-950">Vahvistan työmatkan korvausedellytykset</span><span className="mt-1 block text-xs leading-5 text-blue-800">Matka on tilapäinen työmatka erityiselle työntekemispaikalle ja päivärahan etäisyysedellytykset täyttyvät. Hyväksyjä tarkistaa tiedot ennen maksamista.</span></span></label>
          </div>

          {calculation && (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 font-semibold text-slate-950"><CheckCircle2 size={18} className="text-emerald-600" />Laskelman esikatselu</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div><p className="text-xs text-slate-500">Kesto</p><p className="mt-1 font-semibold">{durationLabel(calculation.durationMinutes)}</p></div>
                <div><p className="text-xs text-slate-500">Kilometrikorvaus</p><p className="mt-1 font-semibold">{money(calculation.mileageCents)}</p></div>
                <div><p className="text-xs text-slate-500">{allowanceLabel(calculation.allowanceType)}</p><p className="mt-1 font-semibold">{money(calculation.dailyAllowanceCents)}</p></div>
                <div><p className="text-xs text-slate-500">Yhteensä</p><p className="mt-1 text-lg font-bold">{money(calculation.totalCents)}</p></div>
              </div>
              <p className="text-xs leading-5 text-slate-500">Kilometrimäärä {calculation.distanceKm.toLocaleString('fi-FI')} km · korvaustaso {(calculation.mileageRateCentsPerKm / 100).toLocaleString('fi-FI', { minimumFractionDigits: 2 })} €/km · hinnat voimassa {calculation.ratesValidFrom} alkaen.</p>
              {calculation.warnings.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{calculation.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)}>Peruuta</Button>
            <Button variant="outline" onClick={() => void calculate()} disabled={loading}>{loading ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Calculator size={15} className="mr-2" />}Laske</Button>
            <Button onClick={() => void save()} disabled={loading || !calculation || !eligibilityConfirmed}>Tallenna hyväksyttäväksi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
