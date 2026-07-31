import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, MessageCircle, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import {
  loadAccessibleProjectConversations,
  type ProjectConversationSummary,
} from '@/lib/supabase/projectCollaboration';

function dateTime(value: string | null) {
  if (!value) return 'Ei vielä viestejä';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

export default function ProjectDiscussions() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const [projects, setProjects] = useState<ProjectConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      setProjects(await loadAccessibleProjectConversations(currentOrg.id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Keskustelujen lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">Projektiviestintä</p>
            <h1 className="text-3xl font-bold">Projektikeskustelut</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Kaikki projektiin liittyvä keskustelu pysyy oikean projektin, osallistujien ja käyttöoikeuksien yhteydessä.</p>
          </div>
          <Button variant="outline" className="border-slate-600 bg-white/5 text-white hover:bg-white/10" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'mr-2 animate-spin' : 'mr-2'} /> Päivitä
          </Button>
        </div>
      </section>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5" />{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {projects.map((project) => (
          <button key={project.projectId} type="button" onClick={() => navigate(`/projektikeskustelut/${project.projectId}`)} className="text-left">
            <Card className="h-full border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><MessageCircle size={21} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="min-w-0 flex-1 break-words text-lg font-semibold text-slate-950">{project.projectName}</h2>
                      {project.unreadCount > 0 && <Badge className="bg-indigo-600 text-white">{project.unreadCount} uutta</Badge>}
                    </div>
                    <p className="mt-1 break-words text-sm text-slate-500">{project.location || 'Sijaintia ei ole määritetty'} · {project.status}</p>
                    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span>{dateTime(project.lastMessageAt)}</span>
                      <span className="flex items-center gap-1 font-medium text-indigo-700">Avaa keskustelu <ChevronRight size={15} /></span>
                    </div>
                    {project.canUseInternal && <p className="mt-3 text-xs text-slate-400">Sisäinen ja tilaajalle jaettu kanava käytettävissä</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {!loading && projects.length === 0 && (
        <EmptyState
          icon={MessageCircle}
          title="Ei keskusteltavia projekteja"
          description="Projektit näkyvät täällä, kun käyttäjä on liitetty projektitiimiin tai tilaaja-asiakkuuteen. Työnjohto voi lisätä jäsenet Projektit → Tiimi."
          action={
            <Button variant="outline" onClick={() => navigate('/projektit')}>
              Avaa projektit
            </Button>
          }
        />
      )}
    </div>
  );
}
