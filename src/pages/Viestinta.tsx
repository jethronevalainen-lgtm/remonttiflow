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
  const senderName = profile?.full_name || user?.email || 'Käyttäjä';
  const inbox = useMemo(
    () => messages.filter((message) => message.recipientUserId === user?.id),
    [messages, user?.id],
  );
  const sent = useMemo(
    () => messages.filter((message) => message.senderUserId === user?.id),
    [messages, user?.id],
  );
  const unreadCount = inbox.filter((message) => !message.read).length;
  const selectedRecipient = people.find((person) => person.userId === messageForm.recipientUserId);
  const visibleError = operationError ?? error ?? directoryError;

  const openMessage = async (message: Message) => {
    setSelectedMessage(message);
    if (!message.read && message.recipientUserId === user?.id && currentOrg) {
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
    if (nextErrors.length > 0 || !currentOrg || !user || !selectedRecipient) return;

    setSaving(true);
    setOperationError(null);
    try {
      await sendPersonalMessage({
        organizationId: currentOrg.id,
        senderUserId: user.id,
        senderName,
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
    if (nextErrors.length > 0 || !currentOrg || !canManageAnnouncements) return;

    setSaving(true);
    setOperationError(null);
    try {
      await createAnnouncementRecord(currentOrg.id, user?.id, {
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        author: senderName,
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
    if (!deleteMessage || !currentOrg || deleteMessage.senderUserId !== user?.id) return;
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
    if (!deleteAnnouncement || !currentOrg || !canManageAnnouncements) return;
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

  const messageList = activeTab === 'sent' ? sent : inbox;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-600"><MessageSquare size={15} /> Henkilökohtainen viestintä</div><h1 className="text-3xl font-bold tracking-tight text-slate-950">Viestit ja tiedotteet</h1><p className="mt-2 text-sm text-slate-500">Viestit näkyvät vain lähettäjälle ja vastaanottajalle. Tiedotteet näkyvät koko organisaatiolle.</p></div>
        <div className="flex flex-wrap gap-2"><Button onClick={openMessageCreate} className="gap-2"><Send size={16} /> Uusi viesti</Button>{canManageAnnouncements && <Button variant="outline" onClick={() => { setAnnouncementForm(EMPTY_ANNOUNCEMENT); setFormErrors([]); setAnnouncementDialogOpen(true); }} className="gap-2"><Megaphone size={16} /> Uusi tiedote</Button>}</div>
      </div>

      {visibleError && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} />{visibleError}</div>}

      <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value); setSelectedMessage(null); }}>
        <TabsList className="h-auto flex-wrap"><TabsTrigger value="inbox" className="gap-2"><Inbox size={15} /> Saapuneet {unreadCount > 0 && <Badge className="h-5 min-w-5 justify-center rounded-full bg-red-500 px-1 text-white">{unreadCount}</Badge>}</TabsTrigger><TabsTrigger value="sent" className="gap-2"><Send size={15} /> Lähetetyt</TabsTrigger><TabsTrigger value="announcements" className="gap-2"><Megaphone size={15} /> Tiedotteet</TabsTrigger></TabsList>

        <TabsContent value="inbox" className="mt-4">{renderMessages(messageList)}</TabsContent>
        <TabsContent value="sent" className="mt-4">{renderMessages(messageList)}</TabsContent>
        <TabsContent value="announcements" className="mt-4"><div className="grid gap-4 lg:grid-cols-2">{announcements.map((announcement) => <Card key={announcement.id} className={announcement.priority === 'Tärkeä' ? 'border-red-200 shadow-sm' : 'border-slate-200 shadow-sm'}><CardContent className="space-y-3 p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${announcement.priority === 'Tärkeä' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{announcement.priority === 'Tärkeä' ? <Bell size={18} /> : <Info size={18} />}</div><div><h2 className="font-semibold text-slate-950">{announcement.title}</h2><p className="text-xs text-slate-500">{announcement.author} · {timestamp(announcement.date)}</p></div></div>{priorityBadge(announcement.priority)}</div><p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{announcement.content}</p>{canManageAnnouncements && <div className="flex justify-end"><Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteAnnouncement(announcement)}><Trash2 size={14} className="mr-1" /> Poista</Button></div>}</CardContent></Card>)}{!loading && announcements.length === 0 && <Card className="border-dashed lg:col-span-2"><CardContent className="p-12 text-center"><Megaphone size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei tiedotteita</p></CardContent></Card>}</div></TabsContent>
      </Tabs>

      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Uusi henkilökohtainen viesti</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="space-y-4"><div className="space-y-2"><Label>Vastaanottaja *</Label><Select value={messageForm.recipientUserId} onValueChange={(recipientUserId) => setMessageForm((previous) => ({ ...previous, recipientUserId }))}><SelectTrigger><SelectValue placeholder={directoryLoading ? 'Ladataan käyttäjiä…' : 'Valitse vastaanottaja'} /></SelectTrigger><SelectContent>{people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name} · {person.role === 'admin' ? 'Admin' : person.role === 'supervisor' ? 'Työnjohto' : 'Työntekijä'}</SelectItem>)}</SelectContent></Select>{people.length === 0 && !directoryLoading && <p className="text-xs text-amber-700">Viestittäviä käyttäjiä ei löytynyt. Työntekijälle näkyvät työnjohto ja omiin töihin liittyvät käyttäjät.</p>}</div><div className="space-y-2"><Label htmlFor="message-subject">Aihe</Label><Input id="message-subject" value={messageForm.subject} onChange={(event) => setMessageForm((previous) => ({ ...previous, subject: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="message-content">Viesti *</Label><Textarea id="message-content" value={messageForm.content} onChange={(event) => setMessageForm((previous) => ({ ...previous, content: event.target.value }))} rows={6} /></div></div><DialogFooter><Button variant="outline" onClick={() => setMessageDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void sendMessage()} disabled={saving}><Send size={15} className="mr-1" />{saving ? 'Lähetetään…' : 'Lähetä'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={announcementDialogOpen} onOpenChange={setAnnouncementDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Uusi tiedote</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="space-y-4"><div className="space-y-2"><Label htmlFor="announcement-title">Otsikko *</Label><Input id="announcement-title" value={announcementForm.title} onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, title: event.target.value }))} /></div><div className="space-y-2"><Label>Prioriteetti</Label><Select value={announcementForm.priority} onValueChange={(priority: AnnouncementPriority) => setAnnouncementForm((previous) => ({ ...previous, priority }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="announcement-content">Sisältö *</Label><Textarea id="announcement-content" value={announcementForm.content} onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, content: event.target.value }))} rows={6} /></div></div><DialogFooter><Button variant="outline" onClick={() => setAnnouncementDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void publishAnnouncement()} disabled={saving}><Plus size={15} className="mr-1" />{saving ? 'Julkaistaan…' : 'Julkaise'}</Button></DialogFooter></DialogContent></Dialog>

      <AlertDialog open={Boolean(deleteMessage)} onOpenChange={(open) => !open && setDeleteMessage(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poista lähetetty viesti</AlertDialogTitle><AlertDialogDescription>Viesti poistetaan omasta ja vastaanottajan näkymästä.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction onClick={() => void removeMessage()} className="bg-red-600 hover:bg-red-700">Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={Boolean(deleteAnnouncement)} onOpenChange={(open) => !open && setDeleteAnnouncement(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poista tiedote</AlertDialogTitle><AlertDialogDescription>Poistetaanko <strong>{deleteAnnouncement?.title}</strong>?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction onClick={() => void removeAnnouncement()} className="bg-red-600 hover:bg-red-700">Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </motion.div>
  );

  function renderMessages(items: Message[]) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card className="overflow-hidden border-slate-200 shadow-sm"><CardContent className="p-0">{items.map((message) => {
          const otherName = message.senderUserId === user?.id ? message.recipient : message.sender;
          return <button key={message.id} type="button" onClick={() => void openMessage(message)} className={`flex w-full items-start gap-3 border-b border-slate-100 p-4 text-left transition-colors hover:bg-slate-50 ${selectedMessage?.id === message.id ? 'bg-orange-50' : ''}`}><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials(otherName)}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className={`truncate text-sm ${message.read || message.senderUserId === user?.id ? 'font-medium text-slate-700' : 'font-bold text-slate-950'}`}>{otherName}</p><span className="flex-shrink-0 text-xs text-slate-400">{timestamp(message.timestamp)}</span></div><p className="mt-1 truncate text-sm font-medium text-slate-900">{message.subject || 'Ei aihetta'}</p><p className="mt-1 line-clamp-2 text-sm text-slate-500">{message.content}</p></div>{!message.read && message.recipientUserId === user?.id && <span className="mt-2 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-orange-500" />}</button>;
        })}{!loading && items.length === 0 && <div className="p-12 text-center"><MessageSquare size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei viestejä</p></div>}</CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-5">{selectedMessage ? <div className="space-y-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-slate-500">{selectedMessage.sender} → {selectedMessage.recipient}</p><h2 className="mt-1 text-lg font-semibold text-slate-950">{selectedMessage.subject || 'Ei aihetta'}</h2><p className="text-xs text-slate-400">{timestamp(selectedMessage.timestamp)}</p></div>{selectedMessage.senderUserId === user?.id && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteMessage(selectedMessage)}><Trash2 size={15} /></Button>}</div><div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">{selectedMessage.content}</div></div> : <div className="flex min-h-52 flex-col items-center justify-center text-center text-slate-500"><UserRound size={38} className="mb-3 text-slate-300" /><p>Valitse viesti luettavaksi.</p></div>}</CardContent></Card>
      </div>
    );
  }
}
