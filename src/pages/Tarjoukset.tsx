import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  FilePlus2,
  FileText,
  FolderKanban,
  History,
  Layers3,
  Plus,
  RefreshCw,
  Ruler,
  Settings2,
  Trash2,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import {
  buildCalculationSteps,
  getOfferPhaseTemplate,
  mergePhaseSelections,
  type OfferPhaseDefinition,
} from '@/lib/pricing/offerPhases';
import { openOfferPrintWindow } from '@/lib/pricing/offerPrint';
import {
  addCatalogItem,
  addOfferLine,
  addOfferLines,
  addOfferSection,
  addOfferSections,
  convertOfferToProject,
  createOffer,
  createOfferVersion,
  deleteCatalogItem,
  deleteOffer,
  deleteOfferLine,
  deleteOfferSection,
  findLatestOfferVersionId,
  transitionOffer,
  updateCatalogItem,
  updateOffer,
  updateOfferLine,
  updateOfferSection,
  updateOfferVersion,
  type OfferLine,
  type OfferSection,
  type OfferStatus,
  type PriceCatalogItem,
} from '@/lib/supabase/offers';
import { cn } from '@/lib/utils';
import { CalculationStepsPanel } from './offers/CalculationStepsPanel';
import { CatalogTab } from './offers/CatalogTab';
import { OfferCreateWizard } from './offers/OfferCreateWizard';
import { OfferKpiStrip } from './offers/OfferKpiStrip';
import { OfferLineCard } from './offers/OfferLineCard';
import { OfferListPanel } from './offers/OfferListPanel';
import { OfferWorkflowCard } from './offers/OfferWorkflowCard';
import { PhaseTemplatesPicker } from './offers/PhaseTemplatesPicker';
import {
  centsInput,
  date,
  dateTime,
  daysUntil,
  emptyOfferWizardForm,
  euro,
  expiryLabel,
  marginTone,
  moneyInput,
  OFFER_CATEGORIES,
  type OfferWizardForm,
  UNSECTIONED,
} from './offers/offerUi';

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

type ConfirmAction =
  | { kind: 'transition'; status: OfferStatus; title: string; description: string }
  | { kind: 'delete-offer'; title: string; description: string }
  | { kind: 'delete-line'; line: OfferLine; title: string; description: string }
  | { kind: 'delete-section'; section: OfferSection; title: string; description: string }
  | { kind: 'delete-catalog'; item: PriceCatalogItem; title: string; description: string }
  | { kind: 'convert'; title: string; description: string };

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
  const [detailTab, setDetailTab] = useState('lines');
  const [selectedOfferId, setSelectedOfferId] = useState(searchParams.get('offer') ?? '');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('all');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [offerDialog, setOfferDialog] = useState(false);
  const [offerMetaDialog, setOfferMetaDialog] = useState(false);
  const [lineDialog, setLineDialog] = useState(false);
  const [sectionDialog, setSectionDialog] = useState(false);
  const [phaseDialog, setPhaseDialog] = useState(false);
  const [catalogDialog, setCatalogDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const [offerForm, setOfferForm] = useState<OfferWizardForm>(emptyOfferWizardForm);
  const [phaseTemplateId, setPhaseTemplateId] = useState('bathroom');
  const [phaseExtras, setPhaseExtras] = useState<OfferPhaseDefinition[]>([]);
  const [offerMetaForm, setOfferMetaForm] = useState<OfferMetaForm>({
    name: '', validUntil: '', customerReference: '', deliveryTime: '', paymentTerms: '', notes: '', assignedUserId: '',
  });
  const [lineForm, setLineForm] = useState<LineForm>(emptyLine);
  const [editingLine, setEditingLine] = useState<OfferLine | null>(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionDescription, setSectionDescription] = useState('');
  const [editingSection, setEditingSection] = useState<OfferSection | null>(null);
  const [editingCatalog, setEditingCatalog] = useState<PriceCatalogItem | null>(null);
  const [catalogForm, setCatalogForm] = useState<CatalogForm>(emptyCatalog);
  const [takeoffId, setTakeoffId] = useState('');
  const [settings, setSettings] = useState({
    vatRate: '25.5', overheadPercent: '0', riskPercent: '0', marginPercent: '20', notes: '', terms: '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const normalizedSearch = search.trim().toLocaleLowerCase('fi-FI');

  const filteredOffers = useMemo(() => data.offers.filter((offer) => {
    if (statusFilter !== 'all' && offer.status !== statusFilter) return false;
    if (scopeFilter === 'mine' && offer.assignedUserId !== user?.id) return false;
    if (scopeFilter === 'convertible' && (offer.status !== 'Hyväksytty' || offer.convertedProjectId)) return false;
    if (scopeFilter === 'expiring') {
      const remaining = daysUntil(offer.validUntil);
      const relevant = offer.status === 'Luonnos' || offer.status === 'Lähetetty' || offer.status === 'Vanhentunut';
      if (!relevant || remaining == null || remaining > 7) return false;
    }
    if (!normalizedSearch) return true;
    const customer = customers.find((item) => item.id === offer.customerId);
    const assignee = people.find((person) => person.userId === offer.assignedUserId);
    return [offer.name, offer.offerNumber, customer?.name, assignee?.name]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('fi-FI')
      .includes(normalizedSearch);
  }), [customers, data.offers, normalizedSearch, people, scopeFilter, statusFilter, user?.id]);

  const selectedOffer = data.offers.find((offer) => offer.id === selectedOfferId)
    ?? (selectedOfferId ? null : filteredOffers[0] ?? null);
  const offerVersions = useMemo(
    () => (selectedOffer
      ? data.versions.filter((version) => version.offerId === selectedOffer.id)
      : []),
    [data.versions, selectedOffer],
  );
  const selectedVersion = offerVersions.find((version) => version.id === selectedVersionId)
    ?? offerVersions[0]
    ?? null;
  const versionSections = useMemo(
    () => (selectedVersion
      ? data.sections.filter((section) => section.offerVersionId === selectedVersion.id)
      : []),
    [data.sections, selectedVersion],
  );
  const versionLines = useMemo(
    () => (selectedVersion
      ? data.lines.filter((line) => line.offerVersionId === selectedVersion.id)
      : []),
    [data.lines, selectedVersion],
  );
  const versionEvents = useMemo(
    () => (selectedOffer
      ? data.events.filter((event) => event.offerId === selectedOffer.id)
      : []),
    [data.events, selectedOffer],
  );
  const customer = selectedOffer ? customers.find((item) => item.id === selectedOffer.customerId) : undefined;
  const lead = selectedOffer ? crmLeads.find((item) => item.id === selectedOffer.crmLeadId) : undefined;
  const linkedProject = selectedOffer
    ? projects.find((item) => item.id === (selectedOffer.convertedProjectId ?? selectedOffer.projectId))
    : undefined;
  const assignee = selectedOffer
    ? people.find((person) => person.userId === selectedOffer.assignedUserId)
    : undefined;
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
  const calculationSteps = browserTotals && selectedVersion
    ? buildCalculationSteps(browserTotals, {
        vatRate: selectedVersion.vatRate,
        overheadPercent: selectedVersion.overheadPercent,
        riskPercent: selectedVersion.riskPercent,
        targetMarginPercent: selectedVersion.marginPercent,
      })
    : [];

  const totalsMismatch = Boolean(selectedVersion && browserTotals && (
    Math.abs(selectedVersion.subtotalCents - browserTotals.saleSubtotalCents) > 1
    || Math.abs(selectedVersion.estimatedCostCents - browserTotals.estimatedCostCents) > 1
    || Math.abs(selectedVersion.totalCents - browserTotals.totalCents) > 1
  ));

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { cost: number; sale: number }>();
    versionLines.filter((line) => !line.optional).forEach((line) => {
      const totals = calculateOfferLineTotals(line);
      const current = map.get(line.category) ?? { cost: 0, sale: 0 };
      map.set(line.category, {
        cost: current.cost + totals.directCostCents,
        sale: current.sale + totals.saleSubtotalCents,
      });
    });
    return [...map.entries()].sort((a, b) => b[1].sale - a[1].sale);
  }, [versionLines]);

  const linePreview = useMemo(() => {
    const quantity = moneyInput(lineForm.quantity);
    const costUnitPriceCents = centsInput(lineForm.costUnitPrice);
    const saleUnitPriceCents = centsInput(lineForm.saleUnitPrice);
    const wastePercent = moneyInput(lineForm.wastePercent);
    const discountPercent = moneyInput(lineForm.discountPercent);
    if (![quantity, costUnitPriceCents, saleUnitPriceCents, wastePercent, discountPercent].every(Number.isFinite)) {
      return null;
    }
    return calculateOfferLineTotals({
      quantity,
      costUnitPriceCents,
      saleUnitPriceCents,
      wastePercent,
      discountPercent,
      optional: lineForm.optional,
    });
  }, [lineForm]);

  useEffect(() => {
    if (selectedOffer && selectedOffer.id !== selectedOfferId) setSelectedOfferId(selectedOffer.id);
  }, [selectedOffer, selectedOfferId]);

  useEffect(() => {
    if (selectedVersion && selectedVersion.id !== selectedVersionId) setSelectedVersionId(selectedVersion.id);
  }, [selectedVersion, selectedVersionId]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'catalog') next.set('tab', 'hinnasto');
    else next.delete('tab');
    if (selectedOfferId) next.set('offer', selectedOfferId);
    else next.delete('offer');
    const current = searchParams.toString();
    const upcoming = next.toString();
    if (current !== upcoming) setSearchParams(next, { replace: true });
  }, [selectedOfferId, setSearchParams, searchParams, tab]);

  useEffect(() => {
    const leadId = searchParams.get('lead');
    const customerId = searchParams.get('customer');
    const projectId = searchParams.get('project');
    if (!leadId && !customerId && !projectId) return;
    const next = emptyOfferWizardForm();
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
    setTab('offers');
    const cleaned = new URLSearchParams(searchParams);
    cleaned.delete('lead');
    cleaned.delete('customer');
    cleaned.delete('project');
    setSearchParams(cleaned, { replace: true });
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

  useEffect(() => {
    if (!operationSuccess) return;
    const timer = window.setTimeout(() => setOperationSuccess(null), 4000);
    return () => window.clearTimeout(timer);
  }, [operationSuccess]);

  const run = async (action: () => Promise<void>, successMessage?: string) => {
    setSaving(true);
    setOperationError(null);
    try {
      await action();
      if (successMessage) setOperationSuccess(successMessage);
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
    setOfferForm(emptyOfferWizardForm());
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

  const saveOffer = async (phases: OfferPhaseDefinition[]) => {
    const nextErrors: string[] = [];
    if (!offerForm.name.trim()) nextErrors.push('Tarjouksen nimi on pakollinen.');
    if (!offerForm.customerId && !offerForm.crmLeadId && !offerForm.projectId) {
      nextErrors.push('Valitse vähintään asiakas, CRM-mahdollisuus tai projekti.');
    }
    const vatRate = Number(offerForm.vatRate);
    const overheadPercent = Number(offerForm.overheadPercent);
    const riskPercent = Number(offerForm.riskPercent);
    const marginPercent = Number(offerForm.marginPercent);
    if (![vatRate, overheadPercent, riskPercent, marginPercent].every(Number.isFinite)
      || vatRate < 0 || vatRate > 100
      || overheadPercent < 0 || overheadPercent > 100
      || riskPercent < 0 || riskPercent > 100
      || marginPercent < 0 || marginPercent >= 100) {
      nextErrors.push('ALV:n, yleiskulujen ja riskin pitää olla 0–100 %. Tavoitekatteen pitää olla alle 100 %.');
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

      await updateOffer(currentOrg.id, offerId, {
        paymentTerms: offerForm.paymentTerms.trim(),
        deliveryTime: offerForm.deliveryTime.trim(),
      });

      const versionId = await findLatestOfferVersionId(currentOrg.id, offerId);
      if (versionId) {
        await updateOfferVersion(currentOrg.id, versionId, {
          vatRate,
          overheadPercent,
          riskPercent,
          marginPercent,
          notes: offerForm.notes.trim(),
          terms: offerForm.terms.trim(),
        });
        if (phases.length) {
          await addOfferSections(
            currentOrg.id,
            user?.id,
            phases.map((phase, index) => ({
              offerVersionId: versionId,
              title: phase.title,
              description: phase.description,
              sortOrder: index,
              customerVisible: true,
            })),
          );
        }
      }

      await refreshAll();
      setSelectedOfferId(offerId);
      setSelectedVersionId(versionId ?? '');
      setDetailTab(phases.length ? 'lines' : 'settings');
      setOfferDialog(false);
    }, phases.length
      ? `Tarjous luotiin ${phases.length} työvaiheella.`
      : 'Tarjous luotiin.');
  };

  const applyPhaseTemplate = async () => {
    if (!currentOrg || !selectedVersion) return;
    const phases = mergePhaseSelections(phaseTemplateId, phaseExtras);
    const existing = new Set(
      versionSections.map((section) => section.title.toLocaleLowerCase('fi-FI')),
    );
    const toAdd = phases.filter(
      (phase) => !existing.has(phase.title.toLocaleLowerCase('fi-FI')),
    );
    if (!toAdd.length) {
      setOperationError('Valitut työvaiheet ovat jo tarjouksessa.');
      return;
    }
    await run(async () => {
      const template = getOfferPhaseTemplate(phaseTemplateId);
      await addOfferSections(
        currentOrg.id,
        user?.id,
        toAdd.map((phase, index) => ({
          offerVersionId: selectedVersion.id,
          title: phase.title,
          description: phase.description,
          sortOrder: versionSections.length + index,
          customerVisible: true,
        })),
      );
      if (
        selectedVersion.marginPercent === 0
        && selectedVersion.overheadPercent === 0
        && selectedVersion.riskPercent === 0
      ) {
        await updateOfferVersion(currentOrg.id, selectedVersion.id, {
          marginPercent: template.suggestedMarginPercent,
          overheadPercent: template.suggestedOverheadPercent,
          riskPercent: template.suggestedRiskPercent,
          terms: selectedVersion.terms || template.defaultTerms,
        });
      }
      await data.refresh();
      setPhaseDialog(false);
      setPhaseExtras([]);
      setDetailTab('lines');
    }, `Lisättiin ${toAdd.length} työvaihetta.`);
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
    }, 'Perustiedot tallennettiin.');
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
    }, 'Laskenta-asetukset tallennettiin.');
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
    }, editingLine ? 'Tarjousrivi päivitettiin.' : 'Tarjousrivi lisättiin.');
  };

  const openSectionCreate = () => {
    setEditingSection(null);
    setSectionTitle('');
    setSectionDescription('');
    setSectionDialog(true);
  };

  const openSectionEdit = (section: OfferSection) => {
    setEditingSection(section);
    setSectionTitle(section.title);
    setSectionDescription(section.description);
    setSectionDialog(true);
  };

  const saveSection = async () => {
    if (!currentOrg || !selectedVersion || !sectionTitle.trim()) return;
    await run(async () => {
      if (editingSection) {
        await updateOfferSection(currentOrg.id, editingSection.id, {
          title: sectionTitle.trim(),
          description: sectionDescription.trim(),
        });
      } else {
        await addOfferSection(currentOrg.id, user?.id, {
          offerVersionId: selectedVersion.id,
          title: sectionTitle.trim(),
          description: sectionDescription.trim(),
          sortOrder: versionSections.length,
          customerVisible: true,
        });
      }
      await data.refresh();
      setSectionDialog(false);
      setEditingSection(null);
      setSectionTitle('');
      setSectionDescription('');
    }, editingSection ? 'Osio päivitettiin.' : 'Osio lisättiin.');
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
      setDetailTab('lines');
    }, `${lines.length} riviä tuotiin määrälaskelmasta.`);
  };

  const requestTransition = (status: OfferStatus) => {
    const messages: Partial<Record<OfferStatus, ConfirmAction>> = {
      Lähetetty: {
        kind: 'transition',
        status,
        title: 'Merkitse lähetetyksi?',
        description: 'Lähetetty versio lukitaan, eikä sen rivejä voi enää muokata. CRM-tilanne päivittyy automaattisesti.',
      },
      Hyväksytty: {
        kind: 'transition',
        status,
        title: 'Merkitse hyväksytyksi?',
        description: 'Tarjous merkitään hyväksytyksi. Voit sen jälkeen luoda projektin yhdellä napilla.',
      },
      Hylätty: {
        kind: 'transition',
        status,
        title: 'Merkitse hylätyksi?',
        description: 'Tarjous merkitään hylätyksi. Voit tarvittaessa tehdä uuden version myöhemmin.',
      },
      Arkistoitu: {
        kind: 'transition',
        status,
        title: 'Arkistoi tarjous?',
        description: 'Arkistoitu tarjous poistuu aktiivisesta tarjouskannasta.',
      },
    };
    const action = messages[status];
    if (action) setConfirmAction(action);
  };

  const newVersion = async () => {
    if (!selectedOffer) return;
    await run(async () => {
      const versionId = await createOfferVersion(selectedOffer.id);
      await data.refresh();
      setSelectedVersionId(versionId);
      setDetailTab('lines');
    }, 'Uusi tarjousversio luotiin.');
  };

  const convertProject = async () => {
    if (!selectedOffer) return;
    await run(async () => {
      const projectId = await convertOfferToProject(selectedOffer.id);
      await refreshAll();
      navigate(`/projektit/${projectId}/tyotila`);
    }, 'Projekti luotiin hyväksytystä tarjouksesta.');
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
    }, 'Hinnastorivi tallennettiin.');
  };

  const executeConfirm = async () => {
    if (!confirmAction || !currentOrg) return;
    const action = confirmAction;
    setConfirmAction(null);
    if (action.kind === 'transition' && selectedOffer && selectedVersion) {
      await run(async () => {
        await transitionOffer(selectedOffer.id, selectedVersion.id, action.status);
        await refreshAll();
      }, `Tila päivitettiin: ${action.status}.`);
      return;
    }
    if (action.kind === 'delete-offer' && selectedOffer) {
      await run(async () => {
        await deleteOffer(currentOrg.id, selectedOffer.id);
        setSelectedOfferId('');
        await data.refresh();
      }, 'Luonnos poistettiin.');
      return;
    }
    if (action.kind === 'delete-line') {
      await run(async () => {
        await deleteOfferLine(currentOrg.id, action.line.id);
        await data.refresh();
      }, 'Tarjousrivi poistettiin.');
      return;
    }
    if (action.kind === 'delete-section') {
      await run(async () => {
        await deleteOfferSection(currentOrg.id, action.section.id);
        await data.refresh();
      }, 'Osio poistettiin.');
      return;
    }
    if (action.kind === 'delete-catalog') {
      await run(async () => {
        await deleteCatalogItem(currentOrg.id, action.item.id);
        await data.refresh();
      }, 'Hinnastorivi poistettiin.');
      return;
    }
    if (action.kind === 'convert') {
      await convertProject();
    }
  };

  const sectionSaleTotal = (sectionId: string) => versionLines
    .filter((line) => line.sectionId === sectionId && !line.optional)
    .reduce((sum, line) => sum + calculateOfferLineTotals(line).saleSubtotalCents, 0);

  const unsectionedLines = versionLines.filter((line) => !line.sectionId);
  const visibleError = operationError ?? data.error ?? finance.error;
  const expiry = selectedOffer ? expiryLabel(selectedOffer.validUntil, selectedOffer.status) : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1700px] space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Tarjouslaskenta</h1>
          <p className="mt-1 max-w-3xl break-words text-body-sm text-text-secondary">
            Luo tarjous nopeasti vaiheittain: valitse työvaihepohja, hinnoittele rivit ja näe miten kate muodostuu loppusummaan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/maaralaskenta"><Ruler size={16} className="mr-2" /> Määrälaskenta</Link>
          </Button>
          <Button variant="outline" onClick={() => void refreshAll()} disabled={data.refreshing}>
            <RefreshCw size={16} className={cn('mr-2', data.refreshing && 'animate-spin')} /> Päivitä
          </Button>
          <Button onClick={openOfferCreate}>
            <Plus size={16} className="mr-2" /> Uusi tarjous
          </Button>
        </div>
      </div>

      <OfferKpiStrip offers={data.offers} versions={data.versions} />

      {visibleError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <span className="break-words">{visibleError}</span>
        </div>
      )}
      {operationSuccess && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <span className="break-words">{operationSuccess}</span>
        </div>
      )}
      {totalsMismatch && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <span className="break-words">
            Selain- ja palvelinlaskennan summissa on ero. Päivitä näkymä ennen tarjouksen lähettämistä.
          </span>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="offers">Tarjoukset ({data.offers.length})</TabsTrigger>
          <TabsTrigger value="catalog">Hinnasto ({data.catalog.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="offers" className="space-y-4">
          <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
            <OfferListPanel
              offers={filteredOffers}
              versions={data.versions}
              selectedOfferId={selectedOffer?.id}
              search={search}
              statusFilter={statusFilter}
              scopeFilter={scopeFilter}
              loading={data.loading}
              metaForOffer={(offer) => ({
                customerName: customers.find((item) => item.id === offer.customerId)?.name,
                assigneeName: people.find((person) => person.userId === offer.assignedUserId)?.name,
              })}
              onSearchChange={setSearch}
              onStatusFilterChange={setStatusFilter}
              onScopeFilterChange={setScopeFilter}
              onSelect={(offerId) => {
                setSelectedOfferId(offerId);
                setSelectedVersionId('');
                setDetailTab('lines');
              }}
            />

            {selectedOffer && selectedVersion ? (
              <div className="min-w-0 space-y-4">
                <Card className="overflow-hidden border-slate-200/80 shadow-none">
                  <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="border-white/20 bg-white/10 text-white">{selectedOffer.status}</Badge>
                          <span className="break-words font-mono text-xs text-slate-300">
                            {selectedOffer.offerNumber}
                          </span>
                          <span className="text-xs text-slate-400">Versio {selectedVersion.versionNumber}</span>
                          {expiry && (
                            <Badge className="border-amber-300/40 bg-amber-400/20 text-amber-100">{expiry}</Badge>
                          )}
                        </div>
                        <h2 className="break-words text-2xl font-bold tracking-tight">{selectedOffer.name}</h2>
                        <div className="space-y-1 text-sm text-slate-300">
                          <p className="break-words">
                            {customer?.name || lead?.company || 'Ei asiakasta'}
                            {' · '}
                            voimassa {date(selectedOffer.validUntil)}
                          </p>
                          {assignee && <p className="break-words">Vastuu: {assignee.name}</p>}
                          {selectedOffer.paymentTerms && (
                            <p className="break-words">Maksuehto: {selectedOffer.paymentTerms}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {lead && (
                            <Button asChild size="sm" variant="outline" className="border-slate-600 bg-white/5 text-white hover:bg-white/10">
                              <Link to="/crm">
                                <ExternalLink size={14} className="mr-2" /> Avaa CRM · {lead.name}
                              </Link>
                            </Button>
                          )}
                          {linkedProject && (
                            <Button asChild size="sm" variant="outline" className="border-slate-600 bg-white/5 text-white hover:bg-white/10">
                              <Link to={`/projektit/${linkedProject.id}/tyotila`}>
                                <FolderKanban size={14} className="mr-2" /> {linkedProject.name}
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          className="border-slate-600 bg-white/5 text-white hover:bg-white/10"
                          onClick={printOffer}
                        >
                          <Download size={15} className="mr-2" /> Tulosta / PDF
                        </Button>
                        {draft && (
                          <Button
                            variant="outline"
                            className="border-slate-600 bg-white/5 text-white hover:bg-white/10"
                            onClick={openOfferMeta}
                          >
                            <Edit3 size={15} className="mr-2" /> Perustiedot
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <CardContent className="space-y-4 p-4 sm:p-5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">Arvioitu kustannus</p>
                        <p className="mt-1 break-words font-mono text-xl font-bold">
                          {euro(selectedVersion.estimatedCostCents)}
                        </p>
                        <p className="mt-1 break-words text-xs text-slate-500">
                          Suorat {euro(selectedVersion.directCostCents)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-sky-50 p-4">
                        <p className="text-xs text-sky-700">Veroton myynti</p>
                        <p className="mt-1 break-words font-mono text-xl font-bold text-sky-950">
                          {euro(selectedVersion.subtotalCents)}
                        </p>
                        <p className="mt-1 break-words text-xs text-sky-700">
                          ALV {euro(selectedVersion.taxCents)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-4">
                        <p className="text-xs text-emerald-700">Arvioitu kate</p>
                        <p className={cn('mt-1 break-words font-mono text-xl font-bold', marginTone(selectedVersion.grossMarginPercent))}>
                          {euro(selectedVersion.grossMarginCents)}
                        </p>
                        <p className={cn('mt-1 text-xs font-semibold', marginTone(selectedVersion.grossMarginPercent))}>
                          {selectedVersion.grossMarginPercent.toFixed(1)} %
                        </p>
                      </div>
                      <div className="rounded-xl bg-orange-50 p-4">
                        <p className="text-xs text-orange-700">Tarjous yhteensä</p>
                        <p className="mt-1 break-words font-mono text-xl font-bold text-orange-950">
                          {euro(selectedVersion.totalCents)}
                        </p>
                        <p className="mt-1 break-words text-xs text-orange-700">
                          sis. ALV {selectedVersion.vatRate} %
                        </p>
                      </div>
                    </div>

                    {categoryBreakdown.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Myynti kustannuslajeittain
                        </p>
                        <div className="mt-3 space-y-2">
                          {categoryBreakdown.map(([category, values]) => {
                            const share = selectedVersion.subtotalCents > 0
                              ? Math.round((values.sale / selectedVersion.subtotalCents) * 100)
                              : 0;
                            return (
                              <div key={category} className="space-y-1">
                                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                                  <span className="break-words font-medium text-slate-700">{category}</span>
                                  <span className="break-words font-mono text-slate-900">
                                    {euro(values.sale)} · {share} %
                                  </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                  <div className="h-full rounded-full bg-orange-400" style={{ width: `${share}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <OfferWorkflowCard
                  offer={selectedOffer}
                  versions={offerVersions}
                  selectedVersion={selectedVersion}
                  draft={Boolean(draft)}
                  hasConvertedProject={Boolean(selectedOffer.convertedProjectId)}
                  saving={saving}
                  onSelectVersion={setSelectedVersionId}
                  onTransition={requestTransition}
                  onNewVersion={() => void newVersion()}
                  onConvertProject={() => setConfirmAction({
                    kind: 'convert',
                    title: 'Luo projekti hyväksytystä tarjouksesta?',
                    description: 'Projekti luodaan hyväksytyn version perusteella ja avataan työtilaan.',
                  })}
                  onOpenProject={() => {
                    if (selectedOffer.convertedProjectId) {
                      navigate(`/projektit/${selectedOffer.convertedProjectId}/tyotila`);
                    }
                  }}
                  onDeleteDraft={() => setConfirmAction({
                    kind: 'delete-offer',
                    title: 'Poista luonnostarjous?',
                    description: `Poistetaanko tarjous ”${selectedOffer.name}”? Toimintoa ei voi perua.`,
                  })}
                />

                <Tabs value={detailTab} onValueChange={setDetailTab} className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="lines">Rivit ({versionLines.length})</TabsTrigger>
                    <TabsTrigger value="settings">Laskenta</TabsTrigger>
                    <TabsTrigger value="history">Historia ({versionEvents.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="lines" className="space-y-4">
                    {draft && (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setPhaseTemplateId(versionSections.length ? 'blank' : 'bathroom');
                            setPhaseExtras([]);
                            setPhaseDialog(true);
                          }}
                        >
                          <Layers3 size={15} className="mr-2" /> Lisää työvaiheita
                        </Button>
                        <Button variant="outline" onClick={openSectionCreate}>
                          <FilePlus2 size={15} className="mr-2" /> Lisää osio
                        </Button>
                        <Button variant="outline" onClick={() => setImportDialog(true)}>
                          <Ruler size={15} className="mr-2" /> Tuo määrälaskennasta
                        </Button>
                        <Button onClick={() => openLineCreate()}>
                          <Plus size={15} className="mr-2" /> Lisää tarjousrivi
                        </Button>
                      </div>
                    )}

                    {!versionSections.length && !versionLines.length && draft && (
                      <Card className="overflow-hidden border-dashed border-orange-300 bg-orange-50/40 shadow-none">
                        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">Aloita työvaiheilla</p>
                            <p className="mt-1 break-words text-sm text-slate-600">
                              Valitse valmis pohja (esim. kylpyhuone tai keittiö), niin tarjoukseen syntyy selkeät laskentavaiheet heti.
                            </p>
                          </div>
                          <Button
                            onClick={() => {
                              setPhaseTemplateId('bathroom');
                              setPhaseExtras([]);
                              setPhaseDialog(true);
                            }}
                          >
                            <Layers3 size={15} className="mr-2" /> Valitse pohja
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {versionSections.map((section, sectionIndex) => (
                      <Card key={section.id} className="overflow-hidden border-slate-200/80 shadow-none">
                        <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-slate-50 py-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">
                                Vaihe {sectionIndex + 1}
                              </p>
                              <CardTitle className="mt-0.5 break-words text-base">{section.title}</CardTitle>
                              {section.description && (
                                <p className="mt-1 break-words text-xs text-slate-500">{section.description}</p>
                              )}
                              <p className="mt-1 font-mono text-xs text-slate-500">
                                Osio yht. {euro(sectionSaleTotal(section.id))}
                              </p>
                            </div>
                            {draft && (
                              <div className="flex flex-wrap gap-1">
                                <Button size="sm" variant="outline" onClick={() => openLineCreate(section.id)}>
                                  <Plus size={14} className="mr-1" /> Rivi
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => openSectionEdit(section)}>
                                  <Edit3 size={14} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600"
                                  onClick={() => setConfirmAction({
                                    kind: 'delete-section',
                                    section,
                                    title: 'Poista osio?',
                                    description: `Osion ”${section.title}” rivien osiointi poistuu, mutta rivit säilyvät.`,
                                  })}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          {versionLines.filter((line) => line.sectionId === section.id).map((line) => (
                            <OfferLineCard
                              key={line.id}
                              line={line}
                              draft={Boolean(draft)}
                              onEdit={openLineEdit}
                              onDelete={(current) => setConfirmAction({
                                kind: 'delete-line',
                                line: current,
                                title: 'Poista tarjousrivi?',
                                description: `Poistetaanko rivi ”${current.description}”?`,
                              })}
                            />
                          ))}
                          {!versionLines.some((line) => line.sectionId === section.id) && (
                            <p className="p-6 text-center text-sm text-slate-500">Osiossa ei ole rivejä.</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}

                    <Card className="overflow-hidden border-slate-200/80 shadow-none">
                      <CardHeader className="border-b bg-slate-50 py-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <CardTitle className="text-base">Muut tarjousrivit</CardTitle>
                          <p className="font-mono text-xs text-slate-500">
                            Yht. {euro(unsectionedLines.filter((line) => !line.optional).reduce((sum, line) => sum + calculateOfferLineTotals(line).saleSubtotalCents, 0))}
                          </p>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        {unsectionedLines.map((line) => (
                          <OfferLineCard
                            key={line.id}
                            line={line}
                            draft={Boolean(draft)}
                            onEdit={openLineEdit}
                            onDelete={(current) => setConfirmAction({
                              kind: 'delete-line',
                              line: current,
                              title: 'Poista tarjousrivi?',
                              description: `Poistetaanko rivi ”${current.description}”?`,
                            })}
                          />
                        ))}
                        {!unsectionedLines.length && (
                          <div className="p-10 text-center text-sm text-slate-500">
                            <Calculator size={38} className="mx-auto mb-3 text-slate-300" />
                            {versionLines.length
                              ? 'Kaikki rivit on sijoitettu osioihin.'
                              : 'Lisää ensimmäinen tarjousrivi tai tuo määrät määrälaskelmasta.'}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="settings" className="space-y-4">
                    {calculationSteps.length > 0 && (
                      <CalculationStepsPanel steps={calculationSteps} />
                    )}
                    <Card className="border-slate-200/80 shadow-none">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Settings2 size={18} /> Laskenta-asetukset
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="space-y-1">
                            <Label>ALV %</Label>
                            <Input type="number" value={settings.vatRate} disabled={!draft} onChange={(event) => setSettings((previous) => ({ ...previous, vatRate: event.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label>Yleiskulut %</Label>
                            <Input type="number" value={settings.overheadPercent} disabled={!draft} onChange={(event) => setSettings((previous) => ({ ...previous, overheadPercent: event.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label>Riskivaraus %</Label>
                            <Input type="number" value={settings.riskPercent} disabled={!draft} onChange={(event) => setSettings((previous) => ({ ...previous, riskPercent: event.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label>Tavoitekate % myynnistä</Label>
                            <Input type="number" value={settings.marginPercent} disabled={!draft} onChange={(event) => setSettings((previous) => ({ ...previous, marginPercent: event.target.value }))} />
                          </div>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-2">
                          <div className="space-y-1">
                            <Label>Tarjouksen kuvaus</Label>
                            <Textarea value={settings.notes} disabled={!draft} rows={4} onChange={(event) => setSettings((previous) => ({ ...previous, notes: event.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label>Ehdot ja rajaukset</Label>
                            <Textarea value={settings.terms} disabled={!draft} rows={4} onChange={(event) => setSettings((previous) => ({ ...previous, terms: event.target.value }))} />
                          </div>
                        </div>
                        {draft && (
                          <div className="flex justify-end">
                            <Button onClick={() => void saveSettings()} disabled={saving}>Tallenna asetukset</Button>
                          </div>
                        )}
                        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm">
                              {settingsOpen ? 'Piilota ohje' : 'Näytä hinnoitteluohje'}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-2 text-sm text-slate-500">
                            Laskenta etenee vaiheittain: suorat kustannukset → yleiskulut → riskivaraus → arvioitu kustannus → veroton myynti → ALV → loppusumma. Tavoitekate lasketaan myyntihinnasta: esimerkiksi 10 000 € kustannus ja 20 % tavoitekate tarkoittaa 12 500 € myyntihintaa. Rivin ”Laske suositus” käyttää näitä asetuksia.
                          </CollapsibleContent>
                        </Collapsible>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="history">
                    <Card className="border-slate-200/80 shadow-none">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <History size={18} /> Tapahtumahistoria
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {versionEvents.map((event) => (
                          <div key={event.id} className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-medium">{event.detail || event.eventType}</p>
                              <p className="break-words text-xs text-slate-500">{event.eventType}</p>
                            </div>
                            <span className="shrink-0 text-xs text-slate-400">{dateTime(event.createdAt)}</span>
                          </div>
                        ))}
                        {!versionEvents.length && (
                          <p className="py-6 text-center text-sm text-slate-500">Ei tapahtumia.</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <Card className="border-slate-200/80 shadow-none">
                <CardContent className="p-14 text-center">
                  <FileText size={48} className="mx-auto mb-4 text-slate-300" />
                  <h2 className="text-lg font-semibold">Valitse tai luo tarjous</h2>
                  <p className="mx-auto mt-1 max-w-md break-words text-sm text-slate-500">
                    Tarjous yhdistää sisäisen kustannuksen, myyntihinnan ja tavoitekatteen. CRM-mahdollisuudesta voit avata tarjouksen suoraan valmiilla asiakastiedoilla.
                  </p>
                  <Button className="mt-5" onClick={openOfferCreate}>
                    <Plus size={16} className="mr-2" /> Uusi tarjous
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="catalog">
          <CatalogTab
            items={data.catalog}
            search={catalogSearch}
            categoryFilter={catalogCategory}
            onSearchChange={setCatalogSearch}
            onCategoryFilterChange={setCatalogCategory}
            onCreate={openCatalogCreate}
            onEdit={openCatalogEdit}
            onDelete={(item) => setConfirmAction({
              kind: 'delete-catalog',
              item,
              title: 'Poista hinnastorivi?',
              description: `Poistetaanko hinnastorivi ”${item.name}”?`,
            })}
          />
        </TabsContent>
      </Tabs>

      <OfferCreateWizard
        open={offerDialog}
        onOpenChange={setOfferDialog}
        form={offerForm}
        onFormChange={setOfferForm}
        customers={customers}
        crmLeads={crmLeads}
        projects={projects}
        people={people}
        errors={errors}
        saving={saving}
        onSelectLead={selectLead}
        onSubmit={(phases) => void saveOffer(phases)}
      />

      <Dialog open={phaseDialog} onOpenChange={setPhaseDialog}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Lisää työvaiheita laskentaan</DialogTitle>
          </DialogHeader>
          <PhaseTemplatesPicker
            selectedTemplateId={phaseTemplateId}
            onSelectTemplate={setPhaseTemplateId}
            customPhases={phaseExtras}
            onCustomPhasesChange={setPhaseExtras}
            existingTitles={versionSections.map((section) => section.title)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhaseDialog(false)}>Peruuta</Button>
            <Button onClick={() => void applyPhaseTemplate()} disabled={saving}>
              {saving ? 'Lisätään…' : 'Lisää valitut vaiheet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={offerMetaDialog} onOpenChange={setOfferMetaDialog}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Tarjouksen perustiedot</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Nimi *</Label>
              <Input value={offerMetaForm.name} onChange={(event) => setOfferMetaForm((previous) => ({ ...previous, name: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Voimassa asti</Label>
              <Input type="date" value={offerMetaForm.validUntil} onChange={(event) => setOfferMetaForm((previous) => ({ ...previous, validUntil: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Asiakkaan viite</Label>
              <Input value={offerMetaForm.customerReference} onChange={(event) => setOfferMetaForm((previous) => ({ ...previous, customerReference: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Toimitusaika</Label>
              <Input value={offerMetaForm.deliveryTime} onChange={(event) => setOfferMetaForm((previous) => ({ ...previous, deliveryTime: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Maksuehto</Label>
              <Input value={offerMetaForm.paymentTerms} onChange={(event) => setOfferMetaForm((previous) => ({ ...previous, paymentTerms: event.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Vastuuhenkilö</Label>
              <Select value={offerMetaForm.assignedUserId || UNSECTIONED} onValueChange={(value) => setOfferMetaForm((previous) => ({ ...previous, assignedUserId: value === UNSECTIONED ? '' : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSECTIONED}>Ei vastuuhenkilöä</SelectItem>
                  {people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Sisäinen huomio</Label>
              <Textarea value={offerMetaForm.notes} onChange={(event) => setOfferMetaForm((previous) => ({ ...previous, notes: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferMetaDialog(false)}>Peruuta</Button>
            <Button onClick={() => void saveOfferMeta()} disabled={saving}>Tallenna</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lineDialog} onOpenChange={setLineDialog}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingLine ? 'Muokkaa tarjousriviä' : 'Uusi tarjousrivi'}</DialogTitle>
          </DialogHeader>
          {errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errors.map((error) => <p key={error}>{error}</p>)}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Hinnastosta</Label>
              <Select value={lineForm.catalogItemId || UNSECTIONED} onValueChange={(value) => value !== UNSECTIONED && selectCatalogItem(value)}>
                <SelectTrigger><SelectValue placeholder="Valitse valmis hinnastorivi" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSECTIONED}>Ei hinnastoriviä</SelectItem>
                  {data.catalog.filter((item) => item.active).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.code ? `${item.code} · ` : ''}{item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Kustannuslaji</Label>
              <Select value={lineForm.category} onValueChange={(value) => setLineForm((previous) => ({ ...previous, category: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OFFER_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Osio</Label>
              <Select value={lineForm.sectionId} onValueChange={(value) => setLineForm((previous) => ({ ...previous, sectionId: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSECTIONED}>Ei osiota</SelectItem>
                  {versionSections.map((section) => <SelectItem key={section.id} value={section.id}>{section.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Kuvaus *</Label>
              <Input value={lineForm.description} onChange={(event) => setLineForm((previous) => ({ ...previous, description: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Määrä</Label>
              <Input type="number" step="0.01" value={lineForm.quantity} onChange={(event) => setLineForm((previous) => ({ ...previous, quantity: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Yksikkö</Label>
              <Input value={lineForm.unit} onChange={(event) => setLineForm((previous) => ({ ...previous, unit: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Sisäinen kustannus / yks. €</Label>
              <Input type="number" step="0.01" value={lineForm.costUnitPrice} onChange={(event) => setLineForm((previous) => ({ ...previous, costUnitPrice: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label>Myyntihinta / yks. €</Label>
                <button type="button" className="text-xs font-semibold text-orange-600" onClick={recommendLinePrice}>
                  Laske suositus
                </button>
              </div>
              <Input type="number" step="0.01" value={lineForm.saleUnitPrice} onChange={(event) => setLineForm((previous) => ({ ...previous, saleUnitPrice: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Hukka %</Label>
              <Input type="number" step="0.1" value={lineForm.wastePercent} onChange={(event) => setLineForm((previous) => ({ ...previous, wastePercent: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Alennus %</Label>
              <Input type="number" step="0.1" value={lineForm.discountPercent} onChange={(event) => setLineForm((previous) => ({ ...previous, discountPercent: event.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Asiakkaalle näkyvä huomio</Label>
              <Textarea value={lineForm.customerNote} rows={2} onChange={(event) => setLineForm((previous) => ({ ...previous, customerNote: event.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Sisäinen huomio</Label>
              <Textarea value={lineForm.internalNote} rows={2} onChange={(event) => setLineForm((previous) => ({ ...previous, internalNote: event.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={lineForm.customerVisible} onChange={(event) => setLineForm((previous) => ({ ...previous, customerVisible: event.target.checked }))} />
              Näytä asiakkaan tarjouksessa
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={lineForm.optional} onChange={(event) => setLineForm((previous) => ({ ...previous, optional: event.target.checked }))} />
              Valinnainen optio
            </label>
          </div>
          {linePreview && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-slate-800">Rivikohtainen esikatselu</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <p className="break-words">Kustannus: <strong className="font-mono">{euro(linePreview.directCostCents)}</strong></p>
                <p className="break-words">Myynti: <strong className="font-mono">{euro(linePreview.saleSubtotalCents)}</strong></p>
                <p className={cn('break-words', marginTone(linePreview.grossMarginPercent))}>
                  Kate: <strong className="font-mono">{euro(linePreview.grossMarginCents)}</strong> ({linePreview.grossMarginPercent.toFixed(1)} %)
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineDialog(false)}>Peruuta</Button>
            <Button onClick={() => void saveLine()} disabled={saving}>Tallenna rivi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sectionDialog} onOpenChange={setSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSection ? 'Muokkaa osiota' : 'Uusi tarjousosio'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Otsikko *</Label>
              <Input value={sectionTitle} placeholder="Esim. Purkutyöt" onChange={(event) => setSectionTitle(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Kuvaus</Label>
              <Textarea value={sectionDescription} onChange={(event) => setSectionDescription(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialog(false)}>Peruuta</Button>
            <Button onClick={() => void saveSection()} disabled={saving || !sectionTitle.trim()}>
              {editingSection ? 'Tallenna osio' : 'Lisää osio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tuo määrälaskelmasta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Määrälaskelma</Label>
            <Select value={takeoffId} onValueChange={setTakeoffId}>
              <SelectTrigger><SelectValue placeholder="Valitse määrälaskelma" /></SelectTrigger>
              <SelectContent>
                {finance.takeoffs.map((takeoff) => (
                  <SelectItem key={takeoff.id} value={takeoff.id}>
                    {takeoff.name} · {finance.takeoffLines.filter((line) => line.takeoffId === takeoff.id).length} riviä
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="break-words text-sm text-slate-500">
              Rivien nimet ja tunnukset yhdistetään hinnastoon. Tunnistamattomat rivit tuodaan nollahinnalla hinnoiteltaviksi.
            </p>
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to="/maaralaskenta"><Ruler size={15} className="mr-2" /> Avaa määrälaskenta</Link>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialog(false)}>Peruuta</Button>
            <Button onClick={() => void importTakeoff()} disabled={saving || !takeoffId}>Tuo rivit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={catalogDialog} onOpenChange={setCatalogDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCatalog ? 'Muokkaa hinnastoriviä' : 'Uusi hinnastorivi'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Tunnus</Label>
              <Input value={catalogForm.code} onChange={(event) => setCatalogForm((previous) => ({ ...previous, code: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Kategoria</Label>
              <Select value={catalogForm.category} onValueChange={(value) => setCatalogForm((previous) => ({ ...previous, category: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OFFER_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Nimi *</Label>
              <Input value={catalogForm.name} onChange={(event) => setCatalogForm((previous) => ({ ...previous, name: event.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Kuvaus</Label>
              <Textarea value={catalogForm.description} onChange={(event) => setCatalogForm((previous) => ({ ...previous, description: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Yksikkö</Label>
              <Input value={catalogForm.unit} onChange={(event) => setCatalogForm((previous) => ({ ...previous, unit: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Oletushukka %</Label>
              <Input type="number" value={catalogForm.wastePercent} onChange={(event) => setCatalogForm((previous) => ({ ...previous, wastePercent: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Kustannushinta €</Label>
              <Input type="number" step="0.01" value={catalogForm.costUnitPrice} onChange={(event) => setCatalogForm((previous) => ({ ...previous, costUnitPrice: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Myyntihinta €</Label>
              <Input type="number" step="0.01" value={catalogForm.saleUnitPrice} onChange={(event) => setCatalogForm((previous) => ({ ...previous, saleUnitPrice: event.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={catalogForm.active} onChange={(event) => setCatalogForm((previous) => ({ ...previous, active: event.target.checked }))} />
              Aktiivinen hinnastossa
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatalogDialog(false)}>Peruuta</Button>
            <Button onClick={() => void saveCatalog()} disabled={saving}>Tallenna</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {confirmAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Peruuta</AlertDialogCancel>
            <AlertDialogAction onClick={() => void executeConfirm()} disabled={saving}>
              Vahvista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
