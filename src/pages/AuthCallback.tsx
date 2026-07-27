import { useEffect, useMemo, useState } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

import { BRAND } from '@/config/brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getLeakedPasswordCount } from '@/lib/security/passwordBreach';
import { supabase } from '@/lib/supabase/client';

const SUPPORTED_OTP_TYPES = new Set<EmailOtpType>([
  'email',
  'invite',
  'recovery',
  'email_change',
]);

function authErrorFromUrl(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const description = hash.get('error_description') ?? query.get('error_description');
  if (description) return decodeURIComponent(description.replaceAll('+', ' '));
  if (hash.get('error') || query.get('error')) {
    return 'Kutsulinkki on virheellinen tai vanhentunut.';
  }
  return null;
}

export default function AuthCallback() {
  const initialError = useMemo(authErrorFromUrl, []);
  const [status, setStatus] = useState<'verifying' | 'ready' | 'complete' | 'error'>(
    initialError ? 'error' : 'verifying',
  );
  const [error, setError] = useState<string | null>(initialError);
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialError) return;
    let cancelled = false;

    const verify = async () => {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const tokenHash = query.get('token_hash');
      const requestedType = query.get('type') as EmailOtpType | null;
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');

      try {
        if (tokenHash) {
          const type = requestedType && SUPPORTED_OTP_TYPES.has(requestedType)
            ? requestedType
            : 'invite';
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          if (verifyError) throw verifyError;
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) {
            throw new Error('Kutsulinkistä puuttuvat tilin aktivointitiedot.');
          }
        }

        window.history.replaceState({}, document.title, '/auth/callback');
        if (!cancelled) setStatus('ready');
      } catch (caught) {
        if (cancelled) return;
        const message = caught instanceof Error ? caught.message : '';
        setError(
          /expired|invalid|token/i.test(message)
            ? 'Kutsulinkki on vanhentunut tai jo käytetty. Pyydä ylläpitäjää lähettämään uusi kutsu.'
            : message || 'Tilin aktivointi epäonnistui.',
        );
        setStatus('error');
      }
    };

    void verify();
    return () => { cancelled = true; };
  }, [initialError]);

  const savePassword = async () => {
    setError(null);
    if (password.length < 12) {
      setError('Salasanassa pitää olla vähintään 12 merkkiä.');
      return;
    }
    if (password !== passwordAgain) {
      setError('Salasanat eivät täsmää.');
      return;
    }

    setSaving(true);
    try {
      const leakedCount = await getLeakedPasswordCount(password);
      if (leakedCount > 0) {
        setError('Tämä salasana tunnetaan aiemmista tietovuodoista. Valitse kokonaan uusi salasana, jota et käytä muissa palveluissa.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setStatus('complete');
      window.setTimeout(() => {
        window.location.replace(`${window.location.origin}/#/`);
      }, 1000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Salasanan tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-100 p-4 sm:p-6">
      <Card className="w-full max-w-lg overflow-hidden border-slate-200 shadow-xl">
        <CardHeader className="items-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-8 text-center text-white">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 text-xl font-bold shadow-lg shadow-orange-500/25">
            {BRAND.shortName}
          </div>
          <CardTitle className="text-2xl text-white">Ota VaKantti käyttöön</CardTitle>
          <CardDescription className="max-w-sm text-slate-300">
            Vahvista kutsu ja määritä henkilökohtainen salasana.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-6 sm:p-8">
          {status === 'verifying' && (
            <div className="flex min-h-52 flex-col items-center justify-center text-center">
              <Loader2 className="h-9 w-9 animate-spin text-orange-600" />
              <h2 className="mt-5 text-lg font-semibold text-slate-950">Kutsu tarkistetaan</h2>
              <p className="mt-2 text-sm text-slate-500">Tämä kestää yleensä vain hetken.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                <AlertTriangle size={28} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Linkkiä ei voitu käyttää</h2>
                <p className="mt-2 text-sm leading-6 text-red-700">{error}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => window.location.replace(`${window.location.origin}/#/login`)}>
                Siirry kirjautumiseen
              </Button>
            </div>
          )}

          {status === 'ready' && (
            <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void savePassword(); }}>
              <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                <ShieldCheck className="mt-0.5 shrink-0" size={20} />
                <p>Kutsu on vahvistettu. Salasana tarkistetaan paikallisesti tietovuotoja vastaan ja tallennetaan suojatun Supabase Auth -yhteyden kautta.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Uusi salasana</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pr-12"
                    minLength={12}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Piilota salasana' : 'Näytä salasana'}
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-0 top-0 flex h-full w-12 items-center justify-center text-slate-500"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-slate-500">Vähintään 12 merkkiä. Tunnettuja vuotaneita salasanoja ei hyväksytä.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password-again">Salasana uudelleen</Label>
                <Input
                  id="new-password-again"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={passwordAgain}
                  onChange={(event) => setPasswordAgain(event.target.value)}
                  minLength={12}
                  required
                />
              </div>
              {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
              <Button type="submit" className="min-h-12 w-full gap-2" disabled={saving}>
                {saving ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
                {saving ? 'Tarkistetaan ja tallennetaan…' : 'Aseta salasana ja avaa VaKantti'}
              </Button>
            </form>
          )}

          {status === 'complete' && (
            <div className="flex min-h-52 flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 size={34} />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-slate-950">Tili on valmis</h2>
              <p className="mt-2 text-sm text-slate-500">VaKantti avataan automaattisesti.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
