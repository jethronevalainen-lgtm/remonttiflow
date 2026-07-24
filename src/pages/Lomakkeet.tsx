import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  useFinanceFormsData,
  type FormFieldDefinition,
  type FormFieldType,
  type FormSubmission,
  type FormSubmissionStatus,
  type FormTemplate,
} from '@/hooks/useFinanceFormsData';
import logger from '@/lib/logger';
import {
  createFormSubmission,
  createFormTemplate,
  deleteFormSubmission,
  deleteFormTemplate,
  updateFormSubmission,
  updateFormTemplate,
} from '@/lib/supabase/financeFormsEntities';

const FIELD_TYPES: Array<{ value: FormFieldType; label: string }> = [
  { value: 'text', label: 'Lyhyt teksti' },
  { value: 'textarea', label: 'Pitkä teksti' },
  { value: 'number', label: 'Numero' },
  { value: 'date', label: 'Päivämäärä' },
  { value: 'checkbox', label: 'Kyllä / ei' },
];

const CATEGORIES = ['TYA', 'Turvallisuus', 'Laatu', 'Koulutus', 'Ympäristö', 'Muu'];

interface TemplateDraft {
  name: string;
  category: string;
  description: string;
  active: boolean;
  fields: FormFieldDefinition[];
}

interface SubmissionDraft {
  templateId: string;
  projectId: string;
  title: string;
  data: Record<string, unknown>;
}

const EMPTY_TEMPLATE: TemplateDraft = {
  name: '',
  category: 'TYA',
  description: '',
  active: true,
  fields: [],
};

const EMPTY_SUBMISSION: SubmissionDraft = {
  templateId: '',
  projectId: '',
  title: '',
  data: {},
};

function makeField(): FormFieldDefinition {
  return { id: crypto.randomUUID(), label: '', type: 'text', required: false };
}

function statusBadge(status: FormSubmissionStatus) {
  const classes: Record<FormSubmissionStatus, string> = {
    Luonnos: 'bg-slate-100 text-slate-700',
    Lähetetty: 'bg-blue-50 text-blue-700',
    Hyväksytty: 'bg-emerald-50 text-emerald-700',
    Hylätty: 'bg-red-50 text-red-700',
  };
  return <Badge className={`border-0 ${classes[status]}`}>{status}</Badge>;
}

function hasRequiredValue(field: FormFieldDefinition, value: unknown) {
  if (field.type === 'checkbox') return value === true;
  if (field.type === 'number') return value !== '' && Number.isFinite(Number(value));
  return typeof value === 'string' && value.trim().length > 0;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const cell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = rows.map((row) => row.map(cell).join(';')).join('\n');
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Lomakkeet() {
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { projects } = useAppDataContext();
  const { templates, submissions, loading, error, refresh } = useFinanceFormsData();
  const canManage = currentRole === 'admin' || currentRole === 'supervisor';

  const [search, setSearch] = useState('');
  const [templateDialog, setTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(EMPTY_TEMPLATE);
  const [fillDialog, setFillDialog] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<FormSubmission | null>(null);
  const [submissionDraft, setSubmissionDraft] = useState<SubmissionDraft>(EMPTY_SUBMISSION);
  const [viewSubmission, setViewSubmission] = useState<FormSubmission | null>(null);
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<FormTemplate | null>(null);
  const [deleteSubmissionTarget, setDeleteSubmissionTarget] = useState<FormSubmission | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    if (!query) return templates;
    return templates.filter((template) =>
      `${template.name} ${template.category} ${template.description}`
        .toLocaleLowerCase('fi')
        .includes(query),
    );
  }, [search, templates]);

  const selectedTemplate = templates.find(
    (template) => template.id === submissionDraft.templateId,
  ) ?? null;
  const templateFor = (submission: FormSubmission) =>
    templates.find((template) => template.id === submission.templateId);
  const projectFor = (submission: FormSubmission) =>
    projects.find((project) => project.id === submission.projectId);

  const openTemplateCreate = () => {
    setEditingTemplate(null);
    setTemplateDraft({ ...EMPTY_TEMPLATE, fields: [makeField()] });
    setFormErrors([]);
    setOperationError(null);
    setTemplateDialog(true);
  };

  const openTemplateEdit = (template: FormTemplate) => {
    setEditingTemplate(template);
    setTemplateDraft({
      name: template.name,
      category: template.category,
      description: template.description,
      active: template.active,
      fields: template.fields.map((field) => ({ ...field })),
    });
    setFormErrors([]);
    setOperationError(null);
    setTemplateDialog(true);
  };

  const patchField = (id: string, patch: Partial<FormFieldDefinition>) => {
    setTemplateDraft((previous) => ({
      ...previous,
      fields: previous.fields.map((field) =>
        field.id === id ? { ...field, ...patch } : field,
      ),
    }));
  };

  const saveTemplate = async () => {
    const fields = templateDraft.fields.map((field) => ({
      ...field,
      label: field.label.trim(),
    }));
    const nextErrors: string[] = [];
    if (!templateDraft.name.trim()) nextErrors.push('Nimi on pakollinen.');
    if (fields.length === 0) nextErrors.push('Lisää vähintään yksi kenttä.');
    if (fields.some((field) => !field.label)) {
      nextErrors.push('Jokaisella kentällä pitää olla nimi.');
    }
    setFormErrors(nextErrors);
    if (nextErrors.length || !currentOrg || !canManage) return;

    const payload: Omit<FormTemplate, 'id'> = {
      name: templateDraft.name.trim(),
      category: templateDraft.category,
      description: templateDraft.description.trim(),
      active: templateDraft.active,
      fields,
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editingTemplate) {
        await updateFormTemplate(currentOrg.id, editingTemplate.id, payload);
      } else {
        await createFormTemplate(currentOrg.id, user?.id, payload);
      }
      await refresh();
      setTemplateDialog(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Lomakepohjan tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const openFill = (template: FormTemplate) => {
    setEditingSubmission(null);
    setSubmissionDraft({
      templateId: template.id,
      projectId: '',
      title: template.name,
      data: Object.fromEntries(
        template.fields.map((field) => [field.id, field.type === 'checkbox' ? false : '']),
      ),
    });
    setFormErrors([]);
    setOperationError(null);
    setFillDialog(true);
  };

  const openDraft = (submission: FormSubmission) => {
    setEditingSubmission(submission);
    setSubmissionDraft({
      templateId: submission.templateId,
      projectId: submission.projectId ?? '',
      title: submission.title,
      data: { ...submission.data },
    });
    setFormErrors([]);
    setOperationError(null);
    setFillDialog(true);
  };

  const patchSubmissionValue = (field: FormFieldDefinition, value: unknown) => {
    const normalized = field.type === 'number' && value !== '' ? Number(value) : value;
    setSubmissionDraft((previous) => ({
      ...previous,
      data: { ...previous.data, [field.id]: normalized },
    }));
  };

  const saveSubmission = async (status: 'Luonnos' | 'Lähetetty') => {
    const nextErrors: string[] = [];
    if (!selectedTemplate) nextErrors.push('Lomakepohja puuttuu.');
    if (!submissionDraft.title.trim()) nextErrors.push('Otsikko on pakollinen.');
    if (status === 'Lähetetty' && selectedTemplate) {
      selectedTemplate.fields.forEach((field) => {
        if (field.required && !hasRequiredValue(field, submissionDraft.data[field.id])) {
          nextErrors.push(`Täytä pakollinen kenttä: ${field.label}.`);
        }
      });
    }
    setFormErrors(nextErrors);
    if (nextErrors.length || !currentOrg || !user || !selectedTemplate) return;

    const payload: Omit<FormSubmission, 'id'> = {
      templateId: selectedTemplate.id,
      projectId: submissionDraft.projectId || undefined,
      title: submissionDraft.title.trim(),
      status,
      data: submissionDraft.data,
      submittedAt: status === 'Lähetetty' ? new Date().toISOString() : undefined,
      submittedBy: user.id,
    };

    setSaving(true);
    setOperationError(null);
    try {
      if (editingSubmission) {
        await updateFormSubmission(currentOrg.id, editingSubmission.id, payload);
      } else {
        await createFormSubmission(currentOrg.id, user.id, payload);
      }
      await refresh();
      setFillDialog(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tallennus epäonnistui.';
      setOperationError(message);
      logger.error('Lomakelähetyksen tallennus epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const reviewSubmission = async (
    submission: FormSubmission,
    status: 'Hyväksytty' | 'Hylätty',
  ) => {
    if (!currentOrg || !canManage) return;
    setSaving(true);
    try {
      await updateFormSubmission(currentOrg.id, submission.id, { status });
      await refresh();
      setViewSubmission(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Käsittely epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const removeTemplate = async () => {
    if (!currentOrg || !deleteTemplateTarget || !canManage) return;
    setSaving(true);
    try {
      await deleteFormTemplate(currentOrg.id, deleteTemplateTarget.id);
      await refresh();
      setDeleteTemplateTarget(null);
    } catch (caught) {
      setOperationError(
        caught instanceof Error
          ? caught.message
          : 'Pohjaa ei voi poistaa, jos sillä on lähetyksiä.',
      );
      setDeleteTemplateTarget(null);
    } finally {
      setSaving(false);
    }
  };

  const removeSubmission = async () => {
    if (!currentOrg || !deleteSubmissionTarget) return;
    setSaving(true);
    try {
      await deleteFormSubmission(currentOrg.id, deleteSubmissionTarget.id);
      await refresh();
      setDeleteSubmissionTarget(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    downloadCsv('lomakelahetykset.csv', [
      ['Otsikko', 'Pohja', 'Projekti', 'Tila', 'Lähetetty'],
      ...submissions.map((submission) => [
        submission.title,
        templateFor(submission)?.name ?? '',
        projectFor(submission)?.name ?? '',
        submission.status,
        submission.submittedAt
          ? new Date(submission.submittedAt).toLocaleString('fi-FI')
          : '',
      ]),
    ]);
  };

  const canEditDraft = (submission: FormSubmission) =>
    submission.status === 'Luonnos' &&
    (canManage || submission.submittedBy === user?.id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Lomakkeet</h1>
          <p className="mt-1 text-body-sm text-text-secondary">
            Lomakepohjat, työmaalta täyttäminen ja hyväksyntäkierto
          </p>
        </div>
        {canManage && (
          <Button onClick={openTemplateCreate} className="gap-2">
            <Plus size={16} /> Uusi lomakepohja
          </Button>
        )}
      </div>

      {(error || operationError) && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} /> {operationError ?? error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Aktiivisia pohjia</p><p className="mt-1 font-mono text-2xl font-bold">{templates.filter((item) => item.active).length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Lähetyksiä</p><p className="mt-1 font-mono text-2xl font-bold">{submissions.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Odottaa käsittelyä</p><p className="mt-1 font-mono text-2xl font-bold text-blue-700">{submissions.filter((item) => item.status === 'Lähetetty').length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Hyväksytty</p><p className="mt-1 font-mono text-2xl font-bold text-emerald-700">{submissions.filter((item) => item.status === 'Hyväksytty').length}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="templates">Pohjat</TabsTrigger>
            <TabsTrigger value="submissions">Täytetyt ({submissions.length})</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <div className="relative sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Hae lomakkeita..."
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={exportCsv} disabled={!submissions.length}>
              <Download size={15} className="mr-1" /> CSV
            </Button>
          </div>
        </div>

        <TabsContent value="templates" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className={!template.active ? 'opacity-60' : ''}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{template.name}</h2>
                      <p className="text-xs text-text-secondary">
                        {template.category} · {template.fields.length} kenttää
                      </p>
                    </div>
                    <Badge variant="outline">
                      {template.active ? 'Aktiivinen' : 'Pois käytöstä'}
                    </Badge>
                  </div>
                  <p className="mt-4 min-h-10 text-sm text-text-secondary">
                    {template.description || 'Ei kuvausta.'}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <Button onClick={() => openFill(template)} disabled={!template.active}>
                      <FileText size={15} className="mr-1" /> Täytä
                    </Button>
                    {canManage && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openTemplateEdit(template)}>
                          <Edit3 size={15} />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDeleteTemplateTarget(template)}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {!loading && filteredTemplates.length === 0 && (
            <Card><CardContent className="p-12 text-center"><FileText size={42} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei lomakepohjia</p></CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="submissions" className="mt-0">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {submissions.map((submission) => (
                <div key={submission.id} className="grid gap-3 border-b border-slate-100 px-5 py-4 lg:grid-cols-[1.2fr_1fr_1fr_130px_160px] lg:items-center">
                  <button type="button" onClick={() => setViewSubmission(submission)} className="text-left font-medium hover:text-primary">
                    {submission.title}
                  </button>
                  <span className="text-sm text-text-secondary">{templateFor(submission)?.name ?? 'Pohja puuttuu'}</span>
                  <span className="text-sm text-text-secondary">{projectFor(submission)?.name ?? 'Ei projektia'}</span>
                  <span>{statusBadge(submission.status)}</span>
                  <div className="flex gap-1 lg:justify-end">
                    <Button variant="outline" size="sm" onClick={() => setViewSubmission(submission)}>Avaa</Button>
                    {canEditDraft(submission) && (
                      <Button variant="ghost" size="sm" onClick={() => openDraft(submission)}><Edit3 size={14} /></Button>
                    )}
                    {(canManage || canEditDraft(submission)) && (
                      <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDeleteSubmissionTarget(submission)}><Trash2 size={14} /></Button>
                    )}
                  </div>
                </div>
              ))}
              {!loading && submissions.length === 0 && (
                <div className="p-12 text-center"><FileText size={42} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei täytettyjä lomakkeita</p></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingTemplate ? 'Muokkaa lomakepohjaa' : 'Uusi lomakepohja'}</DialogTitle></DialogHeader>
          {formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="template-name">Nimi *</Label><Input id="template-name" value={templateDraft.name} onChange={(event) => setTemplateDraft((previous) => ({ ...previous, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Kategoria</Label><Select value={templateDraft.category} onValueChange={(category) => setTemplateDraft((previous) => ({ ...previous, category }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
            <label className="flex items-center gap-2 pt-7 text-sm"><Checkbox checked={templateDraft.active} onCheckedChange={(checked) => setTemplateDraft((previous) => ({ ...previous, active: checked === true }))} /> Pohja käytössä</label>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="template-description">Kuvaus</Label><Textarea id="template-description" value={templateDraft.description} onChange={(event) => setTemplateDraft((previous) => ({ ...previous, description: event.target.value }))} /></div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><h3 className="font-semibold">Kentät</h3><Button variant="outline" size="sm" onClick={() => setTemplateDraft((previous) => ({ ...previous, fields: [...previous.fields, makeField()] }))}><Plus size={14} className="mr-1" /> Lisää kenttä</Button></div>
            {templateDraft.fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_170px_auto_auto] sm:items-end">
                <div className="space-y-2"><Label htmlFor={`field-${field.id}`}>Kenttä {index + 1}</Label><Input id={`field-${field.id}`} value={field.label} onChange={(event) => patchField(field.id, { label: event.target.value })} /></div>
                <div className="space-y-2"><Label>Tyyppi</Label><Select value={field.type} onValueChange={(type: FormFieldType) => patchField(field.id, { type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FIELD_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
                <label className="flex h-10 items-center gap-2 text-sm"><Checkbox checked={field.required} onCheckedChange={(checked) => patchField(field.id, { required: checked === true })} /> Pakollinen</label>
                <Button variant="ghost" className="text-danger" onClick={() => setTemplateDraft((previous) => ({ ...previous, fields: previous.fields.filter((item) => item.id !== field.id) }))}><Trash2 size={15} /></Button>
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTemplateDialog(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void saveTemplate()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna pohja'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fillDialog} onOpenChange={setFillDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingSubmission ? 'Muokkaa luonnosta' : selectedTemplate?.name ?? 'Täytä lomake'}</DialogTitle></DialogHeader>
          {formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="submission-title">Otsikko *</Label><Input id="submission-title" value={submissionDraft.title} onChange={(event) => setSubmissionDraft((previous) => ({ ...previous, title: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Projekti</Label><Select value={submissionDraft.projectId || 'none'} onValueChange={(value) => setSubmissionDraft((previous) => ({ ...previous, projectId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ei projektia</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-4">
            {selectedTemplate?.fields.map((field) => {
              const value = submissionDraft.data[field.id];
              if (field.type === 'textarea') return <div key={field.id} className="space-y-2"><Label>{field.label}{field.required ? ' *' : ''}</Label><Textarea value={typeof value === 'string' ? value : ''} onChange={(event) => patchSubmissionValue(field, event.target.value)} /></div>;
              if (field.type === 'checkbox') return <label key={field.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"><Checkbox checked={value === true} onCheckedChange={(checked) => patchSubmissionValue(field, checked === true)} /><span className="text-sm">{field.label}{field.required ? ' *' : ''}</span></label>;
              return <div key={field.id} className="space-y-2"><Label>{field.label}{field.required ? ' *' : ''}</Label><Input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} value={typeof value === 'number' || typeof value === 'string' ? value : ''} onChange={(event) => patchSubmissionValue(field, event.target.value)} /></div>;
            })}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFillDialog(false)} disabled={saving}>Peruuta</Button><Button variant="secondary" onClick={() => void saveSubmission('Luonnos')} disabled={saving}>Tallenna luonnos</Button><Button onClick={() => void saveSubmission('Lähetetty')} disabled={saving}><Send size={15} className="mr-1" /> Lähetä</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewSubmission)} onOpenChange={(open) => !open && setViewSubmission(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{viewSubmission?.title}</DialogTitle></DialogHeader>
          {viewSubmission && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">{statusBadge(viewSubmission.status)}<Badge variant="outline">{templateFor(viewSubmission)?.name ?? 'Pohja puuttuu'}</Badge><Badge variant="outline">{projectFor(viewSubmission)?.name ?? 'Ei projektia'}</Badge></div>
              {templateFor(viewSubmission)?.fields.map((field) => {
                const value = viewSubmission.data[field.id];
                return <div key={field.id} className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{field.label}</p><p className="mt-1 whitespace-pre-wrap text-sm">{field.type === 'checkbox' ? (value === true ? 'Kyllä' : 'Ei') : String(value ?? '—')}</p></div>;
              })}
              {canManage && viewSubmission.status === 'Lähetetty' && (
                <div className="flex justify-end gap-2 border-t pt-4"><Button variant="outline" className="text-red-700" onClick={() => void reviewSubmission(viewSubmission, 'Hylätty')} disabled={saving}><XCircle size={15} className="mr-1" /> Hylkää</Button><Button onClick={() => void reviewSubmission(viewSubmission, 'Hyväksytty')} disabled={saving}><CheckCircle2 size={15} className="mr-1" /> Hyväksy</Button></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTemplateTarget)} onOpenChange={(open) => !open && setDeleteTemplateTarget(null)}><DialogContent><DialogHeader><DialogTitle>Poista lomakepohja</DialogTitle></DialogHeader><p className="text-sm text-text-secondary">Poistetaanko <strong>{deleteTemplateTarget?.name}</strong>?</p><DialogFooter><Button variant="outline" onClick={() => setDeleteTemplateTarget(null)}>Peruuta</Button><Button variant="destructive" onClick={() => void removeTemplate()} disabled={saving}>Poista</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(deleteSubmissionTarget)} onOpenChange={(open) => !open && setDeleteSubmissionTarget(null)}><DialogContent><DialogHeader><DialogTitle>Poista lomake</DialogTitle></DialogHeader><p className="text-sm text-text-secondary">Poistetaanko <strong>{deleteSubmissionTarget?.title}</strong>?</p><DialogFooter><Button variant="outline" onClick={() => setDeleteSubmissionTarget(null)}>Peruuta</Button><Button variant="destructive" onClick={() => void removeSubmission()} disabled={saving}>Poista</Button></DialogFooter></DialogContent></Dialog>

      {!canManage && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"><ShieldCheck size={16} /> Näet vain omat lähetyksesi. Työnjohto käsittelee lähetetyt lomakkeet.</div>
      )}
    </motion.div>
  );
}
