import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LocateFixed,
  MapPin,
  QrCode,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { captureCurrentWorkSiteLocation } from '@/lib/supabase/workSiteCheckIns';
import { consumeWorkSiteQr, type QrCheckInResult } from '@/lib/supabase/workforceHr';

const TIMER_START_KEY = 'vakantti-time-timer-start';
const TIMER_PROJECT_KEY = 'vakantti-time-timer-project';
const TIMER_DESCRIPTION_KEY = 'vakantti-time-timer-description';
const TIMER_CHECK_IN_KEY = 'vakantti-time-work-site-check-in';

function distanceLabel(value?: number) {
  if (value == null) return 'Sijaintirajaa ei käytetty';
  return value < 1000 ? `${Math.round(value)} m työmaan keskipisteestä` : `${(value / 1000).toFixed(1)} km työmaan keskipisteestä`;
}

export default function QrKirjautuminen() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') ?? '', [location.search]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QrCheckInResult | null>(null);

  const checkIn = async () => {
    if (!token) {
      setError('QR-koodista puuttuu työmaan tunniste. Skannaa työmaalla oleva koodi uudelleen.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const captured = await captureCurrentWorkSiteLocation();
      const next = await consumeWorkSiteQr({
        token,
        latitude: captured.latitude,
        longitude: captured.longitude,
        accuracyM: captured.accuracyM,
        description,
      });
      localStorage.setItem(TIMER_START_KEY, next.checkedInAt);
      localStorage.setItem(TIMER_PROJECT_KEY, next.projectId || next.projectName);
      localStorage.setItem(TIMER_DESCRIPTION_KEY, description.trim());
      localStorage.setItem(TIMER_CHECK_IN_KEY, next.checkInId);
      setResult(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Työmaalle kirjautuminen epäonnistui.');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center py-6">
        <Card className="w-full overflow-hidden border-emerald-200 shadow-xl">
          <CardContent className="p-0">
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 text-center text-white sm:p-10">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-8 ring-white/10"><CheckCircle2 size={44} /></div>
              <h1 className="mt-6 text-3xl font-bold">Olet kirjautunut työmaalle</h1>
              <p className="mt-2 text-lg text-emerald-100">{result.projectName}</p>
            </div>
            <div className="space-y-5 p-6 sm:p-8">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Aloitusaika</p><p className="mt-2 font-semibold text-slate-950">{new Date(result.checkedInAt).toLocaleString('fi-FI')}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Sijainti</p><p className="mt-2 font-semibold text-slate-950">{distanceLabel(result.distanceFromSiteM)}</p></div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><ShieldCheck size={19} className="mt-0.5 shrink-0" /><p>Työaika on käynnissä. Lopeta työpäivä Tuntikirjaukset-näkymästä, jolloin kirjauksesta muodostetaan hyväksyttävä tuntikirjaus.</p></div>
              <Button className="min-h-12 w-full text-base" onClick={() => navigate('/tuntikirjaukset', { replace: true })}>Avaa työajan seuranta</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center py-6">
      <Card className="w-full overflow-hidden border-slate-200 shadow-xl">
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-7 text-center text-white sm:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-500 shadow-lg shadow-orange-500/25"><QrCode size={42} /></div>
            <h1 className="mt-6 text-3xl font-bold">Kirjaudu työmaalle</h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-300">VaKantti tunnistaa työmaan QR-koodista ja tarkistaa nykyisen sijaintisi. Sijainti tallennetaan vain kirjautumisen todentamista varten.</p>
          </div>

          <div className="space-y-5 p-6 sm:p-8">
            {error && <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"><AlertTriangle size={19} className="mt-0.5 shrink-0" />{error}</div>}
            {!token && <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><AlertTriangle size={19} className="mt-0.5 shrink-0" />QR-koodin tunniste puuttuu. Avaa tämä näkymä skannaamalla työmaalla oleva QR-koodi.</div>}

            <div className="space-y-2"><Label htmlFor="qr-work-description">Työn kuvaus</Label><Input id="qr-work-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Esim. huoneiston A12 lattiatyöt" autoFocus /></div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><LocateFixed size={20} className="mt-0.5 shrink-0 text-orange-600" /><div><p className="font-semibold text-slate-950">Tarkka sijainti</p><p className="mt-1 text-xs leading-5 text-slate-500">Puhelin pyytää sijaintiluvan kirjautumisen yhteydessä.</p></div></div>
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><MapPin size={20} className="mt-0.5 shrink-0 text-orange-600" /><div><p className="font-semibold text-slate-950">Työmaan alueraja</p><p className="mt-1 text-xs leading-5 text-slate-500">Kirjautuminen estetään, jos olet sallitun alueen ulkopuolella.</p></div></div>
            </div>

            <Button className="min-h-14 w-full gap-2 text-base" disabled={loading || !token} onClick={() => void checkIn()}>{loading ? <Loader2 size={20} className="animate-spin" /> : <MapPin size={20} />}{loading ? 'Tarkistetaan sijaintia…' : 'Aloita työaika tällä työmaalla'}</Button>
            <p className="text-center text-xs leading-5 text-slate-500">VaKantti ei käynnistä jatkuvaa taustaseurantaa. Kirjautumishetken sijainti, tarkkuus ja työmaa tallennetaan tapahtuman todentamiseksi.</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
