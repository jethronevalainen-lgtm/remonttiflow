import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { BRAND } from '@/config/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const loginSchema = z.object({
  email: z.string().min(1, 'Syötä sähköpostiosoite').email('Syötä kelvollinen sähköpostiosoite'),
  password: z.string().min(1, 'Syötä salasana'),
});

type LoginFormValues = z.infer<typeof loginSchema>;
interface LoginLocationState { from?: string; }

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    const { error } = await signIn(values.email, values.password);
    if (error) {
      setServerError(error);
      return;
    }
    const from = (location.state as LoginLocationState | null)?.from;
    navigate(from && from !== '/login' ? from : '/app', { replace: true });
  };

  return (
    <div className="relative flex h-[100dvh] min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950 p-4 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,0.20),transparent_35%),radial-gradient(circle_at_80%_85%,rgba(59,130,246,0.15),transparent_35%)]" />
      <div className="relative w-full max-w-md py-6">
        <Link to="/" className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Takaisin etusivulle
        </Link>

        <Card className="border-white/10 bg-white shadow-2xl shadow-black/30">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-orange-500 text-xl font-black text-white shadow-lg shadow-orange-500/25">{BRAND.shortName}</div>
            <CardTitle className="text-2xl">{BRAND.name}</CardTitle>
            <CardDescription>Kirjaudu työtilaan · {BRAND.tagline}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Sähköposti</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="nimi@yritys.fi" aria-invalid={errors.email ? true : undefined} {...register('email')} />
                {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Salasana</Label>
                <Input id="password" type="password" autoComplete="current-password" aria-invalid={errors.password ? true : undefined} {...register('password')} />
                {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
              </div>
              {serverError ? <p role="alert" className="text-sm font-medium text-destructive">{serverError}</p> : null}
              <Button type="submit" className="h-11 w-full bg-orange-500 text-white hover:bg-orange-400" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Kirjaudutaan…</> : 'Kirjaudu sisään'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center border-t border-slate-100 pt-5">
            <p className="text-center text-sm leading-6 text-muted-foreground">Käyttäjätilit luo organisaation ylläpitäjä. Ota yhteyttä ylläpitäjään, jos tarvitset tunnukset.</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
