/**
 * Keskitetty lokitusrajapinta (central logging interface).
 *
 * Kehitysympäristössä viestit ohjataan konsoliin. Tuotannossa tämä on
 * valmisteltu laajennettavaksi ulkoiseen virheenseurantapalveluun
 * (esim. Sentry) — integraatio kytketään `reportToExternalService`-
 * funktioon myöhemmin ilman, että kutsukohtia tarvitsee muuttaa.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

const isDev = import.meta.env.DEV;

/**
 * Paikkavaraus tulevalle virheenseurannan integraatiolle (esim. Sentry).
 * Lisää tänne ulkoisen palvelun kutsu, kun palvelu otetaan käyttöön.
 */
function reportToExternalService(
  level: LogLevel,
  message: string,
  context?: LogContext,
): void {
  // TODO: Kytke virheenseurantapalvelu (esim. Sentry.captureException).
  // Ei vielä tehdä mitään — tarkoituksellinen stub.
  void level;
  void message;
  void context;
}

/**
 * Kirjaa viestin keskitetyn lokituksen kautta.
 *
 * @param level   Viestin taso: debug | info | warn | error
 * @param message Ihmisluettava viesti
 * @param context Vapaaehtoinen lisätieto (esim. virheolio, komponenttipino)
 */
export function log(level: LogLevel, message: string, context?: LogContext): void {
  if (isDev) {
    const consoleFn =
      level === 'debug'
        ? console.debug
        : level === 'info'
          ? console.info
          : level === 'warn'
            ? console.warn
            : console.error;
    if (context !== undefined) {
      consoleFn(`[RemonttiFlow] ${message}`, context);
    } else {
      consoleFn(`[RemonttiFlow] ${message}`);
    }
  }

  // Virheet ja varoitukset valmistellaan raportoitavaksi ulospäin.
  if (level === 'error' || level === 'warn') {
    reportToExternalService(level, message, context);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),
};

export default logger;
