import type { QuantityTakeoff, QuantityTakeoffLine, TakeoffStatus } from '@/hooks/useFinanceFormsData';
import { quantityWithWaste, summarizeTakeoffByUnit } from '@/lib/financeCalculations';
import type { OfferPhaseDefinition } from '@/lib/pricing/offerPhases';

export const TAKEOFF_STATUSES: TakeoffStatus[] = ['Luonnos', 'Valmis', 'Arkistoitu'];

export const COMMON_UNITS = ['m²', 'm', 'jm', 'kpl', 'm³', 'kg', 'tn', 'h', 'vrk', 'erä'] as const;

export function statusTone(status: TakeoffStatus): string {
  switch (status) {
    case 'Luonnos':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'Valmis':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'Arkistoitu':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

export function formatQuantity(value: number, maximumFractionDigits = 3): string {
  return value.toLocaleString('fi-FI', { maximumFractionDigits });
}

export function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function filterTakeoffs(
  takeoffs: QuantityTakeoff[],
  takeoffLines: QuantityTakeoffLine[],
  search: string,
  statusFilter: string,
): QuantityTakeoff[] {
  const needle = search.trim().toLocaleLowerCase('fi-FI');
  return takeoffs.filter((takeoff) => {
    if (statusFilter !== 'all' && takeoff.status !== statusFilter) return false;
    if (!needle) return true;
    const lineText = takeoffLines
      .filter((line) => line.takeoffId === takeoff.id)
      .map((line) => `${line.workPhase} ${line.description} ${line.notes}`)
      .join(' ')
      .toLocaleLowerCase('fi-FI');
    const haystack = `${takeoff.name} ${takeoff.projectName} ${takeoff.notes} ${lineText}`.toLocaleLowerCase('fi-FI');
    return haystack.includes(needle);
  });
}

export function groupLinesByPhase(lines: QuantityTakeoffLine[]): Array<[string, QuantityTakeoffLine[]]> {
  const groups = new Map<string, QuantityTakeoffLine[]>();
  for (const line of lines) {
    const key = line.workPhase.trim() || 'Muut';
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fi'));
}

export function takeoffStats(lines: QuantityTakeoffLine[]) {
  const phaseCount = new Set(lines.map((line) => line.workPhase.trim() || 'Muut')).size;
  const missingQuantity = lines.filter((line) => line.quantity <= 0).length;
  const withWaste = lines.reduce((sum, line) => sum + quantityWithWaste(line), 0);
  const base = lines.reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
  return {
    lineCount: lines.length,
    phaseCount,
    missingQuantity,
    baseQuantity: base,
    withWasteQuantity: withWaste,
    wasteQuantity: withWaste - base,
    byUnit: summarizeTakeoffByUnit(lines),
  };
}

export function linesFromPhases(
  takeoffId: string,
  phases: OfferPhaseDefinition[],
  options?: { defaultUnit?: string; defaultWastePercent?: number; skipExistingPhases?: Set<string> },
): Array<Omit<QuantityTakeoffLine, 'id'>> {
  const defaultUnit = options?.defaultUnit ?? 'm²';
  const defaultWastePercent = options?.defaultWastePercent ?? 5;
  const skip = options?.skipExistingPhases;
  return phases
    .filter((phase) => {
      if (!skip) return true;
      return !skip.has(phase.title.toLocaleLowerCase('fi-FI'));
    })
    .map((phase) => ({
      takeoffId,
      workPhase: phase.title,
      description: phase.description,
      quantity: 0,
      unit: defaultUnit,
      wastePercent: defaultWastePercent,
      notes: '',
    }));
}

export function exportTakeoffCsv(name: string, lines: QuantityTakeoffLine[]): void {
  const rows = lines.map((line) => [
    line.workPhase,
    line.description,
    line.quantity,
    line.unit,
    line.wastePercent,
    quantityWithWaste(line).toFixed(3),
    line.notes,
  ]);
  const csv = [
    ['Työvaihe', 'Kuvaus', 'Määrä', 'Yksikkö', 'Hukka %', 'Hukallinen määrä', 'Huomiot'],
    ...rows,
  ].map((row) => row.map(csvCell).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replaceAll(/\s+/g, '-') || 'maaralaskelma'}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
