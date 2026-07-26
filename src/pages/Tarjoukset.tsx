import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Copy,
  Edit3,
  Euro,
  ExternalLink,
  FilePlus2,
  FileSignature,
  FolderKanban,
  Loader2,
  Paperclip,
  Plus,
  Printer,
  Search,
  Send,
  Settings,
  Trash2,
  XCircle,
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
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOfferCenter } from '@/hooks/useOfferCenter';
import { buildOfferPrintHtml, formatCents } from '@/lib/offerDocument';
import { localDateIso } from '@/lib/localDateTime';
import {
  convertOfferToProject,
  createOffer,
  createOfferLine,
  createOfferVersion,
  deleteOffer,
  deleteOfferLine,
  deleteRecordAttachment,
  openRecordAttachment,
  saveCommercialSettings,
  transitionOffer,
  updateOffer,
  updateOfferLine,
  updateOfferVersion,
  uploadRecordAttachment,
  type Offer,
  type OfferLine,
  type OfferStatus,
  type OrganizationCommercialSettings,
  type RecordAttachment,
} from '@/lib/supabase/offers';

const OFFER_STATUSES: OfferStatus[] = [
  'Luonnos',
  'Lähetetty',
  'Hyväksytty',
  'Hylätty',
  'Vanhentunut',
  'Arkistoitu',
];
const LINE_CATEGORIES = ['Työ', 'Materiaali', 'Aliurakka', 'Kalusto', 'Matka', 'Muu'];
const UNITS = ['kpl', 'h', 'pv', 'm', 'm²', 'm³', 'kg', 'erä'];

interface OfferForm {
  name: string;
  offerNumber: string;
  customerId: string;
  crmLeadId: string;
  projectId: string;
  validUntil: string;
  notes: string;
}

interface VersionForm {
  title: string;
  vatRate: string;
  overheadPercent: string;
  riskPercent: string;
  marginPercent: string;
  notes: string;
  terms: string;
}

interface LineForm {
  category: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

interface SettingsForm {
  defaultVatRate: string;
  defaultOverheadPercent: string;
  defaultRiskPercent: string;
  defaultMarginPercent: string;
  defaultHourlyCost: string;
  defaultPaymentTermDays: string;
  defaultOfferValidDays: string;
  defaultOfferTerms: string;
  companyAddress: string;
  companyPostalCode: string;
  companyCity: string;
  companyEmail: string;
  companyPhone: string;
}

const emptyOfferForm: OfferForm = {
  name: '',
  offerNumber: '',
  customerId: '',
  crmLeadId: '',
  projectId: '',
  validUntil: '',
  notes: '',
};

const emptyLineForm: LineForm = {
  category: 'Työ',
  description: '',
  quantity: '1',
  unit: 'kpl',
  unitPrice: '0',
};

function money(value: number): string {
  return formatCents(Math.round(value));
}

function dateLabel(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

function addLocalDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateIso(date);
}

function parseDecimal(value: string): number {
  return Number(value.replace(',', '.'));
}

function statusBadge(status: OfferStatus) {
  const classes: Record<OfferStatus, string> = {
    Luonnos: 'bg-slate-100 text-slate-700',
    Lähetetty: 'bg-blue-50 text-blue-700',
    Hyväksytty: 'bg-emerald-50 text-emerald-700',
    Hylätty: 'bg-red-50 text-red-700',
    Vanhentunut: 'bg-amber-50 text-amber-700',
    Arkistoitu: 'bg-slate-200 text-slate-600',
  };
  return <Badge className={`border-0 ${classes[status]}`}>{status}</Badge>;
}

function settingsToForm(settings: OrganizationCommercialSettings): SettingsForm {
  return {
    defaultVatRate: String(settings.defaultVatRate),
    defaultOverheadPercent: String(settings.defaultOverheadPercent),
    defaultRiskPercent: String(settings.defaultRiskPercent),
    defaultMarginPercent: String(settings.defaultMarginPercent),
    defaultHourlyCost: String(settings.defaultHourlyCostCents / 100),
    defaultPaymentTermDays: String(settings.defaultPaymentTermDays),
    defaultOfferValidDays: String(settings.defaultOfferValidDays),
    defaultOfferTerms: settings.defaultOfferTerms ?? '',
    companyAddress: settings.companyAddress ?? '',
    companyPostalCode: settings.companyPostalCode ?? '',
    companyCity: settings.companyCity ?? '',
    companyEmail: settings.companyEmail ?? '',
    companyPhone: settings.companyPhone ?? '',
  };
}

export default function Tarjoukset() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg, actualRole } = useOrganization();
  const {
    customers,
    projects,
    crmLeads,
    refresh: refreshDomain,
  } = useAppDataContext();
  const center = useOfferCenter();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Kaikki');
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [offerDialog, setOfferDialog] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [offerForm, setOfferForm] = useState<OfferForm>(emptyOfferForm);
  const [offerErrors, setOfferErrors] = useState<string[]>([]);

  const [versionForm, setVersionForm] = useState<VersionForm>({
    title: '',
    vatRate: '25.5',
    overheadPercent: '0',
    riskPercent: '0',
    marginPercent: '0',
    notes: '',
    terms: '',
  });

  const [lineDialog, setLineDialog] = useState(false);
  const [editingLine, setEditingLine] = useState<OfferLine | null>(null);
  const [lineForm, setLineForm] = useState<LineForm>(emptyLineForm);
  const [lineErrors, setLineErrors] = useState<string[]>([]);

  const [attachmentDialog, setAttachmentDialog] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentDescription, setAttachmentDescription] = useState('');

  const [deleteOfferTarget, setDeleteOfferTarget] = useState<Offer | null>(null);
  const [deleteLineTarget, setDeleteLineTarget] = useState<OfferLine | null>(null);
  const [deleteAttachmentTarget, setDeleteAttachmentTarget] = useState<RecordAttachment | null>(null);

  const [settingsForm, setSettingsForm] = useState<SettingsForm>(() =>
    settingsToForm(center.settings),
  );
  const [settingsErrors, setSettingsErrors] = useState<string[]>([]);

  const latestVersionByOffer = useMemo(() => {
    const result = new Map<string, (typeof center.versions)[number]>();
    center.versions.forEach((version) => {
      const current = result.get(version.offerId);
      if (!current || version.versionNumber > current.versionNumber) {
        result.set(version.offerId, version);
      }
    });
    return result;
  }, [center.versions]);

  const filteredOffers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    return center.offers.filter((offer) => {
      const customer = customers.find((item) => item.id === offer.customerId);
      const matchesSearch = !query || [
        offer.name,
        offer.offerNumber ?? '',
        customer?.name ?? '',
      ].some((value) => value.toLocaleLowerCase('fi').includes(query));
      return matchesSearch && (statusFilter === 'Kaikki' || offer.status === statusFilter);
    });
  }, [center.offers, customers, search, statusFilter]);

  const selectedOffer = center.offers.find((offer) => offer.id === selectedOfferId);
  const versionsForOffer = useMemo(
    () => center.versions
      .filter((version) => version.offerId === selectedOfferId)
      .sort((a, b) => b.versionNumber - a.versionNumber),
    [center.versions, selectedOfferId],
  );
  const selectedVersion = versionsForOffer.find((version) => version.id === selectedVersionId)
    ?? versionsForOffer[0];
  const linesForVersion = useMemo(
    () => center.lines
      .filter((line) => line.offerVersionId === selectedVersion?.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)),
    [center.lines, selectedVersion?.id],
  );
  const attachmentsForOffer = useMemo(
    () => center.attachments.filter(
      (attachment) => attachment.entityType === 'offer' && attachment.entityId === selectedOfferId,
    ),
    [center.attachments, selectedOfferId],
  );

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const leadById = useMemo(
    () => new Map(crmLeads.map((lead) => [lead.id, lead])),
    [crmLeads],
  );

  const currentPipelineCents = center.offers
    .filter((offer) => !['Arkistoitu', 'Hylätty'].includes(offer.status))
    .reduce((sum, offer) => sum + (latestVersionByOffer.get(offer.id)?.totalCents ?? 0), 0);
  const weightedPipelineCents = center.offers
    .filter((offer) => !['Arkistoitu', 'Hylätty'].includes(offer.status))
    .reduce((sum, offer) => {
      const total = latestVersionByOffer.get(offer.id)?.totalCents ?? 0;
      const probability = offer.crmLeadId
        ? leadById.get(offer.crmLeadId)?.probability ?? 50
        : offer.status === 'Hyväksytty'
          ? 100
          : offer.status === 'Lähetetty'
            ? 60
            : 30;
      return sum + Math.round(total * probability / 100);
    }, 0);
  const acceptedCents = center.offers
    .filter((offer) => offer.status === 'Hyväksytty')
    .reduce((sum, offer) => {
      const accepted = center.versions.find(
        (version) => version.offerId === offer.id && version.status === 'Hyväksytty',
      );
      return sum + (accepted?.totalCents ?? latestVersionByOffer.get(offer.id)?.totalCents ?? 0);
    }, 0);

  useEffect(() => {
    if (center.offers.length === 0) {
      setSelectedOfferId('');
      return;
    }
    if (!center.offers.some((offer) => offer.id === selectedOfferId)) {
      setSelectedOfferId(center.offers[0].id);
    }
  }, [center.offers, selectedOfferId]);

  useEffect(() => {
    if (versionsForOffer.length === 0) {
      setSelectedVersionId('');
      return;
    }
    if (!versionsForOffer.some((version) => version.id === selectedVersionId)) {
      setSelectedVersionId(versionsForOffer[0].id);
    }
  }, [selectedVersionId, versionsForOffer]);

  useEffect(() => {
    if (!selectedVersion) return;
    setVersionForm({
      title: selectedVersion.title,
      vatRate: String(selectedVersion.vatRate),
      overheadPercent: String(selectedVersion.overheadPercent),
      riskPercent: String(selectedVersion.riskPercent),
      marginPercent: String(selectedVersion.marginPercent),
      notes: selectedVersion.notes ?? '',
      terms: selectedVersion.terms ?? '',
    });
  }, [selectedVersion]);

  useEffect(() => {
    setSettingsForm(settingsToForm(center.settings));
  }, [center.settings]);

  const runAction = async (
    action: () => Promise<unknown>,
    onSuccess?: () => void | Promise<void>,
  ) => {
    setSaving(true);
    setOperationError(null);
    try {
      await action();
      await center.refresh();
      await onSuccess?.();
      return true;
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Toiminto epäonnistui.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openOfferCreate = () => {
    setEditingOffer(null);
    setOfferForm({
      ...emptyOfferForm,
      validUntil: addLocalDays(center.settings.defaultOfferValidDays || 30),
    });
    setOfferErrors([]);
    setOperationError(null);
    setOfferDialog(true);
  };

  const openOfferEdit = (offer: Offer) => {
    setEditingOffer(offer);
    setOfferForm({
      name: offer.name,
      offerNumber: offer.offerNumber ?? '',
      customerId: offer.customerId ?? '',
      crmLeadId: offer.crmLeadId ?? '',
      projectId: offer.projectId ?? '',
      validUntil: offer.validUntil ?? '',
      notes: offer.notes ?? '',
    });
    setOfferErrors([]);
    setOperationError(null);
    setOfferDialog(true);
  };

  const saveOffer = async () => {
    const nextErrors: string[] = [];
    if (!offerForm.name.trim()) nextErrors.push('Tarjouksen nimi on pakollinen.');
    if (offerForm.validUntil && offerForm.validUntil < localDateIso()) {
      nextErrors.push('Voimassaolopäivä ei voi olla menneisyydessä.');
    }
    setOfferErrors(nextErrors);
    if (nextErrors.length || !currentOrg) return;

    await runAction(async () => {
      if (editingOffer) {
        await updateOffer(currentOrg.id, editingOffer.id, {
          name: offerForm.name,
          offerNumber: offerForm.offerNumber,
          customerId: offerForm.customerId || undefined,
          crmLeadId: offerForm.crmLeadId || undefined,
          projectId: offerForm.projectId || undefined,
          validUntil: offerForm.validUntil || undefined,
          notes: offerForm.notes,
        });
        setSelectedOfferId(editingOffer.id);
      } else {
        const id = await createOffer({
          organizationId: currentOrg.id,
          customerId: offerForm.customerId || undefined,
          crmLeadId: offerForm.crmLeadId || undefined,
          projectId: offerForm.projectId || undefined,
          name: offerForm.name,
          offerNumber: offerForm.offerNumber || undefined,
          validUntil: offerForm.validUntil || undefined,
          notes: offerForm.notes || undefined,
        });
        setSelectedOfferId(id);
      }
      setOfferDialog(false);
    });
  };

  const saveVersion = async () => {
    if (!currentOrg || !selectedVersion) return;
    const vatRate = parseDecimal(versionForm.vatRate);
    const overheadPercent = parseDecimal(versionForm.overheadPercent);
    const riskPercent = parseDecimal(versionForm.riskPercent);
    const marginPercent = parseDecimal(versionForm.marginPercent);
    const percentages = [vatRate, overheadPercent, riskPercent, marginPercent];
    if (!versionForm.title.trim()) {
      setOperationError('Tarjousversion otsikko on pakollinen.');
      return;
    }
    if (percentages.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
      setOperationError('Prosenttien pitää olla välillä 0–100.');
      return;
    }

    await runAction(() => updateOfferVersion(currentOrg.id, selectedVersion.id, {
      title: versionForm.title,
      vatRate,
      overheadPercent,
      riskPercent,
      marginPercent,
      notes: versionForm.notes,
      terms: versionForm.terms,
    }));
  };

  const openLineCreate = () => {
    setEditingLine(null);
    setLineForm(emptyLineForm);
    setLineErrors([]);
    setLineDialog(true);
  };

  const openLineEdit = (line: OfferLine) => {
    setEditingLine(line);
    setLineForm({
      category: line.category,
      description: line.description,
      quantity: String(line.quantity),
      unit: line.unit,
      unitPrice: String(line.unitPriceCents / 100),
    });
    setLineErrors([]);
    setLineDialog(true);
  };

  const saveLine = async () => {
    if (!currentOrg || !selectedVersion) return;
    const quantity = parseDecimal(lineForm.quantity);
    const unitPrice = parseDecimal(lineForm.unitPrice);
    const nextErrors: string[] = [];
    if (!lineForm.description.trim()) nextErrors.push('Rivin kuvaus on pakollinen.');
    if (!Number.isFinite(quantity) || quantity <= 0) nextErrors.push('Määrän pitää olla positiivinen.');
    if (!Number.isFinite(unitPrice) || unitPrice < 0) nextErrors.push('Yksikköhinta ei voi olla negatiivinen.');
    if (!lineForm.unit.trim()) nextErrors.push('Yksikkö on pakollinen.');
    setLineErrors(nextErrors);
    if (nextErrors.length) return;

    await runAction(async () => {
      if (editingLine) {
        await updateOfferLine(currentOrg.id, editingLine.id, {
          category: lineForm.category,
          description: lineForm.description,
          quantity,
          unit: lineForm.unit,
          unitPriceCents: Math.round(unitPrice * 100),
        });
      } else {
        const nextSortOrder = linesForVersion.reduce(
          (maximum, line) => Math.max(maximum, line.sortOrder),
          0,
        ) + 10;
        await createOfferLine({
          organizationId: currentOrg.id,
          offerVersionId: selectedVersion.id,
          userId: user?.id,
          category: lineForm.category,
          description: lineForm.description,
          quantity,
          unit: lineForm.unit,
          unitPriceCents: Math.round(unitPrice * 100),
          sortOrder: nextSortOrder,
        });
      }
      setLineDialog(false);
    });
  };

  const changeStatus = async (status: OfferStatus) => {
    if (!selectedOffer) return;
    await runAction(() => transitionOffer(selectedOffer.id, selectedVersion?.id, status));
  };

  const addVersion = async () => {
    if (!selectedOffer) return;
    await runAction(async () => {
      const versionId = await createOfferVersion(selectedOffer.id);
      setSelectedVersionId(versionId);
    });
  };

  const convertToProject = async () => {
    if (!selectedOffer) return;
    await runAction(
      async () => {
        const projectId = await convertOfferToProject(selectedOffer.id);
        await refreshDomain();
        navigate(`/projektit/${projectId}`);
      },
    );
  };

  const printOffer = () => {
    if (!selectedOffer || !selectedVersion || !currentOrg) return;
    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) {
      setOperationError('Tulostusikkunaa ei voitu avata. Salli ponnahdusikkunat ja yritä uudelleen.');
      return;
    }
    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(buildOfferPrintHtml({
      organization: {
        name: currentOrg.name,
        businessId: currentOrg.business_id ?? undefined,
      },
      customer: selectedOffer.customerId
        ? customerById.get(selectedOffer.customerId)
        : undefined,
      offer: selectedOffer,
      version: selectedVersion,
      lines: linesForVersion,
      settings: center.settings,
    }));
    printWindow.document.close();
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  const uploadAttachment = async () => {
    if (!currentOrg || !selectedOffer || !attachmentFile) {
      setOperationError('Valitse lähetettävä tiedosto.');
      return;
    }
    await runAction(async () => {
      await uploadRecordAttachment({
        organizationId: currentOrg.id,
        projectId: selectedOffer.projectId,
        entityType: 'offer',
        entityId: selectedOffer.id,
        userId: user?.id,
        file: attachmentFile,
        description: attachmentDescription,
      });
      setAttachmentDialog(false);
      setAttachmentFile(null);
      setAttachmentDescription('');
    });
  };

  const saveSettings = async () => {
    if (!currentOrg || actualRole !== 'admin') return;
    const defaultVatRate = parseDecimal(settingsForm.defaultVatRate);
    const defaultOverheadPercent = parseDecimal(settingsForm.defaultOverheadPercent);
    const defaultRiskPercent = parseDecimal(settingsForm.defaultRiskPercent);
    const defaultMarginPercent = parseDecimal(settingsForm.defaultMarginPercent);
    const defaultHourlyCost = parseDecimal(settingsForm.defaultHourlyCost);
    const defaultPaymentTermDays = Number(settingsForm.defaultPaymentTermDays);
    const defaultOfferValidDays = Number(settingsForm.defaultOfferValidDays);
    const nextErrors: string[] = [];

    if ([defaultVatRate, defaultOverheadPercent, defaultRiskPercent, defaultMarginPercent]
      .some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
      nextErrors.push('Prosenttien pitää olla välillä 0–100.');
    }
    if (!Number.isFinite(defaultHourlyCost) || defaultHourlyCost < 0) {
      nextErrors.push('Tuntikustannuksen pitää olla nolla tai positiivinen.');
    }
    if (!Number.isInteger(defaultPaymentTermDays) || defaultPaymentTermDays < 1 || defaultPaymentTermDays > 365) {
      nextErrors.push('Maksuehdon pitää olla 1–365 päivää.');
    }
    if (!Number.isInteger(defaultOfferValidDays) || defaultOfferValidDays < 1 || defaultOfferValidDays > 365) {
      nextErrors.push('Tarjouksen voimassaolon pitää olla 1–365 päivää.');
    }
    if (settingsForm.companyEmail.trim() && !/^\S+@\S+\.\S+$/.test(settingsForm.companyEmail.trim())) {
      nextErrors.push('Yrityksen sähköpostiosoite ei ole kelvollinen.');
    }
    setSettingsErrors(nextErrors);
    if (nextErrors.length) return;

    await runAction(() => saveCommercialSettings({
      organizationId: currentOrg.id,
      locale: center.settings.locale,
      timezone: center.settings.timezone,
      defaultVatRate,
      defaultOverheadPercent,
      defaultRiskPercent,
      defaultMarginPercent,
      defaultHourlyCostCents: Math.round(defaultHourlyCost * 100),
      defaultPaymentTermDays,
      defaultOfferValidDays,
      defaultOfferTerms: settingsForm.defaultOfferTerms,
      companyAddress: settingsForm.companyAddress,
      companyPostalCode: settingsForm.companyPostalCode,
      companyCity: settingsForm.companyCity,
      companyEmail: settingsForm.companyEmail,
      companyPhone: settingsForm.companyPhone,
    }));
  };

  const confirmDelete = async () => {
    if (!currentOrg) return;
    if (deleteOfferTarget) {
      await runAction(() => deleteOffer(currentOrg.id, deleteOfferTarget.id), () => {
        setDeleteOfferTarget(null);
      });
      return;
    }
    if (deleteLineTarget) {
      await runAction(() => deleteOfferLine(currentOrg.id, deleteLineTarget.id), () => {
        setDeleteLineTarget(null);
      });
      return;
    }
    if (deleteAttachmentTarget) {
      await runAction(() => deleteRecordAttachment(deleteAttachmentTarget), () => {
        setDeleteAttachmentTarget(null);
      });
    }
  };

  const selectedOfferCustomer = selectedOffer?.customerId
    ? customerById.get(selectedOffer.customerId)
    : undefined;
  const canEditVersion = Boolean(
    selectedOffer
    && selectedVersion
    && selectedOffer.status === 'Luonnos'
    && selectedVersion.status === 'Luonnos',
  );
  const visibleError = operationError ?? center.error;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Tarjoukset ja talousasetukset</h1>
          <p className="mt-1 text-body-sm text-text-secondary">
            Versioidut tarjoukset, hinnanmuodostus, liitteet ja hyväksytyn tarjouksen siirto projektiksi
          </p>
        </div>
        <Button onClick={openOfferCreate} className="gap-2"><Plus size={16} /> Uusi tarjous</Button>
      </div>

      {visibleError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} />{visibleError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Tarjouksia', value: center.offers.length, icon: FileSignature },
          { label: 'Avoin tarjouskanta', value: money(currentPipelineCents), icon: Euro },
          { label: 'Painotettu tarjouskanta', value: money(weightedPipelineCents), icon: Euro },
          { label: 'Hyväksytty', value: money(acceptedCents), icon: CheckCircle2 },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <div className="flex justify-between text-xs uppercase tracking-wide text-text-secondary">
                <span>{item.label}</span><item.icon size={18} className="text-primary" />
              </div>
              <p className="mt-2 break-words font-mono text-2xl font-bold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="offers" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="offers">Tarjousrekisteri</TabsTrigger>
          <TabsTrigger value="settings">Talousasetukset</TabsTrigger>
        </TabsList>

        <TabsContent value="offers" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            <Card className="h-fit overflow-hidden">
              <CardContent className="p-0">
                <div className="space-y-3 border-b p-4">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae tarjousta…" className="pl-9" />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Kaikki">Kaikki tilat</SelectItem>
                      {OFFER_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="max-h-[70vh] overflow-y-auto">
                  {filteredOffers.map((offer) => {
                    const latest = latestVersionByOffer.get(offer.id);
                    const customer = offer.customerId ? customerById.get(offer.customerId) : undefined;
                    return (
                      <button
                        key={offer.id}
                        type="button"
                        onClick={() => setSelectedOfferId(offer.id)}
                        className={`w-full border-b px-4 py-4 text-left transition-colors ${selectedOfferId === offer.id ? 'bg-orange-50' : 'hover:bg-slate-50'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{offer.name}</p>
                            <p className="mt-1 truncate text-xs text-text-secondary">
                              {offer.offerNumber || 'Ei tarjousnumeroa'} · {customer?.name || 'Ei asiakasta'}
                            </p>
                          </div>
                          {statusBadge(offer.status)}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-text-secondary">
                          <span>v{latest?.versionNumber ?? 0}</span>
                          <span className="font-mono font-semibold text-text-primary">{money(latest?.totalCents ?? 0)}</span>
                        </div>
                      </button>
                    );
                  })}
                  {!center.loading && filteredOffers.length === 0 && (
                    <div className="p-10 text-center">
                      <FileSignature size={40} className="mx-auto mb-3 text-text-muted" />
                      <p className="font-semibold">Ei tarjouksia</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {!selectedOffer ? (
              <Card><CardContent className="p-12 text-center"><FileSignature size={48} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Valitse tarjous tai luo uusi</p></CardContent></Card>
            ) : (
              <div className="min-w-0 space-y-4">
                <Card>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold">{selectedOffer.name}</h2>
                          {statusBadge(selectedOffer.status)}
                        </div>
                        <p className="mt-1 text-sm text-text-secondary">
                          {selectedOffer.offerNumber || 'Ei tarjousnumeroa'} · {selectedOfferCustomer?.name || 'Ei asiakasta'} · voimassa {dateLabel(selectedOffer.validUntil)} asti
                        </p>
                        {selectedOffer.projectId && (
                          <p className="mt-1 text-xs text-text-muted">
                            Liitetty projektiin: {projectById.get(selectedOffer.projectId)?.name ?? selectedOffer.projectId}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => openOfferEdit(selectedOffer)}><Edit3 size={14} className="mr-1" /> Muokkaa</Button>
                        <Button variant="outline" size="sm" onClick={printOffer} disabled={!selectedVersion}><Printer size={14} className="mr-1" /> Tulosta / PDF</Button>
                        {!['Hyväksytty', 'Arkistoitu'].includes(selectedOffer.status) && (
                          <Button variant="outline" size="sm" onClick={() => void addVersion()} disabled={saving}><Copy size={14} className="mr-1" /> Uusi versio</Button>
                        )}
                        {selectedOffer.status === 'Luonnos' && (
                          <Button size="sm" onClick={() => void changeStatus('Lähetetty')} disabled={saving || !selectedVersion || linesForVersion.length === 0}><Send size={14} className="mr-1" /> Merkitse lähetetyksi</Button>
                        )}
                        {selectedOffer.status === 'Lähetetty' && (
                          <>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void changeStatus('Hyväksytty')} disabled={saving}><CheckCircle2 size={14} className="mr-1" /> Hyväksy</Button>
                            <Button variant="destructive" size="sm" onClick={() => void changeStatus('Hylätty')} disabled={saving}><XCircle size={14} className="mr-1" /> Hylkää</Button>
                          </>
                        )}
                        {selectedOffer.status === 'Hyväksytty' && !selectedOffer.convertedProjectId && (
                          <Button size="sm" onClick={() => void convertToProject()} disabled={saving}><FolderKanban size={14} className="mr-1" /> Luo projekti</Button>
                        )}
                        {selectedOffer.convertedProjectId && (
                          <Button variant="outline" size="sm" onClick={() => navigate(`/projektit/${selectedOffer.convertedProjectId}`)}><ExternalLink size={14} className="mr-1" /> Avaa projekti</Button>
                        )}
                        {selectedOffer.status !== 'Arkistoitu' && (
                          <Button variant="ghost" size="sm" onClick={() => void changeStatus('Arkistoitu')} disabled={saving}><Archive size={14} /></Button>
                        )}
                        {selectedOffer.status === 'Luonnos' && (
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteOfferTarget(selectedOffer)}><Trash2 size={14} /></Button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-text-secondary">Versio</p><p className="mt-1 font-mono text-xl font-bold">v{selectedVersion?.versionNumber ?? '—'}</p></div>
                      <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-text-secondary">Veroton</p><p className="mt-1 font-mono text-xl font-bold">{money(selectedVersion?.subtotalCents ?? 0)}</p></div>
                      <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-text-secondary">Yhteensä</p><p className="mt-1 font-mono text-xl font-bold">{money(selectedVersion?.totalCents ?? 0)}</p></div>
                      <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-text-secondary">Liitteitä</p><p className="mt-1 font-mono text-xl font-bold">{attachmentsForOffer.length}</p></div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-5 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-bold">Tarjousversio</h3>
                        <p className="text-xs text-text-secondary">Jokainen uusi versio kopioi edellisen version rivit ja ehdot.</p>
                      </div>
                      <Select value={selectedVersion?.id ?? ''} onValueChange={setSelectedVersionId}>
                        <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Valitse versio" /></SelectTrigger>
                        <SelectContent>{versionsForOffer.map((version) => <SelectItem key={version.id} value={version.id}>v{version.versionNumber} · {version.status} · {money(version.totalCents)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    {selectedVersion && (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2 sm:col-span-2 lg:col-span-4"><Label>Version otsikko</Label><Input value={versionForm.title} onChange={(event) => setVersionForm((previous) => ({ ...previous, title: event.target.value }))} disabled={!canEditVersion} /></div>
                        <div className="space-y-2"><Label>ALV %</Label><Input inputMode="decimal" value={versionForm.vatRate} onChange={(event) => setVersionForm((previous) => ({ ...previous, vatRate: event.target.value }))} disabled={!canEditVersion} /></div>
                        <div className="space-y-2"><Label>Yleiskulu %</Label><Input inputMode="decimal" value={versionForm.overheadPercent} onChange={(event) => setVersionForm((previous) => ({ ...previous, overheadPercent: event.target.value }))} disabled={!canEditVersion} /></div>
                        <div className="space-y-2"><Label>Riskivaraus %</Label><Input inputMode="decimal" value={versionForm.riskPercent} onChange={(event) => setVersionForm((previous) => ({ ...previous, riskPercent: event.target.value }))} disabled={!canEditVersion} /></div>
                        <div className="space-y-2"><Label>Kate %</Label><Input inputMode="decimal" value={versionForm.marginPercent} onChange={(event) => setVersionForm((previous) => ({ ...previous, marginPercent: event.target.value }))} disabled={!canEditVersion} /></div>
                        <div className="space-y-2 sm:col-span-2"><Label>Lisätiedot</Label><Textarea value={versionForm.notes} onChange={(event) => setVersionForm((previous) => ({ ...previous, notes: event.target.value }))} disabled={!canEditVersion} /></div>
                        <div className="space-y-2 sm:col-span-2"><Label>Ehdot</Label><Textarea value={versionForm.terms} onChange={(event) => setVersionForm((previous) => ({ ...previous, terms: event.target.value }))} disabled={!canEditVersion} /></div>
                        {canEditVersion && <div className="flex justify-end sm:col-span-2 lg:col-span-4"><Button onClick={() => void saveVersion()} disabled={saving}>{saving ? <Loader2 size={15} className="mr-2 animate-spin" /> : null} Tallenna version asetukset</Button></div>}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between border-b px-5 py-4">
                      <div><h3 className="font-bold">Tarjousrivit</h3><p className="text-xs text-text-secondary">Hinnat ilman arvonlisäveroa</p></div>
                      <Button size="sm" onClick={openLineCreate} disabled={!canEditVersion}><Plus size={14} className="mr-1" /> Lisää rivi</Button>
                    </div>
                    <div className="hidden grid-cols-[110px_1fr_80px_70px_110px_120px_80px] gap-3 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted lg:grid">
                      <span>Ryhmä</span><span>Kuvaus</span><span className="text-right">Määrä</span><span>Yks.</span><span className="text-right">Yks.hinta</span><span className="text-right">Yhteensä</span><span />
                    </div>
                    {linesForVersion.map((line) => (
                      <div key={line.id} className="grid gap-2 border-b px-5 py-4 lg:grid-cols-[110px_1fr_80px_70px_110px_120px_80px] lg:items-center lg:gap-3">
                        <Badge variant="outline" className="w-fit">{line.category}</Badge>
                        <p className="text-sm font-medium">{line.description}</p>
                        <span className="font-mono text-sm lg:text-right">{line.quantity.toLocaleString('fi-FI')}</span>
                        <span className="text-sm">{line.unit}</span>
                        <span className="font-mono text-sm lg:text-right">{money(line.unitPriceCents)}</span>
                        <span className="font-mono text-sm font-bold lg:text-right">{money(Math.round(line.quantity * line.unitPriceCents))}</span>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" disabled={!canEditVersion} onClick={() => openLineEdit(line)}><Edit3 size={14} /></Button>
                          <Button variant="ghost" size="sm" className="text-red-600" disabled={!canEditVersion} onClick={() => setDeleteLineTarget(line)}><Trash2 size={14} /></Button>
                        </div>
                      </div>
                    ))}
                    {linesForVersion.length === 0 && <div className="p-10 text-center"><Euro size={38} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei tarjousrivejä</p><p className="mt-1 text-sm text-text-secondary">Lisää työ-, materiaali- tai muu kustannusrivi.</p></div>}
                  </CardContent>
                </Card>

                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between border-b px-5 py-4">
                      <div><h3 className="font-bold">Tarjouksen liitteet</h3><p className="text-xs text-text-secondary">Kuvat, PDF:t ja toimistoasiakirjat yksityisessä tallennustilassa</p></div>
                      <Button variant="outline" size="sm" onClick={() => setAttachmentDialog(true)}><Paperclip size={14} className="mr-1" /> Lisää liite</Button>
                    </div>
                    {attachmentsForOffer.map((attachment) => (
                      <div key={attachment.id} className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0"><p className="truncate font-medium">{attachment.fileName}</p><p className="text-xs text-text-secondary">{(attachment.sizeBytes / 1024).toLocaleString('fi-FI', { maximumFractionDigits: 0 })} kt · {attachment.description || 'Ei kuvausta'}</p></div>
                        <div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => void runAction(() => openRecordAttachment(attachment.storagePath))}><ExternalLink size={14} className="mr-1" /> Avaa</Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteAttachmentTarget(attachment)}><Trash2 size={14} /></Button></div>
                      </div>
                    ))}
                    {attachmentsForOffer.length === 0 && <div className="p-8 text-center"><Paperclip size={34} className="mx-auto mb-2 text-text-muted" /><p className="text-sm text-text-secondary">Ei liitteitä</p></div>}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardContent className="space-y-6 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary-light p-3"><Settings size={20} className="text-primary" /></div>
                <div><h2 className="font-bold">Organisaation kaupalliset oletukset</h2><p className="mt-1 text-sm text-text-secondary">Uudet tarjoukset käyttävät näitä arvoja. Vain organisaation ylläpitäjä voi muuttaa asetuksia.</p></div>
              </div>
              {settingsErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{settingsErrors.map((item) => <p key={item}>{item}</p>)}</div>}
              <fieldset disabled={actualRole !== 'admin' || saving} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 disabled:opacity-70">
                <div className="space-y-2"><Label>Oletus-ALV %</Label><Input inputMode="decimal" value={settingsForm.defaultVatRate} onChange={(event) => setSettingsForm((previous) => ({ ...previous, defaultVatRate: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Yleiskulu %</Label><Input inputMode="decimal" value={settingsForm.defaultOverheadPercent} onChange={(event) => setSettingsForm((previous) => ({ ...previous, defaultOverheadPercent: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Riskivaraus %</Label><Input inputMode="decimal" value={settingsForm.defaultRiskPercent} onChange={(event) => setSettingsForm((previous) => ({ ...previous, defaultRiskPercent: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Kate %</Label><Input inputMode="decimal" value={settingsForm.defaultMarginPercent} onChange={(event) => setSettingsForm((previous) => ({ ...previous, defaultMarginPercent: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Oletustuntikustannus €</Label><Input inputMode="decimal" value={settingsForm.defaultHourlyCost} onChange={(event) => setSettingsForm((previous) => ({ ...previous, defaultHourlyCost: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Maksuehto, päivää</Label><Input inputMode="numeric" value={settingsForm.defaultPaymentTermDays} onChange={(event) => setSettingsForm((previous) => ({ ...previous, defaultPaymentTermDays: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Tarjouksen voimassaolo, päivää</Label><Input inputMode="numeric" value={settingsForm.defaultOfferValidDays} onChange={(event) => setSettingsForm((previous) => ({ ...previous, defaultOfferValidDays: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Yrityksen puhelin</Label><Input value={settingsForm.companyPhone} onChange={(event) => setSettingsForm((previous) => ({ ...previous, companyPhone: event.target.value }))} /></div>
                <div className="space-y-2 sm:col-span-2"><Label>Yrityksen osoite</Label><Input value={settingsForm.companyAddress} onChange={(event) => setSettingsForm((previous) => ({ ...previous, companyAddress: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Postinumero</Label><Input value={settingsForm.companyPostalCode} onChange={(event) => setSettingsForm((previous) => ({ ...previous, companyPostalCode: event.target.value }))} /></div>
                <div className="space-y-2"><Label>Postitoimipaikka</Label><Input value={settingsForm.companyCity} onChange={(event) => setSettingsForm((previous) => ({ ...previous, companyCity: event.target.value }))} /></div>
                <div className="space-y-2 sm:col-span-2"><Label>Yrityksen sähköposti</Label><Input value={settingsForm.companyEmail} onChange={(event) => setSettingsForm((previous) => ({ ...previous, companyEmail: event.target.value }))} /></div>
                <div className="space-y-2 sm:col-span-2"><Label>Tarjousten oletusehdot</Label><Textarea rows={7} value={settingsForm.defaultOfferTerms} onChange={(event) => setSettingsForm((previous) => ({ ...previous, defaultOfferTerms: event.target.value }))} /></div>
              </fieldset>
              <div className="flex justify-end">{actualRole === 'admin' ? <Button onClick={() => void saveSettings()} disabled={saving}>{saving ? <Loader2 size={15} className="mr-2 animate-spin" /> : null} Tallenna asetukset</Button> : <p className="text-sm text-text-secondary">Asetukset ovat vain luku -tilassa.</p>}</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={offerDialog} onOpenChange={setOfferDialog}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingOffer ? 'Muokkaa tarjousta' : 'Uusi tarjous'}</DialogTitle></DialogHeader>
          {offerErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{offerErrors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Tarjouksen nimi *</Label><Input value={offerForm.name} onChange={(event) => setOfferForm((previous) => ({ ...previous, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Tarjousnumero</Label><Input value={offerForm.offerNumber} onChange={(event) => setOfferForm((previous) => ({ ...previous, offerNumber: event.target.value }))} placeholder="Esim. TAR-2026-001" /></div>
            <div className="space-y-2"><Label>Voimassa asti</Label><Input type="date" value={offerForm.validUntil} onChange={(event) => setOfferForm((previous) => ({ ...previous, validUntil: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Asiakas</Label><Select value={offerForm.customerId || 'none'} onValueChange={(value) => setOfferForm((previous) => ({ ...previous, customerId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei asiakasta</SelectItem>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>CRM-mahdollisuus</Label><Select value={offerForm.crmLeadId || 'none'} onValueChange={(value) => setOfferForm((previous) => ({ ...previous, crmLeadId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei CRM-linkkiä</SelectItem>{crmLeads.map((lead) => <SelectItem key={lead.id} value={lead.id}>{lead.name} · {lead.company}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label>Nykyinen projekti</Label><Select value={offerForm.projectId || 'none'} onValueChange={(value) => setOfferForm((previous) => ({ ...previous, projectId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label>Muistiinpanot</Label><Textarea value={offerForm.notes} onChange={(event) => setOfferForm((previous) => ({ ...previous, notes: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOfferDialog(false)}>Peruuta</Button><Button onClick={() => void saveOffer()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lineDialog} onOpenChange={setLineDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{editingLine ? 'Muokkaa tarjousriviä' : 'Uusi tarjousrivi'}</DialogTitle></DialogHeader>
          {lineErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{lineErrors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Ryhmä</Label><Select value={lineForm.category} onValueChange={(category) => setLineForm((previous) => ({ ...previous, category }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LINE_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Yksikkö</Label><Select value={lineForm.unit} onValueChange={(unit) => setLineForm((previous) => ({ ...previous, unit }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNITS.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label>Kuvaus *</Label><Textarea value={lineForm.description} onChange={(event) => setLineForm((previous) => ({ ...previous, description: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Määrä *</Label><Input inputMode="decimal" value={lineForm.quantity} onChange={(event) => setLineForm((previous) => ({ ...previous, quantity: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Yksikköhinta € *</Label><Input inputMode="decimal" value={lineForm.unitPrice} onChange={(event) => setLineForm((previous) => ({ ...previous, unitPrice: event.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setLineDialog(false)}>Peruuta</Button><Button onClick={() => void saveLine()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={attachmentDialog} onOpenChange={setAttachmentDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Lisää tarjouksen liite</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Tiedosto *</Label><Input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,text/plain,text/csv,.xlsx,.docx" onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)} /></div>
            <div className="space-y-2"><Label>Kuvaus</Label><Textarea value={attachmentDescription} onChange={(event) => setAttachmentDescription(event.target.value)} /></div>
            <p className="text-xs text-text-secondary">Enimmäiskoko 25 Mt. Tiedosto tallennetaan yksityiseen organisaatiokohtaiseen tallennustilaan.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAttachmentDialog(false)}>Peruuta</Button><Button onClick={() => void uploadAttachment()} disabled={saving || !attachmentFile}>{saving ? <Loader2 size={15} className="mr-2 animate-spin" /> : <FilePlus2 size={15} className="mr-2" />} Lähetä</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteOfferTarget || deleteLineTarget || deleteAttachmentTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteOfferTarget(null);
            setDeleteLineTarget(null);
            setDeleteAttachmentTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poistetaanko tieto?</AlertDialogTitle>
            <AlertDialogDescription>
              Poistoa ei voi perua. Tarjouksen poistaminen poistaa myös sen versiot, rivit ja metatietoliitteet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Peruuta</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void confirmDelete()} disabled={saving}>Poista</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
