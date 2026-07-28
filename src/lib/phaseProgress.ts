/**
 * Aikataulutus progress is operational: share of linked work orders that are
 * finished (Valmis or Peruttu). Phases without work orders have no percentage.
 */

export type PhaseStatus = 'Suunniteltu' | 'Käynnissä' | 'Valmis' | 'Myöhässä';

export interface PhaseProgressInput {
  endDate: string;
  status: PhaseStatus;
  workOrderCount: number;
  completedWorkOrderCount: number;
  activeWorkOrderCount: number;
  /** Stored DB progress — used only as a fallback when counts are present. */
  storedProgress: number;
}

export interface PhaseProgressView {
  /** null when there are no linked work orders */
  percent: number | null;
  label: string;
  detail: string;
  status: PhaseStatus;
  trackedByWorkOrders: boolean;
}

function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function derivePhaseStatus(input: PhaseProgressInput, today = todayIsoDate()): PhaseStatus {
  const { workOrderCount, completedWorkOrderCount, activeWorkOrderCount, endDate, status } = input;
  const overdue = Boolean(endDate && endDate < today);

  if (workOrderCount > 0) {
    if (completedWorkOrderCount >= workOrderCount) return 'Valmis';
    if (overdue) return 'Myöhässä';
    if (activeWorkOrderCount > 0 || completedWorkOrderCount > 0) return 'Käynnissä';
    return 'Suunniteltu';
  }

  if (status === 'Valmis') return 'Valmis';
  if (overdue) return 'Myöhässä';
  if (status === 'Käynnissä' || status === 'Myöhässä') return status;
  return 'Suunniteltu';
}

export function derivePhaseProgress(input: PhaseProgressInput, today = todayIsoDate()): PhaseProgressView {
  const status = derivePhaseStatus(input, today);
  const trackedByWorkOrders = input.workOrderCount > 0;

  if (!trackedByWorkOrders) {
    return {
      percent: null,
      label: 'Ei työmääräyksiä',
      detail: 'Etenemistä ei lasketa ennen kuin vaiheeseen on linkitetty työmääräyksiä.',
      status,
      trackedByWorkOrders: false,
    };
  }

  const percent = Math.round(
    (input.completedWorkOrderCount / input.workOrderCount) * 100,
  );

  return {
    percent,
    label: `${percent} %`,
    detail: `${input.completedWorkOrderCount}/${input.workOrderCount} työmääräystä valmis tai peruttu`,
    status,
    trackedByWorkOrders: true,
  };
}
