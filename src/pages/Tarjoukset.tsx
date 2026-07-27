import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Archive,
  Calculator,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  Euro,
  FilePlus2,
  FileText,
  FolderKanban,
  History,
  Loader2,
  PackagePlus,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  Send,
  Settings2,
  Trash2,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useFinanceFormsData } from '@/hooks/useFinanceFormsData';
import { useOffersData } from '@/hooks/useOffersData';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import {
  calculateOfferLineTotals,
  calculateOfferVersionTotals,
  calculateRecommendedSaleUnitCents,
} from '@/lib/pricing/offerCalculator';
import { openOfferPrintWindow } from '@/lib/pricing/offerPrint';
import {
  addCatalogItem,
  addOfferLine,
  addOfferLines,
  addOfferSection,
  convertOfferToProject,
  createOffer,
  createOfferVersion,
  deleteCatalogItem,
  deleteOffer,
  deleteOfferLine,
  deleteOfferSection,
  transitionOffer,
  updateCatalogItem,
  updateOffer,
  updateOfferLine,
  updateOfferVersion,
  type OfferLine,
  type OfferSection,
  type OfferStatus,
  type PriceCatalogItem,
} from '@/lib/supabase/offers';

const CATEGORIES = ['Työ', 'Materiaali', 'Aliurakka', 'Kalusto', 'Kuljetus', 'Jäte', 'Muu'];
const UNSECTIONED = '__none__';

interface OfferForm {
  name: string;
  customerId: string;
  crmLeadId: string;
  projectId: string;
  offerNumber: string;
  validUntil: string;
  notes: string;
  assignedUserId: string;
}

interface OfferMetaForm {
  name: string;
  validUntil: string;
  customerReference: string;
  deliveryTime: string;
  paymentTerms: string;
  notes: string;
  assignedUserId: string;
}

interface LineForm {
  category: string;
  description: string;
  sectionId: string;
  quantity: string;
  unit: string;
  costUnitPrice: string;
  saleUnitPrice: string;
  wastePercent: string;
  discountPercent: string;
  internalNote: string;
  customerNote: string;
  customerVisible: boolean;
  optional: boolean;
  catalogItemId: string;
}

interface CatalogForm {
  code: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  costUnitPrice: string;
  saleUnitPrice: string;
  wastePercent: string;
  active: boolean;
}

const emptyOffer = (): OfferForm => ({
  name: '',
  customerId: '',
  crmLeadId: '',
  projectId: '',
  offerNumber: '',
  validUntil: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  notes: '',
  assignedUserId: '',
});

const emptyLine = (): LineForm => ({
  category: 'Työ',
  description: '',
  sectionId: UNSECTIONED,
  quantity: '1',
  unit: 'h',
  costUnitPrice: '0',
  saleUnitPrice: '0',
  wastePercent: '0',
  discountPercent: '0',
  internalNote: '',
  customerNote: '',
  customerVisible: true,
  optional: false,
  catalogItemId: '',
});

const emptyCatalog = (): CatalogForm => ({
  code: '',
  name: '',
  category: 'Työ',
  description: '',
  unit: 'h',
  costUnitPrice: '0',
  saleUnitPrice: '0',
  wastePercent: '0',
  active: true,
});

function euro(cents: number): string {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function date(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function dateTime(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function moneyInput(value: string): number {
  return Number(value.replace(/\s/g, '').replace(',', '.'));
}

function centsInput(value: string): number {
  const euros = moneyInput(value);
  return Number.isFinite(euros) ? Math.round(euros * 100) : Number.NaN;
}

function statusTone(status: OfferStatus | string): string {
  if (status === 'Hyväksytty') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Lähetetty') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'Hylätty') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'Vanhentunut') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'Korvattu' || status === 'Arkistoitu') return 'border-slate-200 bg-slate-100 text-slate-600';
  return 'border-orange-200 bg-orange-50 text-orange-700';
}

function marginTone(percent: number): string {
  if (percent >= 25) return 'text-emerald-700';
  if (percent >= 15) return 'text-amber-700';
  return 'text-red-700';
}

export default function Tarjoukset() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { customers, crmLeads, projects, refresh: refreshAppData } = useAppDataContext();
  const { people } = useRoleWorkspace();
  const finance = useFinanceFormsData();
  const data = useOffersData();

  const [tab, setTab] = useState(searchParams.get('tab') === 'hinnasto' ? 'catalog' : 'offers');
  const [selectedOfferId, setSelectedOfferId] = useState(searchParams.get('offer') ?? '');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [offerDialog, setOfferDialog] = useState(false);
  const [offerMetaDialog, setOfferMetaDialog] = useState(false);
  const [lineDialog, setLineDialog] = useState(false);
  const [sectionDialog, setSectionDialog] = useState(false);
  const [catalogDialog, setCatalogDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [offerForm, setOfferForm] = useState<OfferForm>(emptyOffer);
  const [offerMetaForm, setOfferMetaForm] = useState<OfferMetaForm>({
    name: '', validUntil: '', customerReference: '', deliveryTime: '', paymentTerms: '', notes: '', assignedUserId: '',
  });
  const [lineForm, setLineForm] = useState<LineForm>(emptyLine);
  const [editingLine, setEditingLine] = useState<OfferLine | null>(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionDescription, setSectionDescription] = useState('');
  const [editingCatalog, setEditingCatalog] = useState<PriceCatalogItem | null>(null);
  const [catalogForm, setCatalogForm] = useState<CatalogForm>(emptyCatalog);
  const [takeoffId, setTakeoffId] = useState('');
  const [settings, setSettings] = useState({ vatRate: '25.5', overheadPercent: '0', riskPercent: '0', marginPercent: '20', notes: '', terms: '' });
  const [errors, setErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const normalizedSearch = search.trim().toLocaleLowerCase('fi-FI');
  const filteredOffers = useMemo(() => data.offers.filter((offer) => {
    if (statusFilter !== 'all' && offer.status !== statusFilter) return false;
    if (!normalizedSearch) return true;
    const customer = customers.find((item) => item.id === offer.customerId);
    return [offer.name, offer.offerNumber, customer?.name]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('fi-FI')
      .includes(normalizedSearch);
  }), [customers, data.offers, normalizedSearch, statusFilter]);

  const selectedOffer = data.offers.find((offer) => offer.id === selectedOfferId)
    ?? filteredOffers[0]
    ?? null;
  const offerVersions = selectedOffer
    ? data.versions.filter((version) => version.offerId === selectedOffer.id)
    : [];
  const selectedVersion = offerVersions.find((version) => version.id === selectedVersionId)
    ?? offerVersions[0]
    ?? null;
  const versionSections = selectedVersion
    ? data.sections.filter((section) => section.offerVersionId === selectedVersion.id)
    : [];
  const versionLines = selectedVersion
    ? data.lines.filter((line) => line.offerVersionId === selectedVersion.id)
    : [];
  const versionEvents = selectedOffer
    ? data.events.filter((event) => event.offerId === selectedOffer.id)
    : [];
  const customer = selectedOffer ? customers.find((item) => item.id === selectedOffer.customerId) : undefined;
  const lead = selectedOffer ? crmLeads.find((item) => item.id === selectedOffer.crmLeadId) : undefined;
  const linkedProject = selectedOffer ? projects.find((item) => item.id === (selectedOffer.convertedProjectId ?? selectedOffer.projectId)) : undefined;
  const draft = selectedOffer?.status === 'Luonnos' && selectedVersion?.status === 'Luonnos';

  const browserTotals = selectedVersion
    ? calculateOfferVersionTotals(versionLines.map((line) => ({
        quantity: line.quantity,
        costUnitPriceCents: line.costUnitPriceCents,
        saleUnitPriceCents: line.saleUnitPriceCents,
        wastePercent: line.wastePercent,
        discountPercent: line.discountPercent,
        optional: line.optional,
      })), {
        vatRate: selectedVersion.vatRate,
        overheadPercent: selectedVersion.overheadPercent,
        riskPercent: selectedVersion.riskPercent,
        targetMarginPercent: selectedVersion.marginPercent,
      })
    : null;
  const totalsMismatch = Boolean(selectedVersion && browserTotals && (
    Math.abs(selectedVersion.subtotalCents - browserTotals.saleSubtotalCents) > 1
    || Math.abs(selectedVersion.estimatedCostCents - browserTotals.estimatedCostCents) > 1
    || Math.abs(selectedVersion.totalCents - browserTotals.totalCents) > 1
  ));

  useEffect(() => {
    if (selectedOffer && selectedOffer.id !== selectedOfferId) setSelectedOfferId(selectedOffer.id);
  }, [selectedOffer, selectedOfferId]);

  useEffect(() => {
    if (selectedVersion && selectedVersion.id !== selectedVersionId) setSelectedVersionId(selectedVersion.id);
  }, [selectedVersion, selectedVersionId]);

  useEffect(() => {
    const leadId = searchParams.get('lead');
    const customerId = searchParams.get('customer');
    const projectId = searchParams.get('project');
    if (!leadId && !customerId && !projectId) return;
    const next = emptyOffer();
    const queryLead = crmLeads.find((item) => item.id === leadId);
    const queryCustomer = customers.find((item) => item.id === (customerId ?? queryLead?.customerId));
    const queryProject = projects.find((item) => item.id === projectId);
    next.crmLeadId = queryLead?.id ?? '';
    next.customerId = queryCustomer?.id ?? '';
    next.projectId = queryProject?.id ?? '';
    next.name = queryLead?.name ?? queryProject?.name ?? '';
    next.notes = queryLead?.description ?? queryProject?.description ?? '';
    next.assignedUserId = queryLead?.assigneeUserId ?? '';
    setOfferForm(next);
    setOfferDialog(true);
    setSearchParams({}, { replace: true });
  }, [crmLeads, customers, projects, searchParams, setSearchParams]);

  useEffect(() => {
    if (!selectedVersion) return;
    setSettings({
      vatRate: String(selectedVersion.vatRate),
      overheadPercent: String(selectedVersion.overheadPercent),
      riskPercent: String(selectedVersion.riskPercent),
      marginPercent: String(selectedVersion.marginPercent),
      notes: selectedVersion.notes,
      terms: selectedVersion.terms,
    });
  }, [selectedVersion]);

  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    setOperationError(null);
    try {
      await action();
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Toiminto epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([data.refresh(), finance.refresh(), refreshAppData()]);
  };

  const openOfferCreate = () => {
    setOfferForm(emptyOffer());
    setErrors([]);
    setOperationError(null);
    setOfferDialog(true);
  };

  const selectLead = (crmLeadId: string) => {
    const selected = crmLeads.find((item) => item.id === crmLeadId);
    setOfferForm((previous) => ({
      ...previous,
      crmLeadId,
      customerId: selected?.customerId ?? previous.customerId,
      name: previous.name || selected?.name || '',
      notes: previous.notes || selected?.description || '',
      assignedUserId: selected?.assigneeUserId ?? previous.assignedUserId,
    }));
  };

  const saveOffer = async () => {
    const nextErrors: string[] = [];
    if (!offerForm.name.trim()) nextErrors.push('Tarjouksen nimi on pakollinen.');
    if (!offerForm.customerId && !offerForm.crmLeadId && !offerForm.projectId) {
      nextErrors.push('Valitse vähintään asiakas, CRM-mahdollisuus tai projekti.');
    }
    setErrors(nextErrors);
    if (nextErrors.length || !currentOrg) return;
    await run(async () => {
      const offerId = await createOffer({
        organizationId: currentOrg.id,
        customerId: offerForm.customerId || undefined,
        crmLeadId: offerForm.crmLeadId || undefined,
        projectId: offerForm.projectId || undefined,
        name: offerForm.name.trim(),
        offerNumber: offerForm.offerNumber.trim() || undefined,
        validUntil: offerForm.validUntil || undefined,
        notes: offerForm.notes.trim() || undefined,
        assignedUserId: offerForm.assignedUserId || undefined,
      });
      await refreshAll();
      setSelectedOfferId(offerId);
      setSelectedVersionId('');
      setOfferDialog(false);
    });
  };

  const openOfferMeta = () => {
    if (!selectedOffer) return;
    setOfferMetaForm({
      name: selectedOffer.name,
      validUntil: selectedOffer.validUntil ?? '',
      customerReference: selectedOffer.customerReference,
      deliveryTime: selectedOffer.deliveryTime,
      paymentTerms: selectedOffer.paymentTerms,
      notes: selectedOffer.notes,
      assignedUserId: selectedOffer.assignedUserId ?? '',
    });
    setOfferMetaDialog(true);
  };

  const saveOfferMeta = async () => {
    if (!currentOrg || !selectedOffer || !offerMetaForm.name.trim()) return;
    await run(async () => {
      await updateOffer(currentOrg.id, selectedOffer.id, {
        ...offerMetaForm,
        name: offerMetaForm.name.trim(),
      });
      await data.refresh();
      setOfferMetaDialog(false);
    });
  };

  const saveSettings = async () => {
    if (!currentOrg || !selectedVersion) return;
    const vatRate = Number(settings.vatRate);
    const overheadPercent = Number(settings.overheadPercent);
    const riskPercent = Number(settings.riskPercent);
    const marginPercent = Number(settings.marginPercent);
    if (![vatRate, overheadPercent, riskPercent, marginPercent].every(Number.isFinite)
      || vatRate < 0 || vatRate > 100
      || overheadPercent < 0 || overheadPercent > 100
      || riskPercent < 0 || riskPercent > 100
      || marginPercent < 0 || marginPercent >= 100) {
      setOperationError('ALV:n, yleiskulujen ja riskin pitää olla 0–100 %. Tavoitekatteen pitää olla alle 100 %.');
      return;
    }
    await run(async () => {
      await updateOfferVersion(currentOrg.id, selectedVersion.id, {
        vatRate, overheadPercent, riskPercent, marginPercent,
        notes: settings.notes,
        terms: settings.terms,
      });
      await data.refresh();
    });
  };

  const openLineCreate = (sectionId = UNSECTIONED) => {
    setEditingLine(null);
    setLineForm({ ...emptyLine(), sectionId });
    setErrors([]);
    setLineDialog(true);
  };

  const openLineEdit = (line: OfferLine) => {
    setEditingLine(line);
    setLineForm({
      category: line.category,
      description: line.description,
      sectionId: line.sectionId ?? UNSECTIONED,
      quantity: String(line.quantity),
      unit: line.unit,
      costUnitPrice: String(line.costUnitPriceCents / 100),
      saleUnitPrice: String(line.saleUnitPriceCents / 100),
      wastePercent: String(line.wastePercent),
      discountPercent: String(line.discountPercent),
      internalNote: line.internalNote,
      customerNote: line.customerNote,
      customerVisible: line.customerVisible,
      optional: line.optional,
      catalogItemId: line.sourceCatalogItemId ?? '',
    });
    setErrors([]);
    setLineDialog(true);
  };

  const selectCatalogItem = (catalogItemId: string) => {
    const item = data.catalog.find((current) => current.id === catalogItemId);
    if (!item) return;
    setLineForm((previous) => ({
      ...previous,
      catalogItemId,
      category: item.category,
      description: item.name,
      unit: item.unit,
      costUnitPrice: String(item.costUnitPriceCents / 100),
      saleUnitPrice: String(item.saleUnitPriceCents / 100),
      wastePercent: String(item.defaultWastePercent),
      customerNote: item.description,
    }));
  };

  const recommendLinePrice = () => {
    if (!selectedVersion) return;
    const cost = centsInput(lineForm.costUnitPrice);
    if (!Number.isFinite(cost)) return;
    const recommended = calculateRecommendedSaleUnitCents(cost, {
      overheadPercent: selectedVersion.overheadPercent,
      riskPercent: selectedVersion.riskPercent,
      targetMarginPercent: selectedVersion.marginPercent,
    });
    setLineForm((previous) => ({ ...previous, saleUnitPrice: String(recommended / 100) }));
  };

  const saveLine = async () => {
    if (!currentOrg || !selectedVersion) return;
    const quantity = moneyInput(lineForm.quantity);
    const costUnitPriceCents = centsInput(lineForm.costUnitPrice);
    const saleUnitPriceCents = centsInput(lineForm.saleUnitPrice);
    const wastePercent = moneyInput(lineForm.wastePercent);
    const discountPercent = moneyInput(lineForm.discountPercent);
    const nextErrors: string[] = [];
    if (!lineForm.description.trim()) nextErrors.push('Tarjousrivin kuvaus on pakollinen.');
    if (!Number.isFinite(quantity) || quantity <= 0) nextErrors.push('Määrän pitää olla suurempi kuin nolla.');
    if (!Number.isFinite(costUnitPriceCents) || costUnitPriceCents < 0) nextErrors.push('Kustannushinta on virheellinen.');
    if (!Number.isFinite(saleUnitPriceCents) || saleUnitPriceCents < 0) nextErrors.push('Myyntihinta on virheellinen.');
    if (!Number.isFinite(wastePercent) || wastePercent < 0 || wastePercent > 100) nextErrors.push('Hukan pitää olla 0–100 %.');
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) nextErrors.push('Alennuksen pitää olla 0–100 %.');
    setErrors(nextErrors);
    if (nextErrors.length) return;

    const value: Omit<OfferLine, 'id'> = {
      offerVersionId: selectedVersion.id,
      sectionId: lineForm.sectionId === UNSECTIONED ? undefined : lineForm.sectionId,
      category: lineForm.category,
      description: lineForm.description.trim(),
      quantity,
      unit: lineForm.unit.trim() || 'kpl',
      costUnitPriceCents,
      saleUnitPriceCents,
      wastePercent,
      discountPercent,
      vatRate: selectedVersion.vatRate,
      sourceCatalogItemId: lineForm.catalogItemId || undefined,
      internalNote: lineForm.internalNote.trim(),
      customerNote: lineForm.customerNote.trim(),
      customerVisible: lineForm.customerVisible,
      optional: lineForm.optional,
      sortOrder: editingLine?.sortOrder ?? versionLines.length,
    };

    await run(async () => {
      if (editingLine) await updateOfferLine(currentOrg.id, editingLine.id, value);
      else await addOfferLine(currentOrg.id, user?.id, value);
      await data.refresh();
      setLineDialog(false);
    });
  };

  const saveSection = async () => {
    if (!currentOrg || !selectedVersion || !sectionTitle.trim()) return;
    await run(async () => {
      await addOfferSection(currentOrg.id, user?.id, {
        offerVersionId: selectedVersion.id,
        title: sectionTitle.trim(),
        description: sectionDescription.trim(),
        sortOrder: versionSections.length,
        customerVisible: true,
      });
      await data.refresh();
      setSectionDialog(false);
      setSectionTitle('');
      setSectionDescription('');
    });
  };

  const importTakeoff = async () => {
    if (!currentOrg || !selectedVersion || !takeoffId) return;
    const sourceLines = finance.takeoffLines.filter((line) => line.takeoffId === takeoffId);
    if (!sourceLines.length) {
      setOperationError('Valitussa määrälaskelmassa ei ole tuotavia rivejä.');
      return;
    }
    const lines: Array<Omit<OfferLine, 'id'>> = sourceLines.map((source, index) => {
      const exact = data.catalog.find((item) => item.active && (
        item.name.trim().toLocaleLowerCase('fi-FI') === source.description.trim().toLocaleLowerCase('fi-FI')
        || item.code.trim().toLocaleLowerCase('fi-FI') === source.workPhase.trim().toLocaleLowerCase('fi-FI')
      ));
      const saleUnitPriceCents = exact?.saleUnitPriceCents
        ?? calculateRecommendedSaleUnitCents(exact?.costUnitPriceCents ?? 0, {
          overheadPercent: selectedVersion.overheadPercent,
          riskPercent: selectedVersion.riskPercent,
          targetMarginPercent: selectedVersion.marginPercent,
        });
      return {
        offerVersionId: selectedVersion.id,
        category: exact?.category ?? 'Materiaali',
        description: source.description,
        quantity: source.quantity,
        unit: source.unit,
        costUnitPriceCents: exact?.costUnitPriceCents ?? 0,
        saleUnitPriceCents,
        wastePercent: source.wastePercent,
        discountPercent: 0,
        vatRate: selectedVersion.vatRate,
        sourceTakeoffLineId: source.id,
        sourceCatalogItemId: exact?.id,
        internalNote: source.notes,
        customerNote: '',
        customerVisible: true,
        optional: false,
        sortOrder: versionLines.length + index,
      };
    });
    await run(async () => {
      await addOfferLines(currentOrg.id, user?.id, lines);
      await data.refresh();
      setImportDialog(false);
      setTakeoffId('');
    });
  };

  const performTransition = async (status: OfferStatus) => {
    if (!selectedOffer || !selectedVersion) return;
    const confirmations: Partial<Record<OfferStatus, string>> = {
      Lähetetty: 'Lähetetty versio lukitaan, eikä sen rivejä voi enää muokata. Jatketaanko?',
      Hyväksytty: 'Merkitäänkö tarjous hyväksytyksi?',
      Hylätty: 'Merkitäänkö tarjous hylätyksi?',
      Arkistoitu: 'Arkistoidaanko tarjous?',
    };
    const message = confirmations[status];
    if (message && !window.confirm(message)) return;
    await run(async () => {
      await transitionOffer(selectedOffer.id, selectedVersion.id, status);
      await refreshAll();
    });
  };

  const newVersion = async () => {
    if (!selectedOffer) return;
    await run(async () => {
      const versionId = await createOfferVersion(selectedOffer.id);
      await data.refresh();
      setSelectedVersionId(versionId);
    });
  };

  const convertProject = async () => {
    if (!selectedOffer || !window.confirm('Luodaanko hyväksytystä tarjouksesta uusi projekti?')) return;
    await run(async () => {
      const projectId = await convertOfferToProject(selectedOffer.id);
      await refreshAll();
      navigate(`/projektit/${projectId}/tyotila`);
    });
  };

  const printOffer = () => {
    if (!selectedOffer || !selectedVersion) return;
    try {
      openOfferPrintWindow({
        companyName: currentOrg?.name ?? 'VaKantti',
        customerName: customer?.name ?? lead?.company ?? '',
        offer: selectedOffer,
        version: selectedVersion,
        sections: versionSections,
        lines: versionLines,
      });
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tulostaminen epäonnistui.');
    }
  };

  const openCatalogCreate = () => {
    setEditingCatalog(null);
    setCatalogForm(emptyCatalog());
    setCatalogDialog(true);
  };

  const openCatalogEdit = (item: PriceCatalogItem) => {
    setEditingCatalog(item);
    setCatalogForm({
      code: item.code,
      name: item.name,
      category: item.category,
      description: item.description,
      unit: item.unit,
      costUnitPrice: String(item.costUnitPriceCents / 100),
      saleUnitPrice: String(item.saleUnitPriceCents / 100),
      wastePercent: String(item.defaultWastePercent),
      active: item.active,
    });
    setCatalogDialog(true);
  };

  const saveCatalog = async () => {
    if (!currentOrg || !catalogForm.name.trim()) return;
    const costUnitPriceCents = centsInput(catalogForm.costUnitPrice);
    const saleUnitPriceCents = centsInput(catalogForm.saleUnitPrice);
    const defaultWastePercent = moneyInput(catalogForm.wastePercent);
    if (![costUnitPriceCents, saleUnitPriceCents, defaultWastePercent].every(Number.isFinite)) {
      setOperationError('Hinnaston numeeriset arvot ovat virheellisiä.');
      return;
    }
    const value: Omit<PriceCatalogItem, 'id'> = {
      code: catalogForm.code.trim(),
      name: catalogForm.name.trim(),
      category: catalogForm.category,
      description: catalogForm.description.trim(),
      unit: catalogForm.unit.trim() || 'kpl',
      costUnitPriceCents,
      saleUnitPriceCents,
      defaultWastePercent,
      active: catalogForm.active,
    };
    await run(async () => {
      if (editingCatalog) await updateCatalogItem(currentOrg.id, editingCatalog.id, value);
      else await addCatalogItem(currentOrg.id, user?.id, value);
      await data.refresh();
      setCatalogDialog(false);
    });
  };

  const removeLine = async (line: OfferLine) => {
    if (!currentOrg || !window.confirm(`Poistetaanko tarjousrivi ”${line.description}”?`)) return;
    await run(async () => { await deleteOfferLine(currentOrg.id, line.id); await data.refresh(); });
  };

  const removeSection = async (section: OfferSection) => {
    if (!currentOrg || !window.confirm(`Poistetaanko osio ”${section.title}”? Rivien osiointi poistuu, mutta rivit säilyvät.`)) return;
    await run(async () => { await deleteOfferSection(currentOrg.id, section.id); await data.refresh(); });
  };

  const removeSelectedOffer = async () => {
    if (!currentOrg || !selectedOffer || !window.confirm(`Poistetaanko luonnostarjous ”${selectedOffer.name}”?`)) return;
    await run(async () => {
      await deleteOffer(currentOrg.id, selectedOffer.id);
      setSelectedOfferId('');
      await data.refresh();
    });
  };

  const removeCatalog = async (item: PriceCatalogItem) => {
    if (!currentOrg || !window.confirm(`Poistetaanko hinnastorivi ”${item.name}”?`)) return;
    await run(async () => { await deleteCatalogItem(currentOrg.id, item.id); await data.refresh(); });
  };

  const renderLine = (line: OfferLine) => {
    const totals = calculateOfferLineTotals({
      quantity: line.quantity,
      costUnitPriceCents: line.costUnitPriceCents,
      saleUnitPriceCents: line.saleUnitPriceCents,
      wastePercent: line.wastePercent,
      discountPercent: line.discountPercent,
      optional: line.optional,
    });
    return <div key={line.id} className="grid gap-3 border-b border-slate-100 px-4 py-4 lg:grid-cols-[115px_1.4fr_80px_100px_120px_120px_100px] lg:items-center">
      <div><Badge variant="outline">{line.category}</Badge>{line.optional && <Badge className="ml-1 border-amber-200 bg-amber-50 text-amber-700">Optio</Badge>}</div>
      <div className="min-w-0"><p className="font-medium text-slate-900">{line.description}</p><p className="mt-1 text-xs text-slate-500">{line.customerNote || line.internalNote || 'Ei lisätietoja'}</p></div>
      <span className="font-mono text-sm">{line.quantity} {line.unit}</span>
      <span className="font-mono text-sm text-slate-600">{euro(line.costUnitPriceCents)}</span>
      <span className="font-mono text-sm">{euro(line.saleUnitPriceCents)}</span>
      <span className="font-mono text-sm font-semibold">{line.optional ? 'Ei perussummassa' : euro(totals.saleSubtotalCents)}</span>
      <div className="flex justify-end gap-1">{draft && <><Button variant="ghost" size="sm" onClick={() => openLineEdit(line)}><Edit3 size={14} /></Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => void removeLine(line)}><Trash2 size={14} /></Button></>}</div>
    </div>;
  };

  const visibleError = operationError ?? data.error ?? finance.error;

  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1700px] space-y-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-hero text-text-primary">Tarjouslaskenta</h1><p className="mt-1 text-body-sm text-text-secondary">Kustannukset, myyntihinnat, tavoitekate, versiointi ja projektiksi muuntaminen</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void refreshAll()} disabled={data.refreshing}><RefreshCw size={16} className={data.refreshing ? 'mr-2 animate-spin' : 'mr-2'} /> Päivitä</Button><Button onClick={openOfferCreate}><Plus size={16} className="mr-2" /> Uusi tarjous</Button></div>
    </div>

    {visibleError && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><span>{visibleError}</span></div>}
    {totalsMismatch && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><span>Selain- ja palvelinlaskennan summissa on ero. Päivitä näkymä ennen tarjouksen lähettämistä.</span></div>}

    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList><TabsTrigger value="offers">Tarjoukset</TabsTrigger><TabsTrigger value="catalog">Hinnasto ({data.catalog.length})</TabsTrigger></TabsList>
      <TabsContent value="offers" className="space-y-4">
        <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
          <Card className="h-fit xl:sticky xl:top-4">
            <CardContent className="space-y-3 p-3">
              <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae tarjousta tai asiakasta" className="pl-9" /></div>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Kaikki tilat</SelectItem>{['Luonnos','Lähetetty','Hyväksytty','Hylätty','Vanhentunut','Arkistoitu'].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
              <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
                {filteredOffers.map((offer) => {
                  const latest = data.versions.find((version) => version.offerId === offer.id);
                  const offerCustomer = customers.find((item) => item.id === offer.customerId);
                  return <button key={offer.id} type="button" onClick={() => { setSelectedOfferId(offer.id); setSelectedVersionId(''); }} className={`w-full rounded-xl border p-3 text-left transition ${selectedOffer?.id === offer.id ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{offer.name}</p><p className="mt-0.5 text-xs text-slate-500">{offer.offerNumber || 'Numero muodostuu tallennuksessa'}</p></div><Badge variant="outline" className={statusTone(offer.status)}>{offer.status}</Badge></div>
                    <p className="mt-2 truncate text-sm text-slate-600">{offerCustomer?.name || 'Ei asiakasta'}</p><div className="mt-2 flex items-center justify-between"><span className="text-xs text-slate-500">Voimassa {date(offer.validUntil)}</span><strong className="font-mono text-sm">{latest ? euro(latest.totalCents) : '—'}</strong></div>
                  </button>;
                })}
                {!data.loading && filteredOffers.length === 0 && <div className="py-10 text-center text-sm text-slate-500"><FileText size={38} className="mx-auto mb-3 text-slate-300" />Ei tarjouksia</div>}
                {data.loading && <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={17} className="animate-spin" />Ladataan tarjouksia…</div>}
              </div>
            </CardContent>
          </Card>

          {selectedOffer && selectedVersion ? <div className="min-w-0 space-y-4">
            <Card className="overflow-hidden border-slate-200">
              <div className="bg-gradient-to-r from-slate-950 to-slate-800 p-5 text-white sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge className={statusTone(selectedOffer.status)}>{selectedOffer.status}</Badge><span className="font-mono text-xs text-slate-300">{selectedOffer.offerNumber}</span><span className="text-xs text-slate-400">Versio {selectedVersion.versionNumber}</span></div><h2 className="mt-3 break-words text-2xl font-bold">{selectedOffer.name}</h2><p className="mt-2 text-sm text-slate-300">{customer?.name || lead?.company || 'Ei asiakasta'} · voimassa {date(selectedOffer.validUntil)}</p></div>
                  <div className="flex flex-wrap gap-2"><Button variant="outline" className="border-slate-600 bg-white/5 text-white hover:bg-white/10" onClick={printOffer}><Download size={15} className="mr-2" /> Tulosta/PDF</Button>{draft && <Button variant="outline" className="border-slate-600 bg-white/5 text-white hover:bg-white/10" onClick={openOfferMeta}><Edit3 size={15} className="mr-2" /> Perustiedot</Button>}{selectedOffer.status === 'Hyväksytty' && !selectedOffer.convertedProjectId && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void convertProject()}><FolderKanban size={15} className="mr-2" /> Luo projekti</Button>}{linkedProject && <Button className="bg-white text-slate-950 hover:bg-slate-100" onClick={() => navigate(`/projektit/${linkedProject.id}/tyotila`)}><FolderKanban size={15} className="mr-2" /> Avaa projekti</Button>}</div>
                </div>
              </div>
              <CardContent className="p-4 sm:p-5"><div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Arvioitu kustannus</p><p className="mt-1 font-mono text-xl font-bold">{euro(selectedVersion.estimatedCostCents)}</p><p className="mt-1 text-xs text-slate-500">Suorat {euro(selectedVersion.directCostCents)}</p></div><div className="rounded-xl bg-blue-50 p-4"><p className="text-xs text-blue-700">Veroton myynti</p><p className="mt-1 font-mono text-xl font-bold text-blue-900">{euro(selectedVersion.subtotalCents)}</p><p className="mt-1 text-xs text-blue-700">ALV {euro(selectedVersion.taxCents)}</p></div><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs text-emerald-700">Arvioitu kate</p><p className={`mt-1 font-mono text-xl font-bold ${marginTone(selectedVersion.grossMarginPercent)}`}>{euro(selectedVersion.grossMarginCents)}</p><p className={`mt-1 text-xs font-semibold ${marginTone(selectedVersion.grossMarginPercent)}`}>{selectedVersion.grossMarginPercent.toFixed(1)} %</p></div><div className="rounded-xl bg-orange-50 p-4"><p className="text-xs text-orange-700">Tarjous yhteensä</p><p className="mt-1 font-mono text-xl font-bold text-orange-900">{euro(selectedVersion.totalCents)}</p><p className="mt-1 text-xs text-orange-700">sis. ALV {selectedVersion.vatRate} %</p></div></div></CardContent>
            </Card>

            <Card><CardHeader className="pb-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle className="flex items-center gap-2"><History size={18} /> Versiot ja tila</CardTitle><div className="flex flex-wrap gap-2">{offerVersions.map((version) => <Button key={version.id} size="sm" variant={selectedVersion.id === version.id ? 'default' : 'outline'} onClick={() => setSelectedVersionId(version.id)}>v{version.versionNumber} · {version.status}</Button>)}</div></div></CardHeader><CardContent className="flex flex-wrap gap-2">{draft && <><Button onClick={() => void performTransition('Lähetetty')}><Send size={15} className="mr-2" /> Merkitse lähetetyksi</Button><Button variant="outline" onClick={() => void performTransition('Hyväksytty')}><CheckCircle2 size={15} className="mr-2" /> Hyväksy suoraan</Button><Button variant="ghost" className="text-red-600" onClick={() => void removeSelectedOffer()}><Trash2 size={15} className="mr-2" /> Poista luonnos</Button></>}{selectedOffer.status === 'Lähetetty' && <><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void performTransition('Hyväksytty')}><CheckCircle2 size={15} className="mr-2" /> Hyväksytty</Button><Button variant="outline" className="text-red-600" onClick={() => void performTransition('Hylätty')}><XCircle size={15} className="mr-2" /> Hylätty</Button><Button variant="outline" onClick={() => void newVersion()}><Copy size={15} className="mr-2" /> Uusi versio</Button></>}{selectedOffer.status === 'Hylätty' && <Button variant="outline" onClick={() => void newVersion()}><Copy size={15} className="mr-2" /> Tee uusi versio</Button>}{selectedOffer.status !== 'Arkistoitu' && <Button variant="ghost" onClick={() => void performTransition('Arkistoitu')}><Archive size={15} className="mr-2" /> Arkistoi</Button>}</CardContent></Card>

            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings2 size={18} /> Laskenta-asetukset</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="space-y-1"><Label>ALV %</Label><Input type="number" value={settings.vatRate} onChange={(event) => setSettings((previous) => ({ ...previous, vatRate: event.target.value }))} disabled={!draft} /></div><div className="space-y-1"><Label>Yleiskulut %</Label><Input type="number" value={settings.overheadPercent} onChange={(event) => setSettings((previous) => ({ ...previous, overheadPercent: event.target.value }))} disabled={!draft} /></div><div className="space-y-1"><Label>Riskivaraus %</Label><Input type="number" value={settings.riskPercent} onChange={(event) => setSettings((previous) => ({ ...previous, riskPercent: event.target.value }))} disabled={!draft} /></div><div className="space-y-1"><Label>Tavoitekate % myynnistä</Label><Input type="number" value={settings.marginPercent} onChange={(event) => setSettings((previous) => ({ ...previous, marginPercent: event.target.value }))} disabled={!draft} /></div></div><div className="grid gap-3 lg:grid-cols-2"><div className="space-y-1"><Label>Tarjouksen kuvaus</Label><Textarea value={settings.notes} onChange={(event) => setSettings((previous) => ({ ...previous, notes: event.target.value }))} disabled={!draft} rows={3} /></div><div className="space-y-1"><Label>Ehdot ja rajaukset</Label><Textarea value={settings.terms} onChange={(event) => setSettings((previous) => ({ ...previous, terms: event.target.value }))} disabled={!draft} rows={3} /></div></div>{draft && <div className="flex justify-end"><Button onClick={() => void saveSettings()} disabled={saving}>Tallenna asetukset</Button></div>}<p className="text-xs text-slate-500">Tavoitekate lasketaan myyntihinnasta: esimerkiksi 10 000 € kustannus ja 20 % tavoitekate tarkoittaa 12 500 € myyntihintaa ennen muita kustannuksia.</p></CardContent></Card>

            <div className="flex flex-wrap justify-end gap-2">{draft && <><Button variant="outline" onClick={() => { setSectionTitle(''); setSectionDescription(''); setSectionDialog(true); }}><FilePlus2 size={15} className="mr-2" /> Lisää osio</Button><Button variant="outline" onClick={() => setImportDialog(true)}><Ruler size={15} className="mr-2" /> Tuo määrälaskennasta</Button><Button onClick={() => openLineCreate()}><Plus size={15} className="mr-2" /> Lisää tarjousrivi</Button></>}</div>

            {versionSections.map((section) => <Card key={section.id} className="overflow-hidden"><CardHeader className="border-b bg-slate-50 py-3"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base">{section.title}</CardTitle>{section.description && <p className="mt-1 text-xs text-slate-500">{section.description}</p>}</div>{draft && <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => openLineCreate(section.id)}><Plus size={14} className="mr-1" /> Rivi</Button><Button size="sm" variant="ghost" className="text-red-600" onClick={() => void removeSection(section)}><Trash2 size={14} /></Button></div>}</div></CardHeader><CardContent className="p-0">{versionLines.filter((line) => line.sectionId === section.id).map(renderLine)}{!versionLines.some((line) => line.sectionId === section.id) && <p className="p-6 text-center text-sm text-slate-500">Osiossa ei ole rivejä.</p>}</CardContent></Card>)}
            <Card className="overflow-hidden"><CardHeader className="border-b bg-slate-50 py-3"><CardTitle className="text-base">Muut tarjousrivit</CardTitle></CardHeader><CardContent className="p-0"><div className="hidden grid-cols-[115px_1.4fr_80px_100px_120px_120px_100px] gap-3 border-b bg-white px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 lg:grid"><span>Laji</span><span>Kuvaus</span><span>Määrä</span><span>Kust./yks.</span><span>Myynti/yks.</span><span>Myynti yht.</span><span /></div>{versionLines.filter((line) => !line.sectionId).map(renderLine)}{!versionLines.some((line) => !line.sectionId) && <div className="p-10 text-center text-sm text-slate-500"><Calculator size={38} className="mx-auto mb-3 text-slate-300" />Ei osioimattomia rivejä.</div>}</CardContent></Card>

            <Card><CardHeader><CardTitle className="flex items-center gap-2"><History size={18} /> Tapahtumahistoria</CardTitle></CardHeader><CardContent className="space-y-2">{versionEvents.slice(0, 12).map((event) => <div key={event.id} className="flex items-start justify-between gap-4 border-b border-slate-100 py-2"><div><p className="text-sm font-medium">{event.detail || event.eventType}</p><p className="text-xs text-slate-500">{event.eventType}</p></div><span className="shrink-0 text-xs text-slate-400">{dateTime(event.createdAt)}</span></div>)}{!versionEvents.length && <p className="py-6 text-center text-sm text-slate-500">Ei tapahtumia.</p>}</CardContent></Card>
          </div> : <Card><CardContent className="p-14 text-center"><FileText size={48} className="mx-auto mb-4 text-slate-300" /><h2 className="text-lg font-semibold">Valitse tai luo tarjous</h2><p className="mt-1 text-sm text-slate-500">Tarjous yhdistää sisäisen kustannuksen, myyntihinnan ja projektin tavoitekatteen.</p><Button className="mt-5" onClick={openOfferCreate}><Plus size={16} className="mr-2" /> Uusi tarjous</Button></CardContent></Card>}
        </div>
      </TabsContent>

      <TabsContent value="catalog" className="space-y-4"><div className="flex justify-end"><Button onClick={openCatalogCreate}><PackagePlus size={16} className="mr-2" /> Uusi hinnastorivi</Button></div><Card className="overflow-hidden"><CardContent className="p-0"><div className="hidden grid-cols-[110px_1.2fr_130px_100px_140px_140px_100px] gap-3 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 lg:grid"><span>Tunnus</span><span>Nimi</span><span>Laji</span><span>Yks.</span><span>Kustannus</span><span>Myynti</span><span /></div>{data.catalog.map((item) => <div key={item.id} className="grid gap-3 border-b border-slate-100 px-5 py-4 lg:grid-cols-[110px_1.2fr_130px_100px_140px_140px_100px] lg:items-center"><span className="font-mono text-sm">{item.code || '—'}</span><div><p className="font-semibold">{item.name}</p><p className="text-xs text-slate-500">{item.description || 'Ei kuvausta'}</p></div><Badge variant="outline">{item.category}</Badge><span>{item.unit}</span><span className="font-mono">{euro(item.costUnitPriceCents)}</span><span className="font-mono font-semibold">{euro(item.saleUnitPriceCents)}</span><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => openCatalogEdit(item)}><Edit3 size={14} /></Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => void removeCatalog(item)}><Trash2 size={14} /></Button></div></div>)}{!data.catalog.length && <div className="p-14 text-center"><Euro size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Hinnasto on tyhjä</p><p className="mt-1 text-sm text-slate-500">Lisää työn, materiaalien ja aliurakoiden vakiohinnat.</p></div>}</CardContent></Card></TabsContent>
    </Tabs>

    <Dialog open={offerDialog} onOpenChange={setOfferDialog}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Uusi tarjous</DialogTitle></DialogHeader>{errors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.map((error) => <p key={error}>{error}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1 sm:col-span-2"><Label>Tarjouksen nimi *</Label><Input value={offerForm.name} onChange={(event) => setOfferForm((previous) => ({ ...previous, name: event.target.value }))} /></div><div className="space-y-1"><Label>CRM-mahdollisuus</Label><Select value={offerForm.crmLeadId || UNSECTIONED} onValueChange={(value) => selectLead(value === UNSECTIONED ? '' : value)}><SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger><SelectContent><SelectItem value={UNSECTIONED}>Ei CRM-mahdollisuutta</SelectItem>{crmLeads.filter((item) => !['Voitettu','Hävitty'].includes(item.stage)).map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.company}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Asiakas</Label><Select value={offerForm.customerId || UNSECTIONED} onValueChange={(value) => setOfferForm((previous) => ({ ...previous, customerId: value === UNSECTIONED ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={UNSECTIONED}>Ei asiakasta</SelectItem>{customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Nykyinen projekti</Label><Select value={offerForm.projectId || UNSECTIONED} onValueChange={(value) => setOfferForm((previous) => ({ ...previous, projectId: value === UNSECTIONED ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={UNSECTIONED}>Ei projektia</SelectItem>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Vastuuhenkilö</Label><Select value={offerForm.assignedUserId || UNSECTIONED} onValueChange={(value) => setOfferForm((previous) => ({ ...previous, assignedUserId: value === UNSECTIONED ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={UNSECTIONED}>Ei vastuuhenkilöä</SelectItem>{people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Tarjousnumero</Label><Input value={offerForm.offerNumber} onChange={(event) => setOfferForm((previous) => ({ ...previous, offerNumber: event.target.value }))} placeholder="Muodostetaan automaattisesti" /></div><div className="space-y-1"><Label>Voimassa asti</Label><Input type="date" value={offerForm.validUntil} onChange={(event) => setOfferForm((previous) => ({ ...previous, validUntil: event.target.value }))} /></div><div className="space-y-1 sm:col-span-2"><Label>Muistiinpanot</Label><Textarea value={offerForm.notes} onChange={(event) => setOfferForm((previous) => ({ ...previous, notes: event.target.value }))} rows={3} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOfferDialog(false)}>Peruuta</Button><Button onClick={() => void saveOffer()} disabled={saving}>{saving ? 'Luodaan…' : 'Luo tarjous'}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={offerMetaDialog} onOpenChange={setOfferMetaDialog}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Tarjouksen perustiedot</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1 sm:col-span-2"><Label>Nimi *</Label><Input value={offerMetaForm.name} onChange={(event) => setOfferMetaForm((previous) => ({ ...previous, name: event.target.value }))} /></div><div className="space-y-1"><Label>Voimassa asti</Label><Input type="date" value={offerMetaForm.validUntil} onChange={(event) => setOfferMetaForm((previous) => ({ ...previous, validUntil: event.target.value }))} /></div><div className="space-y-1"><Label>Asiakkaan viite</Label><Input value={offerMetaForm.customerReference} onChange={(event) => setOfferMetaForm((previous) => ({ ...previous, customerReference: event.target.value }))} /></div><div className="space-y-1"><Label>Toimitusaika</Label><Input value={offerMetaForm.deliveryTime} onChange={(event) => setOfferMetaForm((previous) => ({ ...previous, deliveryTime: event.target.value }))} /></div><div className="space-y-1"><Label>Maksuehto</Label><Input value={offerMetaForm.paymentTerms} onChange={(event) => setOfferMetaForm((previous) => ({ ...previous, paymentTerms: event.target.value }))} /></div><div className="space-y-1"><Label>Vastuuhenkilö</Label><Select value={offerMetaForm.assignedUserId || UNSECTIONED} onValueChange={(value) => setOfferMetaForm((previous) => ({ ...previous, assignedUserId: value === UNSECTIONED ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={UNSECTIONED}>Ei vastuuhenkilöä</SelectItem>{people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1 sm:col-span-2"><Label>Sisäinen huomio</Label><Textarea value={offerMetaForm.notes} onChange={(event) => setOfferMetaForm((previous) => ({ ...previous, notes: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOfferMetaDialog(false)}>Peruuta</Button><Button onClick={() => void saveOfferMeta()} disabled={saving}>Tallenna</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={lineDialog} onOpenChange={setLineDialog}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{editingLine ? 'Muokkaa tarjousriviä' : 'Uusi tarjousrivi'}</DialogTitle></DialogHeader>{errors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.map((error) => <p key={error}>{error}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1 sm:col-span-2"><Label>Hinnastosta</Label><Select value={lineForm.catalogItemId || UNSECTIONED} onValueChange={(value) => value !== UNSECTIONED && selectCatalogItem(value)}><SelectTrigger><SelectValue placeholder="Valitse valmis hinnastorivi" /></SelectTrigger><SelectContent><SelectItem value={UNSECTIONED}>Ei hinnastoriviä</SelectItem>{data.catalog.filter((item) => item.active).map((item) => <SelectItem key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ''}{item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Kustannuslaji</Label><Select value={lineForm.category} onValueChange={(value) => setLineForm((previous) => ({ ...previous, category: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Osio</Label><Select value={lineForm.sectionId} onValueChange={(value) => setLineForm((previous) => ({ ...previous, sectionId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={UNSECTIONED}>Ei osiota</SelectItem>{versionSections.map((section) => <SelectItem key={section.id} value={section.id}>{section.title}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1 sm:col-span-2"><Label>Kuvaus *</Label><Input value={lineForm.description} onChange={(event) => setLineForm((previous) => ({ ...previous, description: event.target.value }))} /></div><div className="space-y-1"><Label>Määrä</Label><Input type="number" step="0.01" value={lineForm.quantity} onChange={(event) => setLineForm((previous) => ({ ...previous, quantity: event.target.value }))} /></div><div className="space-y-1"><Label>Yksikkö</Label><Input value={lineForm.unit} onChange={(event) => setLineForm((previous) => ({ ...previous, unit: event.target.value }))} /></div><div className="space-y-1"><Label>Sisäinen kustannus / yks. €</Label><Input type="number" step="0.01" value={lineForm.costUnitPrice} onChange={(event) => setLineForm((previous) => ({ ...previous, costUnitPrice: event.target.value }))} /></div><div className="space-y-1"><div className="flex items-center justify-between"><Label>Myyntihinta / yks. €</Label><button type="button" className="text-xs font-semibold text-orange-600" onClick={recommendLinePrice}>Laske suositus</button></div><Input type="number" step="0.01" value={lineForm.saleUnitPrice} onChange={(event) => setLineForm((previous) => ({ ...previous, saleUnitPrice: event.target.value }))} /></div><div className="space-y-1"><Label>Hukka %</Label><Input type="number" step="0.1" value={lineForm.wastePercent} onChange={(event) => setLineForm((previous) => ({ ...previous, wastePercent: event.target.value }))} /></div><div className="space-y-1"><Label>Alennus %</Label><Input type="number" step="0.1" value={lineForm.discountPercent} onChange={(event) => setLineForm((previous) => ({ ...previous, discountPercent: event.target.value }))} /></div><div className="space-y-1 sm:col-span-2"><Label>Asiakkaalle näkyvä huomio</Label><Textarea value={lineForm.customerNote} onChange={(event) => setLineForm((previous) => ({ ...previous, customerNote: event.target.value }))} rows={2} /></div><div className="space-y-1 sm:col-span-2"><Label>Sisäinen huomio</Label><Textarea value={lineForm.internalNote} onChange={(event) => setLineForm((previous) => ({ ...previous, internalNote: event.target.value }))} rows={2} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lineForm.customerVisible} onChange={(event) => setLineForm((previous) => ({ ...previous, customerVisible: event.target.checked }))} /> Näytä asiakkaan tarjouksessa</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lineForm.optional} onChange={(event) => setLineForm((previous) => ({ ...previous, optional: event.target.checked }))} /> Valinnainen optio</label></div><DialogFooter><Button variant="outline" onClick={() => setLineDialog(false)}>Peruuta</Button><Button onClick={() => void saveLine()} disabled={saving}>Tallenna rivi</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={sectionDialog} onOpenChange={setSectionDialog}><DialogContent><DialogHeader><DialogTitle>Uusi tarjousosio</DialogTitle></DialogHeader><div className="space-y-4"><div className="space-y-1"><Label>Otsikko *</Label><Input value={sectionTitle} onChange={(event) => setSectionTitle(event.target.value)} placeholder="Esim. Purkutyöt" /></div><div className="space-y-1"><Label>Kuvaus</Label><Textarea value={sectionDescription} onChange={(event) => setSectionDescription(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setSectionDialog(false)}>Peruuta</Button><Button onClick={() => void saveSection()} disabled={saving || !sectionTitle.trim()}>Lisää osio</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={importDialog} onOpenChange={setImportDialog}><DialogContent><DialogHeader><DialogTitle>Tuo määrälaskelmasta</DialogTitle></DialogHeader><div className="space-y-3"><Label>Määrälaskelma</Label><Select value={takeoffId} onValueChange={setTakeoffId}><SelectTrigger><SelectValue placeholder="Valitse määrälaskelma" /></SelectTrigger><SelectContent>{finance.takeoffs.map((takeoff) => <SelectItem key={takeoff.id} value={takeoff.id}>{takeoff.name} · {finance.takeoffLines.filter((line) => line.takeoffId === takeoff.id).length} riviä</SelectItem>)}</SelectContent></Select><p className="text-sm text-slate-500">Sovellus yhdistää rivit hinnastoon nimen tai tunnuksen perusteella. Tunnistamattomat rivit tuodaan nollahinnalla ja merkitään hinnoiteltaviksi.</p></div><DialogFooter><Button variant="outline" onClick={() => setImportDialog(false)}>Peruuta</Button><Button onClick={() => void importTakeoff()} disabled={saving || !takeoffId}>Tuo rivit</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={catalogDialog} onOpenChange={setCatalogDialog}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{editingCatalog ? 'Muokkaa hinnastoriviä' : 'Uusi hinnastorivi'}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1"><Label>Tunnus</Label><Input value={catalogForm.code} onChange={(event) => setCatalogForm((previous) => ({ ...previous, code: event.target.value }))} /></div><div className="space-y-1"><Label>Kategoria</Label><Select value={catalogForm.category} onValueChange={(value) => setCatalogForm((previous) => ({ ...previous, category: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1 sm:col-span-2"><Label>Nimi *</Label><Input value={catalogForm.name} onChange={(event) => setCatalogForm((previous) => ({ ...previous, name: event.target.value }))} /></div><div className="space-y-1 sm:col-span-2"><Label>Kuvaus</Label><Textarea value={catalogForm.description} onChange={(event) => setCatalogForm((previous) => ({ ...previous, description: event.target.value }))} /></div><div className="space-y-1"><Label>Yksikkö</Label><Input value={catalogForm.unit} onChange={(event) => setCatalogForm((previous) => ({ ...previous, unit: event.target.value }))} /></div><div className="space-y-1"><Label>Oletushukka %</Label><Input type="number" value={catalogForm.wastePercent} onChange={(event) => setCatalogForm((previous) => ({ ...previous, wastePercent: event.target.value }))} /></div><div className="space-y-1"><Label>Kustannushinta €</Label><Input type="number" step="0.01" value={catalogForm.costUnitPrice} onChange={(event) => setCatalogForm((previous) => ({ ...previous, costUnitPrice: event.target.value }))} /></div><div className="space-y-1"><Label>Myyntihinta €</Label><Input type="number" step="0.01" value={catalogForm.saleUnitPrice} onChange={(event) => setCatalogForm((previous) => ({ ...previous, saleUnitPrice: event.target.value }))} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={catalogForm.active} onChange={(event) => setCatalogForm((previous) => ({ ...previous, active: event.target.checked }))} /> Aktiivinen hinnastossa</label></div><DialogFooter><Button variant="outline" onClick={() => setCatalogDialog(false)}>Peruuta</Button><Button onClick={() => void saveCatalog()} disabled={saving}>Tallenna</Button></DialogFooter></DialogContent></Dialog>
  </motion.div>;
}
