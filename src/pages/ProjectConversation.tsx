import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2, LockKeyhole, MessageCircle, Send, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import {
  loadProjectConversationContext,
  loadProjectMessages,
  markProjectMessagesRead,
  sendProjectMessage,
  subscribeProjectMessages,
  type ProjectConversationContext,
  type ProjectMessage,
  type ProjectMessageChannel,
} from '@/lib/supabase/projectCollaboration';

function dateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

export default function ProjectConversation() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { effectiveRole } = useViewAs();
  const [context, setContext] = useState<ProjectConversationContext | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [channel, setChannel] = useState<ProjectMessageChannel>('shared');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const canUseInternal = Boolean(context?.canUseInternal && effectiveRole !== 'customer');

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      const nextContext = context ?? await loadProjectConversationContext(projectId);
      const selectedChannel = channel === 'internal' && !nextContext.canUseInternal ? 'shared' : channel;
      const nextMessages = await loadProjectMessages(projectId, selectedChannel);
      setContext(nextContext);
      setMessages(nextMessages);
      setError(null);
      await markProjectMessagesRead(projectId, selectedChannel);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Keskustelun lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [channel, context, projectId]);

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
  }, [canUseInternal, channel]);

  const send = async () => {
    const content = body.trim();
    if (!projectId || content.length < 1) return;
    setSending(true);
    setError(null);
    try {
      await sendProjectMessage(projectId, channel, content);
      setBody('');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Viestin lähetys epäonnistui.');
    } finally {
      setSending(false);
    }
  };

  const grouped = useMemo(() => messages, [messages]);

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
          <div className="flex items-center gap-2 text-xs text-slate-300"><MessageCircle size={16} /> Viestit tallentuvat projektin tapahtumahistoriaan</div>
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
          <div className="max-h-[52vh] min-h-[320px] space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-5">
            {loading && <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={17} className="animate-spin" />Ladataan viestejä…</div>}
            {!loading && grouped.map((message) => {
              const own = message.authorUserId === user?.id;
              return (
                <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[72%] ${own ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-900'}`}>
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold">{message.authorName}</span><span className={own ? 'text-indigo-200' : 'text-slate-400'}>{dateTime(message.createdAt)}</span></div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                  </div>
                </div>
              );
            })}
            {!loading && grouped.length === 0 && <div className="py-12 text-center"><MessageCircle size={40} className="mx-auto mb-3 text-slate-300" /><p className="font-medium text-slate-700">Ei vielä viestejä</p><p className="mt-1 text-sm text-slate-500">Aloita projektin keskustelu.</p></div>}
            <div ref={endRef} />
          </div>
          <div className="border-t bg-white p-4 sm:p-5">
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={4000} placeholder={channel === 'shared' ? 'Kirjoita viesti projektin osallistujille…' : 'Kirjoita sisäinen viesti projektiryhmälle…'} onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) void send(); }} />
            <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-slate-400">Ctrl/⌘ + Enter lähettää</p><Button onClick={() => void send()} disabled={sending || !body.trim()} className="gap-2"><Send size={16} />{sending ? 'Lähetetään…' : 'Lähetä'}</Button></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
