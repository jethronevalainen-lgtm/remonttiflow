import type { ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Uudelleenkäytettävät tilakomponentit (lataus, tyhjä tila, virhetila).
 * Saavutettavuus: lataustila ilmoitetaan ruudunlukijalle role="status"-
 * attribuutilla ja virhetila role="alert"-attribuutilla.
 */

export interface LoadingStateProps {
  /** Ruudunlukijalle luettava ja näkyvä latausteksti (valinnainen). */
  text?: string;
  /** Lisäluokat ulkoasun säätöön. */
  className?: string;
}

export function LoadingState({ text, className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-3 p-8 text-muted-foreground',
        className,
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
      {text ? <p className="text-sm">{text}</p> : null}
      <span className="sr-only">{text ?? 'Ladataan…'}</span>
    </div>
  );
}

export interface EmptyStateProps {
  /** Kuvake tai muu visuaalinen elementti (esim. lucide-ikoni). */
  icon?: ReactNode;
  /** Tilan otsikko. */
  title: string;
  /** Tarkempi kuvaus tilanteesta. */
  description?: string;
  /** Valinnainen toiminto (esim. painike uuden kohteen luomiseen). */
  action?: ReactNode;
  /** Lisäluokat ulkoasun säätöön. */
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="text-muted-foreground" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  /** Virheen otsikko. */
  title: string;
  /** Tarkempi kuvaus virheestä. */
  description?: string;
  /** Valinnainen uudelleenyritys-funktio; näyttää "Yritä uudelleen" -painikkeen. */
  onRetry?: () => void;
  /** Lisäluokat ulkoasun säätöön. */
  className?: string;
}

export function ErrorState({
  title,
  description,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-10 text-center',
        className,
      )}
    >
      <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" onClick={onRetry} className="mt-2">
          Yritä uudelleen
        </Button>
      ) : null}
    </div>
  );
}
