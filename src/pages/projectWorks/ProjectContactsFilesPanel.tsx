import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mail,
  Paperclip,
  Phone,
  Plus,
  Trash2,
  Upload,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ROLE_LABELS } from '@/contexts/AuthContext';
import {
  formatProjectFileSize,
  inferProjectDocumentType,
  PROJECT_DOCUMENT_TYPES,
  projectDocumentKind,
} from '@/lib/projectDocumentMeta';
import {
  createCustomerContact,
  listCustomerContactsForCustomer,
  type CustomerContact,
} from '@/lib/supabase/customerRelations';
import {
  archiveProjectDocument,
  createProjectDocumentUrl,
  listProjectDocuments,
  type ProjectDocument,
  uploadProjectDocument,
} from '@/lib/supabase/projectWorkspace';
import {
  replaceProjectTeamMembers,
  type OrganizationPerson,
  type ProjectTeamMembership,
} from '@/lib/supabase/workManagement';
import {
  buildProjectTeamCandidates,
  displayNamesForProjectTeam,
  partitionTeamSelection,
  selectedKeysForProject,
} from '@/lib/projectTeamRoster';
import { useAppDataContext } from '@/contexts/AppDataContext';
import type { Project } from '@/types';
import { cn } from '@/lib/utils';

interface ProjectContactsFilesPanelProps {
  organizationId: string;
  project: Project;
  people: OrganizationPerson[];
  projectMemberships: Array<{ projectId: string; userId: string }>;
  projectTeamMemberships: ProjectTeamMembership[];
  currentUserId?: string;
  canManage: boolean;
  onError: (message: string | null) => void;
  onSuccess: (message: string | null) => void;
  onNavigateWorkspaceDocuments: () => void;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function DocumentIcon({ fileName, mimeType }: { fileName: string; mimeType: string }) {
  const kind = projectDocumentKind(fileName, mimeType);
  if (kind === 'image') return <ImageIcon size={18} />;
  if (kind === 'spreadsheet') return <FileSpreadsheet size={18} />;
  if (kind === 'pdf') return <FileText size={18} />;
  return <Paperclip size={18} />;
}

export default function ProjectContactsFilesPanel({
  organizationId,
  project,
  people,
  projectMemberships,
  projectTeamMemberships,
  currentUserId,
  canManage,
  onError,
  onSuccess,
  onNavigateWorkspaceDocuments,
}: ProjectContactsFilesPanelProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { employees } = useAppDataContext();

  const documentsQuery = useQuery({
    queryKey: ['project-works-documents', organizationId, project.id],
    queryFn: () => listProjectDocuments(organizationId, project.id),
    staleTime: 15_000,
  });

  const contactsQuery = useQuery({
    queryKey: ['project-works-contacts', organizationId, project.customerId ?? 'none'],
    enabled: Boolean(project.customerId),
    queryFn: () => listCustomerContactsForCustomer(organizationId, project.customerId as string),
    staleTime: 15_000,
  });

  const documents = documentsQuery.data ?? [];
  const customerContacts = contactsQuery.data ?? [];
  const teamCandidates = useMemo(
    () => buildProjectTeamCandidates(employees, people),
    [employees, people],
  );
  const teamNames = useMemo(
    () => displayNamesForProjectTeam({
      projectId: project.id,
      teamMemberships: projectTeamMemberships,
      projectMemberships,
      employees,
      people,
    }),
    [employees, people, project.id, projectMemberships, projectTeamMemberships],
  );

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.userId, person])),
    [people],
  );

  const keyPeople = useMemo(() => {
    const rows: Array<{ key: string; label: string; person?: OrganizationPerson }> = [];
    if (project.projectManagerId) {
      rows.push({
        key: `pm:${project.projectManagerId}`,
        label: 'Projektipäällikkö',
        person: peopleById.get(project.projectManagerId),
      });
    }
    if (project.responsibleSupervisorId) {
      rows.push({
        key: `sv:${project.responsibleSupervisorId}`,
        label: 'Vastuutyönjohtaja',
        person: peopleById.get(project.responsibleSupervisorId),
      });
    }
    return rows;
  }, [peopleById, project.projectManagerId, project.responsibleSupervisorId]);

  const [teamOpen, setTeamOpen] = useState(false);
  const [teamKeys, setTeamKeys] = useState<string[]>([]);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    title: '',
    role: '',
    email: '',
    phone: '',
    isPrimary: false,
  });
  const [documentOpen, setDocumentOpen] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentType, setDocumentType] = useState<string>('Muu');
  const [documentDescription, setDocumentDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!teamOpen) return;
    setTeamKeys(selectedKeysForProject({
      projectId: project.id,
      teamMemberships: projectTeamMemberships,
      projectMemberships,
      candidates: teamCandidates,
    }));
  }, [project.id, projectMemberships, projectTeamMemberships, teamCandidates, teamOpen]);

  const refreshSideData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['project-works-documents', organizationId, project.id] }),
      queryClient.invalidateQueries({ queryKey: ['project-works-contacts', organizationId, project.customerId ?? 'none'] }),
      queryClient.invalidateQueries({ queryKey: ['project-workspace', organizationId, project.id] }),
      queryClient.invalidateQueries({ queryKey: ['role-workspace'] }),
    ]);
  };

  const saveTeam = async () => {
    setSaving(true);
    onError(null);
    try {
      const { employeeIds, extraUserIds } = partitionTeamSelection(teamKeys, teamCandidates);
      await replaceProjectTeamMembers({
        organizationId,
        projectId: project.id,
        employeeIds,
        extraUserIds,
      });
      await refreshSideData();
      setTeamOpen(false);
      onSuccess('Projektitiimi päivitettiin.');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Projektitiimin tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async () => {
    if (!project.customerId) {
      onError('Projektille ei ole kytketty asiakasta, joten tilaajan yhteyshenkilöä ei voi lisätä tähän.');
      return;
    }
    if (!contactForm.name.trim()) {
      onError('Yhteyshenkilön nimi on pakollinen.');
      return;
    }
    setSaving(true);
    onError(null);
    try {
      await createCustomerContact({
        organizationId,
        customerId: project.customerId,
        userId: currentUserId,
        name: contactForm.name,
        title: contactForm.title,
        role: contactForm.role,
        email: contactForm.email,
        phone: contactForm.phone,
        isPrimary: contactForm.isPrimary,
      });
      await refreshSideData();
      setContactOpen(false);
      setContactForm({ name: '', title: '', role: '', email: '', phone: '', isPrimary: false });
      onSuccess('Tilaajan yhteyshenkilö lisättiin.');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Yhteyshenkilön tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openDocumentDialog = () => {
    setDocumentFile(null);
    setDocumentTitle('');
    setDocumentType('Muu');
    setDocumentDescription('');
    onError(null);
    setDocumentOpen(true);
  };

  const saveDocument = async () => {
    if (!currentUserId || !documentFile) {
      onError('Valitse tiedosto ennen tallentamista.');
      return;
    }
    if (!documentTitle.trim()) {
      onError('Dokumentin otsikko on pakollinen.');
      return;
    }
    if (documentFile.size > 25 * 1024 * 1024) {
      onError('Tiedosto ylittää 25 Mt kokorajan.');
      return;
    }
    setSaving(true);
    onError(null);
    try {
      await uploadProjectDocument({
        organizationId,
        projectId: project.id,
        userId: currentUserId,
        file: documentFile,
        title: documentTitle,
        documentType,
        description: documentDescription,
      });
      await refreshSideData();
      setDocumentOpen(false);
      onSuccess('Tiedosto lisättiin projektiin.');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Tiedoston tallennus epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const openDocument = async (document: ProjectDocument) => {
    onError(null);
    try {
      const url = await createProjectDocumentUrl(document.storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Dokumentin avaaminen epäonnistui.');
    }
  };

  const removeDocument = async (documentId: string) => {
    setSaving(true);
    onError(null);
    try {
      await archiveProjectDocument(organizationId, documentId);
      await refreshSideData();
      onSuccess('Tiedosto arkistoitiin.');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Dokumentin arkistointi epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const sideLoading = documentsQuery.isLoading || contactsQuery.isLoading;

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <UsersRound size={18} /> Päähenkilöt ja yhteystiedot
              </CardTitle>
              <p className="mt-1 break-words text-sm text-slate-500">
                Projektitiimi sekä tilaajan yhteyshenkilöt yhdessä näkymässä.
              </p>
            </div>
            {canManage && (
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setTeamOpen(true)}>
                  Muokkaa tiimiä
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!project.customerId}
                  onClick={() => {
                    setContactForm({ name: '', title: '', role: '', email: '', phone: '', isPrimary: false });
                    onError(null);
                    setContactOpen(true);
                  }}
                >
                  <Plus size={14} className="mr-1" /> Yhteyshenkilö
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {sideLoading && (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" /> Ladataan yhteystietoja…
              </p>
            )}

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vastuuhenkilöt</h3>
              {keyPeople.length === 0 ? (
                <p className="break-words rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  Projektipäällikköä tai vastuutyönjohtajaa ei ole vielä merkitty projektin perustietoihin.
                </p>
              ) : (
                <div className="grid gap-2">
                  {keyPeople.map((item) => (
                    <div key={item.key} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                        {initials(item.person?.name ?? '?')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-medium text-slate-900">{item.person?.name ?? 'Nimetön käyttäjä'}</p>
                        <p className="break-words text-xs text-slate-500">
                          {item.label}
                          {item.person?.role ? ` · ${ROLE_LABELS[item.person.role]}` : ''}
                        </p>
                        {item.person?.email && (
                          <p className="mt-1 flex items-start gap-1 break-words text-xs text-slate-600">
                            <Mail size={12} className="mt-0.5 shrink-0" />{item.person.email}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Projektitiimi ({teamNames.length})
              </h3>
              {teamNames.length === 0 ? (
                <p className="break-words rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  Tiimiä ei ole vielä määritetty. Lisää henkilöstö projektitiimiin ilman kutsua.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {teamNames.map((name) => (
                    <div key={name} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-800">
                        {initials(name)}
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-slate-900">{name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Tilaajan yhteyshenkilöt
                {project.customer ? ` · ${project.customer}` : ''}
              </h3>
              {!project.customerId ? (
                <p className="break-words rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  Kytke projektiin asiakas, jotta tilaajan yhteyshenkilöt näkyvät tässä.
                </p>
              ) : customerContacts.length === 0 ? (
                <p className="break-words rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  Tilaajalle ei ole vielä yhteyshenkilöitä.
                </p>
              ) : (
                <div className="grid gap-2">
                  {customerContacts.map((contact: CustomerContact) => (
                    <div key={contact.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words font-medium text-slate-900">{contact.name}</p>
                          <p className="break-words text-xs text-slate-500">
                            {[contact.title, contact.role].filter(Boolean).join(' · ') || 'Yhteyshenkilö'}
                          </p>
                        </div>
                        {contact.isPrimary && <Badge variant="outline">Ensisijainen</Badge>}
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-slate-600">
                        {contact.phone && (
                          <p className="flex items-start gap-1 break-words">
                            <Phone size={12} className="mt-0.5 shrink-0" />{contact.phone}
                          </p>
                        )}
                        {contact.email && (
                          <p className="flex items-start gap-1 break-words">
                            <Mail size={12} className="mt-0.5 shrink-0" />{contact.email}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Paperclip size={18} /> Projektin tiedostot
              </CardTitle>
              <p className="mt-1 break-words text-sm text-slate-500">
                Kuvat, PDF:t, Excelit ja muut projektidokumentit. Enintään 25 Mt / tiedosto.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onNavigateWorkspaceDocuments}>
                Avaa kaikki
              </Button>
              <Button size="sm" onClick={openDocumentDialog}>
                <Upload size={14} className="mr-1" /> Lisää tiedosto
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {documentsQuery.isLoading && (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" /> Ladataan tiedostoja…
              </p>
            )}
            {!documentsQuery.isLoading && documents.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                <FileText size={36} className="mx-auto mb-3 text-slate-300" />
                <p className="font-medium text-slate-800">Ei vielä tiedostoja</p>
                <p className="mx-auto mt-1 max-w-md break-words text-sm text-slate-500">
                  Lisää esimerkiksi suunnitelmia, valokuvia, pöytäkirjoja tai Excel-laskelmia suoraan tähän projektiin.
                </p>
                <Button className="mt-4" onClick={openDocumentDialog}>
                  <Upload size={15} className="mr-2" /> Lisää ensimmäinen tiedosto
                </Button>
              </div>
            )}
            {documents.slice(0, 8).map((document) => (
              <div
                key={document.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    projectDocumentKind(document.fileName, document.mimeType) === 'image'
                      ? 'bg-violet-50 text-violet-700'
                      : projectDocumentKind(document.fileName, document.mimeType) === 'spreadsheet'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-blue-50 text-blue-700',
                  )}
                  >
                    <DocumentIcon fileName={document.fileName} mimeType={document.mimeType} />
                  </div>
                  <div className="min-w-0">
                    <p className="break-words font-medium text-slate-900">{document.title}</p>
                    <p className="break-words text-xs text-slate-500">
                      {document.documentType}
                      {' · '}
                      {document.fileName}
                      {' · '}
                      {formatProjectFileSize(document.sizeBytes)}
                    </p>
                    {document.description && (
                      <p className="mt-1 break-words text-xs text-slate-600">{document.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => void openDocument(document)}>
                    Avaa
                  </Button>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={saving}
                      onClick={() => void removeDocument(document.id)}
                      aria-label={`Arkistoi ${document.title}`}
                    >
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {documents.length > 8 && (
              <Button variant="outline" className="w-full" onClick={onNavigateWorkspaceDocuments}>
                Näytä kaikki {documents.length} tiedostoa työtilassa
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Muokkaa projektitiimiä</DialogTitle>
          </DialogHeader>
          <p className="break-words text-sm text-slate-600">
            Lisää henkilöstökortit suoraan tiimiin. Sovellustunnus tarvitaan vasta työmääräysten kohdistukseen.
          </p>
          <div className="space-y-2">
            {teamCandidates.map((candidate) => {
              const checked = teamKeys.includes(candidate.key);
              return (
                <label
                  key={candidate.key}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => {
                      setTeamKeys((previous) => (
                        value === true
                          ? [...new Set([...previous, candidate.key])]
                          : previous.filter((id) => id !== candidate.key)
                      ));
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-medium text-slate-900">{candidate.name}</span>
                    <span className="block break-words text-xs text-slate-500">
                      {candidate.detail}
                      {candidate.hasLogin ? '' : ' · Ei sovellustunnusta'}
                    </span>
                  </span>
                </label>
              );
            })}
            {teamCandidates.length === 0 && (
              <p className="text-sm text-slate-500">
                Organisaatiossa ei ole vielä henkilöstökortteja. Lisää henkilö Henkilöstö-näkymässä.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamOpen(false)} disabled={saving}>Peruuta</Button>
            <Button onClick={() => void saveTeam()} disabled={saving}>
              {saving ? 'Tallennetaan…' : 'Tallenna tiimi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lisää tilaajan yhteyshenkilö</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contact-name">Nimi *</Label>
              <Input
                id="contact-name"
                value={contactForm.name}
                onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-title">Titteli</Label>
              <Input
                id="contact-title"
                value={contactForm.title}
                onChange={(event) => setContactForm((current) => ({ ...current, title: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-role">Rooli</Label>
              <Input
                id="contact-role"
                value={contactForm.role}
                onChange={(event) => setContactForm((current) => ({ ...current, role: event.target.value }))}
                placeholder="Esim. isännöitsijä"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Sähköposti</Label>
              <Input
                id="contact-email"
                type="email"
                value={contactForm.email}
                onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Puhelin</Label>
              <Input
                id="contact-phone"
                value={contactForm.phone}
                onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                checked={contactForm.isPrimary}
                onCheckedChange={(value) => setContactForm((current) => ({
                  ...current,
                  isPrimary: value === true,
                }))}
              />
              <span className="text-sm">Ensisijainen yhteyshenkilö</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOpen(false)} disabled={saving}>Peruuta</Button>
            <Button onClick={() => void saveContact()} disabled={saving}>
              {saving ? 'Tallennetaan…' : 'Tallenna'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={documentOpen} onOpenChange={setDocumentOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Lisää projektin tiedosto</DialogTitle>
          </DialogHeader>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.ods,.txt,.zip"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setDocumentFile(file);
              if (file) {
                setDocumentTitle((current) => current || file.name.replace(/\.[^.]+$/, ''));
                setDocumentType(inferProjectDocumentType(file.name, file.type));
              }
            }}
          />
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-20 w-full whitespace-normal border-dashed"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={20} className="mr-2 shrink-0" />
              <span className="break-words text-left">
                {documentFile
                  ? `${documentFile.name} · ${formatProjectFileSize(documentFile.size)}`
                  : 'Valitse kuva, PDF, Excel tai muu tiedosto (max 25 Mt)'}
              </span>
            </Button>
            <div className="space-y-2">
              <Label htmlFor="works-document-title">Otsikko *</Label>
              <Input
                id="works-document-title"
                value={documentTitle}
                onChange={(event) => setDocumentTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tyyppi</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="works-document-description">Kuvaus</Label>
              <Textarea
                id="works-document-description"
                value={documentDescription}
                onChange={(event) => setDocumentDescription(event.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentOpen(false)} disabled={saving}>Peruuta</Button>
            <Button onClick={() => void saveDocument()} disabled={saving || !documentFile}>
              {saving ? 'Tallennetaan…' : 'Tallenna tiedosto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
