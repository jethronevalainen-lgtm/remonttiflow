import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  AtSign,
  FileText,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Paperclip,
  Pencil,
  Reply,
  Send,
  Settings2,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import {
  createProjectMessageAttachmentUrl,
  deleteProjectMessage,
  editProjectMessage,
  loadProjectConversationContext,
  loadProjectConversationParticipants,
  loadProjectMessages,
  markProjectMessagesRead,
  sendProjectMessage,
  subscribeProjectMessages,
  uploadProjectMessageAttachments,
  type ProjectConversationContext,
  type ProjectConversationParticipant,
  type ProjectMessage,
  type ProjectMessageAttachment,
  type ProjectMessageChannel,
} from '@/lib/supabase/projectCollaboration';

function dateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} t`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kt`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mt`;
}

function AttachmentView({ attachment, own }: { attachment: ProjectMessageAttachment; own: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const image = attachment.mimeType.startsWith('image/');

  useEffect(() => {
    let cancelled = false;
    void createProjectMessageAttachmentUrl(attachment.storagePath)
      .then((nextUrl) => { if (!cancelled) setUrl(nextUrl); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [attachment.storagePath]);

  if (image && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-black/10 bg-black/5">
        <img src={url} alt={attachment.fileName} className="max-h-64 w-full object-cover" />
        <span className={`flex items-center justify-between gap-3 px-3 py-2 text-xs ${own ? 'text-indigo-100' : 'text-slate-600'}`}>
          <span className="min-w-0 truncate">{attachment.fileName}</span><span>{fileSize(attachment.sizeBytes)}</span>
        </span>
      </a>
    );
  }

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      aria-disabled={!url}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${own ? 'border-indigo-400 bg-indigo-500/40 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'} ${!url ? 'pointer-events-none opacity-70' : ''}`}
    >
      {image ? <ImageIcon size={18} /> : <FileText size={18} />}
      <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
      <span className="shrink-0 text-xs">{failed ? 'Ei saatavilla' : fileSize(attachment.sizeBytes)}</span>
    </a>
  );
}

export default function ProjectConversation() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { effectiveRole } = useViewAs();
  const [context, setContext] = useState<ProjectConversationContext | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [participants, setParticipants] = useState<ProjectConversationParticipant[]>([]);
  const [channel, setChannel] = useState<ProjectMessageChannel>('shared');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<ProjectMessage | null>(null);
  const [editing, setEditing] = useState<ProjectMessage | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editMentionedUserIds, setEditMentionedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const canUseInternal = Boolean(context?.canUseInternal && effectiveRole !== 'customer');
  const mentionableParticipants = useMemo(
    () => participants.filter((participant) => channel === 'shared' || participant.canUseInternal),
    [channel, participants],
  );

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      const nextContext = await loadProjectConversationContext(projectId);
      const selectedChannel = channel === 'internal' && !nextContext.canUseInternal ? 'shared' : channel;
      const [nextMessages, nextParticipants] = await Promise.all([
        loadProjectMessages(projectId, selectedChannel),
        loadProjectConversationParticipants(projectId),
      ]);
      setContext(nextContext);
      setParticipants(nextParticipants);
      setMessages(nextMessages);
      setError(null);
      await markProjectMessagesRead(projectId, selectedChannel);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Keskustelun lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [channel, projectId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!projectId) return undefined;
    return subscribeProjectMessages(projectId, () => { void refresh(); });
  }, [projectId, refresh]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    if (channel === 'internal' && !canUseInternal) setChannel('shared');
    setMentionedUserIds([]);
    setReplyingTo(null);
  }, [canUseInternal, channel]);

  const toggleMention = (participant: ProjectConversationParticipant, editingMessage = false) => {
    const setter = editingMessage ? setEditMentionedUserIds : setMentionedUserIds;
    setter((current) => current.includes(participant.userId)
      ? current.filter((id) => id !== participant.userId)
      : [...current, participant.userId]);
    if (!editingMessage && !body.includes(`@${participant.displayName}`)) {
      setBody((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}@${participant.displayName} `);
    }
  };

  const chooseFiles = (selected: FileList | null) => {
    if (!selected) return;
    const next = Array.from(selected);
    if (next.length > 5) {
      setError('Yhteen viestiin voi lisätä enintään viisi liitettä.');
      return;
    }
    const oversized = next.find((file) => file.size > 10 * 1024 * 1024);
    if (oversized) {
      setError(`${oversized.name}: tiedosto ylittää 10 Mt kokorajan.`);
      return;
    }
    setFiles(next);
    setError(null);
  };

  const send = async () => {
    const content = body.trim() || (files.length ? 'Liite' : '');
    if (!projectId || !currentOrg || !content) return;
    setSending(true);
    setError(null);
    try {
      const messageId = await sendProjectMessage(projectId, channel, content, {
        replyToId: replyingTo?.id,
        mentionedUserIds,
      });
      if (files.length) {
        await uploadProjectMessageAttachments({
          organizationId: currentOrg.id,
          projectId,
          messageId,
          files,
        });
      }
      setBody('');
      setFiles([]);
      setMentionedUserIds([]);
      setReplyingTo(null);
      if (fileRef.current) fileRef.current.value = '';
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Viestin lähetys epäonnistui.');
    } finally {
      setSending(false);
    }
  };

  const startEditing = (message: ProjectMessage) => {
    setEditing(message);
    setEditBody(message.body);
    setEditMentionedUserIds(message.mentionedUserIds);
  };

  const saveEdit = async () => {
    if (!editing || editBody.trim().length < 1) return;
    setSending(true);
    try {
      await editProjectMessage(editing.id, editBody.trim(), editMentionedUserIds);
      setEditing(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Viestin muokkaus epäonnistui.');
    } finally {
      setSending(false);
    }
  };

  const removeMessage = async (message: ProjectMessage) => {
    if (!window.confirm('Poistetaanko viesti projektikeskustelusta?')) return;
    setSending(true);
    try {
      await deleteProjectMessage(message.id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Viestin poisto epäonnistui.');
    } finally {
      setSending(false);
    }
  };

  if (!projectId) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-lg sm:p-7">
        <Button variant="ghost" className="mb-4 gap-2 text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => navigate('/projektikeskustelut')}><ArrowLeft size={16} /> Keskustelut</Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2"><Badge className="border-slate-600 bg-slate-800 text-slate-100">{context?.status || 'Ladataan'}</Badge>{context?.location && <span className="text-sm text-slate-300">{context.location}</span>}</div>
            <h1 className="text-2xl font-bold sm:text-3xl">{context?.projectName || 'Projektikeskustelu'}</h1>
            <p className="mt-2 text-sm text-slate-300">{context?.customerName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {effectiveRole !== 'customer' && (
              <Button variant="outline" className="border-slate-600 bg-white/5 text-white hover:bg-white/10" onClick={() => navigate(`/projektit/${projectId}/tilaajayhteistyo`)}>
                <Settings2 size={16} className="mr-2" /> Tilaajayhteistyö
              </Button>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-300"><MessageCircle size={16} /> Viestit tallentuvat tapahtumahistoriaan</div>
          </div>
        </div>
      </section>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5" />{error}</div>}

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Keskustelu</CardTitle>
            <Tabs value={channel} onValueChange={(value) => setChannel(value as ProjectMessageChannel)}>
              <TabsList>
                <TabsTrigger value="shared" className="gap-2"><UsersRound size={15} /> Jaettu</TabsTrigger>
                {canUseInternal && <TabsTrigger value="internal" className="gap-2"><LockKeyhole size={15} /> Sisäinen</TabsTrigger>}
              </TabsList>
            </Tabs>
          </div>
          <p className="text-xs text-slate-500">{channel === 'shared' ? 'Näkyy tilaajalle ja projektin sisäisille jäsenille.' : 'Näkyy vain organisaation projektiryhmälle.'}</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[56vh] min-h-[360px] space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-5">
            {loading && <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={17} className="animate-spin" />Ladataan viestejä…</div>}
            {!loading && messages.map((message) => {
              const own = message.authorUserId === user?.id;
              return (
                <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                  <div className={`group max-w-[94%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[78%] ${own ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-900'}`}>
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold">{message.authorName}</span><span className={own ? 'text-indigo-200' : 'text-slate-400'}>{dateTime(message.createdAt)}</span>{message.editedAt && <span className={own ? 'text-indigo-200' : 'text-slate-400'}>muokattu</span>}</div>
                    {message.replyToId && message.replyBody && (
                      <div className={`mb-2 rounded-lg border-l-4 px-3 py-2 text-xs ${own ? 'border-indigo-200 bg-indigo-500/40 text-indigo-50' : 'border-indigo-400 bg-indigo-50 text-slate-700'}`}>
                        <p className="font-semibold">Vastaus käyttäjälle {message.replyAuthorName || 'Käyttäjä'}</p>
                        <p className="mt-1 line-clamp-2">{message.replyBody}</p>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                    {message.mentionedNames.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">{message.mentionedNames.map((name) => <Badge key={name} variant="outline" className={own ? 'border-indigo-300 bg-indigo-500/40 text-white' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}>@{name}</Badge>)}</div>
                    )}
                    {message.attachments.length > 0 && <div className="mt-3 grid gap-2">{message.attachments.map((attachment) => <AttachmentView key={attachment.id} attachment={attachment} own={own} />)}</div>}
                    <div className={`mt-2 flex flex-wrap justify-end gap-1 border-t pt-2 ${own ? 'border-indigo-500' : 'border-slate-100'}`}>
                      <Button size="sm" variant="ghost" className={own ? 'h-7 text-indigo-100 hover:bg-indigo-500 hover:text-white' : 'h-7'} onClick={() => setReplyingTo(message)}><Reply size={13} className="mr-1" /> Vastaa</Button>
                      {own && <Button size="sm" variant="ghost" className="h-7 text-indigo-100 hover:bg-indigo-500 hover:text-white" onClick={() => startEditing(message)}><Pencil size={13} className="mr-1" /> Muokkaa</Button>}
                      {own && <Button size="sm" variant="ghost" className="h-7 text-indigo-100 hover:bg-red-500 hover:text-white" onClick={() => void removeMessage(message)}><Trash2 size={13} className="mr-1" /> Poista</Button>}
                    </div>
                  </div>
                </div>
              );
            })}
            {!loading && messages.length === 0 && <div className="py-12 text-center"><MessageCircle size={40} className="mx-auto mb-3 text-slate-300" /><p className="font-medium text-slate-700">Ei vielä viestejä</p><p className="mt-1 text-sm text-slate-500">Aloita projektin keskustelu.</p></div>}
            <div ref={endRef} />
          </div>

          <div className="border-t bg-white p-4 sm:p-5">
            {editing ? (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="mb-3 flex items-center justify-between"><p className="font-semibold text-indigo-950">Muokkaa viestiä</p><Button variant="ghost" size="sm" onClick={() => setEditing(null)}><X size={16} /></Button></div>
                <Textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} rows={4} maxLength={4000} />
                <div className="mt-3 flex flex-wrap gap-2">{mentionableParticipants.filter((participant) => participant.userId !== user?.id).map((participant) => <Button key={participant.userId} type="button" size="sm" variant={editMentionedUserIds.includes(participant.userId) ? 'default' : 'outline'} onClick={() => toggleMention(participant, true)}><AtSign size={13} className="mr-1" />{participant.displayName}</Button>)}</div>
                <div className="mt-3 flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Peruuta</Button><Button onClick={() => void saveEdit()} disabled={sending || !editBody.trim()}>Tallenna</Button></div>
              </div>
            ) : (
              <>
                {replyingTo && <div className="mb-3 flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm"><Reply size={16} className="mt-0.5 text-indigo-600" /><div className="min-w-0 flex-1"><p className="font-semibold text-indigo-950">Vastaat käyttäjälle {replyingTo.authorName}</p><p className="mt-1 line-clamp-2 text-indigo-800">{replyingTo.body}</p></div><Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}><X size={15} /></Button></div>}
                <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={4000} placeholder={channel === 'shared' ? 'Kirjoita viesti projektin osallistujille…' : 'Kirjoita sisäinen viesti projektiryhmälle…'} onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) void send(); }} />
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Paperclip size={14} className="mr-1" /> Lisää liitteitä</Button>
                    <input ref={fileRef} type="file" multiple className="hidden" onChange={(event) => chooseFiles(event.target.files)} accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,.doc,.docx,.xls,.xlsx" />
                    <span className="text-xs text-slate-500">Enintään 5 tiedostoa, 10 Mt/tiedosto</span>
                  </div>
                  {files.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{files.map((file) => <Badge key={`${file.name}-${file.size}`} variant="secondary" className="gap-1"><Paperclip size={12} />{file.name}<button type="button" aria-label={`Poista ${file.name}`} onClick={() => setFiles((current) => current.filter((item) => item !== file))}><X size={12} /></button></Badge>)}</div>}
                  <div className="mt-3 flex flex-wrap gap-2">{mentionableParticipants.filter((participant) => participant.userId !== user?.id).map((participant) => <Button key={participant.userId} type="button" size="sm" variant={mentionedUserIds.includes(participant.userId) ? 'default' : 'outline'} onClick={() => toggleMention(participant)}><AtSign size={13} className="mr-1" />{participant.displayName}</Button>)}</div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-slate-400">Ctrl/⌘ + Enter lähettää</p><Button onClick={() => void send()} disabled={sending || (!body.trim() && files.length === 0)} className="gap-2"><Send size={16} />{sending ? 'Lähetetään…' : 'Lähetä'}</Button></div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
