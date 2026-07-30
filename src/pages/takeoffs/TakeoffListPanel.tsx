import { Loader2, Ruler, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { QuantityTakeoff, QuantityTakeoffLine } from '@/hooks/useFinanceFormsData';
import { cn } from '@/lib/utils';
import { statusTone, TAKEOFF_STATUSES } from './takeoffUi';

interface TakeoffListPanelProps {
  takeoffs: QuantityTakeoff[];
  takeoffLines: QuantityTakeoffLine[];
  selectedTakeoffId?: string;
  search: string;
  statusFilter: string;
  loading: boolean;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onSelect: (takeoffId: string) => void;
}

export function TakeoffListPanel({
  takeoffs,
  takeoffLines,
  selectedTakeoffId,
  search,
  statusFilter,
  loading,
  onSearchChange,
  onStatusFilterChange,
  onSelect,
}: TakeoffListPanelProps) {
  return (
    <Card className="h-fit border-slate-200/80 shadow-none xl:sticky xl:top-4">
      <CardContent className="space-y-3 p-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Hae nimeä, projektia tai riviä"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger><SelectValue placeholder="Tila" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Kaikki tilat</SelectItem>
            {TAKEOFF_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
          {takeoffs.map((takeoff) => {
            const lines = takeoffLines.filter((line) => line.takeoffId === takeoff.id);
            const missing = lines.filter((line) => line.quantity <= 0).length;
            const phases = new Set(lines.map((line) => line.workPhase)).size;
            const selected = selectedTakeoffId === takeoff.id;
            return (
              <button
                key={takeoff.id}
                type="button"
                onClick={() => onSelect(takeoff.id)}
                className={cn(
                  'w-full rounded-xl border p-3 text-left transition',
                  selected
                    ? 'border-orange-400 bg-orange-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-900">{takeoff.name}</p>
                    <p className="mt-0.5 break-words text-xs text-slate-500">
                      {takeoff.projectName || 'Ei projektia'}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn('shrink-0', statusTone(takeoff.status))}>
                    {takeoff.status}
                  </Badge>
                </div>
                <p className="mt-2 break-words text-xs text-slate-600">
                  {lines.length} riviä · {phases} työvaihetta
                  {missing > 0 ? ` · ${missing} ilman määrää` : ''}
                </p>
              </button>
            );
          })}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Ladataan…
            </div>
          )}
          {!loading && takeoffs.length === 0 && (
            <div className="px-2 py-10 text-center">
              <Ruler size={36} className="mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-800">Ei määrälaskelmia</p>
              <p className="mt-1 break-words text-xs text-slate-500">
                Luo uusi laskelma tai muuta hakua.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
