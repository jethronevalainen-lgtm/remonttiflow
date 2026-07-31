import type { WorkOrderStatus } from '@/types';

/** Short Finnish explanations for work-order statuses shown in editors and filters. */
export const WORK_ORDER_STATUS_HELP: Record<WorkOrderStatus, string> = {
  Avoin: 'Työ on jaettu mutta ei vielä aloitettu.',
  Käynnissä: 'Työtä tehdään parhaillaan.',
  Odottaa: 'Työ on keskeytetty (esim. odottaa materiaalia, päätöstä tai tilaajaa).',
  Valmis: 'Työnjohto on hyväksynyt työn valmiiksi.',
  Peruttu: 'Työtä ei tehdä.',
};

export const WORK_ORDER_REVIEW_HELP =
  'Työntekijä on ilmoittanut työn valmiiksi. Työnjohto hyväksyy (Valmis) tai palauttaa työn.';

export const WORK_ORDER_DATE_HELP = {
  plannedStart: 'Päivä, josta resurssivaraus / kalenterikortti alkaa.',
  plannedEnd: 'Suunniteltu viimeinen työpäivä resurssivarauksessa.',
  dueDate: 'Määräpäivä myöhästymisvaroille. Voi olla sama tai myöhempi kuin suunniteltu valmis.',
} as const;
