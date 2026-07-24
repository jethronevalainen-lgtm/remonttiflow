import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  Info,
  Megaphone,
  MessageSquare,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOperationsData } from '@/hooks/useOperationsData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import logger from '@/lib/logger';
import {
  createAnnouncementRecord,
  createMessageRecord,
  deleteAnnouncementRecord,
  deleteMessageRecord,
  updateMessageRecord,
} from '@/lib/supabase/operationsEntities';
import type { Announcement, AnnouncementPriority, Message } from '@/types';

interface MessageForm {
  recipient: string;
  subject: string;
  content: string;
}

interface AnnouncementForm {
  title: string;
  content: string;
  priority: AnnouncementPriority;
}

const emptyMessage: MessageForm = { recipient: '', subject: '', content: '' };
const emptyAnnouncement: AnnouncementForm = { title: '', content: '', priority: 'Normaali' };
const ANNOUNCEMENT_PRIORITIES: AnnouncementPriority[] = ['Info', 'Normaali', 'Tärkeä'];

function timestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fi-FI');
}

function priorityBadge(priority: AnnouncementPriority) {
  const classes: Record<AnnouncementPriority, string> = {
    Info: 'bg-blue-50 text-blue-700',
    Normaali: 'bg-slate-100 text-slate-700',
    Tärkeä: 'bg-red-50 text-red-700',
  };
  return <Badge className={`border-0 ${classes[priority]}`}>{priority}</Badge>;
}

export default function Viestinta() {
  const { user, profile } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const { messages, announcements, loading, error, refresh } = useOperationsData();
  const [activeTab, setActiveTab] = useState('messages');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<Message | null>(null);
  const [deleteAnnouncement, setDeleteAnnouncement] = useState<Announcement | null>(null);
  const [messageForm, setMessageForm] = useState<MessageForm>(emptyMessage);
  const [announcementForm, setAnnouncementForm] = useState<AnnouncementForm>(emptyAnnouncement);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const unreadCount = messages.filter((message) => !message.read).length;
  const canManageAnnouncements = currentRole === 'admin' || currentRole === 'supervisor';
  const senderName = profile?.full_name || user?.email || 'Käyttäjä';

  const openMessage = async (message: Message) => {
    setSelectedMessage(message);
    if (!message.read && currentOrg) {
      try {
        await updateMessageRecord(currentOrg.id, message.id, { read: true });
        await refresh();
      } catch (caught) {
        logger.error('Viestin lukutilan päivittäminen epäonnistui', { error: caught });
      }
    }
  };

  const openMessageCreate = () => {
    setMessageForm(emptyMessage);
    setFormErrors([]);
    setOperationError(null);
    setMessageDialogOpen(true);
  };

  const sendMessage = async () => {
    const nextErrors: string[] = [];
    if (!messageForm.recipient.trim()) nextErrors.push('Vastaanottaja on pakollinen.');
    if (!messageForm.content.trim()) nextErrors.push('Viestin sisältö on pakollinen.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg) return;

    const payload: Omit<Message, 'id'> = {
      sender: senderName,
      recipient: messageForm.recipient.trim(),
      subject: messageForm.subject.trim() || undefined,
      content: messageForm.content.trim(),
      timestamp: new Date().toISOString(),
      read: false,
    };

    setSaving(true);
    setOperationError(null);
    try {
      await createMessageRecord(currentOrg.id, user?.id, payload);
      await refresh();
      setMessageDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Viestin lähettäminen epäonnistui.';
      setOperationError(message);
      logger.error('Viestin lähettäminen epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const openAnnouncementCreate = () => {
    setAnnouncementForm(emptyAnnouncement);
    setFormErrors([]);
    setOperationError(null);
    setAnnouncementDialogOpen(true);
  };

  const publishAnnouncement = async () => {
    const nextErrors: string[] = [];
    if (!announcementForm.title.trim()) nextErrors.push('Tiedotteen otsikko on pakollinen.');
    if (!announcementForm.content.trim()) nextErrors.push('Tiedotteen sisältö on pakollinen.');
    setFormErrors(nextErrors);
    if (nextErrors.length > 0 || !currentOrg || !canManageAnnouncements) return;

    const payload: Omit<Announcement, 'id'> = {
      title: announcementForm.title.trim(),
      content: announcementForm.content.trim(),
      author: senderName,
      date: new Date().toISOString(),
      priority: announcementForm.priority,
    };

    setSaving(true);
    setOperationError(null);
    try {
      await createAnnouncementRecord(currentOrg.id, user?.id, payload);
      await refresh();
      setAnnouncementDialogOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tiedotteen julkaiseminen epäonnistui.';
      setOperationError(message);
      logger.error('Tiedotteen julkaiseminen epäonnistui', { error: caught });
    } finally {
      setSaving(false);
    }
  };

  const removeMessage = async () => {
    if (!deleteMessage || !currentOrg) return;
    setSaving(true);
    try {
      await deleteMessageRecord(currentOrg.id, deleteMessage.id);
      await refresh();
      setDeleteMessage(null);
      if (selectedMessage?.id === deleteMessage.id) setSelectedMessage(null);
    } catch (caught) {
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
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
      setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero text-text-primary">Viestintä</h1>
          <p className="mt-1 text-body-sm text-text-secondary">Organisaation viestit ja tiedotteet</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openMessageCreate} className="gap-2"><Send size={16} /> Uusi viesti</Button>
          {canManageAnnouncements && <Button variant="outline" onClick={openAnnouncementCreate} className="gap-2"><Megaphone size={16} /> Uusi tiedote</Button>}
        </div>
      </div>

      {(error || operationError) && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} />{operationError ?? error}</div>}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="messages" className="gap-2"><MessageSquare size={15} /> Viestit {unreadCount > 0 && <Badge className="h-5 min-w-5 justify-center rounded-full bg-red-500 px-1 text-white">{unreadCount}</Badge>}</TabsTrigger>
          <TabsTrigger value="announcements" className="gap-2"><Megaphone size={15} /> Tiedotteet</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <Card className="overflow-hidden"><CardContent className="p-0">
              {messages.map((message) => (
                <button key={message.id} type="button" onClick={() => void openMessage(message)} className={`flex w-full items-start gap-3 border-b border-slate-100 p-4 text-left transition-colors hover:bg-slate-50 ${selectedMessage?.id === message.id ? 'bg-primary-light' : ''}`}>
                  <div className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${message.read ? 'bg-slate-300' : 'bg-primary'}`} />
                  <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className={`truncate text-sm ${message.read ? 'font-medium text-slate-700' : 'font-bold text-slate-950'}`}>{message.sender} → {message.recipient}</p><span className="flex-shrink-0 text-xs text-text-muted">{timestamp(message.timestamp)}</span></div><p className="mt-1 truncate text-sm font-medium">{message.subject || 'Ei aihetta'}</p><p className="mt-1 line-clamp-2 text-sm text-text-secondary">{message.content}</p></div>
                </button>
              ))}
              {!loading && messages.length === 0 && <div className="p-12 text-center"><MessageSquare size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei viestejä</p></div>}
            </CardContent></Card>

            <Card><CardContent className="p-5">
              {selectedMessage ? <div className="space-y-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-text-secondary">{selectedMessage.sender} → {selectedMessage.recipient}</p><h2 className="mt-1 text-lg font-semibold">{selectedMessage.subject || 'Ei aihetta'}</h2><p className="text-xs text-text-muted">{timestamp(selectedMessage.timestamp)}</p></div><Button variant="ghost" size="sm" className="text-danger" onClick={() => setDeleteMessage(selectedMessage)}><Trash2 size={15} /></Button></div><div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed">{selectedMessage.content}</div></div> : <div className="flex min-h-52 flex-col items-center justify-center text-center text-text-secondary"><MessageSquare size={38} className="mb-3 text-text-muted" /><p>Valitse viesti luettavaksi.</p></div>}
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="announcements" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className={announcement.priority === 'Tärkeä' ? 'border-red-200' : 'border-slate-200'}>
                <CardContent className="space-y-3 p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-lg ${announcement.priority === 'Tärkeä' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{announcement.priority === 'Tärkeä' ? <Bell size={18} /> : <Info size={18} />}</div><div><h2 className="font-semibold text-text-primary">{announcement.title}</h2><p className="text-xs text-text-secondary">{announcement.author || 'VaKantti'} · {timestamp(announcement.date)}</p></div></div>{priorityBadge(announcement.priority)}</div><p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{announcement.content}</p>{canManageAnnouncements && <div className="flex justify-end"><Button variant="ghost" size="sm" className="text-danger" onClick={() => setDeleteAnnouncement(announcement)}><Trash2 size={14} className="mr-1" /> Poista</Button></div>}</CardContent>
              </Card>
            ))}
            {!loading && announcements.length === 0 && <Card className="lg:col-span-2"><CardContent className="p-12 text-center"><Megaphone size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei tiedotteita</p></CardContent></Card>}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Uusi viesti</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="space-y-4"><div className="space-y-2"><Label htmlFor="message-recipient">Vastaanottaja *</Label><Input id="message-recipient" value={messageForm.recipient} onChange={(event) => setMessageForm((previous) => ({ ...previous, recipient: event.target.value }))} placeholder="Henkilö, ryhmä tai Kaikki" /></div><div className="space-y-2"><Label htmlFor="message-subject">Aihe</Label><Input id="message-subject" value={messageForm.subject} onChange={(event) => setMessageForm((previous) => ({ ...previous, subject: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="message-content">Viesti *</Label><Textarea id="message-content" rows={6} value={messageForm.content} onChange={(event) => setMessageForm((previous) => ({ ...previous, content: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setMessageDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void sendMessage()} disabled={saving}>{saving ? 'Lähetetään…' : 'Lähetä'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={announcementDialogOpen} onOpenChange={setAnnouncementDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Uusi tiedote</DialogTitle></DialogHeader>{formErrors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formErrors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="space-y-4"><div className="space-y-2"><Label htmlFor="announcement-title">Otsikko *</Label><Input id="announcement-title" value={announcementForm.title} onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, title: event.target.value }))} /></div><div className="space-y-2"><Label>Prioriteetti</Label><Select value={announcementForm.priority} onValueChange={(value: AnnouncementPriority) => setAnnouncementForm((previous) => ({ ...previous, priority: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ANNOUNCEMENT_PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="announcement-content">Sisältö *</Label><Textarea id="announcement-content" rows={6} value={announcementForm.content} onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, content: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setAnnouncementDialogOpen(false)} disabled={saving}>Peruuta</Button><Button onClick={() => void publishAnnouncement()} disabled={saving}><Plus size={15} className="mr-1" />{saving ? 'Julkaistaan…' : 'Julkaise'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(deleteMessage)} onOpenChange={(open) => !open && setDeleteMessage(null)}><DialogContent><DialogHeader><DialogTitle>Poista viesti</DialogTitle></DialogHeader><p className="text-sm text-text-secondary">Poistetaanko valittu viesti?</p><DialogFooter><Button variant="outline" onClick={() => setDeleteMessage(null)}>Peruuta</Button><Button variant="destructive" onClick={() => void removeMessage()} disabled={saving}>Poista</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(deleteAnnouncement)} onOpenChange={(open) => !open && setDeleteAnnouncement(null)}><DialogContent><DialogHeader><DialogTitle>Poista tiedote</DialogTitle></DialogHeader><p className="text-sm text-text-secondary">Poistetaanko tiedote <strong>{deleteAnnouncement?.title}</strong>?</p><DialogFooter><Button variant="outline" onClick={() => setDeleteAnnouncement(null)}>Peruuta</Button><Button variant="destructive" onClick={() => void removeAnnouncement()} disabled={saving}>Poista</Button></DialogFooter></DialogContent></Dialog>
    </motion.div>
  );
}
