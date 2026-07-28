import { Plus, ShieldCheck, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  PortalAccount,
  PortalOrderDraft,
  PortalOrderItemDraft,
  PortalProject,
  PortalUrgency,
} from '@/lib/supabase/customerPortalOrders';

const CATEGORIES = [
  'Pienkorjaus', 'Huolto', 'Maalaus', 'Lattiatyö', 'Kaluste- tai keittiötyö',
  'LVI-työ', 'Sähkötyö', 'Tarkastus', 'Muu',
];

export const EMPTY_ORDER_ITEM: PortalOrderItemDraft = {
  title: '', description: '', locationDetails: '', quantity: '', unit: 'kpl', priority: 'Normaali',
};

export const EMPTY_ORDER_DRAFT: Omit<PortalOrderDraft, 'organizationId'> = {
  customerId: '', projectId: '', title: '', category: '', description: '', urgency: 'Normaali',
  locationDetails: '', serviceAddress: '', building: '', stairwell: '', unit: '',
  contactName: '', contactPhone: '', requestedDate: '', desiredCompletionDate: '',
  preferredTime: '', accessWindow: '', accessInstructions: '', safetyNotes: '',
  customerReference: '', purchaseOrderNumber: '', budgetLimitCents: undefined,
  items: [{ ...EMPTY_ORDER_ITEM }],
};

interface Props {
  open: boolean;
  saving: boolean;
  accounts: PortalAccount[];
  projects: PortalProject[];
  draft: Omit<PortalOrderDraft, 'organizationId'>;
  onDraftChange: (draft: Omit<PortalOrderDraft, 'organizationId'>) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}

export default function CustomerOrderCreateDialog({
  open, saving, accounts, projects, draft, onDraftChange, onOpenChange, onSubmit,
}: Props) {
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    onDraftChange({ ...draft, [key]: value });
  };

  const updateItem = (index: number, patch: Partial<PortalOrderItemDraft>) => {
    const items = [...draft.items];
    items[index] = { ...items[index], ...patch };
    set('items', items);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader><DialogTitle>Uusi työtilaus</DialogTitle></DialogHeader>

        <div className="space-y-6">
          <section>
            <h3 className="mb-3 font-semibold">Perustiedot</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Asiakkuus *</Label>
                <Select value={draft.customerId} onValueChange={(customerId) => {
                  const project = projects.find((item) => item.customerId === customerId);
                  onDraftChange({
                    ...draft,
                    customerId,
                    projectId: project?.id ?? '',
                    serviceAddress: project?.location ?? '',
                  });
                }}>
                  <SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter((item) => item.permissions['orders.create'] !== false).map((account) => (
                      <SelectItem key={account.customerId} value={account.customerId}>{account.customerName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Projekti / kohde *</Label>
                <Select value={draft.projectId} onValueChange={(projectId) => {
                  const project = projects.find((item) => item.id === projectId);
                  onDraftChange({
                    ...draft,
                    projectId,
                    customerId: project?.customerId ?? draft.customerId,
                    serviceAddress: project?.location ?? draft.serviceAddress,
                  });
                }}>
                  <SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger>
                  <SelectContent>
                    {projects.filter((project) => !draft.customerId || project.customerId === draft.customerId).map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} · {project.location || 'Ei sijaintia'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Työn otsikko *</Label>
                <Input
                  value={draft.title}
                  onChange={(event) => set('title', event.target.value)}
                  placeholder="Esimerkiksi huoneiston seinien maalaus"
                  maxLength={180}
                />
              </div>

              <div className="space-y-2">
                <Label>Työn laji *</Label>
                <Select value={draft.category} onValueChange={(value) => set('category', value)}>
                  <SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Kiireellisyys</Label>
                <Select value={draft.urgency} onValueChange={(value) => set('urgency', value as PortalUrgency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kiireellinen">Kiireellinen</SelectItem>
                    <SelectItem value="Normaali">Normaali</SelectItem>
                    <SelectItem value="Ei kiireellinen">Ei kiireellinen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Työn kokonaiskuvaus *</Label>
                <Textarea
                  rows={5}
                  value={draft.description}
                  onChange={(event) => set('description', event.target.value)}
                  placeholder="Mitä tehdään, missä laajuudessa ja millainen lopputulos tarvitaan?"
                  maxLength={5000}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Tilattavat työvaiheet *</h3>
                <p className="text-xs text-slate-500">Määritä työn osat, määrä ja mahdollinen tarkka sijainti.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => set('items', [...draft.items, { ...EMPTY_ORDER_ITEM }])}>
                <Plus size={15} className="mr-1" /> Lisää vaihe
              </Button>
            </div>

            {draft.items.map((item, index) => (
              <div key={item.id ?? index} className="grid gap-3 rounded-xl border p-4 lg:grid-cols-[1.2fr_1fr_110px_100px_auto]">
                <Input value={item.title} onChange={(event) => updateItem(index, { title: event.target.value })} placeholder={`Työvaihe ${index + 1}`} />
                <Input value={item.locationDetails ?? ''} onChange={(event) => updateItem(index, { locationDetails: event.target.value })} placeholder="Sijainti / huone" />
                <Input value={item.quantity ?? ''} onChange={(event) => updateItem(index, { quantity: event.target.value })} placeholder="Määrä" />
                <Input value={item.unit ?? ''} onChange={(event) => updateItem(index, { unit: event.target.value })} placeholder="Yksikkö" />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={draft.items.length === 1}
                  onClick={() => set('items', draft.items.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <Trash2 size={16} />
                </Button>
                <Textarea
                  rows={2}
                  className="lg:col-span-4"
                  value={item.description ?? ''}
                  onChange={(event) => updateItem(index, { description: event.target.value })}
                  placeholder="Työvaiheen tarkennus"
                />
              </div>
            ))}
          </section>

          <section>
            <h3 className="mb-3 font-semibold">Kohde ja kulku</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ['serviceAddress', 'Osoite'], ['building', 'Rakennus'], ['stairwell', 'Rappu'], ['unit', 'Huoneisto / tila'],
                ['locationDetails', 'Tarkka sijainti'], ['accessWindow', 'Sallittu käyntiaika'],
                ['accessInstructions', 'Avaimet / pääsyohje'], ['preferredTime', 'Toivottu kellonaika'],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Input value={draft[key] ?? ''} onChange={(event) => set(key, event.target.value)} />
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-semibold">Aikataulu, viitteet ja yhteyshenkilö</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2"><Label>Toivottu aloitus</Label><Input type="date" value={draft.requestedDate ?? ''} onChange={(event) => set('requestedDate', event.target.value)} /></div>
              <div className="space-y-2"><Label>Toivottu valmistuminen</Label><Input type="date" value={draft.desiredCompletionDate ?? ''} onChange={(event) => set('desiredCompletionDate', event.target.value)} /></div>
              <div className="space-y-2"><Label>Yhteyshenkilö</Label><Input value={draft.contactName ?? ''} onChange={(event) => set('contactName', event.target.value)} /></div>
              <div className="space-y-2"><Label>Puhelin</Label><Input value={draft.contactPhone ?? ''} onChange={(event) => set('contactPhone', event.target.value)} /></div>
              <div className="space-y-2"><Label>Tilaajan viite</Label><Input value={draft.customerReference ?? ''} onChange={(event) => set('customerReference', event.target.value)} /></div>
              <div className="space-y-2"><Label>Ostotilausnumero</Label><Input value={draft.purchaseOrderNumber ?? ''} onChange={(event) => set('purchaseOrderNumber', event.target.value)} /></div>
              <div className="space-y-2">
                <Label>Budjettiraja (€)</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.budgetLimitCents === undefined ? '' : draft.budgetLimitCents / 100}
                  onChange={(event) => set('budgetLimitCents', event.target.value ? Math.round(Number(event.target.value) * 100) : undefined)}
                />
              </div>
            </div>
          </section>

          <div className="space-y-2">
            <Label>Turvallisuus- ja erityishuomiot</Label>
            <Textarea rows={3} value={draft.safetyNotes ?? ''} onChange={(event) => set('safetyNotes', event.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Peruuta</Button>
          <Button onClick={onSubmit} disabled={saving}>
            <ShieldCheck size={16} className="mr-2" /> {saving ? 'Lähetetään…' : 'Lähetä työtilaus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
