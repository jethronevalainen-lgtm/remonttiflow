import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  Inbox,
  Info,
  Megaphone,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  UserRound,
} from 'lucide-react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useCommunicationDirectory } from '@/hooks/useCommunicationDirectory';
import { useOperationsData } from '@/hooks/useOperationsData';
import {
  createAnnouncementRecord,
  deleteAnnouncementRecord,
} from '@/lib/supabase/operationsEntities';
import {
  deleteSentPersonalMessage,
  markPersonalMessageRead,
  sendPersonalMessage,
} from '@/lib/supabase/personalMessages';
import type { Announcement, AnnouncementPriority, Message } from '@/types';

interface MessageForm {
  recipientUserId: string;
  subject: string;
  content: string;
}

interface AnnouncementForm {
  title: string;
  content: string;
  priority: AnnouncementPriority;
}

const EMPTY_MESSAGE: MessageForm = { recipientUserId: '', subject: '', content: '' };
const EMPTY_ANNOUNCEMENT: AnnouncementForm = { title: '', content: '', priority: 'Normaali' };
const PRIORITIES: AnnouncementPriority[] = ['Info', 'Normaali', 'Tärkeä'];

function timestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fi-FI');
}

function priorityBadge(priority: AnnouncementPriority) {
  const classes: Record<AnnouncementPriority, string> = {
    Info: 'border-blue-200 bg-blue-50 text-blue-700',
    Normaali: 'border-slate-200 bg-slate-50 text-slate-700',
    Tärkeä: 'border-red-200 bg-red-50 text-red-700',
  };
  return <Badge variant="outline" className={classes[priority]}>{priority}</Badge>;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function Viestinta() {
  const { user, profile } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { effectiveUserId, effectiveDisplayName, isPreviewing } = useViewAs();
  const { people, loading: directoryLoading, error: directoryError } = useCommunicationDirectory();
  const { messages, announcements, loading, error, refresh } = useOperationsData();
  const [activeTab, setActiveTab] = useState('inbox');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<Message | null>(null);
  const [deleteAnnouncement, setDeleteAnnouncement] = useState<Announcement | null>(null);
  const [messageForm, setMessageForm] = useState<MessageForm>(EMPTY_MESSAGE);
  const [announcementForm, setAnnouncementForm] = useState<AnnouncementForm>(EMPTY_ANNOUNCEMENT);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canManageAnnouncements = currentRole === 'admin' || currentRole === 'supervisor';
  const actualSenderName = profile?.full_name || user?.email || 'Käyttäjä';
  const inbox = useMemo(
    () => messages.filter((message) => message.recipientUserId === effectiveUserId),
    [effectiveUserId, messages],
  );
  const sent = useMemo(
    () => messages.filter((message) => message.senderUserId === effectiveUserId),
    [effectiveUserId, messages],
  );
  const unreadCount = inbox.filter((message) => !message.read).length;
  const selectedRecipient = people.find((person) => person.userId === messageForm.recipientUserId);
  const visibleError = operationError ?? error ?? directoryError;
  const messageList = activeTab === 'sent' ? sent : inbox;

  const openMessage = async (message: Message) => {
    setSelectedMessage(message);
    if (
      !isPreviewing
      && !message.read
      && message.recipientUserId === user?.id
      && currentOrg
    ) {
      try {
        await markPersonalMessageRead(currentOrg.id, message.id);
        await refresh();
      } catch (caught) {
        setOperationError(caught instanceof Error ? caught.message : 'Viestin lukutilan päivitys epäonnistui.');
      }
    }
  };

  const openMessageCreate = () => {
    setMessageForm(EMPTY_MESSAGE);
    setFormErrors([]);
    setOperationError(null);
    setMessageDialogOpen(true);
  };

  const sendMessage = async () => {
    const nextErrors: string[] = [];
    if (!selectedRecipient) nextErrors.push('Valitse vastaanottaja.');
    if (!messageForm.content.trim()) nextErrors.push('Viestin sisältö on pakollinen.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg || !user || !selectedRecipient || isPreviewing) return;

    setSaving(true);
    setOperationError(null);
    try {
      await sendPersonalMessage({
        organizationId: currentOrg.id,
        senderUserId: user.id,
        senderName: actualSenderName,
        recipientUserId: selectedRecipient.userId,
        recipientName: selectedRecipient.name,
        subject: messageForm.subject,
        content: messageForm.content,
      });
      await refresh();
      setMessageDialogOpen(false);
      setActiveTab('sent');
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Viestin lähettäminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const publishAnnouncement = async () => {
    const nextErrors: string[] = [];
    if (!announcementForm.title.trim()) nextErrors.push('Tiedotteen otsikko on pakollinen.');
    if (!announcementForm.content.trim()) nextErrors.push('Tiedotteen sisältö on pakollinen.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg || !canManageAnnouncements || isPreviewing) return;

    setSaving(true);
    setOperationError(null);
    try {
      await createAnnouncementRecord(currentOrg.id, user?.id, {
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        author: actualSenderName,
        date: new Date().toISOString(),
        priority: announcementForm.priority,
      });
      await refresh();
      setAnnouncementDialogOpen(false);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tiedotteen julkaiseminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const removeMessage = async () => {
    if (!deleteMessage || !currentOrg || deleteMessage.senderUserId !== user?.id || isPreviewing) return;
    setSaving(true);
    try {
      await deleteSentPersonalMessage(currentOrg.id, deleteMessage.id);
      await refresh();
      if (selectedMessage?.id === deleteMessage.id) setSelectedMessage(null);
      setDeleteMessage(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Viestin poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const removeAnnouncement = async () => {
    if (!deleteAnnouncement || !currentOrg || !canManageAnnouncements || isPreviewing) return;
    setSaving(true);
    try {
      await deleteAnnouncementRecord(currentOrg.id, deleteAnnouncement.id);
      await refresh();
      setDeleteAnnouncement(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Tiedotteen poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  const renderMessages = (items: Message[]) => (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
      <Card className="min-w-0 overflow-hidden border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {items.map((message) => {
            const otherName = message.senderUserId === effectiveUserId ? message.recipient : message.sender;
            const isUnread = !message.read && message.recipientUserId === effectiveUserId;
            return (
              <button
                key={message.id}
                type="button"
                onClick={() => void openMessage(message)}
                className={`flex min-h-20 w-full min-w-0 items-start gap-3 border-b border-slate-100 p-4 text-left transition-colors hover:bg-slate-50 ${selectedMessage?.id === message.id ? 'bg-orange-50' : ''}`}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials(otherName)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <p className={`truncate text-sm ${isUnread ? 'font-bold text-slate-950' : 'font-medium text-slate-700'}`}>{otherName}</p>
                    <span className="flex-shrink-0 text-xs text-slate-400">{timestamp(message.timestamp)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-slate-900">{message.subject || 'Ei aihetta'}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{message.content}</p>
                </div>
                {isUnread && <span className="mt-2 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-orange-500" />}
              </button>
            );
          })}
          {!loading && items.length === 0 && (
            <div className="p-10 text-center sm:p-12"><MessageSquare size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei viestejä</p></div>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 border-slate-200 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          {selectedMessage ? (
            <div className="space-y-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-500">{selectedMessage.sender} → {selectedMessage.recipient}</p>
                  <h2 className="mt-1 break-words text-lg font-semibold text-slate-950">{selectedMessage.subject || 'Ei aihetta'}</h2>
                  <p className="text-xs text-slate-400">{timestamp(selectedMessage.timestamp)}</p>
                </div>
                {!isPreviewing && selectedMessage.senderUserId === user?.id && (
                  <Button variant="ghost" size="sm" className="flex-shrink-0 text-red-600" onClick={() => setDeleteMessage(selectedMessage)}><Trash2 size={15} /></Button>
                )}
              </div>
              <div className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">{selectedMessage.content}</div>
            </div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center text-center text-slate-500"><UserRound size={38} className="mb-3 text-slate-300" /><p>Valitse viesti luettavaksi.</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto min-w-0 max-w-[1400px] space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-600"><MessageSquare size={15} /> Henkilökohtainen viestintä</div>
          <h1 className="break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Viestit ja tiedotteet</h1>
          <p className="mt-2 text-sm text-slate-500">Käyttäjänä {effectiveDisplayName}. Henkilökohtaiset viestit on rajattu valittuun käyttäjään.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button onClick={openMessageCreate} className="min-h-11 gap-2"><Send size={16} /> Uusi viesti</Button>
          {canManageAnnouncements && <Button variant="outline" onClick={() => { setAnnouncementForm(EMPTY_ANNOUNCEMENT); setFormErrors([]); setAnnouncementDialogOpen(true); }} className="min-h-11 gap-2"><Megaphone size={16} /> Uusi tiedote</Button>}
        </div>
      </div>

      {visibleError && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />{visibleError}</div>}

      <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value); setSelectedMessage(null); }}>
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="inbox" className="min-h-10 gap-2"><Inbox size={15} /> Saapuneet {unreadCount > 0 && <Badge className="h-5 min-w-5 justify-center rounded-full bg-red-500 px-1 text-white">{unreadCount}</Badge>}</TabsTrigger>
          <TabsTrigger value="sent" className="min-h-10 gap-2"><Send size={15} /> Lähetetyt</TabsTrigger>
          <TabsTrigger value="announcements" className="min-h-10 gap-2"><Megaphone size={15} /> Tiedotteet</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" className="mt-4">{renderMessages(messageList)}</TabsContent>
        <TabsContent value="sent" className="mt-4">{renderMessages(messageList)}</TabsContent>
        <TabsContent value="announcements" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className={announcement.priority === 'Tärkeä' ? 'min-w-0 border-red-200 shadow-sm' : 'min-w-0 border-slate-200 shadow-sm'}>
                <CardContent className="space-y-3 p-4 sm:p-5">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${announcement.priority === 'Tärkeä' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{announcement.priority === 'Tärkeä' ? <Bell size={18} /> : <Info size={18} />}</div>
                      <div className="min-w-0"><h2 className="break-words font-semibold text-slate-950">{announcement.title}</h2><p className="text-xs text-slate-500">{announcement.author} · {timestamp(announcement.date)}</p></div>
                    </div>
                    {priorityBadge(announcement.priority)}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{announcement.content}</p>
                  {!isPreviewing && canManageAnnouncements && <div className="flex justify-end"><Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteAnnouncement(announcement)}><Trash2 size={14} className="mr-1" /> Poista</Button></div>}
                </CardContent>
              </Card>
            ))}
            {!loading && announcements.length === 0 && <Card className="border-dashed lg:col-span-2"><CardContent className="p-10 text-center sm:p-12"><Megaphone size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei tiedotteita</p></CardContent></Card>}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Uusi henkilökohtainen viesti</DialogTitle></DialogHeader>
          {formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="space-y-4">
            <div className="space-y-2"><Label>Vastaanottaja *</Label><Select value={messageForm.recipientUserId} onValueChange={(recipientUserId) => setMessageForm((previous) => ({ ...previous, recipientUserId }))}><SelectTrigger className="min-h-11"><SelectValue placeholder={directoryLoading ? 'Ladataan käyttäjiä…' : 'Valitse vastaanottaja'} /></SelectTrigger><SelectContent>{people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name} · {person.role === 'admin' ? 'Admin' : person.role === 'supervisor' ? 'Työnjohto' : 'Työntekijä'}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="message-subject">Aihe</Label><Input id="message-subject" value={messageForm.subject} onChange={(event) => setMessageForm((previous) => ({ ...previous, subject: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="message-content">Viesti *</Label><Textarea id="message-content" value={messageForm.content} onChange={(event) => setMessageForm((previous) => ({ ...previous, content: event.target.value }))} rows={6} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setMessageDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void sendMessage()} disabled={saving}><Send size={15} className="mr-1" />{saving ? 'Lähetetään…' : 'Lähetä'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={announcementDialogOpen} onOpenChange={setAnnouncementDialogOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Uusi tiedote</DialogTitle></DialogHeader>
          {formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="announcement-title">Otsikko *</Label><Input id="announcement-title" value={announcementForm.title} onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, title: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Prioriteetti</Label><Select value={announcementForm.priority} onValueChange={(priority: AnnouncementPriority) => setAnnouncementForm((previous) => ({ ...previous, priority }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="announcement-content">Sisältö *</Label><Textarea id="announcement-content" value={announcementForm.content} onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, content: event.target.value }))} rows={6} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAnnouncementDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void publishAnnouncement()} disabled={saving}><Plus size={15} className="mr-1" />{saving ? 'Julkaistaan…' : 'Julkaise'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteMessage)} onOpenChange={(open) => !open && setDeleteMessage(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poista lähetetty viesti</AlertDialogTitle><AlertDialogDescription>Viesti poistetaan omasta ja vastaanottajan näkymästä.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction onClick={() => void removeMessage()} className="bg-red-600 hover:bg-red-700">Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={Boolean(deleteAnnouncement)} onOpenChange={(open) => !open && setDeleteAnnouncement(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poista tiedote</AlertDialogTitle><AlertDialogDescription>Poistetaanko <strong>{deleteAnnouncement?.title}</strong>?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction onClick={() => void removeAnnouncement()} className="bg-red-600 hover:bg-red-700">Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </motion.div>
  );
}
