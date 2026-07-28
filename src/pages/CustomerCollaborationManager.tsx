import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileImage,
  FileText,
  Loader2,
  MessageCircle,
  Send,
  ShieldCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';

import CustomerPortalInviteDialog from '@/components/admin/CustomerPortalInviteDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  createCustomerDocumentUrl,
  loadManagementProjectChangeOrders,
  loadManagementProjectDocuments,
  setProjectDocumentCustomerVisibility,
  submitChangeOrderToCustomer,
  type CustomerProjectChangeOrder,
  type CustomerProjectDocument,
} from '@/lib/supabase/customerCollaboration';
import {
  loadProjectConversationContext,
  type ProjectConversationContext,
} from '@/lib/supabase/projectCollaboration';

function euro(cents: number) {
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function dateTime(value: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

function decisionBadge(decision: string | null) {
  if (decision === 'Hyväksytty') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (decision === 'Hylätty') return 'border-red-200 bg-red-50 text-red-700';
  if (decision === 'Odottaa') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function CustomerCollaborationManager() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { projects, customers } = useAppDataContext();
  const [context, setContext] = useState<ProjectConversationContext | null>(null);
  const [documents, setDocuments] = useState<CustomerProjectDocument[]>([]);
  const [changeOrders, setChangeOrders] = useState<CustomerProjectChangeOrder[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const project = useMemo(
    () => projects.find((item) => item.id === projectId) ?? null,
    [projectId, projects],
  );
  const customer = useMemo(() => {
    if (!project) return null;
    if (project.customerId) return customers.find((item) => item.id === project.customerId) ?? null;
    return customers.find((item) => item.name === project.customer) ?? null;
  }, [customers, project]);
  const inviteProject = project ? {
    id: project.id,
    name: project.name,
    location: project.location,
    status: project.status,
  } : null;

  const refresh = useCallback(async () => {
    if (!projectId || !currentOrg) return;
    setLoading(true);
    try {
      const [nextContext, nextDocuments, nextChangeOrders] = await Promise.all([
        loadProjectConversationContext(projectId),
        loadManagementProjectDocuments(currentOrg.id, projectId),
        loadManagementProjectChangeOrders(currentOrg.id, projectId),
      ]);
      setContext(nextContext);
      setDocuments(nextDocuments);
      setChangeOrders(nextChangeOrders);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tilaajayhteistyön lataus epäonnistui.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg, projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const toggleDocument = async (document: CustomerProjectDocument) => {
    setSavingId(document.id);
    try {
      await setProjectDocumentCustomerVisibility(document.id, !document.visibleToCustomer);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dokumentin näkyvyyden päivitys epäonnistui.');
    } finally {
      setSavingId(null);
    }
  };

  const openDocument = async (document: CustomerProjectDocument) => {
    try {
      const url = await createCustomerDocumentUrl(document.storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dokumentin avaaminen epäonnistui.');
    }
  };

  const sendChangeOrder = async (changeOrder: CustomerProjectChangeOrder) => {
    setSavingId(changeOrder.id);
    try {
      await submitChangeOrderToCustomer(changeOrder.id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Muutostyön lähetys epäonnistui.');
    } finally {
      setSavingId(null);
    }
  };

  if (!projectId) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-5 text-white shadow-lg sm:p-8">
        <Button variant="ghost" className="mb-4 gap-2 text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => navigate(`/projektit/${projectId}`)}>
          <ArrowLeft size={16} /> Projektityötila
        </Button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="mb-3 border-slate-600 bg-slate-800 text-slate-100">Tilaajayhteistyö</Badge>
            <h1 className="text-3xl font-bold">{context?.projectName || 'Projekti'}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Hallitse projektin tilaajakäyttäjiä, tilaajalle näkyviä dokumentteja, kuvia sekä hyväksyttäviä lisä- ja muutostöitä.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="gap-2 bg-teal-500 text-white hover:bg-teal-600"
              disabled={!customer || !inviteProject || !currentOrg}
              title={!customer ? 'Liitä projekti ensin asiakasrekisterin asiakkaaseen.' : undefined}
              onClick={() => {
                setError(null);
                setSuccessMessage(null);
                setInviteOpen(true);
              }}
            >
              <UserPlus size={16} /> Kutsu tilaaja projektiin
            </Button>
            <Button variant="outline" className="border-slate-600 bg-white/5 text-white hover:bg-white/10" onClick={() => navigate(`/projektikeskustelut/${projectId}`)}>
              <MessageCircle size={16} className="mr-2" /> Projektikeskustelu
            </Button>
          </div>
        </div>
      </section>

      {!customer && !loading && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          Projekti ei ole kytketty asiakasrekisterin asiakkaaseen. Tilaajakutsua ei voi lähettää ennen asiakaskytkentää.
        </div>
      )}
      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} className="mt-0.5" />{error}</div>}
      {successMessage && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5" />{successMessage}</div>}
      {loading && <div className="flex items-center gap-2 rounded-xl border bg-white p-4 text-sm text-slate-500"><Loader2 size={17} className="animate-spin" />Ladataan tilaajayhteistyötä…</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Jaetut dokumentit</p><p className="mt-2 text-3xl font-bold">{documents.filter((item) => item.visibleToCustomer).length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Odottaa tilaajaa</p><p className="mt-2 text-3xl font-bold">{changeOrders.filter((item) => item.customerDecision === 'Odottaa').length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hyväksytyt muutostyöt</p><p className="mt-2 text-3xl font-bold">{changeOrders.filter((item) => item.customerDecision === 'Hyväksytty').length}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
          <TabsTrigger value="documents">Dokumentit ja kuvat ({documents.length})</TabsTrigger>
          <TabsTrigger value="changes">Lisä- ja muutostyöt ({changeOrders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="flex items-start gap-3 p-4 text-sm text-blue-900">
              <ShieldCheck size={19} className="mt-0.5 shrink-0" />
              <p>Vain erikseen tilaajalle jaetut tiedostot näkyvät tilaajaportaalissa. Lisää uusia tiedostoja projektityötilan Dokumentit-välilehdellä ja julkaise ne tästä.</p>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {documents.map((document) => {
              const ImageOrFile = document.mimeType.startsWith('image/') ? FileImage : FileText;
              return (
                <Card key={document.id} className={document.visibleToCustomer ? 'border-emerald-200' : ''}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><ImageOrFile size={19} /></div>
                      <Badge variant="outline" className={document.visibleToCustomer ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}>{document.visibleToCustomer ? 'Näkyy tilaajalle' : 'Sisäinen'}</Badge>
                    </div>
                    <h3 className="mt-4 font-semibold text-slate-950">{document.title}</h3>
                    <p className="mt-1 truncate text-sm text-slate-500">{document.fileName}</p>
                    {document.description && <p className="mt-2 line-clamp-2 text-sm text-slate-700">{document.description}</p>}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => void openDocument(document)}><ExternalLink size={14} className="mr-1" /> Avaa</Button>
                      <Button size="sm" variant={document.visibleToCustomer ? 'outline' : 'default'} disabled={savingId === document.id} onClick={() => void toggleDocument(document)}>
                        {document.visibleToCustomer ? <XCircle size={14} className="mr-1" /> : <CheckCircle2 size={14} className="mr-1" />}
                        {document.visibleToCustomer ? 'Poista jako' : 'Jaa tilaajalle'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {!loading && documents.length === 0 && <Card className="md:col-span-2 xl:col-span-3"><CardContent className="p-12 text-center"><FileText size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Projektilla ei ole dokumentteja</p></CardContent></Card>}
          </div>
        </TabsContent>

        <TabsContent value="changes" className="space-y-3">
          {changeOrders.map((changeOrder) => (
            <Card key={changeOrder.id}>
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-slate-500">{changeOrder.changeNumber || 'Ei tunnusta'}</span><Badge variant="outline" className={decisionBadge(changeOrder.customerDecision)}>{changeOrder.customerDecision || 'Ei lähetetty'}</Badge></div>
                    <h3 className="mt-2 text-lg font-semibold text-slate-950">{changeOrder.title}</h3>
                    {changeOrder.description && <p className="mt-2 text-sm leading-6 text-slate-700">{changeOrder.description}</p>}
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm"><span><strong>Tilaajahinta:</strong> {euro(changeOrder.amountCents)}</span><span><strong>Lähetetty:</strong> {dateTime(changeOrder.submittedToCustomerAt)}</span></div>
                    {changeOrder.customerDecisionNote && <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"><strong>Tilaajan kommentti:</strong> {changeOrder.customerDecisionNote}</div>}
                  </div>
                  <Button className="shrink-0" disabled={savingId === changeOrder.id || changeOrder.customerDecision === 'Odottaa'} onClick={() => void sendChangeOrder(changeOrder)}><Send size={15} className="mr-2" />{changeOrder.customerDecision ? 'Lähetä uudelleen' : 'Lähetä hyväksyttäväksi'}</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!loading && changeOrders.length === 0 && <Card><CardContent className="p-12 text-center"><Send size={44} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold">Ei lisä- tai muutostöitä</p><p className="mt-1 text-sm text-slate-500">Luo muutostyö projektityötilassa.</p></CardContent></Card>}
        </TabsContent>
      </Tabs>

      <CustomerPortalInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        organizationId={currentOrg?.id ?? null}
        customer={customer ? { id: customer.id, name: customer.name } : null}
        projects={inviteProject ? [inviteProject] : []}
        fixedProject={inviteProject}
        allowPersistent={false}
        onInvited={(message) => {
          setSuccessMessage(message);
          setInviteOpen(false);
        }}
      />
    </div>
  );
}
