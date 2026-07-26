import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ExternalLink,
  FileArchive,
  FileText,
  FolderOpen,
  HardDrive,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Upload,
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
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOfferCenter } from '@/hooks/useOfferCenter';
import {
  deleteRecordAttachment,
  openRecordAttachment,
  uploadRecordAttachment,
  type AttachmentEntityType,
  type RecordAttachment,
} from '@/lib/supabase/offers';

interface EntityOption {
  id: string;
  label: string;
  projectId?: string;
}

const ENTITY_TYPES: { value: AttachmentEntityType; label: string }[] = [
  { value: 'project', label: 'Projekti' },
  { value: 'work_order', label: 'Työmääräys' },
  { value: 'diary', label: 'Työmaapäiväkirja' },
  { value: 'safety', label: 'Turvallisuusasia' },
  { value: 'customer', label: 'Asiakas' },
  { value: 'equipment', label: 'Kalusto' },
  { value: 'offer', label: 'Tarjous' },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} t`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} kt`;
  }
  return `${(bytes / 1024 / 1024).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} Mt`;
}

function dateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function typeLabel(type: AttachmentEntityType): string {
  return ENTITY_TYPES.find((item) => item.value === type)?.label ?? type;
}

export default function Dokumentit() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const {
    projects,
    workOrders,
    diaryEntries,
    safetyItems,
    customers,
    equipment,
  } = useAppDataContext();
  const center = useOfferCenter();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('Kaikki');
  const [uploadDialog, setUploadDialog] = useState(false);
  const [entityType, setEntityType] = useState<AttachmentEntityType>('project');
  const [entityId, setEntityId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecordAttachment | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const optionsByType = useMemo<Record<AttachmentEntityType, EntityOption[]>>(() => ({
    project: projects.map((item) => ({ id: item.id, label: item.name, projectId: item.id })),
    work_order: workOrders.map((item) => ({
      id: item.id,
      label: `${item.title} · ${item.project}`,
      projectId: item.projectId,
    })),
    diary: diaryEntries.map((item) => ({
      id: item.id,
      label: `${item.date} · ${item.project}`,
      projectId: item.projectId,
    })),
    safety: safetyItems.map((item) => ({
      id: item.id,
      label: item.title,
      projectId: item.projectId,
    })),
    form_submission: [],
    customer: customers.map((item) => ({ id: item.id, label: item.name })),
    equipment: equipment.map((item) => ({
      id: item.id,
      label: item.name,
      projectId: item.currentProjectId,
    })),
    crm_activity: [],
    offer: center.offers.map((item) => ({
      id: item.id,
      label: `${item.offerNumber || 'Ei numeroa'} · ${item.name}`,
      projectId: item.projectId,
    })),
    change_order: [],
  }), [
    center.offers,
    customers,
    diaryEntries,
    equipment,
    projects,
    safetyItems,
    workOrders,
  ]);

  const entityLabels = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(optionsByType).forEach(([type, options]) => {
      options.forEach((option) => map.set(`${type}:${option.id}`, option.label));
    });
    return map;
  }, [optionsByType]);

  const projectLabels = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  const filteredAttachments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    return center.attachments.filter((attachment) => {
      const entityLabel = entityLabels.get(`${attachment.entityType}:${attachment.entityId}`) ?? '';
      const matchesSearch = !query || [
        attachment.fileName,
        attachment.description ?? '',
        entityLabel,
        projectLabels.get(attachment.projectId ?? '') ?? '',
      ].some((value) => value.toLocaleLowerCase('fi').includes(query));
      return matchesSearch && (typeFilter === 'Kaikki' || attachment.entityType === typeFilter);
    });
  }, [center.attachments, entityLabels, projectLabels, search, typeFilter]);

  const totalBytes = center.attachments.reduce((sum, attachment) => sum + attachment.sizeBytes, 0);
  const linkedProjects = new Set(center.attachments.map((item) => item.projectId).filter(Boolean)).size;
  const typeCount = new Set(center.attachments.map((item) => item.entityType)).size;
  const visibleError = operationError ?? center.error;

  const openUpload = () => {
    const initialType = projects.length > 0 ? 'project' : customers.length > 0 ? 'customer' : 'offer';
    const initialOptions = optionsByType[initialType];
    const first = initialOptions[0];
    setEntityType(initialType);
    setEntityId(first?.id ?? '');
    setProjectId(first?.projectId ?? '');
    setDescription('');
    setFile(null);
    setOperationError(null);
    setUploadDialog(true);
  };

  const changeEntityType = (nextType: AttachmentEntityType) => {
    const first = optionsByType[nextType][0];
    setEntityType(nextType);
    setEntityId(first?.id ?? '');
    setProjectId(first?.projectId ?? '');
  };

  const changeEntity = (nextEntityId: string) => {
    const option = optionsByType[entityType].find((item) => item.id === nextEntityId);
    setEntityId(nextEntityId);
    setProjectId(option?.projectId ?? '');
  };

  const upload = async () => {
    if (!currentOrg || !file || !entityId) {
      setOperationError('Valitse kohde ja lähetettävä tiedosto.');
      return;
    }
    setSaving(true);
    setOperationError(null);
    try {
      await uploadRecordAttachment({
        organizationId: currentOrg.id,
        projectId: projectId || undefined,
        entityType,
        entityId,
        userId: user?.id,
        file,
        description,
      });
      await center.refresh();
      setUploadDialog(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tiedoston lähetys epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openAttachment = async (attachment: RecordAttachment) => {
    setOperationError(null);
    try {
      await openRecordAttachment(attachment.storagePath);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tiedoston avaaminen epäonnistui.');
    }
  };

  const removeAttachment = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setOperationError(null);
    try {
      await deleteRecordAttachment(deleteTarget);
      await center.refresh();
      setDeleteTarget(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tiedoston poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Dokumenttikeskus</h1>
          <p className="mt-1 text-body-sm text-text-secondary">
            Organisaation projekti-, asiakas-, kalusto-, turvallisuus- ja tarjousliitteet yhdessä paikassa
          </p>
        </div>
        <Button onClick={openUpload} className="gap-2"><Upload size={16} /> Lisää tiedosto</Button>
      </div>

      {visibleError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} />{visibleError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Tiedostoja', value: center.attachments.length, icon: FileArchive },
          { label: 'Tallennustila', value: formatSize(totalBytes), icon: HardDrive },
          { label: 'Kohdetyyppejä', value: typeCount, icon: Paperclip },
          { label: 'Projekteja', value: linkedProjects, icon: FolderOpen },
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-lg">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae tiedostolla, kohteella tai projektilla…" className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Kaikki">Kaikki kohdetyypit</SelectItem>
            {ENTITY_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="hidden grid-cols-[1.4fr_140px_1.2fr_1fr_100px_130px] gap-3 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted lg:grid">
            <span>Tiedosto</span><span>Tyyppi</span><span>Kohde</span><span>Projekti</span><span>Koko</span><span />
          </div>
          {filteredAttachments.map((attachment) => (
            <div key={attachment.id} className="grid gap-3 border-b px-5 py-4 lg:grid-cols-[1.4fr_140px_1.2fr_1fr_100px_130px] lg:items-center">
              <div className="min-w-0">
                <p className="truncate font-semibold">{attachment.fileName}</p>
                <p className="mt-1 truncate text-xs text-text-secondary">
                  {attachment.description || attachment.mimeType} · {dateTime(attachment.createdAt)}
                </p>
              </div>
              <Badge variant="outline" className="w-fit">{typeLabel(attachment.entityType)}</Badge>
              <span className="truncate text-sm">
                {entityLabels.get(`${attachment.entityType}:${attachment.entityId}`) ?? 'Poistettu tai tuntematon kohde'}
              </span>
              <span className="truncate text-sm text-text-secondary">
                {projectLabels.get(attachment.projectId ?? '') ?? 'Ei projektia'}
              </span>
              <span className="font-mono text-sm">{formatSize(attachment.sizeBytes)}</span>
              <div className="flex justify-end gap-1">
                <Button variant="outline" size="sm" onClick={() => void openAttachment(attachment)}><ExternalLink size={14} className="mr-1" /> Avaa</Button>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget(attachment)}><Trash2 size={14} /></Button>
              </div>
            </div>
          ))}
          {!center.loading && filteredAttachments.length === 0 && (
            <div className="p-14 text-center">
              <FileText size={48} className="mx-auto mb-3 text-text-muted" />
              <p className="font-semibold">Ei dokumentteja</p>
              <p className="mt-1 text-sm text-text-secondary">Lisää ensimmäinen tiedosto valittuun kohteeseen.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Lisää dokumentti</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Kohdetyyppi *</Label><Select value={entityType} onValueChange={(value: AttachmentEntityType) => changeEntityType(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ENTITY_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Kohde *</Label><Select value={entityId} onValueChange={changeEntity}><SelectTrigger><SelectValue placeholder="Valitse kohde" /></SelectTrigger><SelectContent>{optionsByType[entityType].map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label>Projektilinkki</Label><Select value={projectId || 'none'} onValueChange={(value) => setProjectId(value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label>Tiedosto *</Label><Input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,text/plain,text/csv,.xlsx,.docx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Kuvaus</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-text-secondary">
            Tiedosto tallennetaan yksityiseen organisaatiokohtaiseen tallennustilaan. Enimmäiskoko on 25 Mt.
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setUploadDialog(false)}>Peruuta</Button><Button onClick={() => void upload()} disabled={saving || !file || !entityId}>{saving ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Plus size={15} className="mr-2" />} Tallenna</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poistetaanko dokumentti?</AlertDialogTitle>
            <AlertDialogDescription>Tiedosto ja sen metatiedot poistetaan pysyvästi. Toimintoa ei voi perua.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Peruuta</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void removeAttachment()} disabled={saving}>Poista</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
