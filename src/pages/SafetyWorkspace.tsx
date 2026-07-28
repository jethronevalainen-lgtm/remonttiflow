import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2, Plus } from 'lucide-react';

import { hasPermission } from '@/auth/permissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import logger from '@/lib/logger';
import {
  acknowledgeSafetyBriefing, archiveSafetyBriefing, loadSafetyWorkspace, openSafetyAttachment,
  safetyActionReasons, safetyMetrics, saveProjectSafetyProfile, saveSafetyBriefing,
  selectPrimaryBriefing, subscribeSafetyWorkspace, uploadSafetyAttachment,
  type ProjectSafetyProfile, type SafetyBriefing, type SafetyWorkspaceSnapshot,
} from '@/lib/supabase/safetyWorkspace';
import { createSafetyItemRecord, deleteSafetyItemRecord, updateSafetyItemRecord } from '@/lib/supabase/workforceEntities';
import type { SafetyItem, SafetyItemType } from '@/types';
import {
  EmergencyGuideDialog, SafetyBriefingDialog, SafetyConfirmDialogs, SafetyItemDialog,
  SafetyProfileDialog,
} from './safety/SafetyDialogs';
import {
  BriefingAdminList, EmergencyCard, SafetyActionQueue, SafetyHeader, SafetyHero,
  SafetyList, SafetyMetrics, SafetyQuickActions,
} from './safety/SafetyPresentation';
import {
  emptySafetyBriefingForm, emptySafetyItemForm, emptySafetyProfile,
  type SafetyBriefingForm, type SafetyItemForm, type SafetyViewFilter,
} from './safety/SafetyUiTypes';

export default function SafetyWorkspace() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { effectiveRole, effectiveUserId } = useViewAs();
  const { people } = useRoleWorkspace();
  const today = new Date().toISOString().slice(0, 10);
  const canManage = hasPermission(effectiveRole, 'safety.manage');
  const [data, setData] = useState<SafetyWorkspaceSnapshot>({ projects: [], items: [], briefings: [], profiles: [], attachments: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [projectId, setProjectId] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState<SafetyViewFilter>('action');
  const [itemOpen, setItemOpen] = useState(false);
  const [editing, setEditing] = useState<SafetyItem | null>(null);
  const [itemForm, setItemForm] = useState<SafetyItemForm>(emptySafetyItemForm(today));
  const [itemErrors, setItemErrors] = useState<string[]>([]);
  const [observationFiles, setObservationFiles] = useState<File[]>([]);
  const [correctionFiles, setCorrectionFiles] = useState<File[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<SafetyItem | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefingForm, setBriefingForm] = useState<SafetyBriefingForm>(emptySafetyBriefingForm(today));
  const [briefingFiles, setBriefingFiles] = useState<File[]>([]);
  const [briefingErrors, setBriefingErrors] = useState<string[]>([]);
  const [archiveTarget, setArchiveTarget] = useState<SafetyBriefing | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<ProjectSafetyProfile>(emptySafetyProfile(currentOrg?.id ?? ''));
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [callConfirm, setCallConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async (quiet = false) => {
    if (!currentOrg || !effectiveUserId || !effectiveRole) return;
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const next = await loadSafetyWorkspace(currentOrg.id, effectiveUserId, effectiveRole);
      setData(next);
      setProjectId((previous) => previous && next.projects.some((project) => project.id === previous) ? previous : '');
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Turvallisuustietojen lataus epäonnistui.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentOrg, effectiveRole, effectiveUserId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => currentOrg ? subscribeSafetyWorkspace(currentOrg.id, () => { void refresh(true); }) : undefined, [currentOrg, refresh]);

  const selectedProject = data.projects.find((project) => project.id === projectId);
  const profile = data.profiles.find((item) => item.projectId === projectId);
  const briefing = selectPrimaryBriefing(data.briefings, projectId || undefined);
  const scopedItems = useMemo(
    () => projectId ? data.items.filter((item) => item.projectId === projectId) : data.items,
    [data.items, projectId],
  );
  const metrics = safetyMetrics(scopedItems, today);
  const actionItems = useMemo(() => scopedItems
    .map((item) => ({ item, reasons: safetyActionReasons(item, today) }))
    .filter((entry) => entry.reasons.length)
    .sort((a, b) => Number(b.item.severity === 'Vakava') - Number(a.item.severity === 'Vakava')), [scopedItems, today]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    return scopedItems.filter((item) => {
      const reasons = safetyActionReasons(item, today);
      const closed = ['Suljettu', 'Vahvistettu'].includes(item.status);
      const viewMatch = view === 'all' || (view === 'action' && reasons.length > 0)
        || (view === 'open' && !closed) || (view === 'verification' && item.status === 'Ilmoitettu korjatuksi')
        || (view === 'closed' && closed);
      const textMatch = !query || [item.title, item.description, item.project, item.location, item.assignee]
        .some((value) => value?.toLocaleLowerCase('fi').includes(query));
      return viewMatch && textMatch && (typeFilter === 'all' || item.type === typeFilter)
        && (statusFilter === 'all' || item.status === statusFilter);
    });
  }, [scopedItems, search, statusFilter, today, typeFilter, view]);

  const openCreate = (type: SafetyItemType = 'risk') => {
    setEditing(null);
    setItemForm(emptySafetyItemForm(today, '', type));
    setItemErrors([]);
    setObservationFiles([]);
    setCorrectionFiles([]);
    setItemOpen(true);
  };

  const openEdit = (item: SafetyItem) => {
    setEditing(item);
    setItemForm({
      type: item.type, title: item.title, description: item.description ?? '', date: item.date,
      projectId: item.projectId ?? '', location: item.location ?? '', severity: item.severity ?? 'Keskitasoinen',
      status: item.status, assigneeUserId: item.assigneeUserId ?? '', dueDate: item.dueDate ?? '',
      rootCause: item.rootCause ?? '', correctiveAction: item.correctiveAction ?? '',
      preventiveAction: item.preventiveAction ?? '',
    });
    setItemErrors([]);
    setObservationFiles([]);
    setCorrectionFiles([]);
    setItemOpen(true);
  };

  const pickImages = (event: ChangeEvent<HTMLInputElement>, setter: Dispatch<SetStateAction<File[]>>) => {
    const files = Array.from(event.target.files ?? [])
      .filter((file) => file.type.startsWith('image/') && file.size <= 15 * 1024 * 1024);
    setter((previous) => [...previous, ...files].slice(0, 8));
    event.target.value = '';
  };

  const saveItem = async () => {
    const errors = [
      !itemForm.title.trim() && 'Otsikko on pakollinen.',
      itemForm.description.trim().length < 5 && 'Kuvaa havainto riittävän tarkasti.',
    ].filter(Boolean) as string[];
    if (itemForm.status === 'Ilmoitettu korjatuksi' && !itemForm.correctiveAction.trim()) errors.push('Kirjaa tehty korjaava toimenpide.');
    setItemErrors(errors);
    if (errors.length || !currentOrg || !user) return;
    setSaving(true);
    setError(null);
    try {
      const project = data.projects.find((entry) => entry.id === itemForm.projectId);
      const person = people.find((entry) => entry.userId === itemForm.assigneeUserId);
      const payload = {
        type: itemForm.type, title: itemForm.title.trim(), description: itemForm.description.trim(), date: itemForm.date,
        projectId: itemForm.projectId, project: project?.name ?? '', location: itemForm.location.trim() || undefined,
        severity: itemForm.severity, status: editing && canManage ? itemForm.status : 'Avoin',
        assigneeUserId: itemForm.assigneeUserId || undefined, assignee: person?.name,
        dueDate: itemForm.dueDate || undefined, rootCause: itemForm.rootCause.trim() || undefined,
        correctiveAction: itemForm.correctiveAction.trim() || undefined,
        preventiveAction: itemForm.preventiveAction.trim() || undefined,
        resolvedAt: ['Ilmoitettu korjatuksi', 'Vahvistettu', 'Suljettu'].includes(itemForm.status)
          ? editing?.resolvedAt ?? new Date().toISOString() : undefined,
        verifiedAt: ['Vahvistettu', 'Suljettu'].includes(itemForm.status) ? new Date().toISOString() : undefined,
        verifiedBy: ['Vahvistettu', 'Suljettu'].includes(itemForm.status) ? user.id : undefined,
      };
      let itemId = editing?.id;
      if (editing) await updateSafetyItemRecord(currentOrg.id, editing.id, payload);
      else itemId = await createSafetyItemRecord(currentOrg.id, user.id, payload);
      for (const file of observationFiles) await uploadSafetyAttachment({ organizationId: currentOrg.id, userId: user.id, kind: 'observation', file, safetyItemId: itemId });
      for (const file of correctionFiles) await uploadSafetyAttachment({ organizationId: currentOrg.id, userId: user.id, kind: 'correction', file, safetyItemId: itemId });
      setItemOpen(false);
      setSuccess(editing ? 'Turvallisuusasia päivitettiin.' : 'Turvallisuushavainto tallennettiin ja välitettiin työnjohdolle.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tallennus epäonnistui.');
      logger.error('Turvallisuusasian tallennus epäonnistui', { error: caught });
    } finally { setSaving(false); }
  };

  const verify = async (item: SafetyItem) => {
    if (!currentOrg || !user || !canManage) return;
    setSaving(true);
    try {
      await updateSafetyItemRecord(currentOrg.id, item.id, { status: 'Vahvistettu', verifiedAt: new Date().toISOString(), verifiedBy: user.id });
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Varmennus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!currentOrg || !deleteTarget || !canManage) return;
    setSaving(true);
    try { await deleteSafetyItemRecord(currentOrg.id, deleteTarget.id); setDeleteTarget(null); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.'); }
    finally { setSaving(false); }
  };

  const acknowledge = async () => {
    if (!currentOrg || !effectiveUserId || !effectiveRole || !briefing) return;
    setSaving(true);
    try {
      await acknowledgeSafetyBriefing(currentOrg.id, briefing, effectiveUserId, effectiveRole);
      setSuccess('Turvallisuusohje kuitattiin luetuksi.');
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Kuittaus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const openBriefing = (item?: SafetyBriefing) => {
    setBriefingForm(item ? {
      id: item.id, projectId: item.projectId ?? '', title: item.title, introduction: item.introduction,
      instructions: item.instructionItems.join('\n'), severity: item.severity, audienceRoles: item.audienceRoles,
      validFrom: item.validFrom, validUntil: item.validUntil ?? '', requiresAcknowledgement: item.requiresAcknowledgement,
      status: item.status, version: item.version + 1,
    } : emptySafetyBriefingForm(today));
    setBriefingFiles([]);
    setBriefingErrors([]);
    setBriefingOpen(true);
  };

  const saveBriefingRecord = async () => {
    const instructions = briefingForm.instructions.split('\n').map((item) => item.trim()).filter(Boolean);
    const errors = [
      !briefingForm.title.trim() && 'Otsikko on pakollinen.',
      !instructions.length && 'Lisää vähintään yksi toimintaohje.',
      !briefingForm.audienceRoles.length && 'Valitse vähintään yksi kohderooli.',
    ].filter(Boolean) as string[];
    setBriefingErrors(errors);
    if (errors.length || !currentOrg || !user) return;
    setSaving(true);
    try {
      const briefingId = await saveSafetyBriefing(currentOrg.id, user.id, {
        ...briefingForm, instructionItems: instructions, validUntil: briefingForm.validUntil || undefined,
      });
      for (const file of briefingFiles) await uploadSafetyAttachment({ organizationId: currentOrg.id, userId: user.id, kind: 'briefing', file, briefingId });
      setBriefingOpen(false);
      setSuccess(briefingForm.status === 'published' ? 'Turvallisuusohje julkaistiin.' : 'Luonnos tallennettiin.');
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Ohjeen tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const archiveBriefing = async () => {
    if (!currentOrg || !archiveTarget) return;
    setSaving(true);
    try { await archiveSafetyBriefing(currentOrg.id, archiveTarget.id); setArchiveTarget(null); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Arkistointi epäonnistui.'); }
    finally { setSaving(false); }
  };

  const openProfile = () => {
    if (!currentOrg || !projectId) return;
    setProfileForm(profile ?? emptySafetyProfile(currentOrg.id, projectId));
    setProfileOpen(true);
  };

  const saveProfile = async () => {
    if (!profileForm.projectId) return;
    setSaving(true);
    try { await saveProjectSafetyProfile(profileForm); setProfileOpen(false); setSuccess('Työmaan hätätiedot tallennettiin.'); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Hätätietojen tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const copyAddress = async () => {
    const address = profile?.siteAddress || selectedProject?.location || '';
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setSuccess('Työmaan osoite kopioitiin.');
  };

  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1500px] space-y-6 pb-24 md:pb-8">
    <SafetyHeader projects={data.projects} projectId={projectId} refreshing={refreshing} onProjectChange={setProjectId} onRefresh={() => void refresh(true)} onCreate={openCreate} />
    {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} className="mt-0.5 shrink-0" />{error}</div>}
    {success && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} className="mt-0.5 shrink-0" />{success}</div>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.65fr)]">
      <SafetyHero briefing={briefing} attachments={briefing ? data.attachments.filter((attachment) => attachment.briefingId === briefing.id) : []} canManage={canManage} saving={saving} onCreate={openCreate} onAcknowledge={() => void acknowledge()} onOpenAttachment={(attachment) => void openSafetyAttachment(attachment)} onEditBriefing={() => openBriefing(briefing)} />
      <EmergencyCard project={selectedProject} profile={profile} canManage={canManage} onCallEmergency={() => setCallConfirm(true)} onCopyAddress={() => void copyAddress()} onOpenGuide={() => setEmergencyOpen(true)} onEditProfile={openProfile} />
    </div>
    <SafetyQuickActions onCreate={openCreate} />
    <SafetyMetrics metrics={metrics} onSelect={setView} />
    {canManage && <SafetyActionQueue entries={actionItems} onOpen={openEdit} onVerify={(item) => void verify(item)} />}
    {loading ? <Card><CardContent className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> Ladataan turvallisuustietoja…</CardContent></Card> : <SafetyList items={filteredItems} attachments={data.attachments} view={view} search={search} typeFilter={typeFilter} statusFilter={statusFilter} canManage={canManage} today={today} onView={setView} onSearch={setSearch} onType={setTypeFilter} onStatus={setStatusFilter} onEdit={openEdit} onDelete={setDeleteTarget} onVerify={(item) => void verify(item)} onOpenAttachment={(attachment) => void openSafetyAttachment(attachment)} onCreate={openCreate} />}
    {canManage && <BriefingAdminList briefings={data.briefings} projects={data.projects} onCreate={() => openBriefing()} onEdit={openBriefing} onArchive={setArchiveTarget} />}
    <Button className="fixed bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] -translate-x-1/2 shadow-xl md:hidden" onClick={() => openCreate()}><Plus size={17} className="mr-2" /> Tee turvallisuushavainto</Button>

    <SafetyItemDialog open={itemOpen} form={itemForm} editing={editing} errors={itemErrors} projects={data.projects} people={people.map((person) => ({ userId: person.userId, name: person.name }))} canManage={canManage} observationFileCount={observationFiles.length} correctionFileCount={correctionFiles.length} saving={saving} onOpenChange={setItemOpen} onForm={setItemForm} onObservationFiles={(event) => pickImages(event, setObservationFiles)} onCorrectionFiles={(event) => pickImages(event, setCorrectionFiles)} onSave={() => void saveItem()} />
    <SafetyBriefingDialog open={briefingOpen} form={briefingForm} errors={briefingErrors} projects={data.projects} fileCount={briefingFiles.length} saving={saving} onOpenChange={setBriefingOpen} onForm={setBriefingForm} onFiles={(event) => { setBriefingFiles(Array.from(event.target.files ?? []).filter((file) => file.size <= 15 * 1024 * 1024).slice(0, 8)); event.target.value = ''; }} onSave={() => void saveBriefingRecord()} />
    <SafetyProfileDialog open={profileOpen} form={profileForm} saving={saving} onOpenChange={setProfileOpen} onForm={setProfileForm} onSave={() => void saveProfile()} />
    <EmergencyGuideDialog open={emergencyOpen} profile={profile} project={selectedProject} onOpenChange={setEmergencyOpen} onCall={() => setCallConfirm(true)} />
    <SafetyConfirmDialogs callOpen={callConfirm} deleteTarget={deleteTarget} archiveTarget={archiveTarget} address={profile?.siteAddress || selectedProject?.location || ''} onCallOpen={setCallConfirm} onDeleteTarget={setDeleteTarget} onArchiveTarget={setArchiveTarget} onDelete={() => void remove()} onArchive={() => void archiveBriefing()} />
  </motion.div>;
}
