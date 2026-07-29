import { Edit3, Euro, PackagePlus, Search, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PriceCatalogItem } from '@/lib/supabase/offers';
import { euro, OFFER_CATEGORIES } from './offerUi';

interface CatalogTabProps {
  items: PriceCatalogItem[];
  search: string;
  categoryFilter: string;
  onSearchChange: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onCreate: () => void;
  onEdit: (item: PriceCatalogItem) => void;
  onDelete: (item: PriceCatalogItem) => void;
}

export function CatalogTab({
  items,
  search,
  categoryFilter,
  onSearchChange,
  onCategoryFilterChange,
  onCreate,
  onEdit,
  onDelete,
}: CatalogTabProps) {
  const normalized = search.trim().toLocaleLowerCase('fi-FI');
  const filtered = items.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (!normalized) return true;
    return [item.code, item.name, item.description, item.category]
      .join(' ')
      .toLocaleLowerCase('fi-FI')
      .includes(normalized);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Hae tunnusta, nimeä tai kuvausta"
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
            <SelectTrigger><SelectValue placeholder="Kategoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Kaikki kategoriat</SelectItem>
              {OFFER_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onCreate}>
          <PackagePlus size={16} className="mr-2" /> Uusi hinnastorivi
        </Button>
      </div>

      <Card className="overflow-hidden border-slate-200/80 shadow-none">
        <CardContent className="p-0">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 lg:flex-row lg:items-start lg:justify-between"
            >
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{item.category}</Badge>
                  {!item.active && (
                    <Badge className="border-slate-200 bg-slate-100 text-slate-600">Ei aktiivinen</Badge>
                  )}
                  <span className="break-words font-mono text-xs text-slate-500">
                    {item.code || 'Ei tunnusta'}
                  </span>
                </div>
                <p className="break-words font-semibold text-slate-900">{item.name}</p>
                <p className="break-words text-sm text-slate-500">
                  {item.description || 'Ei kuvausta'}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-4 lg:justify-end">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Yksikkö</p>
                  <p className="font-medium">{item.unit}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Kustannus</p>
                  <p className="font-mono">{euro(item.costUnitPriceCents)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Myynti</p>
                  <p className="font-mono font-semibold">{euro(item.saleUnitPriceCents)}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                    <Edit3 size={14} className="mr-1" /> Muokkaa
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(item)}>
                    <Trash2 size={14} className="mr-1" /> Poista
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {!filtered.length && (
            <div className="p-14 text-center">
              <Euro size={44} className="mx-auto mb-3 text-slate-300" />
              <p className="font-semibold">
                {items.length ? 'Ei osumia suodattimilla' : 'Hinnasto on tyhjä'}
              </p>
              <p className="mt-1 break-words text-sm text-slate-500">
                Lisää työn, materiaalien ja aliurakoiden vakiohinnat, jotta tarjousrivien luonti on nopeaa.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
