import type { FindingSeverity, FindingStatus } from '@/lib/supabase/inspectionEntities';

export type FindingWorkflowStage = 'assignment' | 'correction' | 'verification' | 'closed';

const DEFAULT_DUE_DAYS: Record<FindingSeverity, number> = {
  Vähäinen: 7,
  'Korjattava ennen luovutusta': 3,
  Merkittävä: 1,
  Kriittinen: 0,
};

export function findingBlocksHandover(severity: FindingSeverity): boolean {
  return severity !== 'Vähäinen';
}

export function findingRequiresDueDate(severity: FindingSeverity): boolean {
  return findingBlocksHandover(severity);
}

export function findingRequiresOwner(severity: FindingSeverity): boolean {
  return findingBlocksHandover(severity);
}

export function suggestedFindingDueDate(severity: FindingSeverity, today: string): string {
  const date = new Date(`${today}T12:00:00`);
  if (Number.isNaN(date.getTime())) return today;
  date.setDate(date.getDate() + DEFAULT_DUE_DAYS[severity]);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function findingWorkflowStage(status: FindingStatus): FindingWorkflowStage {
  if (status === 'Hyväksytty' || status === 'Mitätöity') return 'closed';
  if (status === 'Ilmoitettu korjatuksi' || status === 'Odottaa uusintatarkastusta') return 'verification';
  if (status === 'Työn alla') return 'correction';
  return 'assignment';
}

export function findingStageDescription(status: FindingStatus): string {
  const stage = findingWorkflowStage(status);
  if (stage === 'verification') return 'Korjaus on ilmoitettu valmiiksi ja odottaa tarkistusta.';
  if (stage === 'correction') return 'Puute on korjattavana. Korjauksesta kirjataan kuvaus ja tarvittaessa kuva.';
  if (stage === 'closed') return status === 'Hyväksytty' ? 'Korjaus on tarkistettu ja hyväksytty.' : 'Puute on mitätöity.';
  if (status === 'Hylätty') return 'Korjaus ei läpäissyt tarkistusta ja se on tehtävä uudelleen.';
  return 'Puute odottaa korjauksen aloitusta tai työmääräystä.';
}
