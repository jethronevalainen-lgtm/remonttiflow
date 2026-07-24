import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Euro,
  Handshake,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/states';
import { cn } from '@/lib/utils';
import { useAppDataContext } from '@/contexts/AppDataContext';
import type { CrmLead, CrmLeadStage } from '@/types';

/* ─── Vaiheet ─── */
const STAGES: CrmLeadStage[] = ['Uusi', 'Tarjous tehty', 'Neuvottelu', 'Sopimus'];

const STAGE_STYLES: Record<CrmLeadStage, { dot: string; text: string; bg: string }> = {
  Uusi: { dot: 'bg-info', text: 'text-info', bg: 'bg-info-light' },
  'Tarjous tehty': { dot: 'bg-warning', text: 'text-warning', bg: 'bg-warning-light' },
  Neuvottelu: { dot: 'bg-primary', text: 'text-primary', bg: 'bg-primary-light' },
  Sopimus: { dot: 'bg-success', text: 'text-success', bg: 'bg-success-light' },
};

const currency = new Intl.NumberFormat('fi-FI', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fi-FI');
};

/* ─── Lomake ─── */
interface LeadForm {
  name: string;
  company: string;
  value: string;
  stage: CrmLeadStage;
  assignee: string;
  date: string;
}

type FormErrors = Partial<Record<keyof LeadForm, string>>;

const emptyForm: LeadForm = {
  name: '',
  company: '',
  value: '',
  stage: 'Uusi',
  assignee: '',
  date: new Date().toISOString().slice(0, 10),
};

/* ─── Komponentti ─── */
export default function CRM() {
  const { crmLeads, addCrmLead, updateCrmLead, deleteCrmLead } = useAppDataContext();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CrmLead | null>(null);
  const [form, setForm] = useState<LeadForm>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});

  const leadsByStage = useMemo(() => {
    const grouped: Record<CrmLeadStage, CrmLead[]> = {
      Uusi: [],
      'Tarjous tehty': [],
      Neuvottelu: [],
      Sopimus: [],
    };
    crmLeads.forEach(lead => {
      grouped[lead.stage].push(lead);
    });
    return grouped;
  }, [crmLeads]);

  const totalValue = crmLeads.reduce((sum, l) => sum + (l.value || 0), 0);
  const openLeads = crmLeads.filter(l => l.stage !== 'Sopimus');
  const openValue = openLeads.reduce((sum, l) => sum + (l.value || 0), 0);
  const wonCount = leadsByStage['Sopimus'].length;

  const openCreateDialog = (stage: CrmLeadStage = 'Uusi') => {
    setEditingLead(null);
    setForm({ ...emptyForm, stage, date: new Date().toISOString().slice(0, 10) });
    setErrors({});
    setDialogOpen(true);
  };

  const openEditDialog = (lead: CrmLead) => {
    setEditingLead(lead);
    setForm({
      name: lead.name,
      company: lead.company,
      value: String(lead.value),
      stage: lead.stage,
      assignee: lead.assignee,
      date: lead.date,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const setField = <K extends keyof LeadForm>(field: K, value: LeadForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = 'Nimi on pakollinen';
    if (form.value.trim()) {
      const parsed = Number(form.value.replace(/\s/g, '').replace(',', '.'));
      if (Number.isNaN(parsed) || parsed < 0) {
        next.value = 'Arvon täytyy olla ei-negatiivinen luku';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const parsedValue = form.value.trim()
      ? Number(form.value.replace(/\s/g, '').replace(',', '.'))
      : 0;
    const payload = {
      name: form.name.trim(),
      company: form.company.trim(),
      value: parsedValue,
      stage: form.stage,
      assignee: form.assignee.trim(),
      date: form.date,
    };
    if (editingLead) {
      updateCrmLead(editingLead.id, payload);
    } else {
      addCrmLead(payload);
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteCrmLead(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const advanceStage = (lead: CrmLead) => {
    const idx = STAGES.indexOf(lead.stage);
    if (idx >= 0 && idx < STAGES.length - 1) {
      updateCrmLead(lead.id, { stage: STAGES[idx + 1] });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-6"
    >
      {/* ── Sivun otsikko ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-body-sm text-text-secondary mb-1">
            <span>Dashboard</span>
            <ChevronRight size={14} />
            <span className="text-text-primary font-medium">CRM</span>
          </div>
          <h1 className="text-hero text-text-primary">CRM</h1>
          <p className="text-body-sm text-text-secondary mt-1">
            Myyntiputki ja asiakassuhteiden hallinta
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="bg-primary hover:bg-primary-hover text-white gap-2"
            onClick={() => openCreateDialog()}
          >
            <Plus size={16} /> Uusi liidi
          </Button>
        </div>
      </div>

      {/* ── Tilastot ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Liidit yhteensä',
            value: crmLeads.length,
            icon: Briefcase,
            color: 'text-primary',
            bg: 'bg-primary-light',
          },
          {
            label: 'Avoin putki',
            value: currency.format(openValue),
            icon: Euro,
            color: 'text-warning',
            bg: 'bg-warning-light',
          },
          {
            label: 'Sopimukset',
            value: wonCount,
            icon: Handshake,
            color: 'text-success',
            bg: 'bg-success-light',
          },
          {
            label: 'Kokonaisarvo',
            value: currency.format(totalValue),
            icon: TrendingUp,
            color: 'text-info',
            bg: 'bg-info-light',
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.2 }}
          >
            <Card className="border border-[#E2E8F0] shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-caption text-text-secondary uppercase tracking-wider">
                    {stat.label}
                  </span>
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      stat.bg,
                    )}
                  >
                    <stat.icon size={20} className={stat.color} />
                  </div>
                </div>
                <p className="text-[28px] font-bold text-text-primary font-mono leading-none">
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Myyntiputki ── */}
      {crmLeads.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={40} />}
          title="Ei liidejä"
          description="Myyntiputki on tyhjä. Lisää ensimmäinen liidi aloittaaksesi."
          action={
            <Button
              className="bg-primary hover:bg-primary-hover text-white gap-2"
              onClick={() => openCreateDialog()}
            >
              <Plus size={16} /> Uusi liidi
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STAGES.map(stage => {
            const stageLeads = leadsByStage[stage];
            const stageValue = stageLeads.reduce((sum, l) => sum + (l.value || 0), 0);
            const style = STAGE_STYLES[stage];
            return (
              <div key={stage} className="space-y-3">
                {/* Vaiheen otsikko */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2.5 h-2.5 rounded-full', style.dot)} />
                    <span className="text-sm font-semibold text-text-primary">{stage}</span>
                    <span className="text-body-sm text-text-muted font-mono">
                      {stageLeads.length}
                    </span>
                  </div>
                  <span className="text-body-sm text-text-secondary font-mono">
                    {currency.format(stageValue)}
                  </span>
                </div>

                {/* Liidikortit */}
                <div className="space-y-3">
                  {stageLeads.map(lead => (
                    <motion.div
                      key={lead.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Card className="border border-[#E2E8F0] shadow-card hover:shadow-card-hover transition-all">
                        <CardContent className="p-4 space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-text-primary">
                              {lead.name}
                            </p>
                            <p className="text-body-sm text-text-secondary mt-0.5">
                              {lead.company}
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-mono text-sm font-bold text-text-primary">
                              {currency.format(lead.value)}
                            </span>
                            <span className="text-body-sm text-text-muted">
                              {formatDate(lead.date)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-[#F1F5F9]">
                            <span className="text-body-sm text-text-secondary truncate">
                              {lead.assignee || '—'}
                            </span>
                            <div className="flex items-center gap-1">
                              {stage !== 'Sopimus' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn('h-8 w-8 p-0', style.text)}
                                  onClick={() => advanceStage(lead)}
                                  aria-label={`Siirrä liidi ${lead.name} seuraavaan vaiheeseen`}
                                  title="Siirrä seuraavaan vaiheeseen"
                                >
                                  <ArrowRight size={16} />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-text-secondary hover:text-primary"
                                onClick={() => openEditDialog(lead)}
                                aria-label={`Muokkaa liidiä ${lead.name}`}
                              >
                                <Pencil size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-text-secondary hover:text-danger"
                                onClick={() => setDeleteTarget(lead)}
                                aria-label={`Poista liidi ${lead.name}`}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}

                  {stageLeads.length === 0 && (
                    <div className="rounded-xl border border-dashed border-[#E2E8F0] p-6 text-center">
                      <p className="text-body-sm text-text-muted">Ei liidejä tässä vaiheessa</p>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-1 text-text-secondary hover:text-primary border border-dashed border-[#E2E8F0]"
                    onClick={() => openCreateDialog(stage)}
                  >
                    <Plus size={14} /> Lisää liidi
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Luonti-/muokkausdialogi ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-h2">
              {editingLead ? 'Muokkaa liidiä' : 'Uusi liidi'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lead-name">Nimi *</Label>
              <Input
                id="lead-name"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="esim. Korjaustyö Lahti"
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-sm text-danger">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-company">Yritys</Label>
              <Input
                id="lead-company"
                value={form.company}
                onChange={e => setField('company', e.target.value)}
                placeholder="esim. As Oy Lahden Keskusta"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lead-value">Arvo (€)</Label>
                <Input
                  id="lead-value"
                  inputMode="decimal"
                  value={form.value}
                  onChange={e => setField('value', e.target.value)}
                  placeholder="esim. 320000"
                  aria-invalid={!!errors.value}
                />
                {errors.value && <p className="text-sm text-danger">{errors.value}</p>}
              </div>
              <div className="space-y-2">
                <Label>Vaihe</Label>
                <Select
                  value={form.stage}
                  onValueChange={v => setField('stage', v as CrmLeadStage)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Valitse vaihe" />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map(s => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lead-assignee">Vastaava</Label>
                <Input
                  id="lead-assignee"
                  value={form.assignee}
                  onChange={e => setField('assignee', e.target.value)}
                  placeholder="esim. Liisa Virtanen"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-date">Päivämäärä</Label>
                <Input
                  id="lead-date"
                  type="date"
                  value={form.date}
                  onChange={e => setField('date', e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Peruuta
            </Button>
            <Button
              className="bg-primary hover:bg-primary-hover text-white"
              onClick={handleSave}
            >
              {editingLead ? 'Tallenna muutokset' : 'Lisää liidi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Poiston vahvistus ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poista liidi</AlertDialogTitle>
            <AlertDialogDescription>
              Haluatko varmasti poistaa liidin{' '}
              <span className="font-semibold">{deleteTarget?.name}</span>? Toimintoa ei voi
              peruuttaa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Peruuta</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger/90 text-white"
              onClick={handleDelete}
            >
              Poista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
